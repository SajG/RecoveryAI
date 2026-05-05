import { prisma } from "@/lib/prisma";
import { SalesPerformanceView } from "@/components/sales-performance/SalesPerformanceView";

type InvoiceRow = {
  id: string;
  partyId: string;
  invoiceRef: string;
  invoiceDate: Date;
  dueDate: Date;
  amount: number;
  pendingAmount: number;
  overdueDays: number;
  partyName: string;
  salespersonName: string;
};

type MonthlyPerformanceRow = {
  monthKey: string;
  monthLabel: string;
  salespersonName: string;
  totalSales: number;
  totalRecovery: number;
  totalQuantitySold: number;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(date);
}

function buildMonths(count: number): Date[] {
  const now = new Date();
  const months: Date[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return months;
}

async function getSalesPerformanceData() {
  const [invoicesRaw, paymentsRaw] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: [{ invoiceDate: "desc" }, { dueDate: "desc" }],
      select: {
        id: true,
        partyId: true,
        invoiceRef: true,
        invoiceDate: true,
        dueDate: true,
        amount: true,
        pendingAmount: true,
        overdueDays: true,
        party: {
          select: {
            name: true,
            salesperson: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.payment.findMany({
      select: {
        amount: true,
        paymentDate: true,
        party: {
          select: {
            salesperson: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const invoices: InvoiceRow[] = invoicesRaw.map((invoice) => ({
    id: invoice.id,
    partyId: invoice.partyId,
    invoiceRef: invoice.invoiceRef,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    amount: invoice.amount.toNumber(),
    pendingAmount: invoice.pendingAmount.toNumber(),
    overdueDays: invoice.overdueDays,
    partyName: invoice.party.name,
    salespersonName: invoice.party.salesperson.name,
  }));

  const last6Months = buildMonths(6);
  const monthKeys = new Set(last6Months.map((month) => monthKey(month)));
  const salespeople = [...new Set(invoices.map((invoice) => invoice.salespersonName))].sort((a, b) => a.localeCompare(b));

  const salesBySpMonth = new Map<string, number>();
  const qtyBySpMonth = new Map<string, number>();
  const recoveryBySpMonth = new Map<string, number>();

  for (const invoice of invoices) {
    const key = monthKey(invoice.invoiceDate);
    if (!monthKeys.has(key)) continue;
    const composite = `${invoice.salespersonName}__${key}`;
    salesBySpMonth.set(composite, (salesBySpMonth.get(composite) ?? 0) + invoice.amount);
    qtyBySpMonth.set(composite, (qtyBySpMonth.get(composite) ?? 0) + 1);
  }

  for (const payment of paymentsRaw) {
    const key = monthKey(payment.paymentDate);
    if (!monthKeys.has(key)) continue;
    const salespersonName = payment.party.salesperson.name;
    const composite = `${salespersonName}__${key}`;
    recoveryBySpMonth.set(composite, (recoveryBySpMonth.get(composite) ?? 0) + payment.amount.toNumber());
  }

  const monthlyPerformance: MonthlyPerformanceRow[] = [];
  for (const month of last6Months) {
    const key = monthKey(month);
    for (const salespersonName of salespeople) {
      const composite = `${salespersonName}__${key}`;
      monthlyPerformance.push({
        monthKey: key,
        monthLabel: monthLabel(month),
        salespersonName,
        totalSales: Number((salesBySpMonth.get(composite) ?? 0).toFixed(2)),
        totalRecovery: Number((recoveryBySpMonth.get(composite) ?? 0).toFixed(2)),
        totalQuantitySold: qtyBySpMonth.get(composite) ?? 0,
      });
    }
  }

  return {
    invoices,
    monthlyPerformance,
  };
}

export default async function SalesPerformancePage() {
  const data = await getSalesPerformanceData();
  return <SalesPerformanceView invoices={data.invoices} monthlyPerformance={data.monthlyPerformance} />;
}
