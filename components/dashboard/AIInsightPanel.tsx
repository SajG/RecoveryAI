"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw, Sparkles, Target, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactINR } from "@/lib/format";
import type { CriticalParty } from "@/types/dashboard";

type AIInsightPanelProps = {
  recoveredThisMonth: number;
  totalOutstanding: number;
  overdue90PlusCount: number;
  topCriticalParties: CriticalParty[];
  recentActionsCount: number;
  loading?: boolean;
};

export function AIInsightPanel({
  recoveredThisMonth,
  totalOutstanding,
  overdue90PlusCount,
  topCriticalParties,
  recentActionsCount,
  loading = false,
}: AIInsightPanelProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [refreshLabel, setRefreshLabel] = useState("Last refreshed: 4 hours ago");

  const insights = useMemo(
    () => [
      {
        icon: TriangleAlert,
        headline: "Critical",
        description:
          topCriticalParties.length > 0
            ? `${topCriticalParties[0].name} hasn't paid in ${topCriticalParties[0].daysOverdue} days — escalate today`
            : "No critical party is overdue beyond 100 days right now",
        tone: "text-red-600",
      },
      {
        icon: Target,
        headline: "Focus",
        description:
          topCriticalParties.length > 0
            ? `${topCriticalParties[0].name} (${formatCompactINR(topCriticalParties[0].outstanding)}) is your biggest single recovery`
            : "No high-value overdue account to prioritize yet",
        tone: "text-amber-600",
      },
      {
        icon: AlertTriangle,
        headline: "Warning",
        description: `${overdue90PlusCount} parties are overdue by 90+ days out of ${formatCompactINR(totalOutstanding)} outstanding`,
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
        description:
          recentActionsCount > 0
            ? `${recentActionsCount} actions are logged recently — keep momentum going`
            : "No completed actions logged yet — record today's follow-ups",
        tone: "text-sky-600",
      },
    ],
    [overdue90PlusCount, recentActionsCount, recoveredThisMonth, topCriticalParties]
  );

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
      setRefreshLabel("Last refreshed: just now");
    });
  };

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
          disabled={isRefreshing}
          onClick={handleRefresh}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
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
