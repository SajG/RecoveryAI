import { NextResponse } from "next/server";
import { getDashboardMetrics } from "@/lib/dashboard-metrics";

export async function GET() {
  try {
    const payload = await getDashboardMetrics();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to build dashboard metrics", error);
    return NextResponse.json({ message: "Unable to load dashboard metrics" }, { status: 500 });
  }
}
