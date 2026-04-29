"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

type SyncLog = {
  id: string;
  syncType: "auto" | "manual" | "cron";
  status: "success" | "failed" | "partial";
  partiesUpdated: number;
  durationMs: number;
  errorMessage: string | null;
  syncedAt: string;
};

const setupSteps = [
  { label: "Download bridge script", code: "curl -O https://example.com/sync_to_vercel.py" },
  { label: "Install Python 3.9+", code: "python3 --version" },
  { label: "Install dependencies", code: "pip install requests python-dotenv" },
  { label: "Configure .env", code: "VERCEL_API_URL=https://your-app.vercel.app\nBRIDGE_SECRET=replace_me" },
  { label: "Test bridge", code: "python sync_to_vercel.py" },
  { label: "Schedule daily cron", code: "0 8 * * * /usr/bin/python3 /path/to/sync_to_vercel.py" },
];

export default function SyncPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [runningManual, setRunningManual] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const today = new Date();
  const currentYear = today.getFullYear();
  const fiscalYearStartYear = today.getMonth() >= 3 ? currentYear : currentYear - 1;
  const defaultFromDate = `${fiscalYearStartYear}-04-01`;
  const defaultToDate = today.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [dateError, setDateError] = useState<string | null>(null);

  async function loadData() {
    const response = await fetch("/api/sync-logs", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { logs: SyncLog[] };
    setLogs(data.logs);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function forceSyncNow() {
    setDateError(null);
    if (!fromDate || !toDate) {
      setDateError("Select both From Date and To Date.");
      return;
    }
    if (fromDate > toDate) {
      setDateError("From Date cannot be later than To Date.");
      return;
    }

    setLastSyncMessage(null);
    setRunningManual(true);
    try {
      const response = await fetch("/api/sync/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromDate, toDate }),
      });
      const body = (await response.json()) as {
        message?: string;
        error?: string;
        status?: "queued" | "running" | "success" | "failed";
        jobId?: string;
        partiesUpdated?: number;
        totalOutstanding?: number;
        fromDate?: string;
        toDate?: string;
      };
      if (!response.ok) {
        window.alert(body.error ?? body.message ?? "Manual sync failed");
      } else {
        if (body.jobId) {
          setLastSyncMessage("Manual sync started. Fetching full data from Tally...");
          const startedAt = Date.now();
          const maxWaitMs = 20 * 60 * 1000;
          while (Date.now() - startedAt < maxWaitMs) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            const jobResponse = await fetch(`/api/sync/manual?jobId=${encodeURIComponent(body.jobId)}`, {
              cache: "no-store",
            });
            if (!jobResponse.ok) continue;
            const job = (await jobResponse.json()) as {
              status: "queued" | "running" | "success" | "failed";
              message?: string;
              error?: string;
              result?: {
                message?: string;
                partiesUpdated?: number;
                totalOutstanding?: number;
                fromDate?: string;
                toDate?: string;
              };
            };
            if (job.status === "queued" || job.status === "running") {
              setLastSyncMessage(job.message ?? "Manual sync in progress...");
              continue;
            }
            if (job.status === "failed") {
              window.alert(job.error ?? job.message ?? "Manual sync failed");
              break;
            }
            const result = job.result ?? {};
            const syncedParties = result.partiesUpdated ?? 0;
            const totalOutstanding = result.totalOutstanding ?? 0;
            const rangeText =
              result.fromDate && result.toDate ? `Range: ${result.fromDate} to ${result.toDate} • ` : "";
            setLastSyncMessage(
              `${result.message ?? "Sync completed"} • ${rangeText}Parties updated: ${syncedParties} • Total outstanding: ₹${Math.round(totalOutstanding).toLocaleString("en-IN")}`
            );
            break;
          }
        } else {
          const syncedParties = body.partiesUpdated ?? 0;
          const totalOutstanding = body.totalOutstanding ?? 0;
          const rangeText = body.fromDate && body.toDate ? `Range: ${body.fromDate} to ${body.toDate} • ` : "";
          setLastSyncMessage(
            `${body.message ?? "Sync completed"} • ${rangeText}Parties updated: ${syncedParties} • Total outstanding: ₹${Math.round(totalOutstanding).toLocaleString("en-IN")}`
          );
        }
      }
      await loadData();
      window.dispatchEvent(new Event("recoveryai:sync-logs-updated"));
      router.refresh();
    } finally {
      setRunningManual(false);
    }
  }

  const status = useMemo(() => {
    const latest = logs[0];
    if (!latest) return { label: "⚠️ No logs", style: "text-amber-600", lastSynced: "Never synced" };
    if (latest.status === "failed") return { label: "❌ Failed", style: "text-red-600", lastSynced: formatRelativeTime(latest.syncedAt) };
    if (latest.status === "partial") return { label: "⚠️ Partial", style: "text-amber-600", lastSynced: formatRelativeTime(latest.syncedAt) };
    const ageMs = Date.now() - new Date(latest.syncedAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) return { label: "⚠️ Stale", style: "text-amber-600", lastSynced: formatRelativeTime(latest.syncedAt) };
    return { label: "✅ Healthy", style: "text-emerald-600", lastSynced: formatRelativeTime(latest.syncedAt) };
  }, [logs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sync from Tally</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Press this button anytime to fetch latest receivables from Tally and refresh dashboard values.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-slate-500">From Date</p>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">To Date</p>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
          </div>
          <Button
            type="button"
            onClick={forceSyncNow}
            disabled={runningManual}
            size="lg"
            className="w-full bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400 sm:w-auto"
          >
            {runningManual ? "Syncing from Tally..." : "Sync from Tally Now"}
          </Button>
          {dateError ? <p className="text-sm text-red-700">{dateError}</p> : null}
          {lastSyncMessage ? <p className="text-sm text-emerald-700">{lastSyncMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current Status</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className={`text-3xl font-semibold ${status.style}`}>{status.label}</p>
          <p className="text-sm text-slate-600">Last synced: {status.lastSynced}</p>
          <p className="text-sm text-slate-600">Scheduled syncs use your office bridge (cron). Manual sync uses Settings → Tally URL.</p>
          <Button
            type="button"
            variant="outline"
            onClick={forceSyncNow}
            disabled={runningManual}
            className="border-slate-300 text-slate-900 hover:bg-slate-100"
          >
            {runningManual ? "Syncing..." : "Force sync again"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowSetup((v) => !v)}>
          <CardTitle className="flex items-center justify-between">
            How to setup Tally Bridge
            <ChevronDown className={`h-4 w-4 transition ${showSetup ? "rotate-180" : ""}`} />
          </CardTitle>
        </CardHeader>
        {showSetup ? (
          <CardContent className="space-y-3">
            {setupSteps.map((step, idx) => (
              <div key={step.label} className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">{idx + 1}. {step.label}</p>
                <pre className="overflow-auto rounded-md bg-slate-900 p-2 text-xs text-slate-100">{step.code}</pre>
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-2"
                  onClick={async () => navigator.clipboard.writeText(step.code)}
                >
                  <Copy className="mr-1 h-3 w-3" /> Copy
                </Button>
              </div>
            ))}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader><CardTitle>Sync History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Parties Updated</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <TableRow
                    className={log.status === "failed" ? "cursor-pointer bg-red-50" : ""}
                    onClick={() => log.status === "failed" && setExpandedError(expandedError === log.id ? null : log.id)}
                  >
                    <TableCell>{formatDateTime(log.syncedAt)}</TableCell>
                    <TableCell>{log.syncType === "auto" ? "Auto" : log.syncType === "manual" ? "Manual" : "Auto"}</TableCell>
                    <TableCell>{log.status}</TableCell>
                    <TableCell className="text-right">{log.partiesUpdated}</TableCell>
                    <TableCell className="text-right">{(log.durationMs / 1000).toFixed(1)}s</TableCell>
                    <TableCell className="max-w-80 truncate">{log.errorMessage ?? "-"}</TableCell>
                  </TableRow>
                  {expandedError === log.id && log.errorMessage ? (
                    <TableRow>
                      <TableCell colSpan={6} className="whitespace-normal bg-red-50 text-sm text-red-700">{log.errorMessage}</TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
