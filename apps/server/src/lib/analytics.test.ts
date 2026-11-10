import { describe, expect, test } from "bun:test";

import { computeAnalytics, resolveRange } from "./analytics";

/**
 * computeAnalytics' where-clauses run in D1 (integration territory); here we
 * return pre-filtered fixtures and test the aggregation math itself: IST
 * bucketing, dedupe, averages, caps.
 */
function fakeDb(rows: {
  byCategory?: { category: string; _count: { _all: number } }[];
  completed?: { startedAt: Date; completedAt: Date | null }[];
  open?: { startedAt: Date }[];
  series?: { startedAt: Date; completedAt: Date | null; category: string }[];
  prs?: { urlNormalized: string }[];
  seriesPrs?: { addedAt: Date; urlNormalized: string }[];
}) {
  const db = {
    tracker: {
      groupBy: async () => rows.byCategory ?? [],
      // Dispatch on select shape: series rows carry category, open rows only
      // startedAt, completed rows both datetimes.
      findMany: async (args: { select: Record<string, boolean> }) =>
        "category" in args.select
          ? rows.series ?? []
          : "completedAt" in args.select
            ? rows.completed ?? []
            : rows.open ?? [],
    },
    trackerPr: {
      findMany: async (args: { select: Record<string, boolean> }) =>
        "addedAt" in args.select ? rows.seriesPrs ?? [] : rows.prs ?? [],
    },
  };
  return db as unknown as Parameters<typeof computeAnalytics>[0];
}

describe("resolveRange", () => {
  test("defaults to the current IST calendar month", () => {
    const { from } = resolveRange({}, new Date("2026-11-10T12:00:00Z"));
    // Nov 1 00:00 IST == Oct 31 18:30 UTC.
    expect(from.toISOString()).toBe("2026-10-31T18:30:00.000Z");
  });

  test("honors explicit bounds", () => {
    const r = resolveRange(
      { from: "2026-01-01T00:00:00Z", to: "2026-01-31T00:00:00Z" },
      new Date("2026-11-10T12:00:00Z"),
    );
    expect(r.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
});

describe("computeAnalytics — month granularity", () => {
  const range = { from: "2026-01-01T00:00:00Z", to: "2026-02-15T00:00:00Z" };

  test("buckets by IST calendar month", async () => {
    const dto = await computeAnalytics(fakeDb({}), "u1", range);
    expect(dto.series.map((s) => s.bucket)).toEqual(["2026-01", "2026-02"]);
  });

  test("IST day boundary: Jan 31 18:31 UTC is Feb 1 IST, Jan 31 18:29 UTC is Jan", async () => {
    const dto = await computeAnalytics(
      fakeDb({
        series: [
          { startedAt: new Date("2026-01-31T18:29:00Z"), completedAt: null, category: "DEVELOPMENT" },
          { startedAt: new Date("2026-01-31T18:31:00Z"), completedAt: null, category: "SUPPORT" },
        ],
      }),
      "u1",
      range,
    );
    expect(dto.series.find((s) => s.bucket === "2026-01")?.started).toBe(1);
    expect(dto.series.find((s) => s.bucket === "2026-02")?.started).toBe(1);
    expect(dto.series.find((s) => s.bucket === "2026-01")?.support).toBe(0);
    expect(dto.series.find((s) => s.bucket === "2026-02")?.support).toBe(1);
  });

  test("category split, dedupe by normalized URL, cycle-time average", async () => {
    const dto = await computeAnalytics(
      fakeDb({
        byCategory: [
          { category: "DEVELOPMENT", _count: { _all: 2 } },
          { category: "SUPPORT", _count: { _all: 1 } },
        ],
        completed: [
          { startedAt: new Date("2026-01-01T00:00:00Z"), completedAt: new Date("2026-01-01T01:30:00Z") },
          { startedAt: new Date("2026-01-02T00:00:00Z"), completedAt: new Date("2026-01-02T02:30:00Z") },
        ],
        prs: [
          { urlNormalized: "https://github.com/a/b/pull/1" },
          { urlNormalized: "https://github.com/a/b/pull/1" },
          { urlNormalized: "https://github.com/a/b/pull/2" },
        ],
        seriesPrs: [],
      }),
      "u1",
      range,
    );
    expect(dto.started).toBe(3);
    expect(dto.development).toBe(2);
    expect(dto.support).toBe(1);
    expect(dto.completed).toBe(2);
    expect(dto.uniquePrs).toBe(2);
    expect(dto.avgCycleTimeMinutes).toBe(120);
  });

  test("caps the series at the last 12 buckets", async () => {
    const dto = await computeAnalytics(
      fakeDb({}),
      "u1",
      { from: "2024-01-01T00:00:00Z", to: "2026-11-10T00:00:00Z" },
    );
    expect(dto.series.length).toBe(12);
    expect(dto.series[0]!.bucket).toBe("2025-12");
  });

  test("openAgeDays is the current snapshot against startedAt", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    const dto = await computeAnalytics(
      fakeDb({ open: [{ startedAt: tenDaysAgo }] }),
      "u1",
      range,
    );
    expect(dto.openAgeDays.count).toBe(1);
    expect(dto.openAgeDays.average).toBe(10);
    expect(dto.openAgeDays.oldest).toBe(10);
  });
});

describe("computeAnalytics — week granularity", () => {
  // Nov 2 2026 is a Monday, Nov 8 the following Sunday, Nov 9 the next Monday.
  const range = { from: "2026-11-02T00:00:00Z", to: "2026-11-09T23:00:00Z" };

  test("buckets are Monday-start week keys", async () => {
    const dto = await computeAnalytics(fakeDb({}), "u1", range, "week");
    expect(dto.series.map((s) => s.bucket)).toEqual(["2026-11-02", "2026-11-09"]);
  });

  test("a Sunday IST instant lands in its Monday's bucket", async () => {
    const dto = await computeAnalytics(
      fakeDb({
        series: [
          { startedAt: new Date("2026-11-08T10:00:00Z"), completedAt: null, category: "DEVELOPMENT" },
        ],
      }),
      "u1",
      range,
      "week",
    );
    expect(dto.series.find((s) => s.bucket === "2026-11-02")?.started).toBe(1);
    expect(dto.series.find((s) => s.bucket === "2026-11-09")?.started).toBe(0);
  });
});
