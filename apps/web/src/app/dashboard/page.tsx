"use client";

import Link from "next/link";

import { Skeleton } from "@tracklet /ui/components/skeleton";

import { useDashboard, monthRange } from "@/hooks/trackers";
import { ApiError } from "@/lib/api";
import { formatDate, formatCycleTime } from "@/lib/format";
import { toast } from "sonner";
import type { TrackerDTO } from "@tracklet /db/schemas";

/**
 * Dashboard (PRD FR-DASH-01..04): summary cards for the current month,
 * recent activity, and quick actions. One query → one cache entry.
 */
export default function DashboardPage() {
  const range = monthRange();
  const { data, isPending, error } = useDashboard(range);

  if (error instanceof ApiError) {
    toast.error(error.message);
  }

  const totals = data?.totals;

  const cards = [
    { label: "Total trackers", value: totals?.total },
    { label: "Completed", value: totals?.completed },
    { label: "Open", value: totals?.open },
    { label: "DevOps", value: totals?.devops },
    { label: "Support", value: totals?.support },
    { label: "PR references", value: totals?.uniquePrs },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.09em] text-primary">
            {new Date(range.from).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em]">
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/trackers/new"
            className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold shadow-[0_2px_0_0_rgba(17,19,24,0.14)] transition-[transform,box-shadow] hover:-translate-y-px active:translate-y-0 active:shadow-none"
          >
            Create tracker
          </Link>
          <Link
            href="/dashboard/trackers?status=OPEN"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_2px_0_0_#0c3fd4,0_10px_20px_rgba(15,17,20,0.12)] transition-[transform,box-shadow] hover:-translate-y-px active:translate-y-0 active:shadow-none"
          >
            Close a tracker
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card px-4 py-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
              {label}
            </p>
            {isPending ? (
              <Skeleton className="mt-2 h-7 w-10 rounded-md" />
            ) : (
              <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-[-.03em]">
                {value ?? 0}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Cycle time strip */}
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
          Avg cycle time (completed this month)
        </p>
        <p className="mt-1 text-xl font-extrabold tabular-nums tracking-[-.03em]">
          {formatCycleTime(totals?.avgCycleTimeMinutes ?? null)}
        </p>
      </div>

      {/* Recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentList
          title="Recently created"
          items={data?.recentCreated ?? []}
          isPending={isPending}
          dateOf={(t) => formatDate(t.startedAt)}
        />
        <RecentList
          title="Recently completed"
          items={data?.recentCompleted ?? []}
          isPending={isPending}
          dateOf={(t) => (t.completedAt ? formatDate(t.completedAt) : "—")}
        />
      </div>
    </div>
  );
}

function RecentList({
  title,
  items,
  isPending,
  dateOf,
}: {
  title: string;
  items: TrackerDTO[];
  isPending: boolean;
  dateOf: (t: TrackerDTO) => string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <h2 className="border-b border-border px-5 py-3 text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
        {title}
      </h2>
      {isPending ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Nothing yet this month.
        </p>
      ) : (
        <ul>
          {items.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between border-b border-border/60 px-5 py-2.5 last:border-b-0"
            >
              <Link
                href={`/dashboard/trackers/${t.id}`}
                className="text-sm font-semibold tabular-nums hover:text-primary"
              >
                {t.ticketId}
              </Link>
              <span className="text-[13px] text-muted-foreground">
                {dateOf(t)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
