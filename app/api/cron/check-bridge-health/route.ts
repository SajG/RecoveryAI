import { NextResponse } from "next/server";
import { sendOwnerEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings } from "@/lib/settings";

export async function GET() {
  try {
    const [settings, latestSync] = await Promise.all([
      getOrCreateSettings(),
      prisma.syncLog.findFirst({ orderBy: { syncedAt: "desc" } }),
    ]);

    const stale = !latestSync || Date.now() - latestSync.syncedAt.getTime() > 24 * 60 * 60 * 1000;
    if (stale && settings.alertOnSyncFail) {
      await sendOwnerEmail({
        to: settings.ownerEmail,
        subject: "Bridge health alert: sync stale",
        html: "<p>No successful sync in the last 24 hours. Please check your Tally bridge service.</p>",
      });
    }

    return NextResponse.json({
      healthy: !stale,
      lastSyncedAt: latestSync?.syncedAt ?? null,
    });
  } catch (error) {
    console.error("Failed bridge health check", error);
    return NextResponse.json({ message: "Unable to run bridge health check" }, { status: 500 });
  }
}
