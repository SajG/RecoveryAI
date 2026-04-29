"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Mail, MapPin, MessageCircle, Phone, Plus, Scale, Truck, UserRound } from "lucide-react";
import { AIRecommendation } from "@/components/parties/AIRecommendation";
import { ActionModal } from "@/components/parties/ActionModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatINR, formatRelativeTime } from "@/lib/format";
import { getPriorityColor } from "@/lib/rules";
import { cn } from "@/lib/utils";
import type { PartyDetailResponse } from "@/types/party";

type PartyDetailViewProps = {
  initialData: PartyDetailResponse;
};

function getActionIcon(actionType: string) {
  switch (actionType) {
    case "Call":
      return Phone;
    case "Visit":
      return UserRound;
    case "WhatsApp":
      return MessageCircle;
    case "Email":
      return Mail;
    case "LegalNotice":
      return Scale;
    case "StopSupply":
      return Truck;
    default:
      return Phone;
  }
}

export function PartyDetailView({ initialData }: PartyDetailViewProps) {
  const [data, setData] = useState(initialData);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [prefilledAction, setPrefilledAction] = useState<string | undefined>(undefined);
  const router = useRouter();

  async function refreshData() {
    const response = await fetch(`/api/parties/${data.party.id}`, { cache: "no-store" });
    if (!response.ok) return;
    const next = (await response.json()) as PartyDetailResponse;
    setData(next);
    router.refresh();
  }

  async function regenerateRecommendation() {
    setLoadingRecommendation(true);
    try {
      const response = await fetch(`/api/parties/${data.party.id}/regenerate-recommendation`, { method: "POST" });
      if (response.ok) {
        await refreshData();
      }
    } finally {
      setLoadingRecommendation(false);
    }
  }

  const sortedInvoices = useMemo(
    () => [...data.invoices].sort((a, b) => b.overdueDays - a.overdueDays || b.pendingAmount - a.pendingAmount),
    [data.invoices]
  );
  const sortedPayments = useMemo(
    () =>
      [...data.payments].sort(
        (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      ),
    [data.payments]
  );

  const outstandingTrend = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, idx) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - idx));
      const month = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date);
      return { month, outstanding: Math.max(0, data.party.outstanding * (0.58 + idx * 0.08)) };
    });
    return months;
  }, [data.party.outstanding]);

  const totalInvoiceAmount = sortedInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalPending = sortedInvoices.reduce((sum, invoice) => sum + invoice.pendingAmount, 0);

  const priorityColors = getPriorityColor((data.party.priority as "Critical" | "High" | "Medium" | "Low") ?? "Low");
  const overdueDanger = data.party.daysSinceLastPayment > 60;
  const lastActionAt = data.actions[0]?.completedAt;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 bg-white/90 px-4 py-2 backdrop-blur md:hidden">
        <h1 className="truncate text-lg font-semibold text-slate-900">{data.party.name}</h1>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="self-start xl:sticky xl:top-6">
          <Card className="border border-slate-200">
            <CardContent className="space-y-4 pt-4">
              <Link href={`/dashboard?salesperson=${encodeURIComponent(data.party.salesperson.name)}`} className="text-sm text-indigo-600 hover:underline">
                ← Back to {data.party.salesperson.name}
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{data.party.name}</h1>
                <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4" />
                  <span>{data.party.address || "Address not available"}</span>
                </p>
              </div>
              <div className="space-y-1 text-sm">
                <a href={`tel:${data.party.phone}`} className="flex items-center gap-2 text-slate-700 hover:text-indigo-700">
                  <Phone className="h-4 w-4" /> {data.party.phone}
                </a>
                <a href={`mailto:${data.party.email}`} className="flex items-center gap-2 text-slate-700 hover:text-indigo-700">
                  <Mail className="h-4 w-4" /> {data.party.email}
                </a>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Outstanding</p>
                <p className={cn("text-5xl font-black", priorityColors.text)}>{formatINR(data.party.outstanding)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn("border", priorityColors.bg, priorityColors.text, priorityColors.border)}>{data.party.priority}</Badge>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <Avatar>
                    <AvatarFallback>{data.party.salesperson.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-slate-500">Salesperson</p>
                    <p className="font-semibold text-slate-900">{data.party.salesperson.name}</p>
                  </div>
                </div>
              </div>
              <p className={cn("text-sm font-medium", overdueDanger ? "text-red-600" : "text-slate-700")}>
                Last payment: {data.party.daysSinceLastPayment} days ago
              </p>
              <p className="text-sm text-slate-700">
                Last action: {lastActionAt ? formatRelativeTime(lastActionAt) : "No actions yet"}
              </p>
            </CardContent>
          </Card>
        </aside>

        <section>
          <Tabs defaultValue="ai" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
              <TabsTrigger value="ai">🤖 AI</TabsTrigger>
              <TabsTrigger value="invoices">📄 Invoices</TabsTrigger>
              <TabsTrigger value="payments">💰 Payments</TabsTrigger>
              <TabsTrigger value="actions">📋 Actions</TabsTrigger>
              <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-4">
              <AIRecommendation
                recommendationDate={data.party.recommendationDate}
                recommendation={data.party.aiRecommendation}
                aiActions={data.party.aiActions}
                riskScore={data.party.riskScore}
                redFlags={data.party.redFlags}
                onRegenerate={regenerateRecommendation}
                regenerating={loadingRecommendation}
                onUseAction={(label) => {
                  setPrefilledAction(label);
                  setActionModalOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="invoices" className="mt-4">
              <Card className="border border-slate-200">
                <CardContent className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">Days Overdue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedInvoices.map((invoice) => (
                        <TableRow key={invoice.id} className={invoice.overdueDays > 90 ? "bg-red-50/70" : ""}>
                          <TableCell className="font-medium">{invoice.invoiceRef}</TableCell>
                          <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                          <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                          <TableCell className="text-right">{formatINR(invoice.amount)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatINR(invoice.pendingAmount)}</TableCell>
                          <TableCell className="text-right">{invoice.overdueDays}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="font-semibold">Total</TableCell>
                        <TableCell className="text-right font-semibold">{formatINR(totalInvoiceAmount)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatINR(totalPending)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="mt-4 space-y-4">
              <Card className="border border-slate-200">
                <CardHeader>
                  <CardTitle>Payment Trend (Last 12 Months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 min-h-[16rem] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <AreaChart data={data.paymentTrend}>
                        <defs>
                          <linearGradient id="paymentTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatINR(Number(value))} />
                        <Area type="monotone" dataKey="amount" stroke="#2563eb" fillOpacity={1} fill="url(#paymentTrend)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Payment History</CardTitle>
                  <Badge className="bg-slate-900 text-white">Days since last payment: {data.party.daysSinceLastPayment}</Badge>
                </CardHeader>
                <CardContent>
                  {sortedPayments.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-10 text-center text-slate-600">No payments received in this period 😔</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatINR(payment.amount)}</TableCell>
                            <TableCell>{payment.method}</TableCell>
                            <TableCell>{payment.reference}</TableCell>
                            <TableCell className="max-w-[320px] truncate">{payment.notes || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="mt-4">
              <Card className="border border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Action History</CardTitle>
                  <Button
                    onClick={() => {
                      setPrefilledAction(undefined);
                      setActionModalOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Log New Action
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.actions.map((action) => {
                      const Icon = getActionIcon(action.actionType);
                      return (
                        <div key={action.id} className="relative rounded-xl border border-slate-200 bg-white p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-slate-100 p-2 text-slate-700"><Icon className="h-4 w-4" /></span>
                              <div>
                                <p className="font-semibold text-slate-900">{action.actionType}</p>
                                <p className="text-xs text-slate-500">
                                  {action.completedAt ? formatDate(action.completedAt) : "-"} •{" "}
                                  {action.completedAt ? formatRelativeTime(action.completedAt) : "pending"}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline">{action.outcome}</Badge>
                          </div>
                          <p className="mb-2 text-sm text-slate-700">{action.notes}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                            <span>Created by: {action.createdBy}</span>
                            {action.amountCommitted ? <span>Committed: {formatINR(action.amountCommitted)}</span> : null}
                            {action.amountRecovered ? <span>Recovered: {formatINR(action.amountRecovered)}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">DSO</p><p className="text-3xl font-bold">{data.metrics.dso}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Payment Behavior Score</p><p className="text-3xl font-bold">{data.metrics.paymentBehaviorScore}/100</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Average Payment Delay</p><p className="text-3xl font-bold">{data.metrics.avgPaymentDelay} days</p></CardContent></Card>
              </div>

              <Card className="border border-slate-200">
                <CardHeader><CardTitle>Aging Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { key: "0-30", value: data.aging["0-30"] },
                    { key: "31-60", value: data.aging["31-60"] },
                    { key: "61-90", value: data.aging["61-90"] },
                    { key: "91-180", value: data.aging["91-180"] },
                    { key: "180+", value: data.aging["180+"] },
                  ].map((bucket) => {
                    const pct = data.party.outstanding > 0 ? Math.min(100, (bucket.value / data.party.outstanding) * 100) : 0;
                    return (
                      <div key={bucket.key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>{bucket.key} days</span>
                          <span className="font-medium">{formatINR(bucket.value)}</span>
                        </div>
                        <Progress value={pct} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border border-slate-200">
                <CardHeader><CardTitle>Outstanding Trend (6 Months)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64 min-h-[16rem] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <LineChart data={outstandingTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatINR(Number(value))} />
                        <Line type="monotone" dataKey="outstanding" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <ActionModal
        partyId={data.party.id}
        defaultCreatedBy={data.party.salesperson.name}
        open={actionModalOpen}
        onOpenChange={setActionModalOpen}
        prefilledActionLabel={prefilledAction}
        onSuccess={refreshData}
      />
    </div>
  );
}
