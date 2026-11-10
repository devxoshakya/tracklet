import type { AnalyticsDTO } from "@tracklet/db/schemas";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

/**
 * PDF report (FR-PDF-01..05): branded header, executive summary cards, chart
 * frames with gridlines/ticks/value labels, dev-vs-support split, trend areas,
 * and a zebra-striped tracker appendix. Print-friendly, page numbers, honest
 * labels — PR counts are "references submitted", the MVP never verifies GitHub
 * merge state (FR-PDF-05).
 */

import type { TrackerExportRow } from "./excel";

const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const CONTENT_W = PAGE.w - MARGIN * 2;

const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.44, 0.47, 0.52);
const LINE = rgb(0.85, 0.87, 0.89);
const GRID = rgb(0.92, 0.93, 0.95);
const CARD = rgb(0.965, 0.973, 0.98);
const NAVY = rgb(0.055, 0.09, 0.16);
const PRIMARY = rgb(0.1, 0.34, 0.86);
const PURPLE = rgb(0.545, 0.361, 0.965);
const GREEN = rgb(0.16, 0.6, 0.31);
const WHITE = rgb(1, 1, 1);

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

function fmtTick(v: number, suffix?: string) {
  const n = v >= 100 ? Math.round(v).toString() : String(Math.round(v * 10) / 10);
  return `${n}${suffix ?? ""}`;
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

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

export type PdfMeta = { generatedAt: Date };

export async function buildPdfReport(
  summary: AnalyticsDTO,
  trackers: TrackerExportRow[],
  meta: PdfMeta,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Tracklet Analytics Report");
  doc.setSubject(`Analytics for ${fmtDay(summary.range.from)}- ${fmtDay(summary.range.to)} (IST)`);
  doc.setCreator("Tracklet");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { regular, bold };

  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - MARGIN;

  const text = (
    s: string,
    o: {
      x?: number;
      y?: number;
      size?: number;
      font?: PDFFont;
      color?: RGB;
      align?: "right" | "center";
      w?: number;
    },
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
    page.drawText(str, { x, y: o.y ?? y, size, font, color: o.color ?? INK });
  };

  const section = (title: string) => {
    y -= 26;
    text(title, { size: 11, font: bold });
    y -= 5;
    // Short accent underline instead of a full-width rule — quieter, branded.
    page.drawRectangle({ x: MARGIN, y, width: 26, height: 2, color: PRIMARY });
    page.drawRectangle({
      x: MARGIN + 26,
      y,
      width: CONTENT_W - 26,
      height: 2,
      color: GRID,
    });
    y -= 16;
  };

  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 34) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - MARGIN;
    }
  };

  // ---- Branded header band -------------------------------------------------
  const bandH = 74;
  page.drawRectangle({ x: 0, y: PAGE.h - bandH, width: PAGE.w, height: bandH, color: NAVY });
  // Brand mark: accent square + wordmark.
  page.drawRectangle({ x: MARGIN, y: PAGE.h - 44, width: 16, height: 16, color: PRIMARY });
  page.drawText("T", {
    x: MARGIN + 4.5,
    y: PAGE.h - 41,
    size: 11,
    font: bold,
    color: WHITE,
  });
  page.drawText(ascii("Tracklet"), {
    x: MARGIN + 24,
    y: PAGE.h - 42,
    size: 13,
    font: bold,
    color: WHITE,
  });
  page.drawText(ascii("ANALYTICS REPORT"), {
    x: MARGIN + 24,
    y: PAGE.h - 56,
    size: 7,
    font: bold,
    color: rgb(0.62, 0.7, 0.85),
  });
  const period = ascii(
    `${fmtDay(summary.range.from)} - ${fmtDay(summary.range.to)} IST`,
  );
  page.drawText(period, {
    x: PAGE.w - MARGIN - bold.widthOfTextAtSize(period, 10),
    y: PAGE.h - 38,
    size: 10,
    font: bold,
    color: WHITE,
  });
  const generated = ascii(
    `Generated ${meta.generatedAt.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}`,
  );
  page.drawText(generated, {
    x: PAGE.w - MARGIN - regular.widthOfTextAtSize(generated, 8),
    y: PAGE.h - 52,
    size: 8,
    font: regular,
    color: rgb(0.62, 0.7, 0.85),
  });
  y = PAGE.h - bandH - 6;

  // ---- Executive summary ---------------------------------------------------
  section("Executive summary");
  const metrics: [string, string, RGB][] = [
    ["Trackers started", String(summary.started), PRIMARY],
    ["Trackers completed", String(summary.completed), GREEN],
    ["Open trackers (now)", String(summary.openAgeDays.count), NAVY],
    ["PR references submitted", String(summary.uniquePrs), PURPLE],
    ["Development", String(summary.development), PRIMARY],
    ["Support", String(summary.support), PURPLE],
    [
      "Average cycle time",
      summary.avgCycleTimeMinutes === null ? "-" : `${summary.avgCycleTimeMinutes} min`,
      PRIMARY,
    ],
    [
      "Oldest open tracker",
      summary.openAgeDays.oldest === null ? "-" : `${summary.openAgeDays.oldest} days`,
      NAVY,
    ],
  ];
  const cardW = CONTENT_W / 4 - 8;
  const cardH = 50;
  metrics.forEach(([label, value, accent], i) => {
    const col = i % 4;
    const rowI = Math.floor(i / 4);
    const x = MARGIN + col * (cardW + 8);
    const cy = y - rowI * (cardH + 8);
    page.drawRectangle({ x, y: cy - cardH, width: cardW, height: cardH, color: CARD });
    page.drawRectangle({ x, y: cy - cardH, width: 2.5, height: cardH, color: accent });
    page.drawText(ascii(label.toUpperCase()), {
      x: x + 10,
      y: cy - 15,
      size: 6.2,
      font: bold,
      color: MUTED,
    });
    page.drawText(ascii(value), {
      x: x + 10,
      y: cy - 36,
      size: 15,
      font: bold,
      color: INK,
    });
  });
  y -= Math.ceil(metrics.length / 4) * (cardH + 8) + 6;

  // ---- Chart helpers -------------------------------------------------------
  const buckets = summary.series;
  const plotLabels = buckets.map((b) => bucketLabel(b.bucket));
  const maxOf = (get: (b: (typeof buckets)[number]) => number) =>
    Math.max(1, ...buckets.map(get));

  /** Gridlines + y-tick labels + x baseline. Returns the frame's max value. */
  const plotFrame = (
    o: { x: number; y: number; w: number; h: number; max: number; suffix?: string },
  ) => {
    // Integer tick steps — count axes must never show "1.5".
    const step = Math.max(1, Math.ceil(o.max / 4));
    const ticks = Math.ceil(o.max / step);
    const frameMax = step * ticks;
    for (let k = 0; k <= ticks; k++) {
      const v = step * k;
      const gy = o.y - o.h + (v / frameMax) * o.h;
      page.drawLine({
        start: { x: o.x, y: gy },
        end: { x: o.x + o.w, y: gy },
        thickness: k === 0 ? 0.9 : 0.5,
        color: k === 0 ? LINE : GRID,
      });
      const label = fmtTick(v, o.suffix);
      page.drawText(label, {
        x: o.x - 6 - regular.widthOfTextAtSize(label, 6.5),
        y: gy - 2.5,
        size: 6.5,
        font: regular,
        color: MUTED,
      });
    }
    return frameMax;
  };

  const drawLegend = (items: { label: string; color: RGB }[]) => {
    let x = MARGIN;
    for (const item of items) {
      page.drawRectangle({ x, y: y - 8.5, width: 6, height: 6, color: item.color });
      x += 10;
      text(item.label, { x, y, size: 8, color: MUTED });
      x += regular.widthOfTextAtSize(ascii(item.label), 8) + 16;
    }
    y -= 14;
  };

  const CH = 104; // plot height for every chart — consistent rhythm

  // 1. Monthly tracker activity: started vs completed grouped bars.
  section("Monthly tracker activity");
  {
    const o = { x: MARGIN + 30, y, w: CONTENT_W - 30, h: CH };
    const max = maxOf((b) => Math.max(b.started, b.completed));
    const frameMax = plotFrame({ ...o, max });
    const slot = o.w / Math.max(buckets.length, 1);
    const barW = Math.min(13, (slot - 10) / 2);
    buckets.forEach((b, i) => {
      const cx = o.x + slot * i + slot / 2;
      const series: [number, RGB][] = [
        [b.started, PRIMARY],
        [b.completed, GREEN],
      ];
      series.forEach(([v, color], j) => {
        // pdf-lib rectangles grow upward from y — y is the bar's bottom edge.
        const barH = (v / frameMax) * (o.h - 6);
        const bx = cx - barW - 1.5 + j * (barW + 3);
        if (v > 0) {
          page.drawRectangle({ x: bx, y: o.y - o.h, width: barW, height: barH, color });
          const vs = String(v);
          page.drawText(vs, {
            x: bx + barW / 2 - regular.widthOfTextAtSize(vs, 6.5) / 2,
            y: o.y - o.h + barH + 3,
            size: 6.5,
            font: regular,
            color: INK,
          });
        }
      });
      textCentered(page, fonts, plotLabels[i] ?? "", cx, o.y - o.h - 12);
    });
    y = o.y - o.h - 24;
  }
  drawLegend([
    { label: "Started", color: PRIMARY },
    { label: "Completed", color: GREEN },
  ]);

  // 2. Development vs Support distribution — split bar + share legend.
  section("Development vs Support (started in period)");
  {
    const barH = 22;
    const devShare = summary.started > 0 ? summary.development / summary.started : 0;
    page.drawRectangle({ x: MARGIN, y: y - barH, width: CONTENT_W, height: barH, color: CARD });
    if (summary.development > 0) {
      page.drawRectangle({
        x: MARGIN,
        y: y - barH,
        width: CONTENT_W * devShare,
        height: barH,
        color: PRIMARY,
      });
    }
    if (summary.support > 0) {
      page.drawRectangle({
        x: MARGIN + CONTENT_W * devShare,
        y: y - barH,
        width: CONTENT_W * (1 - devShare),
        height: barH,
        color: PURPLE,
      });
    }
    if (summary.started > 0) {
      const devW = CONTENT_W * devShare;
      // Segment labels only when they fit (WinAnsi-safe ASCII separators).
      const segLabel = (count: number, x: number, w: number) => {
        const label = count > 0 && w >= 70 ? `${count} - ${pct(count, summary.started)}%` : null;
        if (label) {
          text(label, {
            x,
            y: y - barH / 2 - 3,
            size: 8,
            font: bold,
            color: WHITE,
            align: "center",
            w,
          });
        }
      };
      segLabel(summary.development, MARGIN, devW);
      segLabel(summary.support, MARGIN + devW, CONTENT_W - devW);
    }
    y -= barH + 14;
  }
  drawLegend([
    { label: `Development - ${summary.development}`, color: PRIMARY },
    { label: `Support - ${summary.support}`, color: PURPLE },
  ]);

  // 3. Monthly PR activity (references submitted, never "merged").
  section("PR references submitted per month");
  {
    const o = { x: MARGIN + 30, y, w: CONTENT_W - 30, h: CH };
    const max = maxOf((b) => b.uniquePrs);
    const frameMax = plotFrame({ ...o, max });
    const slot = o.w / Math.max(buckets.length, 1);
    const barW = Math.min(22, slot - 12);
    buckets.forEach((b, i) => {
      const cx = o.x + slot * i + slot / 2;
      const barH = (b.uniquePrs / frameMax) * (o.h - 6);
      if (b.uniquePrs > 0) {
        page.drawRectangle({
          x: cx - barW / 2,
          y: o.y - o.h,
          width: barW,
          height: barH,
          color: PURPLE,
        });
        const vs = String(b.uniquePrs);
        page.drawText(vs, {
          x: cx - regular.widthOfTextAtSize(vs, 6.5) / 2,
          y: o.y - o.h + barH + 3,
          size: 6.5,
          font: regular,
          color: INK,
        });
      }
      textCentered(page, fonts, plotLabels[i] ?? "", cx, o.y - o.h - 12);
    });
    y = o.y - o.h - 26;
  }

  /** Line/area chart with haloed dots and value labels. */
  const trendChart = (
    title: string,
    values: (number | null)[],
    color: RGB,
    ySuffix?: string,
  ) => {
    section(title);
    const finite = values.filter((v): v is number => v !== null);
    if (finite.length === 0) {
      page.drawRectangle({ x: MARGIN, y: y - CH, width: CONTENT_W, height: CH, color: CARD });
      text("No data in this period.", {
        x: MARGIN,
        y: y - CH / 2 - 3,
        size: 9,
        color: MUTED,
        align: "center",
        w: CONTENT_W,
      });
      y -= CH + 26;
      return;
    }
    const o = { x: MARGIN + 30, y, w: CONTENT_W - 30, h: CH };
    const max = Math.max(1, ...finite);
    const frameMax = plotFrame({ ...o, max, suffix: ySuffix });
    const inner = o.h - 8;
    const pts = values.map((v, i) => ({
      x: o.x + (o.w * i) / Math.max(values.length - 1, 1),
      yy: o.y - o.h + 6 + ((v ?? 0) / frameMax) * inner,
      v,
    }));
    // Area fill under the line.
    const filled = pts.filter((p) => p.v !== null);
    if (filled.length >= 2) {
      const first = filled[0]!;
      const last = filled[filled.length - 1]!;
      page.drawSvgPath(
        `M ${first.x} ${first.yy} ` +
          filled.slice(1).map((p) => `L ${p.x} ${p.yy}`).join(" ") +
          ` L ${last.x} ${o.y - o.h} L ${first.x} ${o.y - o.h} Z`,
        { borderColor: color, borderWidth: 0, color, opacity: 0.12 },
      );
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      if (a.v === null || b.v === null) continue;
      page.drawLine({
        start: { x: a.x, y: a.yy },
        end: { x: b.x, y: b.yy },
        thickness: 2.2,
        color,
      });
    }
    pts.forEach((p, i) => {
      if (p.v === null) return;
      page.drawCircle({ x: p.x, y: p.yy, size: 4, color: WHITE });
      page.drawCircle({ x: p.x, y: p.yy, size: 2.6, color });
      // Skip zero labels — a run of "0"s along the baseline is noise.
      if (p.v > 0) {
        const vs = `${p.v}${ySuffix ?? ""}`;
        page.drawText(vs, {
          x: p.x - regular.widthOfTextAtSize(vs, 6.5) / 2,
          y: p.yy + 6,
          size: 6.5,
          font: regular,
          color: INK,
        });
      }
      textCentered(page, fonts, plotLabels[i] ?? "", p.x, o.y - o.h - 12);
    });
    y = o.y - o.h - 26;
  };

  ensure(CH + 90);
  trendChart("Completion trend", buckets.map((b) => b.completed), GREEN);

  ensure(CH + 90);
  trendChart(
    "Average cycle time (completed trackers)",
    buckets.map((b) => b.avgCycleTimeMinutes),
    PRIMARY,
    "m",
  );

  // ---- Tracker appendix ----------------------------------------------------
  ensure(80);
  section("Tracker appendix");
  const cols = [
    { label: "Ticket ID", x: 0, w: 92 },
    { label: "Category", x: 92, w: 82 },
    { label: "Start", x: 174, w: 64 },
    { label: "Completed", x: 238, w: 64 },
    { label: "Status", x: 302, w: 82 },
    { label: "PRs", x: 384, w: 32 },
    { label: "Cycle", x: 416, w: CONTENT_W - 416 },
  ];
  const drawHead = () => {
    page.drawRectangle({ x: MARGIN, y: y - 5, width: CONTENT_W, height: 17, color: PRIMARY });
    cols.forEach((c) =>
      page.drawText(c.label, {
        x: MARGIN + c.x + 5,
        y,
        size: 7.5,
        font: bold,
        color: WHITE,
      }),
    );
    y -= 19;
  };
  if (trackers.length === 0) {
    text("No trackers started in this period.", { size: 9, color: MUTED });
    y -= 16;
  } else {
    drawHead();
  }
  trackers.forEach((t, idx) => {
    if (y < MARGIN + 40) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - MARGIN;
      drawHead();
    }
    if (idx % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_W, height: 15, color: CARD });
    }
    const cycle = t.completedAt
      ? cycleLabel(t.completedAt.getTime() - t.startedAt.getTime())
      : "-";
    const row = [
      t.ticketId,
      t.category,
      istDate(t.startedAt),
      t.completedAt ? istDate(t.completedAt) : "-",
      t.status,
      String(t.prs.length),
      cycle,
    ];
    cols.forEach((c, i) =>
      page.drawText(ascii(row[i] ?? ""), {
        x: MARGIN + c.x + 5,
        y,
        size: 8,
        font: i === 0 ? bold : regular,
        color: i === 0 ? INK : MUTED,
      }),
    );
    y -= 15;
  });

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
      ascii("PR references submitted - GitHub merge state is not verified."),
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
