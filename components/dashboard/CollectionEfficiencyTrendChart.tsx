"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactINR } from "@/lib/format";
import type { CollectionEfficiencyPoint } from "@/types/dashboard";

type CollectionEfficiencyTrendChartProps = {
  data: CollectionEfficiencyPoint[];
};

export function CollectionEfficiencyTrendChart({ data }: CollectionEfficiencyTrendChartProps) {
  return (
    <Card className="min-w-0 border border-slate-200/80 ring-0">
      <CardHeader>
        <CardTitle>Collection Efficiency Trend (Payments vs Dues)</CardTitle>
      </CardHeader>
      <CardContent className="h-80 min-h-[20rem] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data} margin={{ top: 10, right: 12, left: 6, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis
              yAxisId="amount"
              tickFormatter={(value) => formatCompactINR(value)}
              tick={{ fill: "#64748b", fontSize: 12 }}
              width={70}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tickFormatter={(value) => `${value}%`}
              tick={{ fill: "#64748b", fontSize: 12 }}
              width={48}
            />
            <Tooltip
              formatter={(value, key) => {
                const numeric = typeof value === "number" ? value : Number(value ?? 0);
                if (key === "efficiencyPct") return [`${numeric.toFixed(1)}%`, "Efficiency"];
                if (key === "dues") return [formatCompactINR(numeric), "Dues"];
                return [formatCompactINR(numeric), "Payments"];
              }}
              contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e2e8f0", background: "#fff" }}
            />
            <Legend />
            <Line yAxisId="amount" type="monotone" dataKey="dues" stroke="#f97316" strokeWidth={2.5} dot={false} name="Dues" />
            <Line
              yAxisId="amount"
              type="monotone"
              dataKey="payments"
              stroke="#16a34a"
              strokeWidth={2.5}
              dot={false}
              name="Payments"
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="efficiencyPct"
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              name="Efficiency %"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
