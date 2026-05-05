import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendOwnerEmail } from "@/lib/email";

const payloadSchema = z.object({
  partyId: z.string().min(1),
  subject: z.string().min(1).max(180),
  body: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const party = await prisma.party.findUnique({
      where: { id: parsed.data.partyId },
      select: { id: true, name: true, email: true },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found." }, { status: 404 });
    }

    if (!party.email || !party.email.includes("@")) {
      return NextResponse.json({ error: "Selected party does not have a valid email." }, { status: 400 });
    }

    const html = parsed.data.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${line}</p>`)
      .join("");

    const result = await sendOwnerEmail({
      to: party.email,
      subject: parsed.data.subject,
      html: html || "<p>(No content)</p>",
    });

    if (result.skipped) {
      return NextResponse.json(
        { error: "Email is not configured. Please set RESEND_API_KEY." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: `Email sent to ${party.name}.` });
  } catch (error) {
    console.error("Failed to send contact email", error);
    return NextResponse.json({ error: "Unable to send email right now." }, { status: 500 });
  }
}
