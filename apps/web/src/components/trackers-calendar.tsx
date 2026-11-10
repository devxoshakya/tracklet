"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Skeleton } from "@tracklet/ui/components/skeleton";

import { useTrackersList, IST_MS } from "@/hooks/trackers";
import type { TrackerDTO } from "@tracklet/db/schemas";

/**
 * Calendar month view (PRD FR-VIEW-02..04), Untitled UI style: Sunday-first
 * grid, today as a filled circle, adjacent-month days dimmed, trackers as
 * category-colored chips that open the tracker detail. All day math is IST
 * (UTC+05:30, no DST): `anchor` is a shifted-space Date whose UTC parts are
 * the IST calendar parts, so cell keys and labels need no further shifting.
 * shortcut: shows at most the first 100 trackers of the month, upgrade if a
 * single user ever outgrows that.
 */

/** Sunday-first grid of `Date` cells covering the whole month (UTC). */
export function buildMonthGrid(anchor: Date): Date[] {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = first.getUTCDay();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  return Array.from(
    { length: weeks * 7 },
    (_, i) => new Date(first.getTime() + (i - offset) * 86_400_000),
  );
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TrackersCalendar({ anchor }: { anchor: Date }) {
  const cells = useMemo(() => buildMonthGrid(anchor), [anchor]);
  // Cell instants are IST midnights in shifted space — convert back to UTC.
  const gridFrom = new Date(cells[0].getTime() - IST_MS).toISOString();
  const gridTo = new Date(cells[cells.length - 1].getTime() + DAY_MS - IST_MS - 1).toISOString();

  const { data, isPending } = useTrackersList({
    startedFrom: gridFrom,
    startedTo: gridTo,
    sort: "startedAt",
    order: "asc",
    limit: 100,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, TrackerDTO[]>();
    for (const t of data?.pages[0]?.items ?? []) {
      // IST calendar date of the tracker's start instant.
      const key = new Date(new Date(t.startedAt).getTime() + IST_MS)
        .toISOString()
        .slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [data]);

  const monthLabel = anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  const fmtDay = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  const rangeLabel = `${fmtDay(anchor)} – ${fmtDay(monthEnd)}, ${anchor.getUTCFullYear()}`;
  const todayKey = new Date(Date.now() + IST_MS).toISOString().slice(0, 10);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Card header */}
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-xl font-extrabold tracking-[-.03em]">
          {monthLabel}
        </h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{rangeLabel}</p>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-px border-b border-border bg-border/60">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-card px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      {isPending ? (
        <div className="grid grid-cols-7 gap-px bg-border/60">
          {Array.from({ length: cells.length }).map((_, i) => (
            <div key={i} className="min-h-28 bg-card p-1.5">
              <Skeleton className="h-4 w-5 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-border/60">
          {cells.map((day) => {
            const key = day.toISOString().slice(0, 10);
            const inMonth = day.getUTCMonth() === anchor.getUTCMonth();
            const isToday = key === todayKey;
            const trackers = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                className={`min-h-28 bg-card p-1.5 ${inMonth ? "" : "bg-muted/30"}`}
              >
                {isToday ? (
                  <span className="mb-1 flex size-6 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                    {day.getUTCDate()}
                  </span>
                ) : (
                  <span
                    className={`mb-1 flex size-6 items-center justify-center text-[13px] tabular-nums ${
                      inMonth ? "text-foreground" : "text-muted-foreground/50"
                    }`}
                  >
                    {day.getUTCDate()}
                  </span>
                )}
                <div className="space-y-1">
                  {trackers.slice(0, 3).map((t) => (
                    <DayChip key={t.id} tracker={t} />
                  ))}
                  {trackers.length > 3 ? (
                    <span className="block px-1 text-[10px] text-muted-foreground">
                      {trackers.length - 3} more…
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Chip colored like the list chips: green = completed, purple = Support, dark = Development. */
function DayChip({ tracker }: { tracker: TrackerDTO }) {
  const completed = tracker.status === "COMPLETED";
  const support = tracker.category === "SUPPORT";
  const cls = completed
    ? "bg-[#e7f5ec] text-[#1e7a3a] dark:bg-[#17301f] dark:text-[#6ee7a0]"
    : support
      ? "bg-[#f0ecfc] text-[#5238b8] dark:bg-[#2a2440] dark:text-[#c4b5fd]"
      : "bg-accent text-[color:var(--accent-foreground)]";
  return (
    <Link
      href={`/dashboard/trackers/${tracker.id}`}
      title={tracker.ticketId}
      className={`block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80 ${cls}`}
    >
      {tracker.ticketId}
    </Link>
  );
}
