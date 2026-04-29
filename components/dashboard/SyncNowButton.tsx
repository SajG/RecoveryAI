"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncNowButton() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSync() {
    setIsSyncing(true);
    try {
      await fetch("/api/tally/manual-sync", { method: "POST" });
      router.refresh();
    } catch (_error) {
      // Keep interaction resilient on dashboard quick-sync.
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Button onClick={handleSync} disabled={isSyncing} className="gap-2">
      <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
      {isSyncing ? "Syncing..." : "Sync Now"}
    </Button>
  );
}
