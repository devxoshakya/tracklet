import type { AnalyticsDTO } from "@tracklet /db/schemas";
import ExcelJS from "exceljs";

/**
 * Excel export (FR-EXP-01..05): Overview, Trackers, PR References and Monthly
 * Analytics sheets. Input rows come from the same period rules as the
 * Analytics page (shared computeAnalytics / route queries), so totals match
 * by construction (FR-EXP-05).
 */

const DATE_FMT = "dd-mmm-yyyy";
const DATETIME_FMT = "dd-mmm-yyyy hh:mm";
const CYCLE_FMT = '#,##0 "min"';

/** Tracker with its PR rows — the Trackers sheet payload. */
export type TrackerExportRow = {
  ticketId: string;
  jiraUrl: string;
  category: string;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  prs: { url: string }[];
};

/** PR with its parent tracker — the PR References sheet payload. */
export type PrExportRow = {
  url: string;
  repoOwner: string | null;
  repoName: string | null;
  prNumber: number | null;
  addedAt: Date;
  tracker: { ticketId: string; jiraUrl: string; category: string };
};

export type ExcelMeta = {
  generatedAt: Date;
  from: Date;
  to: Date;
};

const istDay = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function styleTableSheet(
  ws: ExcelJS.Worksheet,
  header: string[],
  widths: number[],
) {
  // FR-EXP-04: bold frozen header row, filters, column widths.
  const row = ws.getRow(1);
  row.font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: header.length },
  };
  ws.columns = widths.map((width) => ({ width }));
}

/** Duration as "Xd Yh Zm" for the Trackers sheet (compact, sortable-adjacent). */
function cycleLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export async function buildExcelWorkbook(
  summary: AnalyticsDTO,
  trackers: TrackerExportRow[],
  prs: PrExportRow[],
  meta: ExcelMeta,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tracklet";
  wb.created = meta.generatedAt;

  // ---- Sheet: Overview -----------------------------------------------------
  const overview = wb.addWorksheet("Overview");
  overview.columns = [{ width: 34 }, { width: 28 }];
  overview.addRows([
    ["Report name", "Tracklet Analytics Report"],
    ["Generated at", meta.generatedAt],
    ["Reporting period from", meta.from],
    ["Reporting period to", meta.to],
    ["Trackers started", summary.started],
    ["Trackers completed", summary.completed],
    ["Open trackers (as of export)", summary.openAgeDays.count],
    ["Development count", summary.development],
    ["Support count", summary.support],
    ["PR references added in period", summary.uniquePrs],
    [
      "Average cycle time (completed in period)",
      summary.avgCycleTimeMinutes ?? "—",
    ],
  ]);
  overview.getColumn(1).font = { bold: true };
  overview.getCell("B2").numFmt = DATETIME_FMT;
  overview.getCell("B3").numFmt = DATE_FMT;
  overview.getCell("B4").numFmt = DATE_FMT;
  overview.getCell("B11").numFmt = CYCLE_FMT;
  // PR counts are references submitted, never "merged" (§8.3, FR-PDF-05).
  overview.getCell("A12").note =
    "PR references added = unique pull-request URLs recorded; GitHub merge state is not verified.";

  // ---- Sheet: Trackers -----------------------------------------------------
  const trackersSheet = wb.addWorksheet("Trackers");
  trackersSheet.addRow([
    "Ticket ID",
    "Jira URL",
    "Category",
    "Start date",
    "Completion date",
    "Status",
    "PR references",
    "Cycle time",
  ]);
  for (const t of trackers) {
    trackersSheet.addRow([
      t.ticketId,
      t.jiraUrl,
      t.category,
      t.startedAt,
      t.completedAt,
      t.status,
      t.prs.length,
      t.completedAt
        ? cycleLabel(t.completedAt.getTime() - t.startedAt.getTime())
        : "—",
    ]);
  }
  styleTableSheet(trackersSheet, [], [14, 42, 14, 14, 16, 12, 14, 12]);
  trackersSheet.getColumn(4).numFmt = DATE_FMT;
  trackersSheet.getColumn(5).numFmt = DATE_FMT;

  // ---- Sheet: PR References ------------------------------------------------
  const prsSheet = wb.addWorksheet("PR References");
  prsSheet.addRow([
    "Ticket ID",
    "Jira URL",
    "Category",
    "PR URL",
    "Repository",
    "PR number",
    "PR added date",
  ]);
  for (const p of prs) {
    prsSheet.addRow([
      p.tracker.ticketId,
      p.tracker.jiraUrl,
      p.tracker.category,
      p.url,
      p.repoOwner && p.repoName ? `${p.repoOwner}/${p.repoName}` : "—",
      p.prNumber ?? "—",
      p.addedAt,
    ]);
  }
  styleTableSheet(prsSheet, [], [14, 42, 14, 52, 26, 12, 16]);
  prsSheet.getColumn(7).numFmt = DATE_FMT;

  // ---- Sheet: Monthly Analytics -------------------------------------------
  const monthly = wb.addWorksheet("Monthly Analytics");
  monthly.addRow([
    "Period",
    "Trackers started",
    "Trackers completed",
    "Development",
    "Support",
    "PR references added",
    "Average cycle time (min)",
  ]);
  for (const b of summary.series) {
    monthly.addRow([
      b.bucket,
      b.started,
      b.completed,
      b.development,
      b.support,
      b.uniquePrs,
      b.avgCycleTimeMinutes ?? "—",
    ]);
  }
  styleTableSheet(monthly, [], [14, 16, 18, 13, 11, 20, 24]);
  monthly.getColumn(1).numFmt = "@";
  // Period is "YYYY-MM" or week-start "YYYY-MM-DD" (IST).

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

/** File name hint used by the route's Content-Disposition. */
export function excelFileName(meta: ExcelMeta): string {
  return `tracklet-export-${istDay(meta.from)}_to_${istDay(meta.to)}.xlsx`;
}
