import { PaymentMethod, Prisma } from "@/lib/generated/prisma/client";
import { generatePartyRecommendation } from "@/lib/claude";
import { prisma } from "@/lib/prisma";
import { getPriority } from "@/lib/rules";
import type { BridgePayload } from "@/lib/validation";

type SyncStats = {
  salespeople: number;
  parties: number;
  invoices: number;
  payments: number;
  newCritical: number;
  durationMs: number;
};

type PartyMetrics = {
  priority: "Critical" | "High" | "Medium" | "Low";
  daysOverdue: number;
  daysSinceLastPayment: number;
};

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function dateDiffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function normalizePaymentMethod(method: string): PaymentMethod {
  const value = method.toLowerCase();
  if (value.includes("cash")) return PaymentMethod.Cash;
  if (value.includes("chq") || value.includes("cheque") || value.includes("check")) return PaymentMethod.Cheque;
  if (value.includes("upi")) return PaymentMethod.UPI;
  if (value.includes("rtgs")) return PaymentMethod.RTGS;
  if (value.includes("neft")) return PaymentMethod.NEFT;
  return PaymentMethod.Cash;
}

export function computePartyMetrics(party: BridgePayload["salespeople"][number]["parties"][number]): PartyMetrics {
  const now = new Date();
  const maxOverdue = party.invoices.reduce((acc, invoice) => Math.max(acc, invoice.overdueDays), 0);
  const maxOverdueFromDueDate = party.invoices.reduce((acc, invoice) => {
    const dueDate = parseDateOnly(invoice.dueDate);
    return Math.max(acc, dateDiffDays(dueDate, now));
  }, 0);
  const daysOverdue = Math.max(maxOverdue, maxOverdueFromDueDate);

  const latestPayment = party.payments.reduce<Date | null>((latest, payment) => {
    const paymentDate = parseDateOnly(payment.date);
    if (!latest || paymentDate > latest) return paymentDate;
    return latest;
  }, null);
  const daysSinceLastPayment = latestPayment ? dateDiffDays(latestPayment, now) : daysOverdue;

  return {
    priority: getPriority(party.outstanding, daysOverdue),
    daysOverdue,
    daysSinceLastPayment,
  };
}

export function detectNewCriticalParties(
  beforePriorityByPartyId: Map<string, string>,
  afterPriorityByPartyId: Map<string, string>
): string[] {
  const newlyCritical: string[] = [];
  for (const [partyId, afterPriority] of afterPriorityByPartyId) {
    const beforePriority = beforePriorityByPartyId.get(partyId);
    if (afterPriority === "Critical" && beforePriority !== "Critical") {
      newlyCritical.push(partyId);
    }
  }
  return newlyCritical;
}

async function regenerateTopCriticalRecommendations(topPartyIds: string[]) {
  if (topPartyIds.length === 0) return;
  for (const partyId of topPartyIds) {
    try {
      const party = await prisma.party.findUnique({
        where: { id: partyId },
        include: {
          salesperson: { select: { name: true } },
          payments: { orderBy: { paymentDate: "desc" }, take: 5 },
          actions: { orderBy: { completedAt: "desc" }, take: 5 },
          invoices: { orderBy: { overdueDays: "desc" }, take: 5 },
        },
      });
      if (!party) continue;
      const recommendation = await generatePartyRecommendation(
        {
          name: party.name,
          address: party.address,
          salesperson: { name: party.salesperson.name },
          outstanding: Number(party.outstanding),
          daysSinceLastPayment: party.daysSinceLastPayment,
          daysOverdue: party.daysOverdue,
        },
        {
          payments: party.payments.map((payment) => ({
            paymentDate: payment.paymentDate,
            amount: Number(payment.amount),
            method: payment.method,
          })),
          actions: party.actions.map((action) => ({
            completedAt: action.completedAt,
            actionType: action.actionType,
            outcome: action.outcome,
            notes: action.notes,
          })),
          invoices: party.invoices.map((invoice) => ({
            invoiceDate: invoice.invoiceDate,
            overdueDays: invoice.overdueDays,
          })),
        }
      );

      await prisma.party.update({
        where: { id: party.id },
        data: {
          aiRecommendation: recommendation.recommendation,
          aiActions: recommendation.suggestedActions as unknown as Prisma.InputJsonValue,
          riskScore: recommendation.riskScore,
          redFlags: recommendation.redFlags,
          recommendationDate: new Date(),
        },
      });
    } catch (error) {
      console.error(`AI regeneration failed for party ${partyId}`, error);
    }
  }
}

export async function processBridgePayload(payload: BridgePayload): Promise<SyncStats> {
  const startedAt = Date.now();
  const beforeRows = await prisma.party.findMany({
    where: { name: { in: payload.salespeople.flatMap((sp) => sp.parties.map((party) => party.name)) } },
    select: { id: true, priority: true, name: true },
  });
  const beforeByPartyId = new Map(beforeRows.map((row) => [row.id, row.priority]));

  const stats = {
    salespeople: 0,
    parties: 0,
    invoices: 0,
    payments: 0,
  };

  const afterByPartyId = new Map<string, string>();

  for (const salespersonInput of payload.salespeople) {
    const salesperson = await prisma.salesperson.upsert({
      where: { name: salespersonInput.name },
      update: { tallyGroup: salespersonInput.tallyGroup, active: true },
      create: {
        name: salespersonInput.name,
        tallyGroup: salespersonInput.tallyGroup,
        phone: "-",
        email: "-",
        active: true,
      },
    });
    stats.salespeople += 1;
    const syncedPartyNames = new Set<string>();

    for (const partyInput of salespersonInput.parties) {
      syncedPartyNames.add(partyInput.name);
      const metrics = computePartyMetrics(partyInput);
      const party = await prisma.party.upsert({
        where: { name: partyInput.name },
        update: {
          salespersonId: salesperson.id,
          outstanding: partyInput.outstanding,
          phone: partyInput.phone || "-",
          email: partyInput.email || "-",
          address: partyInput.address || "-",
          priority: metrics.priority,
          daysSinceLastPayment: metrics.daysSinceLastPayment,
          daysOverdue: metrics.daysOverdue,
          lastSyncedAt: new Date(),
        },
        create: {
          name: partyInput.name,
          salespersonId: salesperson.id,
          outstanding: partyInput.outstanding,
          phone: partyInput.phone || "-",
          email: partyInput.email || "-",
          address: partyInput.address || "-",
          priority: metrics.priority,
          daysSinceLastPayment: metrics.daysSinceLastPayment,
          daysOverdue: metrics.daysOverdue,
          lastSyncedAt: new Date(),
        },
        select: { id: true },
      });
      stats.parties += 1;
      afterByPartyId.set(party.id, metrics.priority);

      await prisma.invoice.deleteMany({ where: { partyId: party.id } });
      if (partyInput.invoices.length > 0) {
        await prisma.invoice.createMany({
          data: partyInput.invoices.map((invoice) => ({
            partyId: party.id,
            invoiceRef: invoice.ref,
            invoiceDate: parseDateOnly(invoice.date),
            dueDate: parseDateOnly(invoice.dueDate),
            amount: invoice.amount,
            pendingAmount: invoice.pending,
            overdueDays: invoice.overdueDays,
          })),
        });
        stats.invoices += partyInput.invoices.length;
      }

      await prisma.payment.deleteMany({ where: { partyId: party.id } });
      if (partyInput.payments.length > 0) {
        await prisma.payment.createMany({
          data: partyInput.payments.map((payment) => ({
            partyId: party.id,
            paymentDate: parseDateOnly(payment.date),
            amount: payment.amount,
            method: normalizePaymentMethod(payment.method),
            reference: payment.reference,
          })),
        });
        stats.payments += partyInput.payments.length;
      }
    }

    if (syncedPartyNames.size > 0) {
      await prisma.party.deleteMany({
        where: {
          salespersonId: salesperson.id,
          name: { notIn: [...syncedPartyNames] },
        },
      });
    }
  }

  const newlyCritical = detectNewCriticalParties(beforeByPartyId, afterByPartyId);
  const topCritical = await prisma.party.findMany({
    where: { priority: "Critical" },
    orderBy: [{ outstanding: "desc" }, { daysOverdue: "desc" }],
    take: 20,
    select: { id: true },
  });
  void regenerateTopCriticalRecommendations(topCritical.map((party) => party.id));

  return {
    ...stats,
    newCritical: newlyCritical.length,
    durationMs: Date.now() - startedAt,
  };
}
