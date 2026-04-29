"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactINR } from "@/lib/format";
import type { SalespersonOutstanding } from "@/types/dashboard";

type SalespeopleChartProps = {
  data: SalespersonOutstanding[];
  loading?: boolean;
};

function getBarColor(amount: number) {
  if (amount > 500_000) return "#dc2626";
  if (amount > 200_000) return "#f97316";
  if (amount > 100_000) return "#eab308";
  return "#16a34a";
}

export function SalespeopleChart({ data, loading = false }: SalespeopleChartProps) {
  if (loading) {
    return (
      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <Skeleton className="h-5 w-52" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 border border-slate-200/80 ring-0">
      <CardHeader>
        <CardTitle>Outstanding by Salesperson</CardTitle>
      </CardHeader>
      <CardContent className="h-80 min-h-[20rem] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tickFormatter={(value) => formatCompactINR(value)} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#334155", fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              formatter={(value) => {
                const numericValue = typeof value === "number" ? value : Number(value ?? 0);
                return [formatCompactINR(numericValue), "Outstanding"];
              }}
              contentStyle={{
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as SalespersonOutstanding | undefined;
                if (!row) return "";
                return `${row.name} • ${row.partyCount} parties • ${row.criticalCount} critical`;
              }}
            />
            <Bar dataKey="outstanding" radius={[0, 8, 8, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={getBarColor(entry.outstanding)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
