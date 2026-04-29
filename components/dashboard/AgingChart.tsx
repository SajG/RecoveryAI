"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactINR } from "@/lib/format";
import type { AgingBucket } from "@/types/dashboard";

type AgingChartProps = {
  data: AgingBucket[];
  loading?: boolean;
};

const bucketColors: Record<AgingBucket["bucket"], string> = {
  "0-30 days": "#16a34a",
  "31-60 days": "#84cc16",
  "61-90 days": "#eab308",
  "91-180 days": "#f97316",
  "180+ days": "#dc2626",
};

export function AgingChart({ data, loading = false }: AgingChartProps) {
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const totalCount = data.reduce((sum, item) => sum + item.count, 0);

  if (loading) {
    return (
      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
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
        <CardTitle>Aging Analysis</CardTitle>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="h-72 min-h-[18rem] w-full min-w-0 shrink-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={data} dataKey="amount" nameKey="bucket" innerRadius={70} outerRadius={110} paddingAngle={2}>
                {data.map((entry) => (
                  <Cell key={entry.bucket} fill={bucketColors[entry.bucket]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => {
                  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
                  return [formatCompactINR(numericValue), "Amount"];
                }}
                contentStyle={{
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                }}
              />
              <text x="50%" y="46%" textAnchor="middle" className="fill-slate-500 text-xs">
                Total Outstanding
              </text>
              <text x="50%" y="54%" textAnchor="middle" className="fill-slate-900 text-sm font-semibold">
                {formatCompactINR(totalAmount)}
              </text>
              <text x="50%" y="62%" textAnchor="middle" className="fill-slate-500 text-xs">
                {totalCount} parties
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((bucket) => {
            const pct = totalAmount > 0 ? (bucket.amount / totalAmount) * 100 : 0;
            return (
              <div key={bucket.bucket} className="rounded-md border border-slate-200 p-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bucketColors[bucket.bucket] }} />
                    <span className="font-medium text-slate-700">{bucket.bucket}</span>
                  </div>
                  <span className="text-slate-500">{pct.toFixed(1)}%</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formatCompactINR(bucket.amount)}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
