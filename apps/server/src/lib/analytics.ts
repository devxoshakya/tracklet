import type { AnalyticsDTO } from "@tracklet /db/schemas";
import { IST_OFFSET_MINUTES } from "@tracklet /db/schemas";

import type { ApiEnv } from "../env.api";

const DAY_MS = 86_400_000;
const IST_MS = IST_OFFSET_MINUTES * 60_000;

/** Same row shape the dashboard route accepts (offset datetimes, optional). */
export type AnalyticsRange = { from?: string; to?: string };

/** FR-AN-02: default period is the current IST calendar month. */
export function resolveRange(range: AnalyticsRange, now = new Date()) {
  const istNow = new Date(now.getTime() + IST_MS);
  return {
    from: range.from
      ? new Date(range.from)
      : new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - IST_MS),
    to: range.to ? new Date(range.to) : now,
  };
}

/**
 * Analytics computation (FR-AN-01..10) — the single source of truth shared by
 * the Analytics page endpoint and the Excel/PDF exports (FR-EXP-05, FR-PDF-03:
 * exports must match the page's period rules by construction).
 *
 * Date bases (stated explicitly per FR-AN-04):
 * - started / category split → startedAt in range
 * - completed / cycle time   → completedAt in range
 * - uniquePrs                → PR addedAt in range ("added", not merged)
 * - openAgeDays              → current open snapshot, now − startedAt
 * - series                   → IST month or week buckets across the range,
 *   capped at the last 12 buckets
 */
export async function computeAnalytics(
  db: ApiEnv["Variables"]["db"],
  userId: string,
  range: AnalyticsRange,
  granularity: "week" | "month" = "month",
): Promise<AnalyticsDTO> {
  const now = new Date();
  const { from, to } = resolveRange(range, now);
  const toAnchor = new Date(to.getTime() + IST_MS);
  const isWeek = granularity === "week";

  /** IST bucket key of an instant: "YYYY-MM" or week-start "YYYY-MM-DD". */
  const bucketKeyOf = (instant: Date): string => {
    if (!isWeek) return istMonthKey(instant);
    // Shifted-space (UTC parts = IST parts); weeks start Monday.
    const t = new Date(instant.getTime() + IST_MS);
    return new Date(
      Date.UTC(
        t.getUTCFullYear(),
        t.getUTCMonth(),
        t.getUTCDate() - ((t.getUTCDay() + 6) % 7),
      ),
    )
      .toISOString()
      .slice(0, 10);
  };
  /** Monday 00:00 IST (shifted space) of the week containing `instant`. */
  const mondayOf = (instant: Date): number => {
    const t = new Date(instant.getTime() + IST_MS);
    return Date.UTC(
      t.getUTCFullYear(),
      t.getUTCMonth(),
      t.getUTCDate() - ((t.getUTCDay() + 6) % 7),
    );
  };

  // Buckets: first bucket of `from` through `to`'s bucket, capped at the
  // last 12 (PRD §14.2: no unbounded queries).
  let bucketCount: number;
  let seriesStart: Date;
  if (isWeek) {
    const firstMonday = mondayOf(from);
    const lastMonday = mondayOf(to);
    bucketCount = Math.min(
      12,
      Math.max(1, Math.round((lastMonday - firstMonday) / (7 * DAY_MS)) + 1),
    );
    seriesStart = new Date(lastMonday - (bucketCount - 1) * 7 * DAY_MS - IST_MS);
  } else {
    const fromAnchor = new Date(from.getTime() + IST_MS);
    const firstBucketStart = new Date(
      Date.UTC(fromAnchor.getUTCFullYear(), fromAnchor.getUTCMonth(), 1) - IST_MS,
    );
    const lastBucketStart = new Date(
      Date.UTC(toAnchor.getUTCFullYear(), toAnchor.getUTCMonth(), 1) - IST_MS,
    );
    bucketCount = Math.min(
      12,
      Math.max(
        1,
        (lastBucketStart.getUTCFullYear() - firstBucketStart.getUTCFullYear()) *
          12 +
          (lastBucketStart.getUTCMonth() - firstBucketStart.getUTCMonth()) +
          1,
      ),
    );
    seriesStart = new Date(
      Date.UTC(
        toAnchor.getUTCFullYear(),
        toAnchor.getUTCMonth() - (bucketCount - 1),
        1,
      ) - IST_MS,
    );
  }
  // Exact IST calendar buckets ending at `to`'s bucket (no fixed-step drift).
  const bucketKeys = Array.from({ length: bucketCount }, (_, i) => {
    if (isWeek) {
      return new Date(mondayOf(to) - (bucketCount - 1 - i) * 7 * DAY_MS)
        .toISOString()
        .slice(0, 10);
    }
    return new Date(
      Date.UTC(
        toAnchor.getUTCFullYear(),
        toAnchor.getUTCMonth() - (bucketCount - 1 - i),
        1,
      ),
    )
      .toISOString()
      .slice(0, 7);
  });

  const startedInRange = {
    userId,
    startedAt: { gte: from, lte: to },
  };
  const completedInRange = {
    userId,
    completedAt: { gte: from, lte: to },
  };
  const addedInRange = {
    userId,
    addedAt: { gte: from, lte: to },
  };

  const [
    byCategory,
    completedInRangeRows,
    prsInRange,
    openTrackers,
    seriesRows,
    seriesPrs,
  ] = await Promise.all([
    db.tracker.groupBy({
      by: ["category"],
      where: startedInRange,
      _count: { _all: true },
    }),
    db.tracker.findMany({
      where: completedInRange,
      select: { startedAt: true, completedAt: true },
    }),
    db.trackerPr.findMany({
      where: addedInRange,
      select: { urlNormalized: true },
    }),
    db.tracker.findMany({
      where: { userId, status: "OPEN" },
      select: { startedAt: true },
    }),
    db.tracker.findMany({
      where: {
        userId,
        OR: [
          { startedAt: { gte: seriesStart } },
          { completedAt: { gte: seriesStart } },
        ],
      },
      select: { startedAt: true, completedAt: true, category: true },
    }),
    db.trackerPr.findMany({
      where: { userId, addedAt: { gte: seriesStart } },
      select: { addedAt: true, urlNormalized: true },
    }),
  ]);

  const development =
    byCategory.find((row) => row.category === "DEVELOPMENT")?._count._all ?? 0;
  const support =
    byCategory.find((row) => row.category === "SUPPORT")?._count._all ?? 0;
  const started = development + support;

  const cycleTimes = completedInRangeRows
    .filter((t) => t.completedAt !== null)
    .map((t) => t.completedAt!.getTime() - t.startedAt.getTime());
  const avgCycleTimeMinutes = cycleTimes.length
    ? Math.round(cycleTimes.reduce((s, ms) => s + ms, 0) / cycleTimes.length / 60_000)
    : null;

  const uniquePrs = new Set(prsInRange.map((p) => p.urlNormalized)).size;

  const openAges = openTrackers.map(
    (t) => Math.max(0, now.getTime() - t.startedAt.getTime()) / DAY_MS,
  );
  const openAgeDays = {
    count: openAges.length,
    average: openAges.length
      ? Math.round(openAges.reduce((s, d) => s + d, 0) / openAges.length)
      : null,
    oldest: openAges.length ? Math.round(Math.max(...openAges)) : null,
  };

  const series = bucketKeys.map((key) => {
    // A distinct IST bucket key identifies exactly one bucket; the `to` bound
    // keeps the series consistent with the range-filtered cards.
    const inBucket = (instant: Date) =>
      bucketKeyOf(instant) === key && instant.getTime() <= to.getTime();
    const startedRows = seriesRows.filter((t) => inBucket(t.startedAt));
    const completedRows = seriesRows.filter(
      (t) => t.completedAt !== null && inBucket(t.completedAt),
    );
    const bucketCycle = completedRows
      .filter((t) => t.completedAt !== null)
      .map((t) => t.completedAt!.getTime() - t.startedAt.getTime());
    return {
      bucket: key,
      started: startedRows.length,
      completed: completedRows.length,
      development: startedRows.filter((t) => t.category === "DEVELOPMENT").length,
      support: startedRows.filter((t) => t.category === "SUPPORT").length,
      uniquePrs: new Set(
        seriesPrs
          .filter((p) => inBucket(p.addedAt))
          .map((p) => p.urlNormalized),
      ).size,
      avgCycleTimeMinutes: bucketCycle.length
        ? Math.round(
            bucketCycle.reduce((s, ms) => s + ms, 0) / bucketCycle.length / 60_000,
          )
        : null,
    };
  });

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    started,
    completed: completedInRangeRows.length,
    development,
    support,
    uniquePrs,
    avgCycleTimeMinutes,
    openAgeDays,
    series,
  };
}

/** IST calendar month key ("YYYY-MM") of an instant (FR-AN-04 basis). */
function istMonthKey(instant: Date): string {
  return new Date(instant.getTime() + IST_MS).toISOString().slice(0, 7);
}
