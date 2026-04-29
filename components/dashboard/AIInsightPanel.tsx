"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Sparkles, Target, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactINR } from "@/lib/format";

type AIInsightPanelProps = {
  recoveredThisMonth: number;
  loading?: boolean;
};

export function AIInsightPanel({ recoveredThisMonth, loading = false }: AIInsightPanelProps) {
  const [refreshLabel, setRefreshLabel] = useState("Last refreshed: 4 hours ago");

  const insights = useMemo(
    () => [
      {
        icon: TriangleAlert,
        headline: "Critical",
        description: "Matrixx Doors hasn't paid in 420 days — escalate today",
        tone: "text-red-600",
      },
      {
        icon: Target,
        headline: "Focus",
        description: "Tulsi Plywood (₹7.2L) is your biggest single recovery",
        tone: "text-amber-600",
      },
      {
        icon: AlertTriangle,
        headline: "Warning",
        description: "Om Sharma has 8 broken commitments this week",
        tone: "text-orange-600",
      },
      {
        icon: CheckCircle2,
        headline: "Win",
        description: `${formatCompactINR(recoveredThisMonth)} recovered this month (great pace)`,
        tone: "text-emerald-600",
      },
      {
        icon: Sparkles,
        headline: "Action",
        description: "12 parties haven't been contacted in 7+ days",
        tone: "text-sky-600",
      },
    ],
    [recoveredThisMonth]
  );

  if (loading) {
    return (
      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200/80 ring-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>🤖 AI Insights for Today</CardTitle>
          <p className="mt-1 text-xs text-slate-500">{refreshLabel}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setRefreshLabel("Last refreshed: just now")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => (
          <div key={insight.headline} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-start gap-2">
              <insight.icon className={`mt-0.5 h-4 w-4 ${insight.tone}`} />
              <div>
                <p className="text-sm font-semibold text-slate-900">{insight.headline}</p>
                <p className="text-sm text-slate-600">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
