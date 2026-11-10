import type { AnalyticsDTO } from "@tracklet /db/schemas";
import { analyticsQuerySchema } from "@tracklet /db/schemas";
import { Hono } from "hono";

import type { ApiEnv } from "../env.api";
import { handleRoute } from "../lib/http";
import { computeAnalytics } from "../lib/analytics";

export const analytics = new Hono<ApiEnv>();

/**
 * Analytics overview (FR-AN-01..10): one round trip so React Query caches the
 * whole page under a single key, mirroring the dashboard route. All metric
 * math lives in lib/analytics (shared with the Excel/PDF exports).
 */
analytics.get("/", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const userId = c.get("userId");
    const query = analyticsQuerySchema.parse(c.req.query());
    const body: AnalyticsDTO = await computeAnalytics(db, userId, query, query.granularity);
    return c.json(body);
  });
});
