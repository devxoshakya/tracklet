import type { AnalyticsDTO } from "@tracklet /db/schemas";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * PDF report (FR-PDF-01..05): executive summary, activity/distribution/PR/
 * completion/cycle-time charts, tracker appendix. Print-friendly A4, page
 * numbers, and honest labels — PR counts are "references submitted", the MVP
 * never verifies GitHub merge state (FR-PDF-05).
 */

import type { TrackerExportRow } from "./excel";

const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const CONTENT_W = PAGE.w - MARGIN * 2;

const INK = rgb(0.11, 0.13, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.89);
const PRIMARY = rgb(0.1, 0.34, 0.86);
const PURPLE = rgb(0.545, 0.361, 0.965);
const GREEN = rgb(0.16, 0.6, 0.31);
const SOFT = rgb(0.96, 0.97, 0.98);

type Fonts = { regular: PDFFont; bold: PDFFont };

/** Standard fonts are WinAnsi — drop anything outside printable ASCII. */
const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, "?");

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

const bucketLabel = (key: string) => {
  const isMonth = key.length === 7;
  return new Date(`${key}${isMonth ? "-01" : ""}T00:00:00Z`).toLocaleDateString(
    "en-GB",
    { month: "short", ...(isMonth ? {} : { day: "numeric" }), timeZone: "UTC" },
  );
};

export type PdfMeta = { generatedAt: Date };

export async function buildPdfReport(
  summary: AnalyticsDTO,
  trackers: TrackerExportRow[],
  meta: PdfMeta,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Tracklet Analytics Report");
  doc.setCreator("Tracklet");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { regular, bold };

  let page = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - MARGIN;

  const text = (
    s: string,
    o: { x?: number; y?: number; size?: number; font?: PDFFont; color?: typeof INK; align?: "right" | "center"; w?: number },
  ) => {
    const size = o.size ?? 10;
    const font = o.font ?? regular;
    const str = ascii(s);
    const width = font.widthOfTextAtSize(str, size);
    const x =
      o.align === "right"
        ? (o.x ?? MARGIN) + (o.w ?? 0) - width
        : o.align === "center"
          ? (o.x ?? MARGIN) + ((o.w ?? 0) - width) / 2
          : (o.x ?? MARGIN);
    page.drawText(str, {
      x,
      y: o.y ?? y,
      size,
      font,
      color: o.color ?? INK,
    });
  };

  const section = (title: string) => {
    y -= 28;
    text(title, { size: 11, font: bold });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE.w - MARGIN, y },
      thickness: 0.75,
      color: LINE,
    });
    y -= 14;
  };

  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 34) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - MARGIN;
    }
  };

  // ---- Title block ---------------------------------------------------------
  text("Tracklet Analytics Report", { size: 19, font: bold });
  y -= 16;
  text(
    `Reporting period: ${fmtDay(summary.range.from)} – ${fmtDay(summary.range.to)} (IST)`,
    { size: 9.5, color: MUTED },
  );
  y -= 12;
  text(
    `Generated ${meta.generatedAt.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}`,
    { size: 9.5, color: MUTED },
  );
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE.w - MARGIN, y },
    thickness: 1.2,
    color: PRIMARY,
  });

  // ---- Executive summary ---------------------------------------------------
  section("Executive summary");
  const metrics: [string, string][] = [
    ["Trackers started", String(summary.started)],
    ["Trackers completed", String(summary.completed)],
    ["Open trackers (now)", String(summary.openAgeDays.count)],
    ["PR references submitted", String(summary.uniquePrs)],
    ["Development", String(summary.development)],
    ["Support", String(summary.support)],
    [
      "Average cycle time",
      summary.avgCycleTimeMinutes === null ? "—" : `${summary.avgCycleTimeMinutes} min`,
    ],
    [
      "Oldest open tracker",
      summary.openAgeDays.oldest === null ? "—" : `${summary.openAgeDays.oldest} days`,
    ],
  ];
  const cellW = CONTENT_W / 4;
  const cellH = 46;
  metrics.forEach(([label, value], i) => {
    const col = i % 4;
    const rowI = Math.floor(i / 4);
    const x = MARGIN + col * cellW;
    const cy = y - rowI * cellH;
    page.drawRectangle({
      x: x + 2,
      y: cy - cellH + 8,
      width: cellW - 4,
      height: cellH - 8,
      color: SOFT,
    });
    text(label.toUpperCase(), { x: x + 10, y: cy - 12, size: 6.5, color: MUTED, font: bold });
    text(value, { x: x + 10, y: cy - 30, size: 14, font: bold });
  });
  y -= Math.ceil(metrics.length / 4) * cellH + 4;

  // ---- Charts --------------------------------------------------------------
  const buckets = summary.series;
  const maxOf = (get: (b: (typeof buckets)[number]) => number) =>
    Math.max(1, ...buckets.map(get));

  // 1. Monthly tracker activity: started vs completed grouped bars (#1).
  section("Monthly tracker activity (started vs completed)");
  y = groupedBars(page, fonts, {
    x: MARGIN,
    y,
    w: CONTENT_W,
    h: 110,
    labels: buckets.map((b) => bucketLabel(b.bucket)),
    groups: buckets.map((b) => [
      { v: b.started, color: PRIMARY },
      { v: b.completed, color: GREEN },
    ]),
    max: maxOf((b) => Math.max(b.started, b.completed)),
  });
  y = legend(y, fonts, text, [
    { label: "Started", color: PRIMARY },
    { label: "Completed", color: GREEN },
  ]);

  // 2. Development vs Support distribution (#2/#6) — one stacked bar + legend.
  section("Development vs Support (started in period)");
  y = stackedBarRow(page, {
    x: MARGIN,
    y,
    w: CONTENT_W,
    development: summary.development,
    support: summary.support,
    total: summary.started,
  });
  y = legend(y - 6, fonts, text, [
    { label: `Development — ${summary.development} · ${pct(summary.development, summary.started)}%`, color: PRIMARY },
    { label: `Support — ${summary.support} · ${pct(summary.support, summary.started)}%`, color: PURPLE },
  ]);

  // 3. Monthly PR activity (#3).
  section("PR references submitted per month");
  y = barChart(page, fonts, {
    x: MARGIN,
    y,
    w: CONTENT_W,
    h: 100,
    labels: buckets.map((b) => bucketLabel(b.bucket)),
    values: buckets.map((b) => b.uniquePrs),
    colors: buckets.map(() => PURPLE),
    max: maxOf((b) => b.uniquePrs),
  });

  // 4. Completion trend (#4).
  section("Completion trend");
  y = lineChart(page, fonts, {
    x: MARGIN,
    y,
    w: CONTENT_W,
    h: 100,
    labels: buckets.map((b) => bucketLabel(b.bucket)),
    values: buckets.map((b) => b.completed),
    color: GREEN,
    max: maxOf((b) => b.completed),
  });

  // 5. Average cycle time (#9).
  section("Average cycle time per month (completed trackers)");
  const cycleValues = buckets.map((b) => b.avgCycleTimeMinutes);
  if (cycleValues.some((v) => v !== null)) {
    y = lineChart(page, fonts, {
      x: MARGIN,
      y,
      w: CONTENT_W,
      h: 100,
      labels: buckets.map((b) => bucketLabel(b.bucket)),
      values: cycleValues,
      color: PRIMARY,
      max: Math.max(1, ...cycleValues.filter((v): v is number => v !== null)),
      ySuffix: "m",
    });
  } else {
    text("No completed trackers in this period.", { size: 9, color: MUTED });
    y -= 14;
  }

  // ---- Tracker appendix ----------------------------------------------------
  ensure(80);
  section("Tracker appendix");
  const cols = [
    { label: "Ticket ID", x: 0, w: 96 },
    { label: "Category", x: 96, w: 84 },
    { label: "Start", x: 180, w: 66 },
    { label: "Completed", x: 246, w: 66 },
    { label: "Status", x: 312, w: 82 },
    { label: "PRs", x: 394, w: 34 },
    { label: "Cycle", x: 428, w: CONTENT_W - 428 },
  ];
  const drawHead = () => {
    page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_W, height: 16, color: SOFT });
    cols.forEach((c) =>
      text(c.label, { x: MARGIN + c.x + 4, y, size: 7.5, font: bold, color: MUTED }),
    );
    y -= 18;
  };
  drawHead();
  for (const t of trackers) {
    if (y < MARGIN + 40) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - MARGIN;
      drawHead();
    }
    const cycle = t.completedAt
      ? cycleLabel(t.completedAt.getTime() - t.startedAt.getTime())
      : "—";
    const row = [
      t.ticketId,
      t.category,
      istDate(t.startedAt),
      t.completedAt ? istDate(t.completedAt) : "—",
      t.status,
      String(t.prs.length),
      cycle,
    ];
    cols.forEach((c, i) =>
      text(row[i] ?? "", { x: MARGIN + c.x + 4, y, size: 8, color: i === 0 ? INK : MUTED, font: i === 0 ? bold : regular }),
    );
    y -= 14;
  }

  // ---- Footers with page numbers (FR-PDF-04) -------------------------------
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGIN, y: MARGIN + 20 },
      end: { x: PAGE.w - MARGIN, y: MARGIN + 20 },
      thickness: 0.6,
      color: LINE,
    });
    p.drawText(
      ascii("PR references submitted — GitHub merge state is not verified."),
      { x: MARGIN, y: MARGIN + 8, size: 7, font: regular, color: MUTED },
    );
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, {
      x: PAGE.w - MARGIN - bold.widthOfTextAtSize(label, 7),
      y: MARGIN + 8,
      size: 7,
      font: bold,
      color: MUTED,
    });
  });

  return doc.save();
}

// ---------------------------------------------------------------- chart prims

type Series = { v: number; color: ReturnType<typeof rgb> };

function axes(
  page: PDFPage,
  fonts: Fonts,
  o: { x: number; y: number; w: number; h: number; max: number; ySuffix?: string },
) {
  page.drawLine({
    start: { x: o.x, y: o.y - o.h },
    end: { x: o.x + o.w, y: o.y - o.h },
    thickness: 0.8,
    color: LINE,
  });
  // Y-axis: max label + gridline at half; enough for a print summary.
  const suffix = o.ySuffix ?? "";
  page.drawText(ascii(`${o.max}${suffix}`), {
    x: o.x - 4 - fonts.regular.widthOfTextAtSize(`${o.max}${suffix}`, 6.5),
    y: o.y - 4,
    size: 6.5,
    font: fonts.regular,
    color: MUTED,
  });
  return o.max;
}

function groupedBars(
  page: PDFPage,
  fonts: Fonts,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    labels: string[];
    groups: Series[][];
    max: number;
  },
) {
  const max = axes(page, fonts, o);
  const slot = o.w / Math.max(o.groups.length, 1);
  const barW = Math.min(14, (slot - 10) / 2);
  o.groups.forEach((group, i) => {
    const cx = o.x + slot * i + slot / 2;
    group.forEach((s, j) => {
      const barH = (s.v / max) * (o.h - 8);
      if (s.v > 0) {
        page.drawRectangle({
          x: cx - barW - 1.5 + j * (barW + 3),
          y: o.y - o.h + barH,
          width: barW,
          height: barH,
          color: s.color,
        });
      }
    });
    textCentered(page, fonts, o.labels[i] ?? "", cx, o.y - o.h - 11);
  });
  return o.y - o.h - 24;
}

function barChart(
  page: PDFPage,
  fonts: Fonts,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    labels: string[];
    values: number[];
    colors: ReturnType<typeof rgb>[];
    max: number;
  },
) {
  const max = axes(page, fonts, o);
  const slot = o.w / Math.max(o.values.length, 1);
  const barW = Math.min(22, slot - 10);
  o.values.forEach((v, i) => {
    const cx = o.x + slot * i + slot / 2;
    const barH = (v / max) * (o.h - 8);
    if (v > 0) {
      page.drawRectangle({
        x: cx - barW / 2,
        y: o.y - o.h + barH,
        width: barW,
        height: barH,
        color: o.colors[i],
      });
    }
    textCentered(page, fonts, o.labels[i] ?? "", cx, o.y - o.h - 11);
  });
  return o.y - o.h - 24;
}

function lineChart(
  page: PDFPage,
  fonts: Fonts,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    labels: string[];
    values: (number | null)[];
    color: ReturnType<typeof rgb>;
    max: number;
    ySuffix?: string;
  },
) {
  const max = axes(page, fonts, o);
  const inner = o.h - 8;
  const pts = o.values
    .map((v, i) => ({
      x: o.x + (o.w * i) / Math.max(o.values.length - 1, 1),
      yy: o.y - o.h + 4 + ((v ?? 0) / max) * inner,
      v,
      label: o.labels[i] ?? "",
    }))
    .filter((p) => p.v !== null);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    page.drawLine({
      start: { x: a.x, y: a.yy },
      end: { x: b.x, y: b.yy },
      thickness: 2,
      color: o.color,
    });
  }
  pts.forEach((p) => {
    page.drawCircle({ x: p.x, y: p.yy, size: 2.5, color: o.color });
    textCentered(page, fonts, p.label, p.x, o.y - o.h - 11);
  });
  return o.y - o.h - 24;
}

function stackedBarRow(
  page: PDFPage,
  o: { x: number; y: number; w: number; development: number; support: number; total: number },
) {
  const barH = 18;
  page.drawRectangle({
    x: o.x,
    y: o.y - barH,
    width: o.w,
    height: barH,
    color: SOFT,
  });
  const devShare = o.total > 0 ? o.development / o.total : 0;
  if (o.development > 0) {
    page.drawRectangle({
      x: o.x,
      y: o.y - barH,
      width: o.w * devShare,
      height: barH,
      color: PRIMARY,
    });
  }
  if (o.support > 0) {
    page.drawRectangle({
      x: o.x + o.w * devShare,
      y: o.y - barH,
      width: o.w * (1 - devShare),
      height: barH,
      color: PURPLE,
    });
  }
  return o.y - barH;
}

function legend(
  y: number,
  fonts: Fonts,
  text: (s: string, o: { x?: number; y?: number; size?: number; font?: PDFFont; color?: typeof INK }) => void,
  items: { label: string; color: ReturnType<typeof rgb> }[],
) {
  let x = 48;
  for (const item of items) {
    text("■", { x, y, size: 9, color: item.color });
    x += 11;
    text(item.label, { x, y, size: 8.5, color: MUTED });
    x += fonts.regular.widthOfTextAtSize(ascii(item.label), 8.5) + 18;
  }
  return y - 16;
}

function textCentered(
  page: PDFPage,
  fonts: Fonts,
  s: string,
  cx: number,
  cy: number,
) {
  const str = ascii(s);
  page.drawText(str, {
    x: cx - fonts.regular.widthOfTextAtSize(str, 7) / 2,
    y: cy,
    size: 7,
    font: fonts.regular,
    color: MUTED,
  });
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function istDate(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function cycleLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
