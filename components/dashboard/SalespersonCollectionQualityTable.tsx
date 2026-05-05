"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactINR } from "@/lib/format";
import type { SalespersonCollectionQuality } from "@/types/dashboard";

type SalespersonCollectionQualityTableProps = {
  rows: SalespersonCollectionQuality[];
};

export function SalespersonCollectionQualityTable({ rows }: SalespersonCollectionQualityTableProps) {
  return (
    <Card className="min-w-0 border border-slate-200/80 ring-0">
      <CardHeader>
        <CardTitle>Salesperson Collection Quality</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="pb-2 pr-2 font-medium">Salesperson</th>
              <th className="pb-2 pr-2 font-medium text-right">Recovered (M)</th>
              <th className="pb-2 pr-2 font-medium text-right">Exposure</th>
              <th className="pb-2 pr-2 font-medium text-right">Collection/Exposure</th>
              <th className="pb-2 pr-2 font-medium text-right">Avg Overdue</th>
              <th className="pb-2 pr-2 font-medium text-right">Paying Parties</th>
              <th className="pb-2 font-medium text-right">Overdue 90+</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.salespersonName} className="border-b border-slate-100">
                <td className="py-2 pr-2 font-medium text-slate-900">{row.salespersonName}</td>
                <td className="py-2 pr-2 text-right text-emerald-600">{formatCompactINR(row.recoveredThisMonth)}</td>
                <td className="py-2 pr-2 text-right text-slate-700">{formatCompactINR(row.totalOutstanding)}</td>
                <td className="py-2 pr-2 text-right text-slate-700">{row.collectionVsExposurePct.toFixed(1)}%</td>
                <td className="py-2 pr-2 text-right text-slate-700">{row.avgOverdueDays.toFixed(1)}d</td>
                <td className="py-2 pr-2 text-right text-slate-700">
                  {row.payingPartiesThisMonth}/{row.partyCount}
                </td>
                <td className="py-2 text-right text-slate-700">{row.overdue90PlusCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
