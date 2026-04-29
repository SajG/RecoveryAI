"use client";

import { useMemo, useState } from "react";
import { ExternalLink, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/format";

type WhatsAppDigestMessage = {
  salespersonId: string;
  salespersonName: string;
  salespersonPhone: string;
  salespersonEmail: string;
  partyCount: number;
  totalPending: number;
  message: string;
  waMeUrl: string | null;
};

type WhatsAppDigestResponse = {
  generatedAt: string;
  minAmount: number;
  minOverdueDays: number;
  salespersonCount: number;
  messages: WhatsAppDigestMessage[];
};

export function WhatsAppDigestPanel() {
  const [minAmount, setMinAmount] = useState("1000");
  const [minOverdueDays, setMinOverdueDays] = useState("60");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WhatsAppDigestResponse | null>(null);

  const parsedMinAmount = useMemo(() => {
    const parsed = Number.parseFloat(minAmount);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1000;
  }, [minAmount]);

  const parsedMinOverdueDays = useMemo(() => {
    const parsed = Number.parseInt(minOverdueDays, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 60;
  }, [minOverdueDays]);

  async function generateDigest() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/cron/salesperson-whatsapp-digest?minAmount=${encodeURIComponent(String(parsedMinAmount))}&minOverdueDays=${encodeURIComponent(String(parsedMinOverdueDays))}`,
        {
          cache: "no-store",
        }
      );
      const data = (await response.json()) as WhatsAppDigestResponse | { message?: string };
      if (!response.ok) {
        setError((data as { message?: string }).message ?? "Failed to generate WhatsApp digest.");
        setResult(null);
        return;
      }
      setResult(data as WhatsAppDigestResponse);
    } catch {
      setError("Failed to generate WhatsApp digest.");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border border-slate-200/80 ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-emerald-600" />
          WhatsApp Recovery Digest
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-[220px]">
            <p className="mb-1 text-xs text-slate-500">Minimum pending amount</p>
            <Input
              type="number"
              min={0}
              step={100}
              value={minAmount}
              onChange={(event) => setMinAmount(event.target.value)}
            />
          </div>
          <div className="w-full sm:max-w-[220px]">
            <p className="mb-1 text-xs text-slate-500">Minimum overdue days</p>
            <select
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              value={minOverdueDays}
              onChange={(event) => setMinOverdueDays(event.target.value)}
            >
              <option value="30">30+ days</option>
              <option value="60">60+ days</option>
              <option value="90">90+ days</option>
              <option value="120">120+ days</option>
            </select>
          </div>
          <Button
            type="button"
            onClick={generateDigest}
            disabled={isLoading}
            className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto"
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate WhatsApp Links"
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Includes only parties with selected overdue days filter (30+/60+/90+/120+).
        </p>
        <p className="text-xs text-slate-500">
          If button is not visible due theme, open this directly:{" "}
          <a
            className="font-medium text-slate-700 underline"
            href={`/api/cron/salesperson-whatsapp-digest?minAmount=${encodeURIComponent(String(parsedMinAmount))}&minOverdueDays=${encodeURIComponent(String(parsedMinOverdueDays))}`}
            target="_blank"
            rel="noreferrer"
          >
            View generated digest JSON
          </a>
        </p>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Generated for <strong>{result.salespersonCount}</strong> salespeople with pending amount threshold{" "}
              <strong>{formatINR(result.minAmount)}</strong> and overdue filter{" "}
              <strong>{result.minOverdueDays}+ days</strong>.
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-right">Parties</TableHead>
                  <TableHead className="text-right">Total Pending</TableHead>
                  <TableHead className="text-right">WhatsApp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.messages.map((item) => (
                  <TableRow key={item.salespersonId}>
                    <TableCell className="font-medium">{item.salespersonName}</TableCell>
                    <TableCell className="text-right">{item.partyCount}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">{formatINR(item.totalPending)}</TableCell>
                    <TableCell className="text-right">
                      {item.waMeUrl ? (
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <a href={item.waMeUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1 h-3.5 w-3.5" />
                              Open
                            </a>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => navigator.clipboard.writeText(item.message)}
                          >
                            Copy Msg
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700">Phone missing/invalid</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Generate a list to open prefilled `wa.me` links for each salesperson.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
