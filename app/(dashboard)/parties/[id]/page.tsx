import { headers } from "next/headers";
import { Inbox } from "lucide-react";
import { PartyDetailView } from "@/components/parties/PartyDetailView";
import { EmptyState } from "@/components/shared/EmptyState";
import type { PartyDetailResponse } from "@/types/party";

async function getPartyData(id: string): Promise<PartyDetailResponse | null> {
  const headerStore = headers();
  const host = headerStore.get("host");
  if (!host) return null;
  const protocol = process.env.NODE_ENV === "development" ? "http" : headerStore.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${protocol}://${host}`;
  const response = await fetch(`${baseUrl}/api/parties/${id}`, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as PartyDetailResponse;
}

export default async function PartyDetailPage({ params }: { params: { id: string } }) {
  const data = await getPartyData(params.id);

  if (!data) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6" />}
        title="Party not found"
        description="The selected party could not be loaded. Please try from the dashboard again."
      />
    );
  }

  return <PartyDetailView initialData={data} />;
}
