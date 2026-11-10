"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { DateRange } from "react-day-picker";

import { Calendar } from "@tracklet /ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@tracklet /ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tracklet /ui/components/select";
import { Input } from "@tracklet /ui/components/input";
import { Skeleton } from "@tracklet /ui/components/skeleton";

import CreateTrackerDialog from "@/components/create-tracker-dialog";
import TrackersCalendar from "@/components/trackers-calendar";
import { CategoryChip, StatusChip } from "@/components/tracker-chips";
import { useDashboard, useTrackersList, istAnchor, istMonthRange } from "@/hooks/trackers";
import { ApiError } from "@/lib/api";
import { formatDate, formatCycleTime } from "@/lib/format";

/**
 * Dashboard (PRD FR-DASH-01..04) with the trackers list (FR-VIEW-01,
 * FR-SEARCH-01..06) inline — one page: summary cards, then the searchable,
 * filterable list. Create-tracker is a dialog; filters live in the URL.
 */
export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // One month state (?month=YYYY-MM) drives the summary cards, cycle-time
  // strip, and the calendar (FR-DASH-02/05). Default: current IST month.
  // anchor is a shifted-space Date: UTC parts are IST calendar parts.
  const monthParam = searchParams.get("month");
  const anchor =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? new Date(`${monthParam}-01T00:00:00Z`)
      : istAnchor();
  const range = istMonthRange(anchor);
  const { data, isPending, error } = useDashboard(range);

  const setMonth = (delta: number) => {
    const next = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + delta, 1),
    );
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next.toISOString().slice(0, 7));
    router.replace(`/dashboard?${params.toString()}`);
  };
  const resetMonth = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("month");
    router.replace(`/dashboard?${params.toString()}`);
  };
  const isCurrentMonth = !monthParam;

  if (error instanceof ApiError) {
    toast.error(error.message);
  }

  const totals = data?.totals;

  const cards = [
    { label: "Total trackers", value: totals?.total },
    { label: "Completed", value: totals?.completed },
    { label: "Open", value: totals?.open },
    { label: "Development", value: totals?.development },
    { label: "Support", value: totals?.support },
    { label: "PR references", value: totals?.uniquePrs },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[.09em] text-primary">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(-1)}
              className="flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeftIcon className="size-3.5" />
            </button>
            {anchor.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(1)}
              className="flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRightIcon className="size-3.5" />
            </button>
            {!isCurrentMonth ? (
              <button
                type="button"
                onClick={resetMonth}
                className="ml-1 cursor-pointer rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Today
              </button>
            ) : null}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em]">
            Dashboard
          </h1>
        </div>
        <CreateTrackerDialog />
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

      <TrackersList anchor={anchor} />
    </div>
  );
}

function TrackersList({ anchor }: { anchor: Date }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = searchParams.get("view") === "calendar" ? "calendar" : "list";
  const status = searchParams.get("status") as "OPEN" | "COMPLETED" | null;
  const category = searchParams.get("category") as
    | "DEVELOPMENT"
    | "SUPPORT"
    | null;
  const sort = searchParams.get("sort") ?? "startedAt";
  const order = searchParams.get("order") ?? "desc";
  // IST date strings (YYYY-MM-DD) → UTC instants covering that IST day.
  const istDayStart = (d: string) => new Date(`${d}T00:00:00+05:30`).toISOString();
  const istDayEnd = (d: string) =>
    new Date(`${d}T23:59:59.999+05:30`).toISOString();
  const dateParams = ["startedFrom", "startedTo", "completedFrom", "completedTo"];
  const dateValue = (key: string) => {
    const v = searchParams.get(key);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
  };
  const datesActive = dateParams.some((k) => dateValue(k) !== "");

  // Range calendar basis: the toggle switches which date the range applies to.
  const [dateBasis, setDateBasis] = useState<"started" | "completed">("started");
  const activeRange: DateRange = {
    from: dateValue(`${dateBasis}From`)
      ? new Date(`${dateValue(`${dateBasis}From`)}T00:00:00+05:30`)
      : undefined,
    to: dateValue(`${dateBasis}To`)
      ? new Date(`${dateValue(`${dateBasis}To`)}T00:00:00+05:30`)
      : undefined,
  };
  const istShort = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const dateSummary = datesActive
    ? activeRange.from
      ? `${istShort(activeRange.from)}${activeRange.to ? ` – ${istShort(activeRange.to)}` : " →"}`
      : "Dates"
    : undefined;

  const [searchInput, setSearchInput] = useState("");
  // Debounced into the actual query to keep cache keys stable.
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = {
    search: search || undefined,
    status: status ?? undefined,
    category: category ?? undefined,
    sort: ["startedAt", "completedAt", "createdAt"].includes(sort)
      ? (sort as "startedAt" | "completedAt" | "createdAt")
      : undefined,
    order: order === "asc" ? ("asc" as const) : ("desc" as const),
    startedFrom: dateValue("startedFrom")
      ? istDayStart(dateValue("startedFrom"))
      : undefined,
    startedTo: dateValue("startedTo") ? istDayEnd(dateValue("startedTo")) : undefined,
    completedFrom: dateValue("completedFrom")
      ? istDayStart(dateValue("completedFrom"))
      : undefined,
    completedTo: dateValue("completedTo")
      ? istDayEnd(dateValue("completedTo"))
      : undefined,
  };
  const { data, isPending, isError, error, fetchNextPage, isFetchingNextPage } =
    useTrackersList(filters);

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  // Batch URL updates: two sequential setParam calls would each start from
  // the same stale searchParams snapshot.
  const setParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`/dashboard?${params.toString()}`);
  };
  const setParam = (key: string, value: string | null) =>
    setParams({ [key]: value });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-[-.03em]">Trackers</h2>
        <PillGroup
          options={["List", "Calendar"]}
          labels={{ List: "List", Calendar: "Calendar" }}
          value={view === "calendar" ? "Calendar" : "List"}
          onChange={(v) => setParam("view", v === "Calendar" ? "calendar" : null)}
        />
      </div>

      {view === "calendar" ? <TrackersCalendar anchor={anchor} /> : null}

      {view === "list" ? (
        <>
          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search ticket ID or PR…"
              className="h-9 w-64 rounded-lg border-border bg-card text-sm"
            />
            <PillGroup
              options={["All", "OPEN", "COMPLETED"]}
              labels={{ All: "All", OPEN: "Open", COMPLETED: "Completed" }}
              value={status ?? "All"}
              onChange={(v) => setParam("status", v === "All" ? null : v)}
            />
            <PillGroup
              options={["All", "DEVELOPMENT", "SUPPORT"]}
              labels={{
                All: "All",
                DEVELOPMENT: "Development",
                SUPPORT: "Support",
              }}
              value={category ?? "All"}
              onChange={(v) => setParam("category", v === "All" ? null : v)}
            />
            {/* Sort (FR-SEARCH-05/06) — direction icon shown at rest too */}
            <Select
              value={`${sort}-${order}`}
              onValueChange={(value) => {
                const [nextSort, nextOrder] = (value as string).split("-");
                setParams({
                  sort: nextSort === "startedAt" ? null : nextSort,
                  order: nextOrder === "desc" ? null : nextOrder,
                });
              }}
            >
              <SelectTrigger
                aria-label="Sort trackers"
                className="h-9 w-40 rounded-lg border-border bg-card text-sm"
              >
                {order === "asc" ? (
                  <ArrowUpIcon className="size-3.5 text-muted-foreground" />
                ) : (
                  <ArrowDownIcon className="size-3.5 text-muted-foreground" />
                )}
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-40 rounded-lg text-sm">
                {SORT_OPTIONS.map(({ value, field, dir }) => (
                  <SelectItem key={value} value={value} className="rounded-md text-sm">
                    {dir === "asc" ? (
                      <ArrowUpIcon className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ArrowDownIcon className="size-3.5 text-muted-foreground" />
                    )}
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Date ranges (FR-SEARCH-05), IST days, shadcn range calendar */}
            <div className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger
                  className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 ${
                    datesActive
                      ? "border-primary/50 bg-primary/5 font-semibold text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CalendarIcon className="size-3.5" />
                  {dateSummary ?? "Dates"}
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-auto max-w-[calc(100vw-2rem)] rounded-lg p-0"
                >
                  <div className="flex justify-center border-b border-border px-2.5 py-2">
                    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
                      <button
                        type="button"
                        onClick={() => setDateBasis("started")}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                          dateBasis === "started"
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Started
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateBasis("completed")}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                          dateBasis === "completed"
                            ? "bg-[#e7f5ec] font-semibold text-[#1e7a3a] dark:bg-[#17301f] dark:text-[#6ee7a0]"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Completed
                      </button>
                    </div>
                  </div>
                  <Calendar
                    mode="range"
                    timeZone="Asia/Kolkata"
                    numberOfMonths={2}
                    defaultMonth={activeRange.from}
                    selected={activeRange}
                    onSelect={(range) => {
                      const toKey = (d?: Date) =>
                        d?.toLocaleDateString("en-CA", {
                          timeZone: "Asia/Kolkata",
                        }) ?? null;
                      setParams(
                        dateBasis === "started"
                          ? {
                              startedFrom: toKey(range?.from),
                              startedTo: toKey(range?.to),
                            }
                          : {
                              completedFrom: toKey(range?.from),
                              completedTo: toKey(range?.to),
                            },
                      );
                    }}
                  />
                </PopoverContent>
              </Popover>
              {/* Red 3D clear — only while a date range is active */}
              {datesActive ? (
                <button
                  type="button"
                  aria-label="Clear date range"
                  title="Clear date range"
                  onClick={() =>
                    setParams({
                      startedFrom: null,
                      startedTo: null,
                      completedFrom: null,
                      completedTo: null,
                    })
                  }
                  className="btn-3d inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-destructive text-white [--btn3d-edge:#7f1d1d] hover:opacity-90"
                >
                  <XIcon className="size-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* List */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isPending ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Could not load trackers."}
          </p>
        ) : items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-lg font-extrabold tracking-[-.03em]">
              Nothing to track yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a Jira ticket URL to create your first tracker.
            </p>
            <div className="mt-4 flex justify-center">
              <CreateTrackerDialog />
            </div>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border/60">
              {items.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/dashboard/trackers/${t.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/60"
                  >
                    <span className="w-28 shrink-0 text-sm font-extrabold tabular-nums tracking-[-.02em]">
                      {t.ticketId}
                    </span>
                    <CategoryChip category={t.category} />
                    <StatusChip status={t.status} />
                    <span className="ml-auto hidden text-[13px] text-muted-foreground sm:block">
                      {t.prCount} PR{t.prCount === 1 ? "" : "s"}
                    </span>
                    <span className="hidden text-[13px] text-muted-foreground md:block">
                      Started {formatDate(t.startedAt)}
                    </span>
                    {t.status === "COMPLETED" ? (
                      <span className="hidden text-[13px] text-muted-foreground lg:block">
                        Cycle {formatCycleTime(t.cycleTimeMinutes)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            {data?.pages.at(-1)?.nextCursor ? (
              <div className="border-t border-border px-5 py-3 text-center">
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-primary hover:bg-muted disabled:opacity-50"
                >
                  {isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
        </>
      ) : null}
    </section>
  );
}

const SORT_OPTIONS = [
  { value: "startedAt-desc", field: "Started", dir: "desc" },
  { value: "startedAt-asc", field: "Started", dir: "asc" },
  { value: "completedAt-desc", field: "Completed", dir: "desc" },
  { value: "completedAt-asc", field: "Completed", dir: "asc" },
  { value: "createdAt-desc", field: "Created", dir: "desc" },
] as const;

function PillGroup({
  options,
  labels,
  value,
  onChange,
}: {
  options: string[];
  labels: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`cursor-pointer rounded-md px-2.5 py-1 text-[13px] transition-colors ${
            value === option
              ? "bg-muted font-semibold text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {labels[option] ?? option}
        </button>
      ))}
    </div>
  );
}
