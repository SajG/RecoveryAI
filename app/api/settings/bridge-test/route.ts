import { NextResponse } from "next/server";
import { getOrCreateSettings } from "@/lib/settings";

function normalizeTallyUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `http://${trimmed}`;
}

export async function POST() {
  try {
    const settings = await getOrCreateSettings();
    const tallyUrl = normalizeTallyUrl(settings.tallyUrl);
    const envBridgeSecret = process.env.BRIDGE_SECRET ?? "";
    const settingsBridgeSecret = settings.bridgeSecret ?? "";
    const endpointPath = (settings.bridgeEndpointUrl || "/api/sync-from-bridge").trim();

    const checks = {
      tallyUrlConfigured: Boolean(tallyUrl),
      bridgeSecretInSettings: Boolean(settingsBridgeSecret),
      bridgeSecretInEnv: Boolean(envBridgeSecret),
      bridgeSecretMatches: Boolean(settingsBridgeSecret && envBridgeSecret && settingsBridgeSecret === envBridgeSecret),
      bridgeEndpointLooksValid: endpointPath.startsWith("/"),
      tallyReachable: false,
      tallyResponseValid: false,
    };

    let tallyStatusCode: number | null = null;
    let tallyBodyPreview = "";
    let tallyError: string | null = null;

    if (checks.tallyUrlConfigured) {
      try {
        const response = await fetch(tallyUrl, {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        const body = (await response.text()).trim();
        tallyStatusCode = response.status;
        tallyBodyPreview = body.slice(0, 200);
        checks.tallyReachable = response.ok;
        checks.tallyResponseValid = body === "<RESPONSE>TallyPrime Server is Running</RESPONSE>";
      } catch (error) {
        tallyError = error instanceof Error ? error.message : "Unknown Tally connection error";
      }
    }

    const ok =
      checks.tallyUrlConfigured &&
      checks.bridgeSecretInSettings &&
      checks.bridgeSecretInEnv &&
      checks.bridgeSecretMatches &&
      checks.bridgeEndpointLooksValid &&
      checks.tallyReachable &&
      checks.tallyResponseValid;

    return NextResponse.json(
      {
        ok,
        message: ok ? "Bridge test passed" : "Bridge test failed",
        checks,
        tallyStatusCode,
        tallyBodyPreview,
        tallyError,
      },
      { status: ok ? 200 : 400 }
    );
  } catch (error) {
    console.error("Bridge test failed", error);
    return NextResponse.json(
      { ok: false, message: "Unable to run bridge test" },
      { status: 500 }
    );
  }
}
