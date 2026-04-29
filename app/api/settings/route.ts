import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings, serializeSettings } from "@/lib/settings";

export async function GET() {
  try {
    const settings = await getOrCreateSettings();
    const salespeople = await prisma.salesperson.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, tallyGroup: true, phone: true, email: true, active: true },
    });
    return NextResponse.json({ settings: serializeSettings(settings), salespeople });
  } catch (error) {
    console.error("Failed to load settings", error);
    return NextResponse.json({ message: "Unable to load settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      settings?: Record<string, unknown>;
      salespeople?: Array<{
        id?: string;
        name: string;
        tallyGroup: string;
        phone: string;
        email: string;
        active: boolean;
      }>;
    };

    if (body.settings) {
      await prisma.setting.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          ...body.settings,
        },
        update: body.settings,
      });
    }

    if (body.salespeople) {
      for (const row of body.salespeople) {
        if (!row.name?.trim() || !row.tallyGroup?.trim()) continue;
        if (row.id) {
          await prisma.salesperson.update({
            where: { id: row.id },
            data: {
              name: row.name.trim(),
              tallyGroup: row.tallyGroup.trim(),
              phone: row.phone?.trim() || "-",
              email: row.email?.trim() || "-",
              active: Boolean(row.active),
            },
          });
        } else {
          await prisma.salesperson.create({
            data: {
              name: row.name.trim(),
              tallyGroup: row.tallyGroup.trim(),
              phone: row.phone?.trim() || "-",
              email: row.email?.trim() || "-",
              active: Boolean(row.active),
            },
          });
        }
      }
    }

    const settings = await getOrCreateSettings();
    const salespeople = await prisma.salesperson.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, tallyGroup: true, phone: true, email: true, active: true },
    });
    return NextResponse.json({ settings: serializeSettings(settings), salespeople });
  } catch (error) {
    console.error("Failed to save settings", error);
    return NextResponse.json({ message: "Unable to save settings" }, { status: 500 });
  }
}
