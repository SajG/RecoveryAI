import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type KPICardProps = {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  trend?: number;
  icon: ReactNode;
  color?: "default" | "red" | "green" | "yellow";
  loading?: boolean;
  progress?: number;
};

const valueColorMap: Record<NonNullable<KPICardProps["color"]>, string> = {
  default: "text-slate-900",
  red: "text-red-600",
  green: "text-emerald-600",
  yellow: "text-amber-600",
};

export function KPICard({ title, value, subtitle, trend, icon, color = "default", loading = false, progress }: KPICardProps) {
  if (loading) {
    return (
      <Card className="ring-slate-200">
        <CardHeader className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200/80 ring-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-slate-500">{title}</CardTitle>
        <div className="rounded-md bg-slate-100 p-2 text-slate-700">{icon}</div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={cn("text-3xl font-semibold tracking-tight", valueColorMap[color])}>{value}</div>
        {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        {typeof trend === "number" ? (
          <p className={cn("text-sm font-medium", trend >= 0 ? "text-emerald-600" : "text-red-600")}>
            {trend >= 0 ? "+" : ""}
            {trend.toFixed(1)}%
          </p>
        ) : null}
        {typeof progress === "number" ? <Progress value={Math.max(0, Math.min(100, progress))} /> : null}
      </CardContent>
    </Card>
  );
}
