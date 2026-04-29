"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiPath } from "@/lib/client-api";
import { formatRelativeTime } from "@/lib/format";

type SyncLog = {
  id: string;
  status: "success" | "failed" | "partial";
  syncedAt: string;
};

function badgeFromLatest(latest: SyncLog | null): { label: string; dot: string } {
  if (!latest) {
    return { label: "No sync yet", dot: "bg-slate-400" };
  }

  const ageMs = Date.now() - new Date(latest.syncedAt).getTime();
  const stale = ageMs > 24 * 60 * 60 * 1000;
  const when = formatRelativeTime(latest.syncedAt);

  if (latest.status === "failed") {
    return { label: `Sync failed · ${when}`, dot: "bg-red-500" };
  }
  if (latest.status === "partial") {
    return { label: `Partial sync · ${when}`, dot: "bg-amber-500" };
  }
  if (stale) {
    return { label: `Stale · ${when}`, dot: "bg-amber-500" };
  }
  return { label: `Synced ${when}`, dot: "bg-emerald-500" };
}

export function SyncStatusBadge() {
  const [state, setState] = useState<{ label: string; dot: string }>({
    label: "Loading…",
    dot: "bg-slate-300",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(apiPath("sync-logs"), { cache: "no-store" });
        if (!response.ok) throw new Error("bad response");
        const data = (await response.json()) as { logs: SyncLog[] };
        const latest = data.logs?.[0] ?? null;
        if (!cancelled) setState(badgeFromLatest(latest));
      } catch {
        if (!cancelled) setState({ label: "Sync status unknown", dot: "bg-slate-400" });
      }
    }

    void load();
    const interval = setInterval(load, 60_000);
    const onRefresh = () => void load();
    window.addEventListener("recoveryai:sync-logs-updated", onRefresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("recoveryai:sync-logs-updated", onRefresh);
    };
  }, []);

  return (
    <Link
      href="/sync"
      className="inline-flex max-w-[220px] items-center gap-2 truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 transition hover:bg-slate-50 sm:max-w-xs"
      title={state.label}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${state.dot}`} />
      <span className="truncate">{state.label}</span>
    </Link>
  );
}
