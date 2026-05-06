"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";

type EscalationStatus = "New" | "Escalated" | "InProgress" | "Resolved" | "Snoozed";
type EscalationRow = {
  id: string;
  name: string;
  salespersonId: string;
  salespersonName: string;
  outstanding: number;
  riskScore: number;
  daysOverdue: number;
  lastActionAt: string | null;
  lastActionNotes: string;
  suggestedEscalation: string;
  escalationDeadline: string | null;
  status: EscalationStatus;
};

export default function EscalationsPage() {
  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [salespersonFilter, setSalespersonFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskThreshold, setRiskThreshold] = useState(0);
  const [sortBy, setSortBy] = useState<"riskScore" | "outstanding" | "daysOverdue">("riskScore");

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch("/api/escalations", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { escalations: EscalationRow[] };
      setRows(data.escalations);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function updateStatus(id: string, status: EscalationStatus, snoozeDays?: number) {
    await fetch(`/api/escalations/${id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, snoozeDays }),
    });
    await loadData();
  }

  const salespeople = useMemo(
    () => Array.from(new Set(rows.map((row) => JSON.stringify({ id: row.salespersonId, name: row.salespersonName })))).map((v) => JSON.parse(v) as { id: string; name: string }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const next = rows
      .filter((row) => row.riskScore >= riskThreshold)
      .filter((row) => (salespersonFilter === "all" ? true : row.salespersonId === salespersonFilter))
      .filter((row) => (statusFilter === "all" ? true : row.status === statusFilter))
      .sort((a, b) => b[sortBy] - a[sortBy]);
    return next;
  }, [riskThreshold, rows, salespersonFilter, sortBy, statusFilter]);

  const kpis = useMemo(() => {
    const totalAtRisk = filteredRows.reduce((sum, row) => sum + row.outstanding, 0);
    const avgDaysOverdue =
      filteredRows.length > 0 ? filteredRows.reduce((sum, row) => sum + row.daysOverdue, 0) / filteredRows.length : 0;
    return {
      count: filteredRows.length,
      totalAtRisk,
      avgDaysOverdue: Number(avgDaysOverdue.toFixed(1)),
      criticalCount: filteredRows.filter((row) => row.riskScore >= 80).length,
    };
  }, [filteredRows]);

  function getRiskClass(score: number) {
    if (score >= 80) return "bg-red-50 border-l-4 border-red-600";
    if (score >= 60) return "bg-orange-50 border-l-4 border-orange-500";
    if (score >= 40) return "bg-yellow-50 border-l-4 border-yellow-500";
    return "";
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total escalations</p><p className="text-2xl font-semibold">{kpis.count}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total at risk</p><p className="text-2xl font-semibold">{formatINR(kpis.totalAtRisk)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Avg overdue</p><p className="text-2xl font-semibold">{kpis.avgDaysOverdue} d</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Critical count</p><p className="text-2xl font-semibold text-red-600">{kpis.criticalCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44">
              <p className="mb-1 text-xs text-slate-500">Salesperson</p>
              <Select value={salespersonFilter} onValueChange={(value) => setSalespersonFilter(value ?? "all")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {salespeople.map((sp) => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-44">
              <p className="mb-1 text-xs text-slate-500">Status</p>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {["New", "Escalated", "InProgress", "Resolved", "Snoozed"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-56 flex-1">
              <p className="mb-1 text-xs text-slate-500">Risk threshold: {riskThreshold}</p>
              <Input type="range" min={0} max={100} value={riskThreshold} onChange={(event) => setRiskThreshold(Number(event.target.value))} />
            </div>
            <Button variant="outline" onClick={() => setSortBy(sortBy === "riskScore" ? "outstanding" : sortBy === "outstanding" ? "daysOverdue" : "riskScore")}>
              <ArrowUpDown className="mr-1 h-4 w-4" /> Sort: {sortBy}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risk Score</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Salesperson</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Days Overdue</TableHead>
                <TableHead>Last Action</TableHead>
                <TableHead>Suggested Escalation</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quick Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10}>Loading...</TableCell></TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={row.id} className={getRiskClass(row.riskScore)}>
                    <TableCell><span className="font-semibold text-red-700">{row.riskScore}</span>/100</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.salespersonName}</TableCell>
                    <TableCell className="text-right">{formatINR(row.outstanding)}</TableCell>
                    <TableCell className="text-right">{row.daysOverdue}</TableCell>
                    <TableCell>{row.lastActionAt ? formatDate(row.lastActionAt) : "-"}</TableCell>
                    <TableCell className="max-w-[250px] whitespace-normal text-xs">{row.suggestedEscalation}</TableCell>
                    <TableCell>{row.escalationDeadline ? formatDate(row.escalationDeadline) : "-"}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="space-x-1">
                      <Button size="xs" variant="outline" onClick={() => updateStatus(row.id, "Escalated")}>Mark Escalated</Button>
                      <Button size="xs" variant="outline" onClick={() => updateStatus(row.id, "Snoozed", 7)}>Snooze 7 days</Button>
                      <Button size="xs" variant="outline" onClick={() => updateStatus(row.id, "Resolved")}>Resolve</Button>
                      <Button size="xs" render={<Link href={`/parties/${row.id}`} />}>View Party →</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
