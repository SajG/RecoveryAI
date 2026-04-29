import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const logs = await prisma.syncLog.findMany({
      orderBy: { syncedAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Failed to load sync logs", error);
    return NextResponse.json({ message: "Unable to load sync logs" }, { status: 500 });
  }
}
