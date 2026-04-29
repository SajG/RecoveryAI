import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DecimalLike = { toNumber: () => number };

function toNumber(value: DecimalLike | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildNextWeeks(count = 12) {
  const weekStart = getWeekStart(new Date());
  return Array.from({ length: count }).map((_, index) => {
    const start = addDays(weekStart, index * 7);
    const end = addDays(start, 6);
    return { index: index + 1, weekStart: start, weekEnd: end };
  });
}

export async function GET() {
  try {
    const weeks = buildNextWeeks(12);
    const start = weeks[0].weekStart;
    const end = weeks[weeks.length - 1].weekEnd;
    const salespeople = await prisma.salesperson.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    const [targets, actions, payments] = await Promise.all([
      prisma.recoveryTarget.findMany({
        where: { weekStart: { gte: start, lte: end } },
      }),
      prisma.action.findMany({
        where: {
          completedAt: { gte: start, lte: addDays(end, 1) },
          amountRecovered: { not: null },
        },
        select: {
          amountRecovered: true,
          completedAt: true,
          party: { select: { salespersonId: true } },
        },
      }),
      prisma.payment.findMany({
        where: {
          paymentDate: { gte: start, lte: addDays(end, 1) },
        },
        select: {
          amount: true,
          paymentDate: true,
          party: { select: { salespersonId: true } },
        },
      }),
    ]);

    const targetMap = new Map<string, number>();
    for (const row of targets as any[]) {
      targetMap.set(`${row.salespersonId}_${row.weekStart.toISOString().slice(0, 10)}`, toNumber(row.targetAmount));
    }

    const actualMap = new Map<string, number>();
    for (const action of actions as any[]) {
      const completedAt = action.completedAt;
      if (!completedAt) continue;
      const weekStart = getWeekStart(completedAt).toISOString().slice(0, 10);
      const key = `${action.party.salespersonId}_${weekStart}`;
      actualMap.set(key, (actualMap.get(key) ?? 0) + toNumber(action.amountRecovered));
    }
    for (const payment of payments as any[]) {
      const paymentDate = payment.paymentDate;
      if (!paymentDate) continue;
      const weekStart = getWeekStart(paymentDate).toISOString().slice(0, 10);
      const key = `${payment.party.salespersonId}_${weekStart}`;
      actualMap.set(key, (actualMap.get(key) ?? 0) + toNumber(payment.amount));
    }

    return NextResponse.json({
      weeks,
      salespeople: (salespeople as any[]).map((sp) => {
        const items = weeks.map((week: { index: number; weekStart: Date; weekEnd: Date }) => {
          const key = `${sp.id}_${week.weekStart.toISOString().slice(0, 10)}`;
          const target = targetMap.get(key) ?? 0;
          const actual = actualMap.get(key) ?? 0;
          const achievement = target > 0 ? (actual / target) * 100 : 0;
          return {
            week: week.index,
            weekStart: week.weekStart,
            weekEnd: week.weekEnd,
            targetAmount: target,
            actualAmount: actual,
            achievement,
          };
        });
        return {
          salespersonId: sp.id,
          salespersonName: sp.name,
          rows: items,
          totalTarget: items.reduce((sum: number, item: any) => sum + item.targetAmount, 0),
          totalActual: items.reduce((sum: number, item: any) => sum + item.actualAmount, 0),
        };
      }),
    });
  } catch (error) {
    console.error("Failed to load recovery targets", error);
    return NextResponse.json({ message: "Unable to load recovery targets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      salespersonId: string;
      weekStart: string;
      targetAmount: number;
    };

    if (!body.salespersonId || !body.weekStart || !Number.isFinite(Number(body.targetAmount))) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const weekStart = getWeekStart(new Date(body.weekStart));
    const weekEnd = addDays(weekStart, 6);
    const targetAmount = Number(body.targetAmount);

    const result = await prisma.recoveryTarget.upsert({
      where: { salespersonId_weekStart: { salespersonId: body.salespersonId, weekStart } },
      create: { salespersonId: body.salespersonId, weekStart, weekEnd, targetAmount },
      update: { targetAmount, weekEnd },
    });

    return NextResponse.json({
      ...result,
      targetAmount: toNumber(result.targetAmount),
      actualAmount: toNumber(result.actualAmount),
    });
  } catch (error) {
    console.error("Failed to save recovery target", error);
    return NextResponse.json({ message: "Unable to save recovery target" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.recoveryTarget.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to reset recovery targets", error);
    return NextResponse.json({ message: "Unable to reset recovery targets" }, { status: 500 });
  }
}
