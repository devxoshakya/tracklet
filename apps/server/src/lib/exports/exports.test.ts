import ExcelJS from "exceljs";
import { describe, expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";

import type { AnalyticsDTO } from "@tracklet /db/schemas";

import { buildExcelWorkbook, excelFileName } from "./excel";
import { buildPdfReport } from "./pdf";

const summary: AnalyticsDTO = {
  range: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-31T23:59:59.999Z" },
  started: 3,
  completed: 2,
  development: 2,
  support: 1,
  uniquePrs: 2,
  avgCycleTimeMinutes: 120,
  openAgeDays: { count: 1, average: 10, oldest: 10 },
  series: [
    {
      bucket: "2026-01",
      started: 3,
      completed: 2,
      development: 2,
      support: 1,
      uniquePrs: 2,
      avgCycleTimeMinutes: 120,
    },
  ],
};

const trackers = [
  {
    ticketId: "DEV-1",
    jiraUrl: "https://acme.atlassian.net/browse/DEV-1",
    category: "DEVELOPMENT",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    completedAt: new Date("2026-01-02T00:00:00Z"),
    status: "COMPLETED",
    prs: [{ url: "https://github.com/a/b/pull/1" }],
  },
];

const prs = [
  {
    url: "https://github.com/a/b/pull/1",
    repoOwner: "a",
    repoName: "b",
    prNumber: 1,
    addedAt: new Date("2026-01-03T00:00:00Z"),
    tracker: { ticketId: "DEV-1", jiraUrl: "https://acme.atlassian.net/browse/DEV-1", category: "DEVELOPMENT" },
  },
];

const meta = { generatedAt: new Date("2026-11-10T06:00:00Z"), from: new Date(summary.range.from), to: new Date(summary.range.to) };

async function loadWorkbook() {
  const bytes = await buildExcelWorkbook(summary, trackers, prs, meta);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb;
}

describe("excel export", () => {
  test("has the four FR-EXP-01 sheets", async () => {
    const wb = await loadWorkbook();
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      "Overview",
      "Trackers",
      "PR References",
      "Monthly Analytics",
    ]);
  });

  test("Trackers sheet carries the fixture rows", async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet("Trackers")!;
    expect(ws.getCell("A2").value).toBe("DEV-1");
    expect(ws.getCell("D2").value).toBeInstanceOf(Date);
  });

  test("never calls PR references 'merged' (FR-PDF-05)", async () => {
    const wb = await loadWorkbook();
    for (const ws of wb.worksheets) {
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          const text = String(cell.value?.toString?.() ?? cell.value ?? "");
          expect(text.toLowerCase()).not.toContain("merged");
        });
      });
    }
  });

  test("file name respects the selected range (FR-EXP-05)", () => {
    const name = excelFileName(meta);
    expect(name).toContain("2026-01-01");
    // `to` is Jan 31 23:59 UTC = Feb 1 IST — the export names by IST day.
    expect(name).toContain("2026-02-01");
  });
});

describe("pdf export", () => {
  test("produces a loadable multi-page PDF with the right title", async () => {
    const bytes = await buildPdfReport(summary, trackers, { generatedAt: meta.generatedAt });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Tracklet Analytics Report");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
