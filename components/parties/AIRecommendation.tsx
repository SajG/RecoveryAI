"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatRelativeTime } from "@/lib/format";
import type { PartyRecommendation } from "@/types/party";

type AIRecommendationProps = {
  recommendationDate: string | Date | null;
  recommendation: string | null;
  aiActions: unknown;
  riskScore: number;
  redFlags: string[];
  onRegenerate: () => Promise<void>;
  regenerating: boolean;
  onUseAction: (label: string) => void;
  estimatedRecoveryPercent?: number;
};

function riskColor(score: number) {
  if (score >= 80) return "#dc2626";
  if (score >= 60) return "#ea580c";
  if (score >= 40) return "#ca8a04";
  return "#16a34a";
}

function urgencyLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("today")) return "Today";
  if (normalized.includes("week")) return "This Week";
  if (normalized.includes("month")) return "This Month";
  return value;
}

function parseActions(aiActions: unknown): PartyRecommendation["suggestedActions"] {
  if (!Array.isArray(aiActions)) return [];
  return aiActions
    .map((item) => {
      const candidate = item as { label?: string; urgency?: string };
      if (!candidate?.label || !candidate?.urgency) return null;
      return { label: candidate.label, urgency: candidate.urgency };
    })
    .filter((item): item is { label: string; urgency: string } => Boolean(item))
    .slice(0, 3);
}

export function AIRecommendation({
  recommendationDate,
  recommendation,
  aiActions,
  riskScore,
  redFlags,
  onRegenerate,
  regenerating,
  onUseAction,
  estimatedRecoveryPercent,
}: AIRecommendationProps) {
  const actions = parseActions(aiActions);
  const hasRecommendation = Boolean(recommendation);
  const score = Math.max(0, Math.min(100, riskScore));
  const strokeColor = riskColor(score);
  const recoveryPercent = Math.max(0, Math.min(100, estimatedRecoveryPercent ?? Math.max(20, 100 - Math.floor(score * 0.7))));

  return (
    <Card className="border-0 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 ring-1 ring-indigo-100">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>🤖 AI Recommendation</CardTitle>
          <p className="mt-1 text-xs text-slate-600">
            Last updated: {recommendationDate ? formatRelativeTime(recommendationDate) : "Never"}
          </p>
        </div>
        <Button variant="outline" onClick={onRegenerate} disabled={regenerating}>
          <RefreshCcw className="mr-1 h-4 w-4" />
          {hasRecommendation ? "Regenerate" : "Generate AI Recommendation"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasRecommendation ? (
          <div className="rounded-lg border border-dashed border-indigo-200 bg-white/70 p-8 text-center text-slate-700">
            Generate AI recommendation to see risk scoring and next best action.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
              <div className="rounded-lg bg-white/90 p-4 ring-1 ring-slate-200">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Risk Score</p>
                <div className="flex items-center justify-center">
                  <svg width="180" height="110" viewBox="0 0 180 110">
                    <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
                    <path
                      d="M20 90 A70 70 0 0 1 160 90"
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={`${(score / 100) * 220} 220`}
                    />
                    <text x="90" y="80" textAnchor="middle" className="fill-slate-900 text-3xl font-bold">
                      {score}
                    </text>
                  </svg>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-base leading-7 text-slate-800">{recommendation}</p>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-900">Suggested Actions</p>
                  <div className="space-y-2">
                    {actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => onUseAction(action.label)}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
                      >
                        <span className="text-sm font-medium text-slate-800">{action.label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {urgencyLabel(action.urgency)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg bg-white/90 p-4 ring-1 ring-slate-200">
                <p className="mb-2 text-sm font-semibold text-slate-900">Red Flags</p>
                {redFlags.length === 0 ? (
                  <p className="text-sm text-slate-600">No major red flags identified.</p>
                ) : (
                  <ul className="space-y-2">
                    {redFlags.map((flag) => (
                      <li key={flag} className="flex items-start gap-2 text-sm text-slate-700">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg bg-white/90 p-4 ring-1 ring-slate-200">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <p className="font-semibold text-slate-900">Estimated Recovery</p>
                  <span className="font-medium text-emerald-700">{recoveryPercent}%</span>
                </div>
                <Progress value={recoveryPercent} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
