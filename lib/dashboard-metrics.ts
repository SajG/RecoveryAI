import { prisma } from "@/lib/prisma";
import type {
  AgingBucket,
  AgingMovement,
  CollectionEfficiencyPoint,
  CustomerPaymentBehavior,
  DashboardResponse,
  RecentAction,
  SalespersonCollectionQuality,
  SalespersonOutstanding,
  SlippingInvoice,
} from "@/types/dashboard";

type DecimalLike = { toNumber: () => number };

type PartyRow = {
  id: string;
  name: string;
  outstanding: DecimalLike;
  daysOverdue: number;
  lastSyncedAt: Date;
  salesperson: {
    name: string;
  };
};

type ActionMonthRow = {
  amountRecovered: DecimalLike | null;
};

type RecoveryTargetRow = {
  targetAmount: DecimalLike;
};

type PaymentMonthRow = {
  id: string;
  partyId: string;
  amount: DecimalLike;
  paymentDate: Date;
  method: "Cash" | "Cheque" | "UPI" | "RTGS" | "NEFT";
  party: {
    name: string;
    salesperson: {
      name: string;
    };
  };
};

type InvoiceRow = {
  id: string;
  partyId: string;
  invoiceRef: string;
  dueDate: Date;
  amount: DecimalLike;
  pendingAmount: DecimalLike;
  overdueDays: number;
  party: {
    id: string;
    name: string;
    salesperson: {
      name: string;
    };
  };
};

type RecentActionRow = {
  id: string;
  partyId: string;
  actionType: string;
  notes: string;
  completedAt: Date | null;
  party: {
    name: string;
    salesperson: {
      name: string;
    };
  };
};

const DEFAULT_BUCKETS: AgingBucket[] = [
  { bucket: "0-30 days", count: 0, amount: 0 },
  { bucket: "31-60 days", count: 0, amount: 0 },
  { bucket: "61-90 days", count: 0, amount: 0 },
  { bucket: "91-180 days", count: 0, amount: 0 },
  { bucket: "180+ days", count: 0, amount: 0 },
];

const CRITICAL_PARTY_MIN_OUTSTANDING = 100_000;
const CRITICAL_PARTY_MIN_OVERDUE_DAYS = 100;
const CRITICAL_PARTY_MAX_OVERDUE_DAYS = 1_000;
const CRITICAL_PARTIES_LIMIT = 10;

function getAgingBucket(daysOverdue: number): AgingBucket["bucket"] {
  if (daysOverdue <= 30) return "0-30 days";
  if (daysOverdue <= 60) return "31-60 days";
  if (daysOverdue <= 90) return "61-90 days";
  if (daysOverdue <= 180) return "91-180 days";
  return "180+ days";
}

function toNumber(value: DecimalLike | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

function calculateCashFlowHealthScore(params: {
  totalOutstanding: number;
  overdue90Plus: number;
  recoveredThisMonth: number;
  monthlyTarget: number;
  recentActionsCount: number;
}): number {
  const { totalOutstanding, overdue90Plus, recoveredThisMonth, monthlyTarget, recentActionsCount } = params;

  const recoveryScore =
    monthlyTarget > 0 ? Math.min((recoveredThisMonth / monthlyTarget) * 100, 100) : recoveredThisMonth > 0 ? 75 : 0;
  const overdueRatio = totalOutstanding > 0 ? overdue90Plus / totalOutstanding : 0;
  const overdueScore = Math.max(0, 100 - overdueRatio * 120);
  const activityScore = Math.min((recentActionsCount / 10) * 100, 100);

  const weighted = recoveryScore * 0.45 + overdueScore * 0.4 + activityScore * 0.15;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(date);
}

function getCollectionEfficiencyTrend(invoices: InvoiceRow[], payments: PaymentMonthRow[], months = 6): CollectionEfficiencyPoint[] {
  const monthStarts: Date[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }

  const points = monthStarts.map((monthStart) => {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const dues = invoices
      .filter((invoice) => invoice.dueDate >= monthStart && invoice.dueDate < monthEnd)
      .reduce((sum, invoice) => sum + toNumber(invoice.amount), 0);
    const collected = payments
      .filter((payment) => payment.paymentDate >= monthStart && payment.paymentDate < monthEnd)
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    const efficiencyPct = dues > 0 ? Math.min((collected / dues) * 100, 999) : collected > 0 ? 100 : 0;
    return {
      monthKey: getMonthKey(monthStart),
      label: getMonthLabel(monthStart),
      dues,
      payments: collected,
      efficiencyPct: Number(efficiencyPct.toFixed(1)),
    };
  });

  return points;
}

function getPaymentBehaviorByCustomer(payments: PaymentMonthRow[]): CustomerPaymentBehavior[] {
  const byParty = new Map<string, PaymentMonthRow[]>();
  for (const payment of payments) {
    const existing = byParty.get(payment.partyId) ?? [];
    existing.push(payment);
    byParty.set(payment.partyId, existing);
  }

  const behaviors: CustomerPaymentBehavior[] = [];
  for (const [partyId, partyPayments] of byParty) {
    const sorted = [...partyPayments].sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime());
    const paymentCount = sorted.length;
    const totalPaid = sorted.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const avgPaymentAmount = paymentCount > 0 ? totalPaid / paymentCount : 0;
    let gapDays: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const diffMs = sorted[i].paymentDate.getTime() - sorted[i - 1].paymentDate.getTime();
      gapDays.push(Math.max(0, Math.round(diffMs / 86_400_000)));
    }
    const avgGapDays = gapDays.length > 0 ? Number((gapDays.reduce((sum, item) => sum + item, 0) / gapDays.length).toFixed(1)) : null;

    const methodCounts = { cash: 0, cheque: 0, upi: 0, rtgs: 0, neft: 0 };
    for (const payment of sorted) {
      switch (payment.method) {
        case "Cash":
          methodCounts.cash += 1;
          break;
        case "Cheque":
          methodCounts.cheque += 1;
          break;
        case "UPI":
          methodCounts.upi += 1;
          break;
        case "RTGS":
          methodCounts.rtgs += 1;
          break;
        case "NEFT":
          methodCounts.neft += 1;
          break;
      }
    }

    const latest = sorted[sorted.length - 1];
    behaviors.push({
      partyId,
      partyName: latest.party.name,
      salespersonName: latest.party.salesperson.name,
      paymentCount,
      totalPaid,
      avgPaymentAmount,
      avgGapDays,
      lastPaymentDate: latest.paymentDate,
      methodSplit: methodCounts,
    });
  }

  return behaviors.sort((a, b) => {
    if (b.totalPaid !== a.totalPaid) return b.totalPaid - a.totalPaid;
    return b.paymentCount - a.paymentCount;
  });
}

function getNextBucket(currentBucket: AgingBucket["bucket"]): AgingBucket["bucket"] | null {
  if (currentBucket === "0-30 days") return "31-60 days";
  if (currentBucket === "31-60 days") return "61-90 days";
  if (currentBucket === "61-90 days") return "91-180 days";
  if (currentBucket === "91-180 days") return "180+ days";
  return null;
}

function getAgingMovement(invoices: InvoiceRow[]): AgingMovement {
  const transitions = new Map<string, { fromBucket: AgingBucket["bucket"]; toBucket: AgingBucket["bucket"]; invoiceCount: number; amount: number }>();
  const slippingSoon: SlippingInvoice[] = [];
  const slippedRecently: SlippingInvoice[] = [];

  for (const invoice of invoices) {
    const pendingAmount = toNumber(invoice.pendingAmount);
    if (pendingAmount <= 0) continue;
    const currentBucket = getAgingBucket(invoice.overdueDays) as AgingBucket["bucket"];
    const nextBucket = getNextBucket(currentBucket);
    if (!nextBucket) continue;

    let threshold = 30;
    if (currentBucket === "31-60 days") threshold = 60;
    if (currentBucket === "61-90 days") threshold = 90;
    if (currentBucket === "91-180 days") threshold = 180;

    const daysToSlip = threshold - invoice.overdueDays;
    const invoiceSummary: SlippingInvoice = {
      invoiceId: invoice.id,
      invoiceRef: invoice.invoiceRef,
      partyId: invoice.party.id,
      partyName: invoice.party.name,
      salespersonName: invoice.party.salesperson.name,
      pendingAmount,
      currentBucket,
      nextBucket,
      overdueDays: invoice.overdueDays,
      daysToSlip,
    };

    if (daysToSlip >= 0 && daysToSlip <= 7) {
      slippingSoon.push(invoiceSummary);
    }
    if (daysToSlip < 0 && daysToSlip >= -7) {
      slippedRecently.push(invoiceSummary);
      const key = `${currentBucket}->${nextBucket}`;
      const existing = transitions.get(key) ?? { fromBucket: currentBucket, toBucket: nextBucket, invoiceCount: 0, amount: 0 };
      existing.invoiceCount += 1;
      existing.amount += pendingAmount;
      transitions.set(key, existing);
    }
  }

  return {
    slippingSoonCount: slippingSoon.length,
    slippedRecentlyCount: slippedRecently.length,
    slippingSoonAmount: slippingSoon.reduce((sum, item) => sum + item.pendingAmount, 0),
    slippedRecentlyAmount: slippedRecently.reduce((sum, item) => sum + item.pendingAmount, 0),
    topSlippingInvoices: slippingSoon
      .sort((a, b) => {
        if ((a.daysToSlip ?? 999) !== (b.daysToSlip ?? 999)) return (a.daysToSlip ?? 999) - (b.daysToSlip ?? 999);
        return b.pendingAmount - a.pendingAmount;
      })
      .slice(0, 8),
    bucketTransitions: [...transitions.values()].sort((a, b) => b.amount - a.amount),
  };
}

function getSalespersonCollectionQuality(
  parties: PartyRow[],
  currentMonthPayments: PaymentMonthRow[]
): SalespersonCollectionQuality[] {
  const salespersonMap = new Map<string, SalespersonCollectionQuality>();
  const payersBySalesperson = new Map<string, Set<string>>();

  for (const party of parties) {
    const salespersonName = party.salesperson.name;
    const existing =
      salespersonMap.get(salespersonName) ??
      ({
        salespersonName,
        partyCount: 0,
        totalOutstanding: 0,
        recoveredThisMonth: 0,
        collectionVsExposurePct: 0,
        avgOverdueDays: 0,
        payingPartiesThisMonth: 0,
        overdue90PlusCount: 0,
      } satisfies SalespersonCollectionQuality);
    existing.partyCount += 1;
    existing.totalOutstanding += toNumber(party.outstanding);
    existing.avgOverdueDays += party.daysOverdue;
    if (party.daysOverdue > 90) existing.overdue90PlusCount += 1;
    salespersonMap.set(salespersonName, existing);
  }

  for (const payment of currentMonthPayments) {
    const salespersonName = payment.party.salesperson.name;
    const existing = salespersonMap.get(salespersonName);
    if (!existing) continue;
    existing.recoveredThisMonth += toNumber(payment.amount);
    salespersonMap.set(salespersonName, existing);

    const payers = payersBySalesperson.get(salespersonName) ?? new Set<string>();
    payers.add(payment.partyId);
    payersBySalesperson.set(salespersonName, payers);
  }

  return [...salespersonMap.values()]
    .map((item) => {
      const payers = payersBySalesperson.get(item.salespersonName);
      const avgOverdueDays = item.partyCount > 0 ? item.avgOverdueDays / item.partyCount : 0;
      const collectionVsExposurePct = item.totalOutstanding > 0 ? (item.recoveredThisMonth / item.totalOutstanding) * 100 : 0;
      return {
        ...item,
        avgOverdueDays: Number(avgOverdueDays.toFixed(1)),
        collectionVsExposurePct: Number(collectionVsExposurePct.toFixed(1)),
        payingPartiesThisMonth: payers?.size ?? 0,
      };
    })
    .sort((a, b) => b.collectionVsExposurePct - a.collectionVsExposurePct);
}

export async function getDashboardMetrics(): Promise<DashboardResponse> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Use sequential reads to avoid pool timeouts in low-connection environments.
  const partiesResult = await prisma.party.findMany({
    select: {
      id: true,
      name: true,
      outstanding: true,
      daysOverdue: true,
      lastSyncedAt: true,
      salesperson: {
        select: {
          name: true,
        },
      },
    },
  });
  const actionsThisMonthResult = await prisma.action.findMany({
    where: {
      completedAt: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    select: {
      amountRecovered: true,
    },
  });
  const paymentsThisMonthResult = await prisma.payment.findMany({
    where: {
      paymentDate: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    select: {
      id: true,
      partyId: true,
      amount: true,
      paymentDate: true,
      method: true,
      party: {
        select: {
          name: true,
          salesperson: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
  const allPaymentsResult = await prisma.payment.findMany({
    select: {
      id: true,
      partyId: true,
      amount: true,
      paymentDate: true,
      method: true,
      party: {
        select: {
          name: true,
          salesperson: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      paymentDate: "desc",
    },
  });
  const allInvoicesResult = await prisma.invoice.findMany({
    select: {
      id: true,
      partyId: true,
      invoiceRef: true,
      dueDate: true,
      amount: true,
      pendingAmount: true,
      overdueDays: true,
      party: {
        select: {
          id: true,
          name: true,
          salesperson: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
  const recoveryTargetsThisMonthResult = await prisma.recoveryTarget.findMany({
    where: {
      weekStart: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    select: {
      targetAmount: true,
    },
  });
  const recentActionsResult = await prisma.action.findMany({
    where: {
      completedAt: {
        not: null,
      },
    },
    orderBy: {
      completedAt: "desc",
    },
    take: 10,
    select: {
      id: true,
      partyId: true,
      actionType: true,
      notes: true,
      completedAt: true,
      party: {
        select: {
          name: true,
          salesperson: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
  const syncLog = await prisma.syncLog.findFirst({
    orderBy: {
      syncedAt: "desc",
    },
    select: {
      syncedAt: true,
    },
  });

  const parties = partiesResult as PartyRow[];
  const actionsThisMonth = actionsThisMonthResult as ActionMonthRow[];
  const paymentsThisMonth = paymentsThisMonthResult as PaymentMonthRow[];
  const allPayments = allPaymentsResult as PaymentMonthRow[];
  const allInvoices = allInvoicesResult as InvoiceRow[];
  const recoveryTargetsThisMonth = recoveryTargetsThisMonthResult as RecoveryTargetRow[];
  const recentActions = recentActionsResult as RecentActionRow[];

  const totalOutstanding = parties.reduce((sum: number, party: PartyRow) => sum + toNumber(party.outstanding), 0);
  const recoveredFromActionsThisMonth = actionsThisMonth.reduce(
    (sum: number, action: ActionMonthRow) => sum + (action.amountRecovered ? toNumber(action.amountRecovered) : 0),
    0
  );
  const recoveredFromPaymentsThisMonth = paymentsThisMonth.reduce(
    (sum: number, payment: PaymentMonthRow) => sum + toNumber(payment.amount),
    0
  );
  const recoveredThisMonth = recoveredFromActionsThisMonth + recoveredFromPaymentsThisMonth;
  const monthlyTarget = recoveryTargetsThisMonth.reduce(
    (sum: number, target: RecoveryTargetRow) => sum + toNumber(target.targetAmount),
    0
  );

  const overdueParties = parties.filter((party: PartyRow) => party.daysOverdue > 90);
  const overdue90Plus = overdueParties.reduce((sum: number, party: PartyRow) => sum + toNumber(party.outstanding), 0);
  const overdue90PlusCount = overdueParties.length;

  const salespeopleMap = new Map<string, SalespersonOutstanding>();
  const bucketsMap = new Map<AgingBucket["bucket"], AgingBucket>(DEFAULT_BUCKETS.map((bucket) => [bucket.bucket, { ...bucket }]));

  for (const party of parties) {
    const salespersonName = party.salesperson.name;
    const outstanding = toNumber(party.outstanding);

    if (!salespeopleMap.has(salespersonName)) {
      salespeopleMap.set(salespersonName, {
        name: salespersonName,
        outstanding: 0,
        partyCount: 0,
        criticalCount: 0,
      });
    }

    const salesperson = salespeopleMap.get(salespersonName);
    if (salesperson) {
      salesperson.outstanding += outstanding;
      salesperson.partyCount += 1;
      if (party.daysOverdue > 90) {
        salesperson.criticalCount += 1;
      }
    }

    const bucketKey = getAgingBucket(party.daysOverdue);
    const bucket = bucketsMap.get(bucketKey);
    if (bucket) {
      bucket.count += 1;
      bucket.amount += outstanding;
    }
  }

  const salespersonOutstanding = [...salespeopleMap.values()].sort((a, b) => b.outstanding - a.outstanding);
  const agingBuckets = DEFAULT_BUCKETS.map((bucket) => bucketsMap.get(bucket.bucket) ?? bucket);

  const topCriticalParties = parties
    .filter((party: PartyRow) => {
      const outstanding = toNumber(party.outstanding);
      return (
        party.daysOverdue >= CRITICAL_PARTY_MIN_OVERDUE_DAYS &&
        party.daysOverdue <= CRITICAL_PARTY_MAX_OVERDUE_DAYS &&
        outstanding >= CRITICAL_PARTY_MIN_OUTSTANDING
      );
    })
    .sort((a: PartyRow, b: PartyRow) => {
      const outstandingGap = toNumber(b.outstanding) - toNumber(a.outstanding);
      if (outstandingGap !== 0) {
        return outstandingGap;
      }
      return b.daysOverdue - a.daysOverdue;
    })
    .slice(0, CRITICAL_PARTIES_LIMIT)
    .map((party: PartyRow) => ({
      id: party.id,
      name: party.name,
      salespersonName: party.salesperson.name,
      outstanding: toNumber(party.outstanding),
      daysOverdue: party.daysOverdue,
    }));

  const normalizedRecentActions: RecentAction[] = recentActions.map((action: RecentActionRow) => ({
    id: action.id,
    partyId: action.partyId,
    partyName: action.party.name,
    salespersonName: action.party.salesperson.name,
    actionType: action.actionType,
    notes: action.notes,
    completedAt: action.completedAt,
  }));

  const cashFlowHealthScore = calculateCashFlowHealthScore({
    totalOutstanding,
    overdue90Plus,
    recoveredThisMonth,
    monthlyTarget,
    recentActionsCount: normalizedRecentActions.length,
  });
  const collectionEfficiencyTrend = getCollectionEfficiencyTrend(allInvoices, allPayments);
  const paymentBehaviorByCustomer = getPaymentBehaviorByCustomer(allPayments).slice(0, 12);
  const agingMovement = getAgingMovement(allInvoices);
  const salespersonCollectionQuality = getSalespersonCollectionQuality(parties, paymentsThisMonth);

  const lastSyncedAt =
    syncLog?.syncedAt ??
    parties.reduce<Date | null>((latest, party) => {
      if (!latest) return party.lastSyncedAt;
      return party.lastSyncedAt > latest ? party.lastSyncedAt : latest;
    }, null);

  return {
    totalOutstanding,
    recoveredThisMonth,
    monthlyTarget,
    overdue90Plus,
    overdue90PlusCount,
    cashFlowHealthScore,
    salespersonOutstanding,
    agingBuckets,
    recentActions: normalizedRecentActions,
    lastSyncedAt,
    topCriticalParties,
    collectionEfficiencyTrend,
    paymentBehaviorByCustomer,
    agingMovement,
    salespersonCollectionQuality,
  };
}
