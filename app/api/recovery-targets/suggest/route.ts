import Anthropic from "@anthropic-ai/sdk";
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
          select: { id: true, outstanding: true, daysOverdue: true, riskScore: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const context = (salespeople as any[]).map((sp) => ({
      salespersonId: sp.id,
      salespersonName: sp.name,
      outstanding: sp.parties.reduce((sum: number, party: any) => sum + toNumber(party.outstanding), 0),
      partyCount: sp.parties.length,
      criticalParties: sp.parties.filter((party: any) => party.daysOverdue > 90 || party.riskScore >= 80).length,
    }));

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ suggestions: fallbackSuggestion(context), source: "fallback" });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system:
        "You are planning debt recovery targets for a B2B collections team in India. Return strict JSON only.",
      messages: [
        {
          role: "user",
          content: `Create a realistic 12-week target plan per salesperson. Keep values in INR integers.
Output JSON:
{ "suggestions": [ { "salespersonId": "...", "salespersonName": "...", "weeklyTargets": [12 numbers] } ] }
Data: ${JSON.stringify(context)}`,
        },
      ],
    });

    const content = response.content.find((block) => block.type === "text");
    const parsed = JSON.parse(content?.text ?? "{}") as { suggestions?: Suggestion[] };
    const suggestions = parsed.suggestions?.filter((s) => Array.isArray(s.weeklyTargets) && s.weeklyTargets.length === 12);
    if (!suggestions || suggestions.length === 0) {
      return NextResponse.json({ suggestions: fallbackSuggestion(context), source: "fallback" });
    }

    return NextResponse.json({ suggestions, source: "claude" });
  } catch (error) {
    console.error("Failed to suggest targets", error);
    return NextResponse.json({ message: "Unable to suggest targets" }, { status: 500 });
  }
}
