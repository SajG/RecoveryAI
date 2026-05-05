import { Inbox, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsAppDigestPanel } from "@/components/salespeople/WhatsAppDigestPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompactINR, formatINR, formatRelativeTime } from "@/lib/format";
import { getDashboardMetrics } from "@/lib/dashboard-metrics";
import type { DashboardResponse } from "@/types/dashboard";

async function getDashboardData(): Promise<DashboardResponse | null> {
  try {
    return await getDashboardMetrics();
  } catch (error) {
    console.error("Failed to load salespeople metrics", error);
    return null;
  }
}

export default async function SalespeoplePage() {
  const data = await getDashboardData();

  if (!data) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6" />}
        title="Salespeople data unavailable"
        description="We couldn't load salesperson metrics right now. Please sync and try again."
      />
    );
  }

  if (data.salespersonOutstanding.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="No salespeople data yet"
        description="Sync your records to view outstanding balances by salesperson."
      />
    );
  }

  const totalOutstanding = data.salespersonOutstanding.reduce((sum, row) => sum + row.outstanding, 0);
  const totalParties = data.salespersonOutstanding.reduce((sum, row) => sum + row.partyCount, 0);
  const totalCritical = data.salespersonOutstanding.reduce((sum, row) => sum + row.criticalCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Salespeople</h2>
        <p className="text-sm text-slate-600">
          Last synced: {data.lastSyncedAt ? formatRelativeTime(data.lastSyncedAt) : "Not synced yet"}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border border-slate-200/80 ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold text-slate-900">{formatINR(totalOutstanding)}</CardContent>
        </Card>
        <Card className="border border-slate-200/80 ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Total Parties</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold text-slate-900">{totalParties}</CardContent>
        </Card>
        <Card className="border border-slate-200/80 ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Critical Parties (&gt;90d)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold text-red-600">{totalCritical}</CardContent>
        </Card>
      </section>

      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <CardTitle>Outstanding by Salesperson</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salesperson</TableHead>
                <TableHead className="text-right">Parties</TableHead>
                <TableHead className="text-right">Critical</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.salespersonOutstanding.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium text-slate-900">{row.name}</TableCell>
                  <TableCell className="text-right text-slate-700">{row.partyCount}</TableCell>
                  <TableCell className="text-right text-slate-700">{row.criticalCount}</TableCell>
                  <TableCell className="text-right font-semibold text-red-600">
                    {formatINR(row.outstanding)}
                    <span className="ml-2 text-xs font-medium text-slate-500">({formatCompactINR(row.outstanding)})</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <WhatsAppDigestPanel />
    </div>
  );
}
