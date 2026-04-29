import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ACTION_TYPES = ["Call", "Visit", "WhatsApp", "Email", "LegalNotice", "StopSupply"] as const;
const ACTION_OUTCOMES = ["PromiseToPay", "NoResponse", "Disputed", "PartialPayment", "Recovered"] as const;
type ActionType = (typeof ACTION_TYPES)[number];
type ActionOutcome = (typeof ACTION_OUTCOMES)[number];

function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const partyId = context.params.id;
    const body = (await request.json()) as {
      actionType: ActionType;
      outcome: ActionOutcome;
      notes: string;
      amountCommitted?: number | null;
      amountRecovered?: number | null;
      commitmentDate?: string | null;
      createdBy: string;
    };

    if (!body.actionType || !body.outcome || !body.notes || !body.createdBy) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    if (!ACTION_TYPES.includes(body.actionType) || !ACTION_OUTCOMES.includes(body.outcome)) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const action = await prisma.action.create({
      data: {
        partyId,
        actionType: body.actionType,
        outcome: body.outcome,
        notes: body.notes.trim(),
        amountCommitted: parseOptionalNumber(body.amountCommitted),
        amountRecovered: parseOptionalNumber(body.amountRecovered),
        commitmentDate: body.commitmentDate ? new Date(body.commitmentDate) : null,
        completedAt: new Date(),
        createdBy: body.createdBy.trim(),
      },
      select: {
        id: true,
        actionType: true,
        outcome: true,
        notes: true,
        amountCommitted: true,
        amountRecovered: true,
        commitmentDate: true,
        completedAt: true,
        createdBy: true,
      },
    });

    return NextResponse.json({
      ...action,
      amountCommitted: action.amountCommitted ? Number(action.amountCommitted) : null,
      amountRecovered: action.amountRecovered ? Number(action.amountRecovered) : null,
    });
  } catch (error) {
    console.error("Failed to create party action", error);
    return NextResponse.json({ message: "Unable to log action" }, { status: 500 });
  }
}
