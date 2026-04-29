"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";

type Week = { index: number; weekStart: string; weekEnd: string };
type Row = { week: number; weekStart: string; weekEnd: string; targetAmount: number; actualAmount: number; achievement: number };
type SalespersonRow = { salespersonId: string; salespersonName: string; rows: Row[]; totalTarget: number; totalActual: number };

export default function RecoveryPlanPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [salespeople, setSalespeople] = useState<SalespersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Record<string, number[]> | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch("/api/recovery-targets", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { weeks: Week[]; salespeople: SalespersonRow[] };
      setWeeks(data.weeks);
      setSalespeople(data.salespeople);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function saveTarget(salespersonId: string, weekStart: string, value: number) {
    await fetch("/api/recovery-targets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ salespersonId, weekStart, targetAmount: Number.isFinite(value) ? value : 0 }),
    });
    await loadData();
  }

  async function handleSuggest() {
    const response = await fetch("/api/recovery-targets/suggest", { method: "POST" });
    if (!response.ok) return;
    const data = (await response.json()) as {
      suggestions: Array<{ salespersonId: string; weeklyTargets: number[] }>;
    };
    const map: Record<string, number[]> = {};
    for (const s of data.suggestions) map[s.salespersonId] = s.weeklyTargets;
    setSuggestions(map);
  }

  async function applySuggestions() {
    if (!suggestions) return;
    for (const row of salespeople) {
      const values = suggestions[row.salespersonId];
      if (!values) continue;
      for (let i = 0; i < row.rows.length; i += 1) {
        await saveTarget(row.salespersonId, row.rows[i].weekStart, values[i] ?? 0);
      }
    }
    setSuggestions(null);
    await loadData();
  }

  async function resetAll() {
    await fetch("/api/recovery-targets", { method: "DELETE" });
    await loadData();
  }

  function exportExcel() {
    const lines = [
      ["Salesperson", ...weeks.map((w) => `Week ${w.index}`), "Total"].join(","),
      ...salespeople.map((sp) => [sp.salespersonName, ...sp.rows.map((r) => r.targetAmount), sp.totalTarget].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recovery-targets.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = useMemo(() => {
    const totalTarget = salespeople.reduce((sum, row) => sum + row.totalTarget, 0);
    const totalRecovered = salespeople.reduce((sum, row) => sum + row.totalActual, 0);
    const achievement = totalTarget > 0 ? (totalRecovered / totalTarget) * 100 : 0;
    const health = achievement >= 85 ? "text-emerald-600" : achievement >= 60 ? "text-amber-600" : "text-red-600";
    return { totalTarget, totalRecovered, achievement, health };
  }, [salespeople]);

  const colTotals = useMemo(
    () =>
      weeks.map((week) =>
        salespeople.reduce((sum, row) => sum + (row.rows.find((r) => r.week === week.index)?.targetAmount ?? 0), 0)
      ),
    [salespeople, weeks]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div><p className="text-xs text-slate-500">Total target</p><p className="text-xl font-semibold">{formatINR(summary.totalTarget)}</p></div>
            <div><p className="text-xs text-slate-500">Total recovered</p><p className="text-xl font-semibold">{formatINR(summary.totalRecovered)}</p></div>
            <div><p className="text-xs text-slate-500">Achievement</p><p className="text-xl font-semibold">{summary.achievement.toFixed(1)}%</p></div>
            <div><p className="text-xs text-slate-500">Health</p><p className={`text-xl font-semibold ${summary.health}`}>{summary.achievement >= 85 ? "Healthy" : summary.achievement >= 60 ? "Watch" : "At Risk"}</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSuggest}><Sparkles className="mr-1 h-4 w-4" />Auto-suggest targets</Button>
            {suggestions ? <Button onClick={applySuggestions}>Apply</Button> : null}
            <Button variant="outline" onClick={exportExcel}><Download className="mr-1 h-4 w-4" />Export to Excel</Button>
            <Button variant="destructive" onClick={resetAll}><Trash2 className="mr-1 h-4 w-4" />Reset all</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salesperson</TableHead>
                {weeks.map((week) => (
                  <TableHead key={week.index}>
                    Week {week.index}: {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
                  </TableHead>
                ))}
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={weeks.length + 2}>Loading...</TableCell></TableRow>
              ) : (
                salespeople.map((sp) => (
                  <TableRow key={sp.salespersonId}>
                    <TableCell className="font-medium">{sp.salespersonName}</TableCell>
                    {sp.rows.map((cell, idx) => {
                      const achievement = cell.achievement;
                      const tone = achievement >= 85 ? "text-emerald-600" : achievement >= 60 ? "text-amber-600" : "text-red-600";
                      const suggested = suggestions?.[sp.salespersonId]?.[idx];
                      return (
                        <TableCell key={`${sp.salespersonId}_${cell.week}`} className="min-w-40">
                          <Input
                            type="number"
                            value={suggested ?? cell.targetAmount}
                            onChange={(event) => {
                              const next = Number(event.target.value || 0);
                              setSalespeople((current) =>
                                current.map((row) =>
                                  row.salespersonId === sp.salespersonId
                                    ? {
                                        ...row,
                                        rows: row.rows.map((r) =>
                                          r.week === cell.week ? { ...r, targetAmount: next } : r
                                        ),
                                      }
                                    : row
                                )
                              );
                            }}
                            onBlur={(event) => void saveTarget(sp.salespersonId, cell.weekStart, Number(event.target.value || 0))}
                          />
                          <p className="mt-1 text-xs text-slate-600">Actual: {formatINR(cell.actualAmount)}</p>
                          <p className={`text-xs font-medium ${tone}`}>{achievement.toFixed(0)}%</p>
                        </TableCell>
                      );
                    })}
                    <TableCell className="font-semibold">{formatINR(sp.totalTarget)}</TableCell>
                  </TableRow>
                ))
              )}
              {!loading && salespeople.length > 0 ? (
                <TableRow>
                  <TableCell className="font-semibold">Column Totals</TableCell>
                  {colTotals.map((value, idx) => <TableCell key={weeks[idx].index} className="font-semibold">{formatINR(value)}</TableCell>)}
                  <TableCell className="font-semibold">{formatINR(summary.totalTarget)}</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
