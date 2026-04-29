import { NextResponse } from "next/server";
import { generatePartyRecommendation } from "@/lib/claude";
import { sendOwnerEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings } from "@/lib/settings";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET() {
  const started = Date.now();
  try {
    const settings = await getOrCreateSettings();
    const limit = settings.aiMaxRecommendationsPerDay;
    const parties = await prisma.party.findMany({
      where: {
        priority: { in: ["Critical", "High"] },
      },
      take: limit,
      orderBy: [{ riskScore: "desc" }, { outstanding: "desc" }],
      include: {
        salesperson: { select: { name: true } },
        payments: { orderBy: { paymentDate: "desc" }, take: 5 },
        actions: { orderBy: { completedAt: "desc" }, take: 5 },
        invoices: { orderBy: { overdueDays: "desc" }, take: 5 },
      },
    });

    let updatedCount = 0;
    for (const party of parties) {
      try {
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
            payments: party.payments.map((p: { paymentDate: Date; amount: { toString: () => string } | number; method: string }) => ({
              paymentDate: p.paymentDate,
              amount: Number(p.amount),
              method: p.method,
            })),
            actions: party.actions.map((a: { completedAt: Date | null; actionType: string; outcome: string; notes: string }) => ({
              completedAt: a.completedAt,
              actionType: a.actionType,
              outcome: a.outcome,
              notes: a.notes,
            })),
            invoices: party.invoices.map((i: { invoiceDate: Date; overdueDays: number }) => ({
              invoiceDate: i.invoiceDate,
              overdueDays: i.overdueDays,
            })),
          }
        );
        await prisma.party.update({
          where: { id: party.id },
          data: {
            aiRecommendation: recommendation.recommendation,
            aiActions: recommendation.suggestedActions,
            riskScore: recommendation.riskScore,
            redFlags: recommendation.redFlags,
            recommendationDate: new Date(),
          },
        });
        updatedCount += 1;
        await delay(300);
      } catch (error) {
        console.error(`Failed refreshing recommendation for ${party.id}`, error);
      }
    }

    await prisma.syncLog.create({
      data: {
        syncType: "cron",
        status: "success",
        partiesUpdated: updatedCount,
        durationMs: Date.now() - started,
      },
    });

    await sendOwnerEmail({
      to: settings.ownerEmail,
      subject: "Daily AI recommendation refresh summary",
      html: `<p>AI recommendations refreshed for <strong>${updatedCount}</strong> parties.</p>`,
    });

    return NextResponse.json({ updatedCount });
  } catch (error) {
    console.error("Failed running refresh-ai cron", error);
    return NextResponse.json({ message: "Unable to run refresh-ai cron" }, { status: 500 });
  }
}
