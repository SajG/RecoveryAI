"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCompactINR } from "@/lib/format";

type ContactParty = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  outstanding: number;
  salespersonName: string;
};

type ContactCenterViewProps = {
  parties: ContactParty[];
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function defaultMessage(party: ContactParty): string {
  return `Hi ${party.name}, this is a reminder regarding your pending amount of ${formatCompactINR(
    party.outstanding
  )}. Please let us know your expected payment date.`;
}

function defaultEmailBody(party: ContactParty): string {
  return [
    `Dear ${party.name},`,
    "",
    `This is a gentle reminder that your outstanding amount is ${formatCompactINR(party.outstanding)}.`,
    "Please share your payment update and expected payment date.",
    "",
    "Regards,",
    `${party.salespersonName}`,
  ].join("\n");
}

export function ContactCenterView({ parties }: ContactCenterViewProps) {
  const [query, setQuery] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return parties;
    return parties.filter((party) => {
      return (
        party.name.toLowerCase().includes(keyword) ||
        party.salespersonName.toLowerCase().includes(keyword) ||
        party.email.toLowerCase().includes(keyword) ||
        party.phone.toLowerCase().includes(keyword)
      );
    });
  }, [parties, query]);

  const selectedParty = useMemo(
    () => parties.find((party) => party.id === selectedPartyId) ?? null,
    [parties, selectedPartyId]
  );

  function openEmailComposer(party: ContactParty) {
    setSelectedPartyId(party.id);
    setSubject(`Payment reminder - ${party.name}`);
    setBody(defaultEmailBody(party));
  }

  async function sendEmail() {
    if (!selectedParty) {
      toast.error("Select a party before sending.");
      return;
    }
    if (!selectedParty.email || selectedParty.email === "-") {
      toast.error("Selected party has no valid email.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required.");
      return;
    }

    try {
      setSending(true);
      const response = await fetch("/api/contacts/send-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partyId: selectedParty.id,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Failed to send email.");
      }
      toast.success("Email sent successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Contact Center</h2>
        <p className="text-sm text-slate-600">Use party master info to send WhatsApp messages and emails quickly.</p>
      </div>

      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <CardTitle>Email Composer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="party">Party</Label>
              <select
                id="party"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={selectedPartyId}
                onChange={(event) => setSelectedPartyId(event.target.value)}
              >
                <option value="">Select party</option>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name} ({party.salespersonName})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Email subject" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" rows={6} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Email message" />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void sendEmail()} disabled={sending}>
              {sending ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <CardTitle>Party Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search party, salesperson, phone, email"
              className="pl-9"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="pb-2 pr-3 font-medium">Party</th>
                  <th className="pb-2 pr-3 font-medium">Salesperson</th>
                  <th className="pb-2 pr-3 font-medium">Phone</th>
                  <th className="pb-2 pr-3 font-medium">Email</th>
                  <th className="pb-2 pr-3 font-medium">Address</th>
                  <th className="pb-2 pr-3 font-medium text-right">Outstanding</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((party) => {
                  const waPhone = normalizePhone(party.phone);
                  const waLink = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(defaultMessage(party))}` : "";
                  return (
                    <tr key={party.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-900">{party.name}</td>
                      <td className="py-2 pr-3 text-slate-600">{party.salespersonName}</td>
                      <td className="py-2 pr-3 text-slate-600">{party.phone || "-"}</td>
                      <td className="py-2 pr-3 text-slate-600">{party.email || "-"}</td>
                      <td className="max-w-[260px] truncate py-2 pr-3 text-slate-600" title={party.address}>
                        {party.address || "-"}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-700">{formatCompactINR(party.outstanding)}</td>
                      <td className="py-2 text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!waLink}
                            onClick={() => {
                              if (!waLink) return;
                              window.open(waLink, "_blank", "noopener,noreferrer");
                            }}
                          >
                            <MessageCircle className="mr-1 h-4 w-4" />
                            Message
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEmailComposer(party)}>
                            <Mail className="mr-1 h-4 w-4" />
                            Email
                          </Button>
                          <Button variant="outline" size="sm" render={<Link href={`/parties/${party.id}`} />}>
                            Open Party
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
