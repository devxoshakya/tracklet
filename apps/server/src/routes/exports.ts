import type { AnalyticsDTO } from "@tracklet /db/schemas";
import { z } from "zod";

import type { ApiEnv } from "../env.api";
import { computeAnalytics } from "../lib/analytics";
import { handleRoute } from "../lib/http";
import {
  buildExcelWorkbook,
  excelFileName,
  type PrExportRow,
  type TrackerExportRow,
} from "../lib/exports/excel";
import { buildPdfReport } from "../lib/exports/pdf";
import { Hono } from "hono";

export const exports = new Hono<ApiEnv>();

/** Exports always use the Analytics page's period rules (FR-EXP-05). */
const exportQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

async function loadExportData(
  db: ApiEnv["Variables"]["db"],
  userId: string,
  query: z.infer<typeof exportQuerySchema>,
): Promise<{ summary: AnalyticsDTO; trackers: TrackerExportRow[]; prs: PrExportRow[]; from: Date; to: Date }> {
  const summary = await computeAnalytics(db, userId, query, "month");
  const from = new Date(summary.range.from);
  const to = new Date(summary.range.to);
  // Trackers sheet: trackers started in the period (startedAt basis, same as
  // the Analytics "Started" metric); PR References: addedAt basis.
  const [trackers, prs] = await Promise.all([
    db.tracker.findMany({
      where: { userId, startedAt: { gte: from, lte: to } },
      include: { prs: { orderBy: { addedAt: "asc" as const } } },
      orderBy: { startedAt: "asc" as const },
    }),
    db.trackerPr.findMany({
      where: { userId, addedAt: { gte: from, lte: to } },
      include: {
        tracker: { select: { ticketId: true, jiraUrl: true, category: true } },
      },
      orderBy: { addedAt: "asc" as const },
    }),
  ]);
  return { summary, trackers, prs, from, to };
}

/** GET /exports/excel?from=&to= — 4-sheet workbook (FR-EXP-01..05). */
exports.get("/excel", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const userId = c.get("userId");
    const query = exportQuerySchema.parse(c.req.query());
    const { summary, trackers, prs, from, to } = await loadExportData(db, userId, query);
    const meta = { generatedAt: new Date(), from, to };

    const bytes = await buildExcelWorkbook(summary, trackers, prs, meta);
    return c.body(bytes as unknown as ArrayBuffer, 200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${excelFileName(meta)}"`,
      "Cache-Control": "no-store",
    });
  });
});

/** GET /exports/pdf?from=&to= — analytics report (FR-PDF-01..05). */
exports.get("/pdf", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const userId = c.get("userId");
    const query = exportQuerySchema.parse(c.req.query());
    const { summary, trackers, from, to } = await loadExportData(db, userId, query);
    const meta = { generatedAt: new Date(), from, to };

    const bytes = await buildPdfReport(summary, trackers, meta);
    return c.body(bytes as unknown as ArrayBuffer, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tracklet-report-${excelFileName(meta).replace("tracklet-export-", "").replace(".xlsx", "")}.pdf"`,
      "Cache-Control": "no-store",
    });
  });
});
