"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { Skeleton } from "@tracklet/ui/components/skeleton";

/**
 * KPI card kit shared by the dashboard and analytics pages: an icon tile,
 * a count-up value, an optional self-drawing sparkline and an optional
 * footnote (where we state the date basis, per FR-AN-04). Resting state is
 * quiet; hover adds a hairline accent, a small lift and a ghost icon.
 */

/** Eased integer count-up (0 → target on mount, old → new on change). */
export function useCountUp(target: number, duration = 700): number {
  const [display, setDisplay] = useState(() =>
    Number.isInteger(target) ? 0 : target,
  );
  // Mirrors `display` so an interrupted animation (StrictMode re-run, value
  // change mid-flight) resumes from where the number actually is, not from a
  // stale "previous target" — that stale-ref version freezes at 0.
  const displayRef = useRef(display);

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return;
    // Fractional aggregates (e.g. avg open age) are shown as-is — rounding
    // them mid-animation would display values that never existed.
    if (!Number.isInteger(target) || !Number.isInteger(from)) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (target - from) * eased);
      displayRef.current = v;
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

export function AnimatedNumber({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

/**
 * Tiny SVG sparkline, stretched full-width over a 100×32 box. Null points
 * (e.g. months with no completed trackers) are skipped. The stroke draws
 * itself in via `.spark-draw` + pathLength=1.
 */
export function Sparkline({
  points,
  className,
}: {
  points: (number | null)[];
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const values = points.filter((p): p is number => p !== null);

  if (values.length < 2) {
    return <div className={className} aria-hidden="true" />;
  }

  const W = 100;
  const H = 32;
  const P = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (W - P * 2) / (values.length - 1);
  const coords = values.map(
    (v, i) =>
      [
        P + i * step,
        P + (1 - (v - min) / span) * (H - P * 2),
      ] as const,
  );
  const line = coords
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${(W - P).toFixed(2)},${H} L${P},${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${uid})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        className="spark-draw"
      />
    </svg>
  );
}

/**
 * Semantic tones for the icon chip, mirroring the status colors already used
 * by the chips and split bars (design.md §6.3: soft fill + text-safe shade
 * per theme).
 */
export type KpiTone = "primary" | "green" | "orange" | "violet" | "neutral";

const KPI_TONES: Record<KpiTone, { chip: string; ghost: string }> = {
  primary: {
    chip: "bg-accent text-[#123f9e] dark:bg-[#16243c] dark:text-[#8fb4ff]",
    ghost: "text-[#1a5cff]/[.09] dark:text-[#3b76ff]/[.14]",
  },
  green: {
    chip: "bg-[#e7f5ec] text-[#1e7a3a] dark:bg-[#17301f] dark:text-[#6ee7a0]",
    ghost: "text-[#34a853]/[.1] dark:text-[#34a853]/[.16]",
  },
  orange: {
    chip: "bg-[#fff0e8] text-[#b8400f] dark:bg-[#33230f] dark:text-[#fdba74]",
    ghost: "text-[#ff672f]/[.1] dark:text-[#ff672f]/[.16]",
  },
  violet: {
    chip: "bg-[#f0ecfc] text-[#5238b8] dark:bg-[#2a2440] dark:text-[#c4b5fd]",
    ghost: "text-[#8b5cf6]/[.1] dark:text-[#8b5cf6]/[.16]",
  },
  neutral: {
    chip: "bg-muted text-muted-foreground",
    ghost: "text-primary/[.07] dark:text-primary/[.1]",
  },
};

export function KpiCard({
  label,
  hint,
  icon: Icon,
  value,
  suffix,
  foot,
  spark,
  sparkClassName,
  tone = "neutral",
  size = "md",
  className,
}: {
  label: string;
  hint?: string;
  icon: LucideIcon;
  /** undefined while loading → skeleton; strings render as-is (no count-up). */
  value?: number | string;
  suffix?: string;
  foot?: string;
  spark?: (number | null)[];
  sparkClassName?: string;
  /** Colors the icon chip and the hover ghost. */
  tone?: KpiTone;
  size?: "md" | "lg";
  className?: string;
}) {
  const pending = value === undefined;
  const tones = KPI_TONES[tone];
  return (
    <div
      title={hint}
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card px-4 py-3.5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-primary/35 hover:shadow-[0_12px_28px_rgba(15,17,20,0.08)] ${className ?? ""}`}
    >
      {/* Ghost icon, hover only — quiet at rest, a little reward on approach */}
      <Icon
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-3 -right-2 size-16 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${tones.ghost}`}
      />
      <div className="relative flex items-start justify-between gap-2">
        <p className="pt-0.5 text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
          {label}
        </p>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${tones.chip}`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      {pending ? (
        <div className="relative mt-3 h-7">
          <Skeleton className="h-7 w-14 rounded-md" />
        </div>
      ) : (
        <p
          className={`relative mt-2 font-bold leading-none tabular-nums tracking-[-.03em] ${
            size === "lg" ? "text-[30px]" : "text-[26px]"
          }`}
        >
          {typeof value === "number" ? (
            <AnimatedNumber value={value} />
          ) : (
            value
          )}
          {suffix ? (
            <span className="ml-1.5 align-baseline text-[13px] font-semibold text-muted-foreground">
              {suffix}
            </span>
          ) : null}
        </p>
      )}
      <div className="relative mt-auto space-y-2 pt-2.5">
        {spark ? (
          <Sparkline
            points={spark}
            className={`h-8 w-full ${sparkClassName ?? "text-primary"}`}
          />
        ) : null}
        {foot && !pending ? (
          <p className="text-[11px] font-medium leading-snug text-muted-foreground">
            {foot}
          </p>
        ) : null}
      </div>
    </div>
  );
}
