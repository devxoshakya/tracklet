import type { TrackerDTO } from "@tracklet /db/schemas";
import { dashboardQuerySchema } from "@tracklet /db/schemas";
import type { Tracker, TrackerPr } from "@tracklet /db/models";
import { Hono } from "hono";

import type { ApiEnv } from "../env.api";
import { handleRoute } from "../lib/http";
import { toTrackerDTO } from "./trackers";

export const dashboard = new Hono<ApiEnv>();

/**
 * FR-DASH-01..03: summary totals + recent activity for a period, in one
 * round trip so React Query caches the whole dashboard under a single key.
 *
 * Date basis (stated explicitly per FR-AN-04):
 * - total / open / devops / support → startedAt in range
 * - completed → completedAt in range
 * - uniquePrs → PR addedAt in range
 * - avgCycleTime → trackers completed in range
 */
dashboard.get("/", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const userId = c.get("userId");

    const query = dashboardQuerySchema.parse(c.req.query());
    const now = new Date();
    // FR-DASH-02: default period is the current calendar month.
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = query.to ? new Date(query.to) : now;

    const startedInRange = {
      userId,
      startedAt: { gte: from, lte: to },
    };
    const completedInRange = {
      userId,
      completedAt: { gte: from, lte: to },
    };

    const [
      total,
      open,
      devops,
      support,
      completed,
      prs,
      recentCreated,
      recentCompleted,
    ] = await Promise.all([
      db.tracker.count({ where: startedInRange }),
      db.tracker.count({ where: { ...startedInRange, status: "OPEN" } }),
      db.tracker.count({ where: { ...startedInRange, category: "DEVOPS" } }),
      db.tracker.count({ where: { ...startedInRange, category: "SUPPORT" } }),
      db.tracker.findMany({
        where: completedInRange,
        select: { startedAt: true, completedAt: true },
      }),
      db.trackerPr.findMany({
        where: { userId, addedAt: { gte: from, lte: to } },
        select: { urlNormalized: true },
      }),
      db.tracker.findMany({
        where: startedInRange,
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { prs: true },
      }),
      db.tracker.findMany({
        where: completedInRange,
        orderBy: { completedAt: "desc" },
        take: 5,
        include: { prs: true },
      }),
    ]);

    const cycleTimes = completed
      .filter((t): t is Tracker & { completedAt: Date } => t.completedAt !== null)
      .map((t) => t.completedAt.getTime() - t.startedAt.getTime());

    const avgCycleTimeMinutes = cycleTimes.length
      ? Math.round(
          cycleTimes.reduce((sum, ms) => sum + ms, 0) /
            cycleTimes.length /
            60_000,
        )
      : null;

    const recentCreatedDto = (recentCreated as (Tracker & { prs: TrackerPr[] })[]).map(
      toTrackerDTO,
    );
    const recentCompletedDto = (recentCompleted as (Tracker & { prs: TrackerPr[] })[]).map(
      toTrackerDTO,
    );

    return c.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        total,
        completed: completed.length,
        open,
        devops,
        support,
        // FR-PR-05: unique stored references only.
        uniquePrs: new Set(prs.map((p) => p.urlNormalized)).size,
        avgCycleTimeMinutes,
      },
      recentCreated: recentCreatedDto satisfies TrackerDTO[],
      recentCompleted: recentCompletedDto satisfies TrackerDTO[],
    });
  });
});
