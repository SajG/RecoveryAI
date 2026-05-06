import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DecimalLike = { toNumber: () => number };
function toNumber(value: DecimalLike | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

type Suggestion = {
  salespersonId: string;
  salespersonName: string;
  weeklyTargets: number[];
};

function fallbackSuggestion(input: Array<{ salespersonId: string; salespersonName: string; outstanding: number }>): Suggestion[] {
  return input.map((row) => {
    const base = row.outstanding * 0.22;
    const weeklyTargets = Array.from({ length: 12 }).map((_, idx) => Number((base * (1 - idx * 0.03) / 12).toFixed(0)));
    return {
      salespersonId: row.salespersonId,
      salespersonName: row.salespersonName,
      weeklyTargets,
    };
  });
}

export async function POST() {
  try {
    const salespeople = await prisma.salesperson.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        parties: {
          select: { id: true, outstanding: true, daysOverdue: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const context = (salespeople as any[]).map((sp) => ({
      salespersonId: sp.id,
      salespersonName: sp.name,
      outstanding: sp.parties.reduce((sum: number, party: any) => sum + toNumber(party.outstanding), 0),
      partyCount: sp.parties.length,
      criticalParties: sp.parties.filter((party: any) => party.daysOverdue > 90).length,
    }));

    return NextResponse.json({ suggestions: fallbackSuggestion(context), source: "deterministic" });
  } catch (error) {
    console.error("Failed to suggest targets", error);
    return NextResponse.json({ message: "Unable to suggest targets" }, { status: 500 });
  }
}
