import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseMinAmount(value: string | null): number {
  if (!value) return 1000;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 1000;
  return parsed;
}

function parseMinOverdueDays(value: string | null): number {
  if (!value) return 60;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 60;
  return parsed;
}

function normalizePhoneForWaMe(phone: string | null): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`; // default India country code
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minAmount = parseMinAmount(searchParams.get("minAmount"));
    const minOverdueDays = parseMinOverdueDays(searchParams.get("minOverdueDays"));

    const salespeople = await prisma.salesperson.findMany({
      where: {
        active: true,
        parties: {
          some: {
            outstanding: { gte: minAmount },
            daysOverdue: { gte: minOverdueDays },
          },
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        parties: {
          where: {
            outstanding: { gte: minAmount },
            daysOverdue: { gte: minOverdueDays },
          },
          orderBy: [{ outstanding: "desc" }, { daysOverdue: "desc" }],
          select: {
            name: true,
            outstanding: true,
            daysOverdue: true,
            phone: true,
          },
        },
      },
    });

    const dateLabel = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const messages = salespeople.map((salesperson) => {
      const totalPending = salesperson.parties.reduce((sum, party) => sum + Number(party.outstanding), 0);

      const lines = salesperson.parties.map((party, index) => {
        const amount = formatCurrency(Number(party.outstanding));
        const overdueSuffix = party.daysOverdue > 0 ? ` | ${party.daysOverdue}d overdue` : "";
        const phoneSuffix = party.phone?.trim() ? ` | ${party.phone}` : "";
        return `${index + 1}. ${party.name} - ${amount}${overdueSuffix}${phoneSuffix}`;
      });

      const message = [
        `Recovery follow-up list (${dateLabel})`,
        `Salesperson: ${salesperson.name}`,
        `Only high pending amounts (>= ${formatCurrency(minAmount)})`,
        `Only parties overdue by ${minOverdueDays}+ days`,
        `Total pending: ${formatCurrency(totalPending)}`,
        "",
        ...lines,
        "",
        "Important: Share recovery status of each client along with payment proofs every day.",
      ].join("\n");

      const waPhone = normalizePhoneForWaMe(salesperson.phone);
      const waMeUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}` : null;

      return {
        salespersonId: salesperson.id,
        salespersonName: salesperson.name,
        salespersonPhone: salesperson.phone,
        salespersonEmail: salesperson.email,
        partyCount: salesperson.parties.length,
        totalPending,
        message,
        waMeUrl,
      };
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      minAmount,
      minOverdueDays,
      salespersonCount: messages.length,
      messages,
    });
  } catch (error) {
    console.error("Failed generating salesperson WhatsApp digest", error);
    return NextResponse.json(
      { message: "Unable to generate salesperson WhatsApp digest" },
      { status: 500 }
    );
  }
}
