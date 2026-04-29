import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { EmptyState } from "@/components/shared/EmptyState";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import {
  formatDate,
  formatDateTime,
  formatINR,
  formatRelativeTime,
} from "@/lib/format";
import { Inbox } from "lucide-react";

const sampleDate = new Date("2026-04-24T08:30:00");
const relativeDate = new Date(Date.now() - 2 * 60 * 60 * 1000);

export default function TestUtilsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-foreground">Utility Test Playground</h1>
        <p className="text-sm text-muted-foreground">
          Quick visual checks for currency, priority badges, date formatters, and empty states.
        </p>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Currency Formats</h2>
        <div className="grid gap-3 text-sm">
          <p>
            Standard (large): <CurrencyDisplay amount={12345678} />
          </p>
          <p>
            Standard (negative):{" "}
            <CurrencyDisplay amount={-345000} colorizeNegative />
          </p>
          <p>
            Compact (crores): <CurrencyDisplay amount={12300000} compact />
          </p>
          <p>
            Compact (lakhs): <CurrencyDisplay amount={6500000} compact />
          </p>
          <p>
            Compact (thousands): <CurrencyDisplay amount={50000} compact />
          </p>
          <p>
            Direct formatter: <span className="font-mono">{formatINR(9876543)}</span>
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Priority Badges</h2>
        <div className="flex flex-wrap gap-3">
          <PriorityBadge priority="Critical" />
          <PriorityBadge priority="High" />
          <PriorityBadge priority="Medium" />
          <PriorityBadge priority="Low" />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Date Examples</h2>
        <div className="grid gap-2 text-sm">
          <p>formatDate: {formatDate(sampleDate)}</p>
          <p>formatDateTime: {formatDateTime(sampleDate)}</p>
          <p>formatRelativeTime: {formatRelativeTime(relativeDate)}</p>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Empty State</h2>
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="No recoveries yet"
          description="Once party follow-ups are logged, this section will show the latest actions."
          action={
            <button className="rounded-md bg-[rgb(var(--primary))] px-4 py-2 text-sm font-medium text-white">
              Add Follow-up
            </button>
          }
        />
      </section>
    </main>
  );
}
