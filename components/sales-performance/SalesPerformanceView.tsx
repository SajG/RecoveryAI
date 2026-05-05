"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatINR } from "@/lib/format";

type InvoiceRow = {
  id: string;
  partyId: string;
  invoiceRef: string;
  invoiceDate: string | Date;
  dueDate: string | Date;
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

type SalesPerformanceViewProps = {
  invoices: InvoiceRow[];
  monthlyPerformance: MonthlyPerformanceRow[];
};

export function SalesPerformanceView({ invoices, monthlyPerformance }: SalesPerformanceViewProps) {
  const [query, setQuery] = useState("");

  const months = useMemo(
    () =>
      [...new Map(monthlyPerformance.map((row) => [row.monthKey, row.monthLabel])).entries()].map(([monthKey, monthLabel]) => ({
        monthKey,
        monthLabel,
      })),
    [monthlyPerformance]
  );

  const rows = useMemo(() => {
    const map = new Map<string, { salespersonName: string; month: Record<string, MonthlyPerformanceRow> }>();
    for (const row of monthlyPerformance) {
      const existing = map.get(row.salespersonName) ?? { salespersonName: row.salespersonName, month: {} };
      existing.month[row.monthKey] = row;
      map.set(row.salespersonName, existing);
    }
    return [...map.values()].sort((a, b) => a.salespersonName.localeCompare(b.salespersonName));
  }, [monthlyPerformance]);

  const filteredInvoices = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter((invoice) => {
      return (
        invoice.partyName.toLowerCase().includes(term) ||
        invoice.salespersonName.toLowerCase().includes(term) ||
        invoice.invoiceRef.toLowerCase().includes(term)
      );
    });
  }, [invoices, query]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Sales Performance</h2>
        <p className="text-sm text-slate-600">
          Month-on-month salesperson performance from invoices and payments. Quantity sold is computed from invoice count.
        </p>
      </div>

      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <CardTitle>Month on Month - Sales, Recovery, Quantity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="py-2 pr-3 font-medium">Salesperson</th>
                  {months.map((month) => (
                    <th key={month.monthKey} className="py-2 pr-3 font-medium">
                      {month.monthLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.salespersonName} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 font-medium text-slate-900">{row.salespersonName}</td>
                    {months.map((month) => {
                      const item = row.month[month.monthKey];
                      return (
                        <td key={month.monthKey} className="py-2 pr-3 text-xs text-slate-700">
                          <div>Sales: {formatINR(item?.totalSales ?? 0)}</div>
                          <div>Recovery: {formatINR(item?.totalRecovery ?? 0)}</div>
                          <div>Qty: {item?.totalQuantitySold ?? 0}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <CardTitle>Invoices per Party</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search party, salesperson, invoice ref"
              className="pl-9"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="py-2 pr-3 font-medium">Salesperson</th>
                  <th className="py-2 pr-3 font-medium">Party</th>
                  <th className="py-2 pr-3 font-medium">Invoice Ref</th>
                  <th className="py-2 pr-3 font-medium">Invoice Date</th>
                  <th className="py-2 pr-3 font-medium">Due Date</th>
                  <th className="py-2 pr-3 text-right font-medium">Invoice Amount</th>
                  <th className="py-2 pr-3 text-right font-medium">Pending Amount</th>
                  <th className="py-2 pr-3 text-right font-medium">Overdue Days</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-3">{invoice.salespersonName}</td>
                    <td className="py-2 pr-3">{invoice.partyName}</td>
                    <td className="py-2 pr-3 font-medium text-slate-900">{invoice.invoiceRef}</td>
                    <td className="py-2 pr-3">{formatDate(invoice.invoiceDate)}</td>
                    <td className="py-2 pr-3">{formatDate(invoice.dueDate)}</td>
                    <td className="py-2 pr-3 text-right">{formatINR(invoice.amount)}</td>
                    <td className="py-2 pr-3 text-right">{formatINR(invoice.pendingAmount)}</td>
                    <td className="py-2 pr-3 text-right">{invoice.overdueDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
