import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PartyDetailResponse } from "@/types/party";

type DecimalLike = { toNumber: () => number };

function toNumber(value: DecimalLike | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(date);
}

function buildLast12Months() {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    months.push({ key, label: monthLabel(date) });
  }
  return months;
}

function computeAvgPaymentDelay(invoices: Array<{ dueDate: Date }>, payments: Array<{ paymentDate: Date }>) {
  if (invoices.length === 0 || payments.length === 0) return 0;
  const count = Math.min(invoices.length, payments.length);
  let totalDelay = 0;
  for (let index = 0; index < count; index += 1) {
    const delayMs = payments[index].paymentDate.getTime() - invoices[index].dueDate.getTime();
    const delayDays = Math.floor(delayMs / (1000 * 60 * 60 * 24));
    totalDelay += Math.max(0, delayDays);
  }
  return Math.round(totalDelay / count);
}

function computePartyDSO(totalOutstanding: number, totalInvoiceAmount: number, invoiceCount: number) {
  if (totalOutstanding <= 0 || totalInvoiceAmount <= 0 || invoiceCount <= 0) return 0;
  const avgMonthlySales = totalInvoiceAmount / Math.max(1, Math.min(invoiceCount, 12));
  const dailySales = avgMonthlySales / 30;
  if (dailySales <= 0) return 0;
  return Math.round(totalOutstanding / dailySales);
}

function computePaymentBehaviorScore(params: { daysOverdue: number; avgPaymentDelay: number; daysSinceLastPayment: number }) {
  const { daysOverdue, avgPaymentDelay, daysSinceLastPayment } = params;
  const overduePenalty = Math.min(45, daysOverdue * 0.3);
  const delayPenalty = Math.min(30, avgPaymentDelay * 0.7);
  const inactivityPenalty = Math.min(25, daysSinceLastPayment * 0.25);
  return Math.max(0, Math.round(100 - overduePenalty - delayPenalty - inactivityPenalty));
}

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const { id } = context.params;

    const party = await prisma.party.findUnique({
      where: { id },
      include: {
        salesperson: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    if (!party) {
      return NextResponse.json({ message: "Party not found" }, { status: 404 });
    }

    const [invoicesRaw, paymentsRaw, actionsRaw] = await Promise.all([
      prisma.invoice.findMany({
        where: { partyId: id },
        orderBy: [{ overdueDays: "desc" }, { dueDate: "asc" }],
      }),
      prisma.payment.findMany({
        where: { partyId: id },
        orderBy: { paymentDate: "desc" },
      }),
      prisma.action.findMany({
        where: { partyId: id },
        orderBy: { completedAt: "desc" },
      }),
    ]);

    const invoices = invoicesRaw.map((invoice: (typeof invoicesRaw)[number]) => ({
      ...invoice,
      amount: toNumber(invoice.amount),
      pendingAmount: toNumber(invoice.pendingAmount),
    }));
    const payments = paymentsRaw.map((payment: (typeof paymentsRaw)[number]) => ({
      ...payment,
      amount: toNumber(payment.amount),
    }));
    const actions = actionsRaw.map((action: (typeof actionsRaw)[number]) => ({
      ...action,
      amountCommitted: action.amountCommitted ? toNumber(action.amountCommitted) : null,
      amountRecovered: action.amountRecovered ? toNumber(action.amountRecovered) : null,
    }));

    const aging = {
      current: 0,
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "91-180": 0,
      "180+": 0,
    };

    for (const invoice of invoices) {
      if (invoice.overdueDays <= 0) aging.current += invoice.pendingAmount;
      else if (invoice.overdueDays <= 30) aging["0-30"] += invoice.pendingAmount;
      else if (invoice.overdueDays <= 60) aging["31-60"] += invoice.pendingAmount;
      else if (invoice.overdueDays <= 90) aging["61-90"] += invoice.pendingAmount;
      else if (invoice.overdueDays <= 180) aging["91-180"] += invoice.pendingAmount;
      else aging["180+"] += invoice.pendingAmount;
    }

    const monthTemplate = buildLast12Months();
    const paymentTotals = new Map<string, number>(monthTemplate.map((month) => [month.key, 0]));
    for (const payment of payments) {
      const date = new Date(payment.paymentDate);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      paymentTotals.set(key, (paymentTotals.get(key) ?? 0) + payment.amount);
    }
    const paymentTrend = monthTemplate.map((month) => ({
      month: month.label,
      amount: Number((paymentTotals.get(month.key) ?? 0).toFixed(2)),
    }));

    const avgPaymentDelay = computeAvgPaymentDelay(
      [...invoicesRaw].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
      [...paymentsRaw].sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime())
    );
    const dso = computePartyDSO(
      toNumber(party.outstanding),
      invoices.reduce((sum: number, invoice: (typeof invoices)[number]) => sum + invoice.amount, 0),
      invoices.length
    );
    const paymentBehaviorScore = computePaymentBehaviorScore({
      daysOverdue: party.daysOverdue,
      avgPaymentDelay,
      daysSinceLastPayment: party.daysSinceLastPayment,
    });

    const payload: PartyDetailResponse = {
      party: {
        ...party,
        outstanding: toNumber(party.outstanding),
      },
      invoices,
      payments,
      actions,
      aging,
      paymentTrend,
      metrics: {
        dso,
        paymentBehaviorScore,
        avgPaymentDelay,
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to fetch party details", error);
    return NextResponse.json({ message: "Unable to load party details" }, { status: 500 });
  }
}
