import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { processBridgePayload } from "@/lib/sync";
import { BridgePayloadSchema } from "@/lib/validation";

const MAX_REQUEST_BYTES = 10 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitByIp = new Map<string, number>();

function extractToken(request: Request): string {
  const raw = request.headers.get("authorization") ?? "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function safeTokenCompare(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function checkRateLimit(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-for") ?? "unknown";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const lastSeen = rateLimitByIp.get(ip);
  if (lastSeen && now - lastSeen < RATE_LIMIT_WINDOW_MS) {
    return false;
  }
  rateLimitByIp.set(ip, now);
  return true;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let partiesUpdated = 0;

  try {
    const expectedSecret = process.env.BRIDGE_SECRET;
    const providedToken = extractToken(request);
    if (!expectedSecret || !providedToken || !safeTokenCompare(providedToken, expectedSecret)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(request)) {
      return NextResponse.json({ success: false, message: "Rate limit exceeded" }, { status: 429 });
    }

    const contentLengthHeader = request.headers.get("content-length");
    const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ success: false, message: "Payload too large" }, { status: 413 });
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
      return NextResponse.json({ success: false, message: "Payload too large" }, { status: 413 });
    }

    const jsonBody = JSON.parse(rawBody) as unknown;
    const parsed = BridgePayloadSchema.safeParse(jsonBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payload",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const stats = await processBridgePayload(parsed.data);
    partiesUpdated = stats.parties;

    await prisma.syncLog.create({
      data: {
        syncType: "auto",
        status: "success",
        partiesUpdated: stats.parties,
        durationMs: stats.durationMs,
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: parsed.data.timestamp,
      stats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal sync error";
    console.error("Bridge sync failed", error);
    await prisma.syncLog.create({
      data: {
        syncType: "auto",
        status: "failed",
        partiesUpdated,
        durationMs: Date.now() - startedAt,
        errorMessage,
      },
    });
    return NextResponse.json({ success: false, message: "Unable to process bridge sync" }, { status: 500 });
  }
}
