import { AlertCircle, HeartPulse, Inbox, TrendingUp, Wallet } from "lucide-react";
import { AIInsightPanel } from "@/components/dashboard/AIInsightPanel";
import { AgingChart } from "@/components/dashboard/AgingChart";
import { AgingMovementPanel } from "@/components/dashboard/AgingMovementPanel";
import { CriticalPartiesTable } from "@/components/dashboard/CriticalPartiesTable";
import { CollectionEfficiencyTrendChart } from "@/components/dashboard/CollectionEfficiencyTrendChart";
import { KPICard } from "@/components/dashboard/KPICard";
import { PaymentBehaviorByCustomerTable } from "@/components/dashboard/PaymentBehaviorByCustomerTable";
import { RecentActionsFeed } from "@/components/dashboard/RecentActionsFeed";
import { SalespeopleChart } from "@/components/dashboard/SalespeopleChart";
import { SalespersonCollectionQualityTable } from "@/components/dashboard/SalespersonCollectionQualityTable";
import { SyncNowButton } from "@/components/dashboard/SyncNowButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { getDashboardMetrics } from "@/lib/dashboard-metrics";
import { formatCompactINR, formatINR, formatRelativeTime } from "@/lib/format";
import type { DashboardResponse } from "@/types/dashboard";

function getHealthTone(score: number) {
  if (score < 40) return { color: "red" as const, label: "Critical" };
  if (score <= 70) return { color: "yellow" as const, label: "Needs attention" };
  return { color: "green" as const, label: "Healthy" };
}

async function getDashboardData(): Promise<DashboardResponse | null> {
  try {
    return await getDashboardMetrics();
  } catch (error) {
    console.error("Failed to load dashboard metrics for page", error);
    return null;
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6" />}
        title="Dashboard data unavailable"
        description="We couldn't load command center metrics right now. Please sync and try again."
      />
    );
  }

  const activePartyCount = data.salespersonOutstanding.reduce((sum, row) => sum + row.partyCount, 0);
  const targetAchievedPct = data.monthlyTarget > 0 ? Math.min((data.recoveredThisMonth / data.monthlyTarget) * 100, 100) : 0;
  const healthTone = getHealthTone(data.cashFlowHealthScore);
  const hasAnyData =
    data.totalOutstanding > 0 ||
    data.recentActions.length > 0 ||
    data.topCriticalParties.length > 0 ||
    data.salespersonOutstanding.length > 0;

  if (!hasAnyData) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6" />}
        title="No dashboard data yet"
        description="Start by syncing your latest recovery records. KPIs and insights will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-600">
            Last synced: {data.lastSyncedAt ? formatRelativeTime(data.lastSyncedAt) : "Not synced yet"}
          </p>
        </div>
        <SyncNowButton />
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Total Outstanding"
          value={formatINR(data.totalOutstanding)}
          subtitle={`${activePartyCount} active parties • ${formatCompactINR(data.totalOutstanding)}`}
          icon={<Wallet className="h-5 w-5 text-red-600" />}
          color="red"
        />
        <KPICard
          title="Recovered This Month"
          value={formatINR(data.recoveredThisMonth)}
          subtitle={`${formatINR(data.monthlyTarget)} target → ${targetAchievedPct.toFixed(0)}% achieved`}
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          color="green"
          progress={targetAchievedPct}
        />
        <KPICard
          title="Overdue >90 Days"
          value={formatINR(data.overdue90Plus)}
          subtitle={`${data.overdue90PlusCount} parties at risk`}
          icon={<AlertCircle className="h-5 w-5 text-red-600" />}
          color="red"
        />
        <KPICard
          title="Cash Flow Health"
          value={`${data.cashFlowHealthScore}/100`}
          subtitle={healthTone.label}
          icon={<HeartPulse className="h-5 w-5 text-pink-600" />}
          color={healthTone.color}
        />
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <SalespeopleChart data={data.salespersonOutstanding} />
        <AgingChart data={data.agingBuckets} />
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <CollectionEfficiencyTrendChart data={data.collectionEfficiencyTrend} />
        <AgingMovementPanel data={data.agingMovement} />
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <SalespersonCollectionQualityTable rows={data.salespersonCollectionQuality} />
        <PaymentBehaviorByCustomerTable rows={data.paymentBehaviorByCustomer} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AIInsightPanel
          recoveredThisMonth={data.recoveredThisMonth}
          totalOutstanding={data.totalOutstanding}
          overdue90PlusCount={data.overdue90PlusCount}
          topCriticalParties={data.topCriticalParties}
          recentActionsCount={data.recentActions.length}
        />
        <RecentActionsFeed actions={data.recentActions} />
      </section>

      <section>
        <CriticalPartiesTable parties={data.topCriticalParties} />
      </section>
    </div>
  );
}
