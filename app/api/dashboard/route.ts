import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AgingBucket, DashboardResponse, RecentAction, SalespersonOutstanding } from "@/types/dashboard";

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
  amount: DecimalLike;
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

export async function GET() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [partiesResult, actionsThisMonthResult, paymentsThisMonthResult, recoveryTargetsThisMonthResult, recentActionsResult, syncLog] =
      await Promise.all([
      prisma.party.findMany({
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
      }),
      prisma.action.findMany({
        where: {
          completedAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        select: {
          amountRecovered: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          paymentDate: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        select: {
          amount: true,
        },
      }),
      prisma.recoveryTarget.findMany({
        where: {
          weekStart: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        select: {
          targetAmount: true,
        },
      }),
      prisma.action.findMany({
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
      }),
      prisma.syncLog.findFirst({
        orderBy: {
          syncedAt: "desc",
        },
        select: {
          syncedAt: true,
        },
      }),
      ]);

    const parties = partiesResult as PartyRow[];
    const actionsThisMonth = actionsThisMonthResult as ActionMonthRow[];
    const paymentsThisMonth = paymentsThisMonthResult as PaymentMonthRow[];
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
    const bucketsMap = new Map<AgingBucket["bucket"], AgingBucket>(
      DEFAULT_BUCKETS.map((bucket) => [bucket.bucket, { ...bucket }])
    );

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

    const lastSyncedAt =
      syncLog?.syncedAt ??
      parties.reduce<Date | null>((latest, party) => {
        if (!latest) return party.lastSyncedAt;
        return party.lastSyncedAt > latest ? party.lastSyncedAt : latest;
      }, null);

    const payload: DashboardResponse = {
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
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to build dashboard metrics", error);
    return NextResponse.json({ message: "Unable to load dashboard metrics" }, { status: 500 });
  }
}
