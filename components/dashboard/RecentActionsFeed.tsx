"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/format";
import type { RecentAction } from "@/types/dashboard";
import { Mail, MessageCircle, Phone, Scale, Truck, UserRound } from "lucide-react";

type RecentActionsFeedProps = {
  actions: RecentAction[];
  loading?: boolean;
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

export function RecentActionsFeed({ actions, loading = false }: RecentActionsFeedProps) {
  if (loading) {
    return (
      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200/80 ring-0">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>📋 Recent Actions</CardTitle>
        <Link href="/actions" className="text-sm font-medium text-[rgb(var(--primary))] hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
            No recent actions yet. Log calls, visits, or WhatsApp follow-ups to see activity here.
          </div>
        ) : (
          actions.map((action) => {
          const Icon = getActionIcon(action.actionType);
          const initials = action.salespersonName
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <Link
              href={`/parties/${action.partyId}`}
              key={action.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50"
            >
              <Avatar size="sm">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="rounded-md bg-slate-100 p-2 text-slate-600">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{action.partyName}</p>
                <p className="truncate text-xs text-slate-600">
                  {action.actionType} · {action.salespersonName}
                </p>
              </div>
              <p className="text-xs text-slate-500">{action.completedAt ? formatRelativeTime(action.completedAt) : "-"}</p>
            </Link>
          );
          })
        )}
      </CardContent>
    </Card>
  );
}
