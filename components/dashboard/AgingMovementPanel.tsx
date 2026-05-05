"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactINR } from "@/lib/format";
import type { AgingMovement } from "@/types/dashboard";

type AgingMovementPanelProps = {
  data: AgingMovement;
};

export function AgingMovementPanel({ data }: AgingMovementPanelProps) {
  return (
    <Card className="min-w-0 border border-slate-200/80 ring-0">
      <CardHeader>
        <CardTitle>Aging Movement (Invoices Slipping Buckets)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Slipping in 7d</p>
            <p className="text-lg font-semibold text-slate-900">{data.slippingSoonCount}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Amount at risk</p>
            <p className="text-lg font-semibold text-amber-600">{formatCompactINR(data.slippingSoonAmount)}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Slipped in 7d</p>
            <p className="text-lg font-semibold text-slate-900">{data.slippedRecentlyCount}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Recently slipped</p>
            <p className="text-lg font-semibold text-red-600">{formatCompactINR(data.slippedRecentlyAmount)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Top invoices likely to slip next</p>
          <div className="space-y-2">
            {data.topSlippingInvoices.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices expected to slip buckets in the next 7 days.</p>
            ) : (
              data.topSlippingInvoices.map((invoice) => (
                <div key={invoice.invoiceId} className="rounded-md border border-slate-200 p-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{invoice.partyName}</p>
                      <p className="text-xs text-slate-500">
                        {invoice.invoiceRef} • {invoice.currentBucket} {"->"} {invoice.nextBucket}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCompactINR(invoice.pendingAmount)}</p>
                      <p className="text-xs text-amber-600">
                        {invoice.daysToSlip === null ? "-" : `${invoice.daysToSlip}d to slip`}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
