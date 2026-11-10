"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  CalendarIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
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

import type { AnalyticsSeriesDTO } from "@tracklet /db/schemas";
import { Calendar } from "@tracklet /ui/components/calendar";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@tracklet /ui/components/chart";
import { Skeleton } from "@tracklet /ui/components/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@tracklet /ui/components/popover";
import type { DateRange } from "react-day-picker";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.09em] text-primary">
            {rangeLabel}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em]">
            Analytics
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PresetPills active={isPreset ? preset : "custom"} onPick={setPreset} />
          <CustomRangePopover
            from={range.from}
            to={range.to}
            onApply={(from, to) => setCustom(from, to)}
          />
          <ExportButtons from={range.from} to={range.to} />
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      ) : !data ? null : total === 0 && data.openAgeDays.count === 0 ? (
        // FR-AN-11: no misleading zero-filled charts without context.
        <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
          <p className="text-lg font-extrabold tracking-[-.03em]">
            Nothing to analyse yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            No trackers or PR references in this period. Pick a wider range or
            start tracking on the dashboard.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold"
          >
            Back to dashboard
          </Link>
        </div>
      ) : (
        <>
          {/* Summary cards (FR-AN-05..10), bases stated per card */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Started" hint="startedAt in range" value={data.started} />
            <StatCard label="Completed" hint="completedAt in range" value={data.completed} />
            <StatCard
              label="PRs added"
              hint="unique references added in range"
              value={data.uniquePrs}
            />
            <StatCard
              label="Avg cycle time"
              hint="completed in range"
              value={formatCycleTime(data.avgCycleTimeMinutes)}
            />
            <StatCard
              label="Avg open age"
              hint="currently open, days"
              value={data.openAgeDays.average ?? 0}
              suffix={data.openAgeDays.count ? ` (${data.openAgeDays.count} open)` : ""}
            />
            <StatCard
              label="Oldest open"
              hint="currently open, days"
              value={data.openAgeDays.oldest ?? 0}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* §10.10 #2 — Development vs Support doughnut */}
            <section className="rounded-xl border border-border bg-card">
              <CardHead>Development vs Support</CardHead>
              <DoughnutChart
                development={data.development}
                support={data.support}
                total={data.started}
              />
            </section>

            {/* Trackers + PR references per bucket (shadcn/recharts) */}
            <section className="rounded-xl border border-border bg-card lg:col-span-2">
              <CardHead
                right={
                  <div className="flex items-center gap-0.5">
                    {(["month", "week"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setParam("gran", g)}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                          gran === g
                            ? "bg-muted font-semibold text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {g === "month" ? "Month" : "Week"}
                      </button>
                    ))}
                  </div>
                }
              >
                Trackers &amp; PR references
              </CardHead>
              <ActivityChart series={data.series} />
            </section>

            {/* §10.10 #6 — work distribution stacked bars */}
            <section className="rounded-xl border border-border bg-card">
              <CardHead>Work distribution</CardHead>
              <DistributionChart buckets={data.series} />
            </section>

            {/* §10.10 #5 — average cycle time line */}
            <section className="rounded-xl border border-border bg-card lg:col-span-2">
              <CardHead>Average cycle time</CardHead>
              <CycleTimeChart buckets={data.series} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  hint,
  value,
  suffix,
}: {
  label: string;
  hint: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4">
      <p
        title={hint}
        className="text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground"
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-[-.03em]">
        {value}
        {suffix ? (
          <span className="ml-1 text-[11px] font-semibold text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function PresetPills({
  active,
  onPick,
}: {
  active: string;
  onPick: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onPick(p.key)}
          className={`cursor-pointer rounded-md px-2.5 py-1 text-[13px] transition-colors ${
            active === p.key
              ? "bg-muted font-semibold text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {p.label}
        </button>
      ))}
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
          { kind: "excel", label: "Excel", Icon: FileSpreadsheetIcon },
          { kind: "pdf", label: "PDF", Icon: FileTextIcon },
        ] as const
      ).map(({ kind, label, Icon }) => (
        <button
          key={kind}
          type="button"
          disabled={busy !== null}
          onClick={() => void download(kind)}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon className="size-3.5 text-primary" />
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
      <PopoverContent align="end" className="w-auto rounded-lg p-0">
        <Calendar
          mode="range"
          timeZone="Asia/Kolkata"
          numberOfMonths={2}
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
  uniquePrs: { label: "PRs added", color: "#34a853" },
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
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border">
      <h2 className="px-5 py-3 text-[11px] font-bold uppercase tracking-[.09em] text-foreground">
        {children}
      </h2>
      {right ? <div className="pr-3">{right}</div> : null}
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
    <ChartContainer config={chartConfig} className="h-[260px] w-full px-2 py-2">
      <ComposedChart
        accessibilityLayer
        data={data}
        margin={{ left: 4, right: 12, top: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis width={30} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <defs>
          <linearGradient id="fillDevelopment" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-development)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-development)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillSupport" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-support)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-support)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <Area
          dataKey="development"
          type="monotone"
          stackId="a"
          fill="url(#fillDevelopment)"
          fillOpacity={0.4}
          stroke="var(--color-development)"
        />
        <Area
          dataKey="support"
          type="monotone"
          stackId="a"
          fill="url(#fillSupport)"
          fillOpacity={0.4}
          stroke="var(--color-support)"
        />
        <Line
          dataKey="uniquePrs"
          type="monotone"
          stroke="var(--color-uniquePrs)"
          strokeWidth={2}
          dot={{ r: 3 }}
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
    <div className="flex flex-wrap items-center justify-center gap-8 px-5 py-6">
      <div className="relative">
        {total > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-square h-[160px] w-[160px]"
          >
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={56}
                outerRadius={76}
                strokeWidth={2}
                cornerRadius={4}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="size-[160px] rounded-full border-[16px] border-muted" />
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold tabular-nums tracking-[-.03em]">
            {total}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[.09em] text-muted-foreground">
            started
          </span>
        </div>
      </div>
      <div className="w-40 space-y-2.5">
        <LegendRow
          color="var(--color-development)"
          label="Development"
          count={development}
          pct={pct(development)}
        />
        <LegendRow
          color="var(--color-support)"
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

function LegendRow({
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
    <div className="flex items-center gap-2 text-sm">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      <span className="font-medium">{label}</span>
      <span className="ml-auto tabular-nums text-muted-foreground">
        {count} · {pct}%
      </span>
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
    <ChartContainer config={chartConfig} className="h-[220px] w-full px-2 py-2">
      <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis width={30} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="development"
          stackId="a"
          fill="var(--color-development)"
          barSize={28}
        />
        <Bar
          dataKey="support"
          stackId="a"
          fill="var(--color-support)"
          barSize={28}
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
      <p className="flex h-[220px] items-center justify-center px-5 text-center text-sm text-muted-foreground">
        No completed trackers in this period.
      </p>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full px-2 py-2">
      <LineChart accessibilityLayer data={data} margin={{ left: 4, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis
          width={36}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(m: number) => `${m}m`}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Line
          dataKey="avgCycleTimeMinutes"
          type="monotone"
          stroke="var(--color-avgCycleTimeMinutes)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}
