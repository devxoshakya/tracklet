"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarDaysIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  CodeIcon,
  GitPullRequestIcon,
  LifeBuoyIcon,
  ListIcon,
  SearchIcon,
  TimerIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { DateRange } from "react-day-picker";

import { Calendar } from "@tracklet/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@tracklet/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tracklet/ui/components/select";
import { Input } from "@tracklet/ui/components/input";
import { Skeleton } from "@tracklet/ui/components/skeleton";

import CreateTrackerDialog from "@/components/create-tracker-dialog";
import Segmented from "@/components/segmented";
import { KpiCard, AnimatedNumber } from "@/components/stat-card";
import TrackersCalendar from "@/components/trackers-calendar";
import { CategoryChip, StatusChip } from "@/components/tracker-chips";
import { useDashboard, useTrackersList, istAnchor, istMonthRange } from "@/hooks/trackers";
import { ApiError } from "@/lib/api";
import { formatDate, formatCycleTime } from "@/lib/format";

/**
 * Dashboard (PRD FR-DASH-01..04) with the trackers list (FR-VIEW-01,
 * FR-SEARCH-01..06) inline — one page: summary hero + KPI row, then the
 * searchable, filterable list. Create-tracker is a dialog; filters live in
 * the URL.
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

  // Error toasts belong in an effect: firing them during render re-toasts on
  // every re-render (and twice under StrictMode).
  useEffect(() => {
    if (error instanceof ApiError) toast.error(error.message);
  }, [error]);

  const totals = data?.totals;
  const t = {
    total: totals?.total ?? 0,
    completed: totals?.completed ?? 0,
    open: totals?.open ?? 0,
    development: totals?.development ?? 0,
    support: totals?.support ?? 0,
    uniquePrs: totals?.uniquePrs ?? 0,
    avgCycleTimeMinutes: totals?.avgCycleTimeMinutes ?? null,
  };
  const completionRate = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;

  const monthLong = anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthShort = anchor.toLocaleDateString(undefined, {
    month: "long",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-8">
      {/* Header: kicker + title + month stepper + create */}
      <header className="landing-rise rise-d1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.09em] text-primary">
            {monthLong} · IST
          </p>
          <h1 className="mt-1.5 text-[26px] font-extrabold leading-none tracking-[-.03em]">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every Jira ticket, tracked to done — {monthShort} at a glance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex h-10 items-center rounded-lg border border-border bg-card shadow-sm">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(-1)}
              className="focus-ring flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <span
              className="min-w-[8.5rem] px-1 text-center text-sm font-semibold tabular-nums tracking-[-.01em]"
              aria-live="polite"
            >
              {monthLong}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(1)}
              className="focus-ring flex size-10 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRightIcon className="size-4" />
            </button>
            {!isCurrentMonth ? (
              <button
                type="button"
                onClick={resetMonth}
                className="focus-ring flex h-10 cursor-pointer items-center rounded-r-lg border-l border-border px-3 text-xs font-semibold text-primary transition-colors hover:bg-muted"
              >
                Today
              </button>
            ) : null}
          </div>
          <CreateTrackerDialog />
        </div>
      </header>

      {/* Summary: hero panel + cycle time, grouped tighter than the page rhythm */}
      <section
        aria-label="Monthly summary"
        className="landing-rise rise-d2 grid gap-3 lg:grid-cols-12"
      >
        {/* Hero: total + completed/open composition */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 sm:p-6 lg:col-span-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-primary/[.07] blur-3xl"
          />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
                Trackers this month
              </p>
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
                <ListIcon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                {isPending ? (
                  <Skeleton className="h-11 w-24 rounded-lg" />
                ) : (
                  <p className="text-[46px] font-extrabold leading-none tracking-[-.04em] tabular-nums">
                    <AnimatedNumber value={t.total} />
                  </p>
                )}
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Total trackers · {monthShort}
                </p>
              </div>
              <div className="pb-0.5">
                {isPending ? (
                  <Skeleton className="h-8 w-20 rounded-lg" />
                ) : (
                  <>
                    <p className="flex items-baseline gap-1.5 text-2xl font-extrabold leading-none tracking-[-.03em] tabular-nums">
                      <GitPullRequestIcon
                        className="size-4 translate-y-px text-muted-foreground"
                        aria-hidden="true"
                      />
                      <AnimatedNumber value={t.uniquePrs} />
                    </p>
                    <p className="mt-1.5 text-[13px] text-muted-foreground">
                      PR references added
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Completed vs open split */}
            <div className="mt-6">
              {isPending ? (
                <Skeleton className="h-2.5 w-full rounded-full" />
              ) : (
                <div
                  className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${t.completed} completed, ${t.open} open of ${t.total} trackers`}
                >
                  <div
                    className="bar-rise h-full bg-[#34a853] transition-[width] duration-500 ease-out"
                    style={{ width: `${t.total ? (t.completed / t.total) * 100 : 0}%` }}
                  />
                  <div
                    className="bar-rise h-full flex-1 bg-[#ff672f] transition-[width] duration-500 ease-out"
                    style={{ width: `${t.total ? (t.open / t.total) * 100 : 0}%` }}
                  />
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#34a853]" aria-hidden="true" />
                  {t.completed} completed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#ff672f]" aria-hidden="true" />
                  {t.open} open
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cycle time */}
        <div className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 sm:p-6 lg:col-span-5">
          <TimerIcon
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-4 -right-3 size-32 text-foreground/[.04]"
          />
          <div className="relative flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
              Avg cycle time
            </p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#e7f5ec] text-[#1e7a3a] dark:bg-[#17301f] dark:text-[#6ee7a0]">
              <TimerIcon className="size-4" aria-hidden="true" />
            </span>
          </div>
          {isPending ? (
            <Skeleton className="mt-4 h-10 w-28 rounded-lg" />
          ) : (
            <p className="relative mt-4 text-4xl font-extrabold leading-none tracking-[-.04em] tabular-nums">
              <span
                key={formatCycleTime(t.avgCycleTimeMinutes)}
                className="stat-swap inline-block"
              >
                {formatCycleTime(t.avgCycleTimeMinutes)}
              </span>
            </p>
          )}
          <p className="relative mt-2.5 text-[13px] text-muted-foreground">
            Start to close, averaged over completed trackers.
          </p>
          <p className="relative mt-auto pt-5 text-[13px] text-muted-foreground">
            <CheckCircle2Icon
              className="mr-1.5 inline size-4 -translate-y-px text-[#34a853]"
              aria-hidden="true"
            />
            {t.completed} tracker{t.completed === 1 ? "" : "s"} completed in {monthShort}
          </p>
        </div>
      </section>

      {/* KPI satellites */}
      <section
        aria-label="Key numbers"
        className="landing-rise rise-d3 grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <KpiCard
          label="Completed"
          icon={CheckCircle2Icon}
          tone="green"
          value={isPending ? undefined : t.completed}
          foot={`${completionRate}% of all started`}
        />
        <KpiCard
          label="Open"
          icon={CircleDashedIcon}
          tone="orange"
          value={isPending ? undefined : t.open}
          foot="in progress right now"
        />
        <KpiCard
          label="Development"
          icon={CodeIcon}
          tone="primary"
          value={isPending ? undefined : t.development}
          foot="started this month"
        />
        <KpiCard
          label="Support"
          icon={LifeBuoyIcon}
          tone="violet"
          value={isPending ? undefined : t.support}
          foot="started this month"
        />
      </section>

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
    completedTo: dateValue("completedTo") ? istDayEnd(dateValue("completedTo")) : undefined,
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

  const anyFilter = Boolean(
    searchInput || status || category || datesActive ||
      sort !== "startedAt" || order !== "desc",
  );

  return (
    <section className="landing-rise rise-d4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-base font-bold tracking-[-.02em]">All trackers</h2>
          {!isPending ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
          ) : null}
        </div>
        <Segmented
          ariaLabel="View"
          value={view}
          onChange={(v) => setParam("view", v === "calendar" ? "calendar" : null)}
          options={[
            { value: "list", label: "List", icon: ListIcon },
            { value: "calendar", label: "Calendar", icon: CalendarDaysIcon },
          ]}
        />
      </div>

      {view === "calendar" ? <TrackersCalendar anchor={anchor} /> : null}

      {view === "list" ? (
        <>
          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <SearchIcon
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search ticket ID or PR…"
                className="h-9 rounded-lg border-border bg-card pl-8 text-sm"
              />
            </div>
            <Segmented
              ariaLabel="Status filter"
              value={status ?? "all"}
              onChange={(v) => setParam("status", v === "all" ? null : v)}
              options={[
                { value: "all", label: "All" },
                { value: "OPEN", label: "Open" },
                { value: "COMPLETED", label: "Completed" },
              ]}
            />
            <Segmented
              ariaLabel="Category filter"
              value={category ?? "all"}
              onChange={(v) => setParam("category", v === "all" ? null : v)}
              options={[
                { value: "all", label: "All" },
                { value: "DEVELOPMENT", label: "Development" },
                { value: "SUPPORT", label: "Support" },
              ]}
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
                {/* Explicit label: SelectValue falls back to the raw value
                    ("startedAt-desc") before the portal items register. */}
                <SelectValue>
                  {SORT_OPTIONS.find((o) => o.value === `${sort}-${order}`)
                    ?.field ?? "Started"}
                </SelectValue>
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
                      ? "border-primary/50 bg-primary/5 font-medium text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CalendarIcon className="size-3.5" />
                  {dateSummary ?? "Dates"}
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-auto max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg p-0"
                >
                  <div className="flex justify-center border-b border-border px-2.5 py-2">
                    <Segmented
                      ariaLabel="Date basis"
                      value={dateBasis}
                      onChange={(v) => setDateBasis(v as "started" | "completed")}
                      options={[
                        { value: "started", label: "Started" },
                        { value: "completed", label: "Completed" },
                      ]}
                    />
                  </div>
                  <Calendar
                    mode="range"
                    timeZone="Asia/Kolkata"
                    numberOfMonths={2}
                    // Outside days would inherit the range band and read as
                    // selected when they are only adjacent-month fill.
                    showOutsideDays={false}
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
                  className="btn-3d focus-ring inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-destructive text-white [--btn3d-edge:#7f1d1d] hover:opacity-90"
                >
                  <XIcon className="size-4" />
                </button>
              ) : null}
            </div>
            {anyFilter && !isPending ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setParams({
                    status: null,
                    category: null,
                    sort: null,
                    order: null,
                    startedFrom: null,
                    startedTo: null,
                    completedFrom: null,
                    completedTo: null,
                  });
                }}
                className="focus-ring cursor-pointer rounded-lg px-2 py-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-accent"
              >
                Clear all filters
              </button>
            ) : null}
          </div>

          {/* List */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {isPending ? (
              <div className="divide-y divide-border/60">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                    <Skeleton className="h-4 w-24 rounded-sm" />
                    <Skeleton className="h-[22px] w-[92px] rounded-md" />
                    <Skeleton className="h-[22px] w-[80px] rounded-md" />
                    <Skeleton className="ml-auto h-3.5 w-14 rounded-sm" />
                    <Skeleton className="hidden h-3.5 w-32 rounded-sm md:block" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Could not load trackers."}
              </p>
            ) : items.length === 0 ? (
              <EmptyTrackers filtered={anyFilter} />
            ) : (
              <>
                <ul className="divide-y divide-border/70">
                  {items.map((t, i) => (
                    <li
                      key={t.id}
                      className="row-rise"
                      style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                    >
                      <Link
                        href={`/dashboard/trackers/${t.id}`}
                        className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:gap-4 sm:px-5"
                      >
                        <span className="w-28 shrink-0 font-mono text-[13px] font-semibold tracking-[-.01em] text-foreground transition-transform duration-150 group-hover:translate-x-0.5">
                          {t.ticketId}
                        </span>
                        <CategoryChip category={t.category} />
                        <StatusChip status={t.status} />
                        <span className="ml-auto hidden w-11 shrink-0 items-center justify-end gap-1.5 text-[13px] tabular-nums text-muted-foreground sm:flex">
                          <GitPullRequestIcon
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          {t.prCount}
                        </span>
                        <span className="hidden w-44 shrink-0 text-[13px] text-muted-foreground md:block">
                          Started {formatDate(t.startedAt)}
                        </span>
                        {t.status === "COMPLETED" ? (
                          <span className="hidden w-28 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground lg:block">
                            Cycle {formatCycleTime(t.cycleTimeMinutes)}
                          </span>
                        ) : (
                          <span className="hidden w-28 shrink-0 lg:block" />
                        )}
                        <ChevronRightIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                        />
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
                      className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {isFetchingNextPage ? "Loading…" : "Load more"}
                      <ChevronRightIcon className="size-3.5" aria-hidden="true" />
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

/** Empty state (no trackers at all vs filters matching nothing). */
function EmptyTrackers({ filtered = false }: { filtered?: boolean }) {
  return (
    <div className="px-5 py-14 text-center">
      <svg
        viewBox="0 0 120 88"
        aria-hidden="true"
        className="mx-auto h-20 w-auto text-border"
      >
        {/* Back card */}
        <rect
          x="26"
          y="10"
          width="68"
          height="30"
          rx="6"
          className="fill-muted"
        />
        {/* Front card: a ticket */}
        <rect
          x="18"
          y="26"
          width="84"
          height="42"
          rx="6"
          className="fill-card stroke-2"
          stroke="currentColor"
        />
        <line
          x1="18"
          y1="38"
          x2="102"
          y2="38"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="3 4"
          opacity="0.7"
        />
        <rect x="28" y="48" width="30" height="6" rx="3" className="fill-accent" />
        <rect x="28" y="58" width="44" height="5" rx="2.5" className="fill-muted" />
        {/* Check badge */}
        <circle cx="96" cy="64" r="11" className="fill-[#34a853]" />
        <path
          d="M91 64l3.2 3.2L101 60.4"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <p className="mt-5 text-lg font-bold tracking-[-.02em]">
        {filtered ? "No trackers match" : "Nothing to track yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered
          ? "Try a wider date range or different filters."
          : "Paste a Jira ticket URL to create your first tracker."}
      </p>
      {!filtered ? (
        <div className="mt-4 flex justify-center">
          <CreateTrackerDialog />
        </div>
      ) : null}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "startedAt-desc", field: "Started", dir: "desc" },
  { value: "startedAt-asc", field: "Started", dir: "asc" },
  { value: "completedAt-desc", field: "Completed", dir: "desc" },
  { value: "completedAt-asc", field: "Completed", dir: "asc" },
  { value: "createdAt-desc", field: "Created", dir: "desc" },
] as const;
