import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type EscalationStatus = "New" | "Escalated" | "InProgress" | "Resolved" | "Snoozed";
const VALID_STATUSES: EscalationStatus[] = ["New", "Escalated", "InProgress", "Resolved", "Snoozed"];

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const body = (await request.json()) as { status: EscalationStatus; snoozeDays?: number };
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    const now = new Date();
    const snoozeDays = Number(body.snoozeDays ?? 7);
    const snoozedUntil =
      body.status === "Snoozed" ? new Date(now.getTime() + Math.max(1, snoozeDays) * 24 * 60 * 60 * 1000) : null;

    const updated = await prisma.party.update({
      where: { id: context.params.id },
      data: {
        escalationStatus: body.status,
        snoozedUntil,
      },
      select: { id: true, escalationStatus: true, snoozedUntil: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update escalation status", error);
    return NextResponse.json({ message: "Unable to update escalation status" }, { status: 500 });
  }
}
