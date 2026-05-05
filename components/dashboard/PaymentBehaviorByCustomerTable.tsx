"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactINR, formatRelativeTime } from "@/lib/format";
import type { CustomerPaymentBehavior } from "@/types/dashboard";

type PaymentBehaviorByCustomerTableProps = {
  rows: CustomerPaymentBehavior[];
};

function methodSummary(methodSplit: CustomerPaymentBehavior["methodSplit"]): string {
  const entries: [string, number][] = [
    ["UPI", methodSplit.upi],
    ["RTGS", methodSplit.rtgs],
    ["NEFT", methodSplit.neft],
    ["Cheque", methodSplit.cheque],
    ["Cash", methodSplit.cash],
  ];
  return entries
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([method, count]) => `${method} (${count})`)
    .join(", ");
}

export function PaymentBehaviorByCustomerTable({ rows }: PaymentBehaviorByCustomerTableProps) {
  return (
    <Card className="min-w-0 border border-slate-200/80 ring-0">
      <CardHeader>
        <CardTitle>Payment Behavior by Customer (Frequency + Method)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="pb-2 pr-2 font-medium">Customer</th>
              <th className="pb-2 pr-2 font-medium">Salesperson</th>
              <th className="pb-2 pr-2 font-medium text-right">Payments</th>
              <th className="pb-2 pr-2 font-medium text-right">Total Paid</th>
              <th className="pb-2 pr-2 font-medium text-right">Avg Gap</th>
              <th className="pb-2 pr-2 font-medium">Preferred Methods</th>
              <th className="pb-2 font-medium">Last Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.partyId} className="border-b border-slate-100">
                <td className="py-2 pr-2 font-medium text-slate-900">{row.partyName}</td>
                <td className="py-2 pr-2 text-slate-600">{row.salespersonName}</td>
                <td className="py-2 pr-2 text-right text-slate-700">{row.paymentCount}</td>
                <td className="py-2 pr-2 text-right text-slate-700">{formatCompactINR(row.totalPaid)}</td>
                <td className="py-2 pr-2 text-right text-slate-700">{row.avgGapDays === null ? "-" : `${row.avgGapDays}d`}</td>
                <td className="py-2 pr-2 text-slate-600">{methodSummary(row.methodSplit) || "-"}</td>
                <td className="py-2 text-slate-600">{row.lastPaymentDate ? formatRelativeTime(row.lastPaymentDate) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
