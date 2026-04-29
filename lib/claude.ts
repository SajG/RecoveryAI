import Anthropic from "@anthropic-ai/sdk";
import type { PartyRecommendation } from "@/types/party";

type PartyContext = {
  name: string;
  address: string;
  salesperson: { name: string };
  outstanding: number;
  daysSinceLastPayment: number;
  daysOverdue: number;
};

type PartyHistory = {
  payments: Array<{ paymentDate: Date | string; amount: number; method: string }>;
  actions: Array<{ completedAt: Date | string | null; actionType: string; outcome: string; notes: string }>;
  invoices: Array<{ invoiceDate: Date | string; overdueDays: number }>;
};

function normalizeUrgency(urgency: string) {
  const value = urgency.toLowerCase().replace(/\s+/g, "_");
  if (value.includes("today")) return "today";
  if (value.includes("week")) return "this_week";
  if (value.includes("month")) return "this_month";
  return value;
}

function extractJsonObject(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return "{}";

  // Handle fenced markdown blocks such as ```json ... ```
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const withoutFence = fencedMatch?.[1]?.trim() ?? trimmed;

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return withoutFence.slice(start, end + 1);
  }
  return withoutFence;
}

export async function generatePartyRecommendation(
  party: PartyContext,
  history: PartyHistory
): Promise<PartyRecommendation> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are an expert credit collections advisor for
Synergy Bonding Solutions Pvt Ltd, an adhesive manufacturer in Pune
(brands: Polygum, Ombond, Stick-onn). The company sells industrial and
woodworking adhesives to plywood dealers, hardware shops, and furniture
manufacturers across Maharashtra on 30-60 day credit terms.

Your job: For each problem customer, recommend the next best collection
action this week. Be direct, specific, culturally aware (Indian B2B
context). You may mix Hindi/English where natural.

Consider:
- B2B adhesive industry norms (60-90 days credit is common in Pune market)
- Whether customer is strategic (large repeat buyer) or marginal
- Pattern of past payments and broken commitments
- Days since last contact and last payment
- Whether to escalate (legal notice/stop supply) or stay patient
- The salesperson's existing relationship matters

Output STRICT JSON only, no markdown, no preamble:
{
  "riskScore": 0-100,
  "recommendation": "2-3 sentence specific advice",
  "suggestedActions": [
    { "label": "Call Mr. Sharma at Tulsi Plywood today", "urgency": "today" }
  ],
  "estimatedRecoveryPercent": 0-100,
  "redFlags": ["Specific concern 1", "Specific concern 2"]
}`;

  const userPrompt = `Customer: ${party.name}
Address: ${party.address || "Not available"}
Salesperson: ${party.salesperson.name}

Outstanding: ₹${party.outstanding.toLocaleString("en-IN")}
Days since last payment: ${party.daysSinceLastPayment}
Days overdue (oldest invoice): ${party.daysOverdue}

Last 5 payments received:
${history.payments
  .slice(0, 5)
  .map((p) => `- ${p.paymentDate}: ₹${p.amount} via ${p.method}`)
  .join("\n") || "No payments in records"}

Last 5 actions taken:
${history.actions
  .slice(0, 5)
  .map((a) => `- ${a.completedAt}: ${a.actionType} → ${a.outcome} (${a.notes})`)
  .join("\n") || "No actions logged yet"}

Open invoices: ${history.invoices.length}
Oldest invoice: ${history.invoices[0]?.invoiceDate || "N/A"}
(${history.invoices[0]?.overdueDays || 0} days overdue)

Recommend the next best action this week.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const contentBlock = response.content.find((block) => block.type === "text");
  const text = contentBlock?.text ?? "{}";
  const parsed = JSON.parse(extractJsonObject(text)) as PartyRecommendation;

  return {
    riskScore: Math.min(100, Math.max(0, Number(parsed.riskScore ?? 0))),
    recommendation: parsed.recommendation ?? "",
    suggestedActions: Array.isArray(parsed.suggestedActions)
      ? parsed.suggestedActions.slice(0, 3).map((action) => ({
          label: action.label,
          urgency: normalizeUrgency(action.urgency),
        }))
      : [],
    estimatedRecoveryPercent: Math.min(100, Math.max(0, Number(parsed.estimatedRecoveryPercent ?? 0))),
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.slice(0, 5) : [],
  };
}
