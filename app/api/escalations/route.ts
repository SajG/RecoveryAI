import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DecimalLike = { toNumber: () => number };

function toNumber(value: DecimalLike | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function buildSuggestedEscalation(outstanding: number, daysOverdue: number): string {
  if (daysOverdue >= 180 || outstanding >= 500000) {
    return "Initiate legal notice readiness and schedule a senior escalation call this week.";
  }
  if (daysOverdue >= 90 || outstanding >= 200000) {
    return "Arrange a field visit and secure a signed repayment commitment with dates.";
  }
  return "Continue structured follow-ups with weekly check-ins and documented commitments.";
}

function deriveRiskScore(outstanding: number, daysOverdue: number): number {
  const overdueComponent = Math.min(60, Math.floor(daysOverdue / 3));
  const outstandingComponent = Math.min(40, Math.floor(outstanding / 25000));
  return Math.max(0, Math.min(100, overdueComponent + outstandingComponent));
}

export async function GET() {
  try {
    const now = new Date();
    const parties = await prisma.party.findMany({
      where: {
        AND: [
          { OR: [{ outstanding: { gt: 200000 } }, { daysOverdue: { gt: 90 } }] },
          { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] },
        ],
      },
      include: {
        salesperson: { select: { id: true, name: true } },
        actions: {
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true, notes: true },
        },
      },
      orderBy: [{ outstanding: "desc" }, { daysOverdue: "desc" }],
    });

    const rows = parties.map((party: any) => {
      const lastAction = party.actions[0] ?? null;
      const outstanding = toNumber(party.outstanding);
      const riskScore = deriveRiskScore(outstanding, party.daysOverdue);
      return {
        id: party.id,
        name: party.name,
        salespersonId: party.salesperson.id,
        salespersonName: party.salesperson.name,
        outstanding,
        riskScore,
        daysOverdue: party.daysOverdue,
        lastActionAt: lastAction?.completedAt ?? null,
        lastActionNotes: lastAction?.notes ?? "",
        suggestedEscalation: buildSuggestedEscalation(outstanding, party.daysOverdue),
        escalationDeadline: party.escalationDeadline,
        status: party.escalationStatus,
      };
    });

    const totalAtRisk = rows.reduce((sum: number, row: any) => sum + row.outstanding, 0);
    const avgDaysOverdue = rows.length > 0 ? rows.reduce((sum: number, row: any) => sum + row.daysOverdue, 0) / rows.length : 0;
    const criticalCount = rows.filter((row: any) => row.riskScore >= 80).length;

    return NextResponse.json({
      kpis: {
        totalEscalationsCount: rows.length,
        totalAtRisk,
        avgDaysOverdue: Number(avgDaysOverdue.toFixed(1)),
        criticalCount,
      },
      escalations: rows,
    });
  } catch (error) {
    console.error("Failed to fetch escalations", error);
    return NextResponse.json({ message: "Unable to load escalations" }, { status: 500 });
  }
}
