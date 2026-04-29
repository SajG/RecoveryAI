import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { POST as runTallyManualSync } from "@/app/api/tally/manual-sync/route";

type ManualSyncRequest = {
  fromDate?: string;
  toDate?: string;
};

type ManualSyncJob = {
  id: string;
  status: "queued" | "running" | "success" | "failed";
  message: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  result?: Record<string, unknown>;
  error?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var recoveryAiManualSyncJobs: Map<string, ManualSyncJob> | undefined;
}

const JOB_TTL_MS = 60 * 60 * 1000;
const jobs = globalThis.recoveryAiManualSyncJobs ?? new Map<string, ManualSyncJob>();
if (!globalThis.recoveryAiManualSyncJobs) {
  globalThis.recoveryAiManualSyncJobs = jobs;
}

function cleanupJobs() {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export async function GET(request: Request) {
  cleanupJobs();
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ message: "jobId is required" }, { status: 400 });
  }
  const job = jobs.get(jobId);
  if (!job) {
    return NextResponse.json({ message: "Job not found or expired" }, { status: 404 });
  }
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    message: job.message,
    error: job.error,
    result: job.result,
    createdAt: new Date(job.createdAt).toISOString(),
    startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
  });
}

export async function POST(request: Request) {
  cleanupJobs();
  try {
    const payload = (await request.json().catch(() => ({}))) as ManualSyncRequest;

    const runningJob = [...jobs.values()].find((job) => job.status === "queued" || job.status === "running");
    if (runningJob) {
      return NextResponse.json(
        { message: "A manual sync is already in progress.", jobId: runningJob.id, status: runningJob.status },
        { status: 409 }
      );
    }

    const jobId = randomUUID();
    jobs.set(jobId, {
      id: jobId,
      status: "queued",
      message: "Manual sync queued",
      createdAt: Date.now(),
    });

    void (async () => {
      const job = jobs.get(jobId);
      if (!job) return;
      job.status = "running";
      job.message = "Manual sync in progress";
      job.startedAt = Date.now();
      try {
        const response = await runTallyManualSync(
          new Request("http://internal/api/tally/manual-sync", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              fromDate: payload.fromDate,
              toDate: payload.toDate,
            }),
          })
        );
        const responseBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
          job.status = "failed";
          job.message = (responseBody.message as string | undefined) ?? "Manual sync failed";
          job.error = (responseBody.error as string | undefined) ?? job.message;
          job.result = responseBody;
          job.finishedAt = Date.now();
          return;
        }
        job.status = "success";
        job.message = (responseBody.message as string | undefined) ?? "Manual sync completed";
        job.result = responseBody;
        job.finishedAt = Date.now();
      } catch (error) {
        job.status = "failed";
        job.message = "Manual sync failed";
        job.error = error instanceof Error ? error.message : "Unknown error";
        job.finishedAt = Date.now();
      }
    })();

    return NextResponse.json({
      message: "Manual sync started",
      jobId,
      status: "queued",
    });
  } catch (error) {
    console.error("Manual sync failed", error);
    return NextResponse.json({ message: "Unable to run manual sync" }, { status: 500 });
  }
}
