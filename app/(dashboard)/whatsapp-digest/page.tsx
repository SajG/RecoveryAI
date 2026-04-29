import { MessageCircle } from "lucide-react";
import { WhatsAppDigestPanel } from "@/components/salespeople/WhatsAppDigestPanel";

export default function WhatsAppDigestPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <MessageCircle className="h-6 w-6 text-emerald-600" />
          WhatsApp Digest
        </h2>
        <p className="text-sm text-slate-600">
          Generate ready-to-send WhatsApp links for salespeople based on high pending recoveries.
        </p>
      </div>
      <WhatsAppDigestPanel />
    </div>
  );
}
