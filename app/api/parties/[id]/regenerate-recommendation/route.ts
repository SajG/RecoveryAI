import { NextResponse } from "next/server";
import { generatePartyRecommendation } from "@/lib/claude";
import { prisma } from "@/lib/prisma";

type DecimalLike = { toNumber: () => number };

function toNumber(value: DecimalLike | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export async function POST(_: Request, context: { params: { id: string } }) {
  try {
    const partyId = context.params.id;
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      include: {
        salesperson: {
          select: { name: true },
        },
      },
    });

    if (!party) {
      return NextResponse.json({ message: "Party not found" }, { status: 404 });
    }

    const [payments, actions, invoices] = await Promise.all([
      prisma.payment.findMany({
        where: { partyId },
        orderBy: { paymentDate: "desc" },
        select: { paymentDate: true, amount: true, method: true },
      }),
      prisma.action.findMany({
        where: { partyId },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true, actionType: true, outcome: true, notes: true },
      }),
      prisma.invoice.findMany({
        where: { partyId },
        orderBy: { overdueDays: "desc" },
        select: { invoiceDate: true, overdueDays: true },
      }),
    ]);

    const recommendation = await generatePartyRecommendation(
      {
        name: party.name,
        address: party.address,
        salesperson: { name: party.salesperson.name },
        outstanding: toNumber(party.outstanding),
        daysSinceLastPayment: party.daysSinceLastPayment,
        daysOverdue: party.daysOverdue,
      },
      {
        payments: payments.map((payment: (typeof payments)[number]) => ({
          paymentDate: payment.paymentDate.toISOString().split("T")[0],
          amount: toNumber(payment.amount),
          method: payment.method,
        })),
        actions: actions.map((action: (typeof actions)[number]) => ({
          completedAt: action.completedAt ? action.completedAt.toISOString().split("T")[0] : "N/A",
          actionType: action.actionType,
          outcome: action.outcome,
          notes: action.notes,
        })),
        invoices: invoices.map((invoice: (typeof invoices)[number]) => ({
          invoiceDate: invoice.invoiceDate.toISOString().split("T")[0],
          overdueDays: invoice.overdueDays,
        })),
      }
    );

    const updatedParty = await prisma.party.update({
      where: { id: partyId },
      data: {
        aiRecommendation: recommendation.recommendation,
        aiActions: recommendation.suggestedActions,
        riskScore: recommendation.riskScore,
        redFlags: recommendation.redFlags,
        recommendationDate: new Date(),
      },
      select: {
        aiRecommendation: true,
        aiActions: true,
        riskScore: true,
        redFlags: true,
        recommendationDate: true,
      },
    });

    return NextResponse.json({
      ...updatedParty,
      estimatedRecoveryPercent: recommendation.estimatedRecoveryPercent,
    });
  } catch (error) {
    console.error("Failed to regenerate recommendation", error);
    return NextResponse.json({ message: "Unable to regenerate recommendation" }, { status: 500 });
  }
}
