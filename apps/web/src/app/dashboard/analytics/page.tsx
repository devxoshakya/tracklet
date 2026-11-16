"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  Columns2Icon,
  FileSpreadsheetIcon,
  FileTextIcon,
  GitPullRequestIcon,
  HourglassIcon,
  Loader2Icon,
  PlayIcon,
  TimerIcon,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import type { AnalyticsSeriesDTO } from "@tracklet/db/schemas";
import { Calendar } from "@tracklet/ui/components/calendar";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@tracklet/ui/components/chart";
import { Skeleton } from "@tracklet/ui/components/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@tracklet/ui/components/popover";
import type { DateRange } from "react-day-picker";

import Segmented from "@/components/segmented";
import { KpiCard } from "@/components/stat-card";
import { useAnalytics, istAnchor, istMonthRange } from "@/hooks/trackers";
import { apiBlob } from "@/lib/api";
import { formatCycleTime } from "@/lib/format";

/**
 * Analytics (PRD FR-AN-01..11): dedicated page, IST month default, presets +
 * custom range. One `useAnalytics` call feeds the summary cards and the
 * monthly charts. Date bases are stated on each card (FR-AN-04) and PR counts
 * are labelled "added", never "merged" (§10.10).
 */

const IST_MS = 330 * 60_000;

/** IST-bounded instants for each preset (FR-AN-03). */
const PRESETS = [
  { key: "this", label: "This month" },
  { key: "last", label: "Last month" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "year", label: "This year" },
] as const;

function presetRange(
  preset: string,
): { from: string; to: string; toIsNow: boolean } {
  const anchor = istAnchor();
  const now = new Date().toISOString();
  switch (preset) {
    case "last": {
      const prev = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1),
      );
      return { ...istMonthRange(prev), toIsNow: false };
    }
    case "3m": {
      const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 2, 1));
      return { from: istMonthRange(first).from, to: now, toIsNow: true };
    }
    case "6m": {
      const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 5, 1));
      return { from: istMonthRange(first).from, to: now, toIsNow: true };
    }
    case "year":
      return {
        from: new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1) - IST_MS).toISOString(),
        to: now,
        toIsNow: true,
      };
    default:
      return { ...istMonthRange(anchor), toIsNow: false };
  }
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

export default function AnalyticsPage() {
  return (
    <Suspense>
      <AnalyticsContent />
    </Suspense>
  );
}

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preset = searchParams.get("preset") ?? "this";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const valid = (v: string | null) => v && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v : null;
  const range =
    fromParam && toParam && valid(fromParam) && valid(toParam)
      ? { from: fromParam, to: toParam }
      : presetRange("this");
  const isPreset = PRESETS.some((p) => p.key === preset) && preset !== "custom";
  const gran = searchParams.get("gran") === "week" ? "week" : "month";

  const { data, isPending } = useAnalytics(range, gran);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`/dashboard/analytics?${params.toString()}`);
  };
  const setPreset = (key: string) => {
    const r = presetRange(key);
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", key);
    params.set("from", r.from);
    params.set("to", r.to);
    router.replace(`/dashboard/analytics?${params.toString()}`);
  };
  const setCustom = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", "custom");
    params.set("from", from);
    params.set("to", to);
    router.replace(`/dashboard/analytics?${params.toString()}`);
  };

  const rangeLabel = `${fmtDay(range.from)} – ${fmtDay(range.to)}`;
  const total = (data?.started ?? 0) + (data?.uniquePrs ?? 0);
  const series = data?.series ?? [];

  return (
    <div className="space-y-6">
      <header className="landing-rise rise-d1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.09em] text-primary">
            {rangeLabel} · IST
          </p>
          <h1 className="mt-1.5 text-[26px] font-extrabold leading-none tracking-[-.03em]">
            Analytics
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Started, completed, PR references and cycle time — date bases stated
            on every card.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            ariaLabel="Period preset"
            value={isPreset ? preset : "custom"}
            onChange={(v) => {
              if (v !== "custom") setPreset(v);
            }}
            options={PRESETS.map((p) => ({ value: p.key, label: p.label }))}
          />
          <CustomRangePopover
            from={range.from}
            to={range.to}
            onApply={(from, to) => setCustom(from, to)}
          />
          <ExportButtons from={range.from} to={range.to} />
        </div>
      </header>

      {isPending ? (
        <div className="landing-rise rise-d2 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-xl" />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl lg:col-span-2" />
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl lg:col-span-2" />
          </div>
        </div>
      ) : !data ? null : total === 0 && data.openAgeDays.count === 0 ? (
        // FR-AN-11: no misleading zero-filled charts without context.
        <div className="landing-rise rise-d2 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted">
            <CalendarIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          </span>
          <p className="mt-5 text-lg font-bold tracking-[-.02em]">
            Nothing to analyse yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            No trackers or PR references in this period. Pick a wider range or
            start tracking on the dashboard.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Back to dashboard
          </Link>
        </div>
      ) : (
        <>
          {/* Summary (FR-AN-05..10), bases stated per card */}
          <section aria-label="Summary" className="landing-rise rise-d2 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <KpiCard
                size="lg"
                label="Trackers started"
                icon={PlayIcon}
                tone="primary"
                value={data.started}
                spark={series.map((s) => s.started)}
                foot="startedAt in range"
              />
              <KpiCard
                size="lg"
                label="Trackers completed"
                icon={CheckCircle2Icon}
                tone="green"
                value={data.completed}
                spark={series.map((s) => s.completed)}
                sparkClassName="text-[#34a853]"
                foot="completedAt in range"
              />
              <KpiCard
                size="lg"
                label="PRs added"
                icon={GitPullRequestIcon}
                tone="violet"
                value={data.uniquePrs}
                spark={series.map((s) => s.uniquePrs)}
                sparkClassName="text-[#8b5cf6]"
                foot="unique references, addedAt basis"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Avg cycle time"
                icon={TimerIcon}
                tone="green"
                value={formatCycleTime(data.avgCycleTimeMinutes)}
                spark={series.map((s) => s.avgCycleTimeMinutes)}
                sparkClassName="text-[#34a853]"
                foot="completed in range"
              />
              <KpiCard
                label="Avg open age"
                icon={ClockIcon}
                tone="orange"
                value={data.openAgeDays.average ?? 0}
                suffix={data.openAgeDays.count ? "days" : undefined}
                foot={
                  data.openAgeDays.count
                    ? `across ${data.openAgeDays.count} open right now`
                    : "no open trackers"
                }
              />
              <KpiCard
                label="Oldest open"
                icon={HourglassIcon}
                tone="orange"
                value={data.openAgeDays.oldest ?? 0}
                suffix={data.openAgeDays.count ? "days" : undefined}
                foot={
                  data.openAgeDays.count
                    ? "since started · still open"
                    : "no open trackers"
                }
              />
              <SplitCard
                development={data.development}
                support={data.support}
                total={data.started}
              />
            </div>
          </section>

          <div className="landing-rise rise-d3 grid gap-4 lg:grid-cols-3">
            {/* §10.10 #2 — Development vs Support doughnut */}
            <section className="rounded-xl border border-border bg-card">
              <CardHead
                title="Development vs Support"
                desc="Share of trackers started in range"
              />
              <DoughnutChart
                development={data.development}
                support={data.support}
                total={data.started}
              />
            </section>

            {/* Trackers + PR references per bucket (shadcn/recharts) */}
            <section className="rounded-xl border border-border bg-card lg:col-span-2">
              <CardHead
                title="Trackers & PR references"
                desc="Started or completed per bucket; PRs on their addedAt date"
                right={
                  <Segmented
                    ariaLabel="Granularity"
                    value={gran}
                    onChange={(v) => setParam("gran", v)}
                    options={[
                      { value: "month", label: "Month" },
                      { value: "week", label: "Week" },
                    ]}
                  />
                }
              />
              <ActivityChart series={data.series} />
            </section>

            {/* §10.10 #6 — work distribution stacked bars */}
            <section className="rounded-xl border border-border bg-card">
              <CardHead
                title="Work distribution"
                desc="Started per bucket, stacked by category"
              />
              <DistributionChart buckets={data.series} />
            </section>

            {/* §10.10 #5 — average cycle time line */}
            <section className="rounded-xl border border-border bg-card lg:col-span-2">
              <CardHead
                title="Average cycle time"
                desc="Start → close for trackers completed per bucket"
              />
              <CycleTimeChart buckets={data.series} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/** Development vs Support mini card: split bar + counts. */
function SplitCard({
  development,
  support,
  total,
}: {
  development: number;
  support: number;
  total: number;
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card px-4 py-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-primary/35 hover:shadow-[0_12px_28px_rgba(15,17,20,0.08)]"
      title="category split of trackers started in range"
    >
      <Columns2Icon
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -right-2 size-16 text-primary/[.07] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
          Dev vs Support
        </p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f0ecfc] text-[#5238b8] transition-transform duration-200 group-hover:scale-105 dark:bg-[#2a2440] dark:text-[#c4b5fd]">
          <Columns2Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div className="relative mt-4">
        <div
          className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${pct(development)}% development, ${pct(support)}% support`}
        >
          <div
            className="bar-rise h-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${pct(development)}%` }}
          />
          <div
            className="bar-rise h-full flex-1 bg-[#8b5cf6] transition-[width] duration-500 ease-out"
            style={{ width: `${pct(support)}%` }}
          />
        </div>
        <div className="mt-3 space-y-1.5 text-[13px]">
          <SplitRow color="var(--color-primary)" label="Development" count={development} pct={pct(development)} />
          <SplitRow color="#8b5cf6" label="Support" count={support} pct={pct(support)} />
        </div>
      </div>
      <p className="relative mt-auto pt-3 text-[11px] font-medium text-muted-foreground">
        of {total} started in range
      </p>
    </div>
  );
}

function SplitRow({
  color,
  label,
  count,
  pct,
}: {
  color: string;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="font-medium">{label}</span>
      <span className="ml-auto tabular-nums text-muted-foreground">
        {count} · {pct}%
      </span>
    </div>
  );
}

/** FR-EXP-01 / FR-PDF-01: download buttons for the selected period. */
function ExportButtons({ from, to }: { from: string; to: string }) {
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);

  const download = async (kind: "excel" | "pdf") => {
    setBusy(kind);
    try {
      const blob = await apiBlob(
        `/exports/${kind}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      const suffix = `${from.slice(0, 10)}_to_${to.slice(0, 10)}`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download =
        kind === "excel" ? `tracklet-export-${suffix}.xlsx` : `tracklet-report-${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast.success(kind === "excel" ? "Excel workbook downloaded" : "PDF report downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {(
        [
          {
            kind: "excel",
            label: "Excel",
            Icon: FileSpreadsheetIcon,
            chip: "bg-[#e7f5ec] dark:bg-[#17301f]",
            glyph: "text-[#1e7a3a] dark:text-[#6ee7a0]",
          },
          {
            kind: "pdf",
            label: "PDF",
            Icon: FileTextIcon,
            chip: "bg-[#fdeaea] dark:bg-[#331414]",
            glyph: "text-[#b3261e] dark:text-[#f87171]",
          },
        ] as const
      ).map(({ kind, label, Icon, chip, glyph }) => (
        <button
          key={kind}
          type="button"
          disabled={busy !== null}
          onClick={() => void download(kind)}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-2.5 pr-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === kind ? (
            <Loader2Icon
              className="size-4 animate-spin text-primary"
              aria-hidden="true"
            />
          ) : (
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-[6px] ${chip}`}
            >
              <Icon className={`size-3 ${glyph}`} aria-hidden="true" />
            </span>
          )}
          {busy === kind ? "Preparing…" : label}
        </button>
      ))}
    </div>
  );
}

function CustomRangePopover({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const istKey = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const toIstInstant = (key: string, endOfDay: boolean) =>
    new Date(
      `${key}T${endOfDay ? "23:59:59.999" : "00:00:00"}+05:30`,
    ).toISOString();
  const selected: DateRange = {
    from: new Date(`${from.slice(0, 10)}T00:00:00+05:30`),
    to: new Date(`${to.slice(0, 10)}T00:00:00+05:30`),
  };

  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60">
        <CalendarIcon className="size-3.5" />
        Custom
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg p-0"
      >
        <Calendar
          mode="range"
          timeZone="Asia/Kolkata"
          numberOfMonths={2}
          // Outside days would inherit the range band and read as selected
          // when they are only adjacent-month fill.
          showOutsideDays={false}
          defaultMonth={selected.from}
          selected={selected}
          onSelect={(range) => {
            if (range?.from && range?.to) {
              onApply(
                toIstInstant(istKey(range.from), false),
                toIstInstant(istKey(range.to), true),
              );
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Charts — all shadcn/recharts; one shared config drives colors + legends.
// ---------------------------------------------------------------------------

const chartConfig = {
  development: { label: "Development", color: "var(--color-primary)" },
  support: { label: "Support", color: "#8b5cf6" },
  uniquePrs: { label: "PRs added", color: "#8b5cf6" },
  avgCycleTimeMinutes: { label: "Avg cycle time", color: "#34a853" },
} satisfies ChartConfig;

function bucketLabel(key: string) {
  const isMonth = key.length === 7;
  return new Date(`${key}${isMonth ? "-01" : ""}T00:00:00Z`).toLocaleDateString(
    undefined,
    {
      month: "short",
      ...(isMonth ? {} : { day: "numeric" }),
      timeZone: "UTC",
    },
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  minTickGap: 18,
  tickFormatter: bucketLabel,
} as const;

function CardHead({
  title,
  desc,
  right,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-[-.01em]">{title}</h2>
        {desc ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        ) : null}
      </div>
      {right ? <div className="pr-0">{right}</div> : null}
    </div>
  );
}

/** Stacked Development/Support areas with a unique-PRs line (shadcn charts). */
function ActivityChart({ series }: { series: AnalyticsSeriesDTO[] }) {
  const data = series.map((row) => ({
    bucket: row.bucket,
    development: row.development,
    support: row.support,
    uniquePrs: row.uniquePrs,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full px-2 py-3">
      <ComposedChart
        accessibilityLayer
        data={data}
        margin={{ left: 4, right: 12, top: 12 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis width={30} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip
          cursor={false}
          labelFormatter={(label) => bucketLabel(String(label))}
          content={<ChartTooltipContent />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <defs>
          <linearGradient id="fillDevelopment" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-development)" stopOpacity={0.32} />
            <stop offset="95%" stopColor="var(--color-development)" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="fillSupport" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-support)" stopOpacity={0.32} />
            <stop offset="95%" stopColor="var(--color-support)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <Area
          dataKey="development"
          type="monotone"
          stackId="a"
          fill="url(#fillDevelopment)"
          fillOpacity={1}
          stroke="var(--color-development)"
          strokeWidth={2}
        />
        <Area
          dataKey="support"
          type="monotone"
          stackId="a"
          fill="url(#fillSupport)"
          fillOpacity={1}
          stroke="var(--color-support)"
          strokeWidth={2}
        />
        <Line
          dataKey="uniquePrs"
          type="monotone"
          stroke="var(--color-uniquePrs)"
          strokeWidth={2}
          dot={{ r: 2.5, fill: "var(--color-uniquePrs)", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

/** §10.10 #2 — Development vs Support doughnut with counts + percentages. */
function DoughnutChart({
  development,
  support,
  total,
}: {
  development: number;
  support: number;
  total: number;
}) {
  const data = [
    { name: "development", value: development, fill: "var(--color-development)" },
    { name: "support", value: support, fill: "var(--color-support)" },
  ];
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="flex flex-wrap items-center justify-center gap-8 px-5 py-7">
      <div className="relative">
        {total > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-square h-[176px] w-[176px]"
          >
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={84}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="size-[176px] rounded-full border-[18px] border-muted" />
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[30px] font-extrabold leading-none tabular-nums tracking-[-.03em]">
            {total}
          </span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-[.09em] text-muted-foreground">
            started
          </span>
        </div>
      </div>
      <div className="w-44 space-y-3">
        <DoughnutLegendRow
          // The legend sits outside the ChartContainer, where the chart-scoped
          // --color-* vars don't exist — use root tokens/literals here.
          color="var(--primary)"
          label="Development"
          count={development}
          pct={pct(development)}
        />
        <DoughnutLegendRow
          color="#8b5cf6"
          label="Support"
          count={support}
          pct={pct(support)}
        />
        <p className="pt-1 text-[11px] text-muted-foreground">
          of {total} started in range
        </p>
      </div>
    </div>
  );
}

function DoughnutLegendRow({
  color,
  label,
  count,
  pct,
}: {
  color: string;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
        <span className="font-medium">{label}</span>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {count} · {pct}%
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="bar-rise h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

/** §10.10 #6 — stacked started-by-category bars per bucket. */
function DistributionChart({ buckets }: { buckets: AnalyticsSeriesDTO[] }) {
  const data = buckets.map((row) => ({
    bucket: row.bucket,
    development: row.development,
    support: row.support,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full px-2 py-3">
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ left: 4, right: 12, top: 12 }}
        barCategoryGap="28%"
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis width={30} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip
          cursor={false}
          labelFormatter={(label) => bucketLabel(String(label))}
          content={<ChartTooltipContent />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="development"
          stackId="a"
          fill="var(--color-development)"
          maxBarSize={26}
        />
        <Bar
          dataKey="support"
          stackId="a"
          fill="var(--color-support)"
          maxBarSize={26}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

/** §10.10 #5 — avg cycle time per bucket, minutes on the y axis. */
function CycleTimeChart({ buckets }: { buckets: AnalyticsSeriesDTO[] }) {
  const data = buckets.map((row) => ({
    bucket: row.bucket,
    avgCycleTimeMinutes: row.avgCycleTimeMinutes,
  }));
  const hasData = data.some((d) => d.avgCycleTimeMinutes !== null);

  if (!hasData) {
    return (
      <p className="flex h-[240px] items-center justify-center px-5 text-center text-sm text-muted-foreground">
        No completed trackers in this period.
      </p>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full px-2 py-3">
      <ComposedChart
        accessibilityLayer
        data={data}
        margin={{ left: 4, right: 12, top: 12 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis
          width={44}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(m: number) =>
            m >= 1440
              ? `${Math.round(m / 1440)}d`
              : m >= 60
                ? `${Math.round(m / 60)}h`
                : `${m}m`
          }
        />
        <ChartTooltip
          cursor={false}
          labelFormatter={(label) => bucketLabel(String(label))}
          content={
            <ChartTooltipContent
              formatter={(value, _name, _item, index) =>
                index === 0 ? (
                  <div className="flex w-full items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-[2px] bg-[color:var(--color-avgCycleTimeMinutes)]"
                    />
                    <span className="text-muted-foreground">Avg cycle time</span>
                    <span className="ml-auto font-mono text-[13px] font-medium tabular-nums text-foreground">
                      {formatCycleTime(value as number)}
                    </span>
                  </div>
                ) : null
              }
            />
          }
        />
        <defs>
          <linearGradient id="fillCycleTime" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-avgCycleTimeMinutes)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--color-avgCycleTimeMinutes)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          dataKey="avgCycleTimeMinutes"
          type="monotone"
          fill="url(#fillCycleTime)"
          fillOpacity={1}
          stroke="none"
          connectNulls
        />
        <Line
          dataKey="avgCycleTimeMinutes"
          type="monotone"
          stroke="var(--color-avgCycleTimeMinutes)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-avgCycleTimeMinutes)", strokeWidth: 0 }}
          activeDot={{ r: 4.5 }}
          connectNulls
        />
      </ComposedChart>
    </ChartContainer>
  );
}
