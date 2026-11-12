// Bibliometric report v2 (5h): the two charts, drawn as SVG and rasterized to PNG for the .docx.
//
//   authorshipSvg(chart)  stacked bars of research articles by role per year (or 5-year bin),
//                         Senior in the accent color, First and Middle in greys, empty runs labeled
//   percentileSvg(bins)   10 NIH-percentile bins as a share of rated research articles, with the
//                         10%-per-bin reference line
//   renderPng(svg)        resvg with system fonts OFF and the bundled Liberation Sans (SIL OFL 1.1,
//                         fonts/LiberationSans-LICENSE.txt), so the PNG is identical on a Mac and on
//                         the node:22-alpine runner, which has no fonts at all
//
// The data comes from bibliometrics.ts (authorshipByYear, percentileBins); nothing here decides
// which works count. The SVG builders are pure and deterministic (snapshot-tested); text widths
// come from the bundled font's advance widths, so layout decisions (gap labels, axis labels) do
// not depend on the renderer.
//
// The runner image copies only .next, public, config and node_modules, so the Dockerfile also
// copies controllers/db/reports/fonts; the font path is resolved from process.cwd() (/app there,
// the repo root under `npm test` and `next dev`). A missing font throws: resvg would otherwise
// drop every glyph silently.

import { existsSync } from "fs";
import { join } from "path";
import { Resvg } from "@resvg/resvg-js";
import type { AuthorshipChart } from "./bibliometrics";

export const CHART_FONT_FAMILY = "Liberation Sans";
export const CHART_FONT_FILE = "controllers/db/reports/fonts/LiberationSans-Regular.ttf";

/** Chart size in CSS pixels (7 x 2.74 in at 96 dpi, the width of a US Letter text column). */
export const CHART_WIDTH = 672;
export const CHART_HEIGHT = 263;
/** Rasterized at 2x so the image stays sharp when Word scales it to the column. */
export const PNG_SCALE = 2;

export const CHART_COLORS = {
  senior: "#2878D8",
  first: "#BFBFB3",
  middle: "#E4E4DE",
  bar: "#9A9A8E",
  text: "#222222",
  muted: "#5F5F5F",
  grid: "#E6E6E6",
  axis: "#9E9E9E",
  reference: "#C0392B",
} as const;

// ---------------------------------------------------------------------------------------------
// Text measurement (Liberation Sans Regular advance widths, units per em 2048; Arial metrics)

const UNITS_PER_EM = 2048;
// ASCII 32..126 in order.
const ASCII_ADVANCE = [
  569, 569, 727, 1139, 1139, 1821, 1366, 391, 682, 682, 797, 1196, 569, 682, 569, 569,
  1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139, 1139, 569, 569, 1196, 1196, 1196, 1139,
  2079, 1366, 1366, 1479, 1479, 1366, 1251, 1593, 1479, 569, 1024, 1366, 1139, 1706, 1479, 1593,
  1366, 1593, 1479, 1366, 1251, 1479, 1366, 1933, 1366, 1366, 1251, 569, 569, 569, 961, 1139,
  682, 1139, 1139, 1024, 1139, 1139, 569, 1139, 1139, 455, 455, 1024, 455, 1706, 1139, 1139,
  1139, 1139, 682, 1024, 569, 1139, 1024, 1479, 1024, 1024, 1024, 684, 532, 684, 1196,
];
const OTHER_ADVANCE: Record<string, number> = { "–": 1139, "—": 2048, "·": 682, "’": 455, "‘": 455 };

/** Rendered width in px of `text` at `size` px in the bundled font (unknown glyphs as a digit). */
export function textWidth(text: string, size: number): number {
  let units = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    units += c >= 32 && c <= 126 ? ASCII_ADVANCE[c - 32] : OTHER_ADVANCE[ch] ?? 1139;
  }
  return (units * size) / UNITS_PER_EM;
}

// ---------------------------------------------------------------------------------------------
// SVG primitives

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Coordinates rounded to 0.01 px, so the SVG text is stable across platforms. */
const n = (v: number): string => String(Math.round(v * 100) / 100);

type Anchor = "start" | "middle" | "end";
function text(x: number, y: number, s: string, size: number, o: { anchor?: Anchor; fill?: string; rotate?: boolean; halo?: boolean } = {}): string {
  const anchor = o.anchor ?? "start";
  const rot = o.rotate ? ` transform="rotate(-90 ${n(x)} ${n(y)})"` : "";
  const halo = o.halo ? ` stroke="#FFFFFF" stroke-width="3" paint-order="stroke"` : "";
  return `<text x="${n(x)}" y="${n(y)}" font-size="${size}" text-anchor="${anchor}" fill="${o.fill ?? CHART_COLORS.text}"${halo}${rot}>${escapeXml(s)}</text>`;
}
const rect = (x: number, y: number, w: number, h: number, fill: string): string =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"/>`;
const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, dashed = false): string =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${dashed ? 1.5 : 1}"${dashed ? ` stroke-dasharray="5 3"` : ""}/>`;

function svgDoc(body: string[], label: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="${escapeXml(label)}" font-family="${CHART_FONT_FAMILY}">`,
    `<title>${escapeXml(label)}</title>`,
    rect(0, 0, CHART_WIDTH, CHART_HEIGHT, "#FFFFFF"),
    ...body,
    `</svg>`,
    "",
  ].join("\n");
}

/** Axis ticks from 0: whole-number steps of 1, 2, 5 (and 25, 250, ...) x 10^k, at most `maxTicks`
 *  intervals, the top tick >= max (and >= 1). */
export function niceTicks(max: number, maxTicks = 5): number[] {
  const top = Math.max(1, max);
  const raw = top / maxTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = (mag >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10]).map((m) => m * mag);
  const step = Math.max(1, steps.find((s) => s >= raw - 1e-9) ?? 10 * mag);
  const count = Math.ceil(top / step - 1e-9);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

type Header = { title?: string; subtitle?: string };
type Legend = Array<{ label: string; color: string; dashed?: boolean }>;

const PAD = 16;
const TITLE_SIZE = 16;
const SUBTITLE_SIZE = 12;
const LABEL_SIZE = 11;
const LEGEND_SIZE = 12;

/** Title, subtitle and right-aligned legend; returns the y where the plot block starts. */
function header(h: Header, legend: Legend, out: string[]): number {
  let y = PAD;
  if (h.title) {
    y += TITLE_SIZE;
    out.push(text(PAD, y, h.title, TITLE_SIZE));
    y += 6;
  }
  const rowY = y + SUBTITLE_SIZE;
  if (h.subtitle) out.push(text(PAD, rowY, h.subtitle, SUBTITLE_SIZE, { fill: CHART_COLORS.muted }));
  if (legend.length) {
    // Right-aligned, emitted left to right so the text reads in order.
    const swatch = (it: Legend[number]) => (it.dashed ? 22 : 11) + 5;
    const widths = legend.map((it) => swatch(it) + textWidth(it.label, LEGEND_SIZE));
    let x = CHART_WIDTH - PAD - widths.reduce((a, b) => a + b, 0) - 14 * (legend.length - 1);
    legend.forEach((it, i) => {
      if (it.dashed) out.push(line(x, rowY - 4, x + 22, rowY - 4, it.color, true));
      else out.push(rect(x, rowY - 10, 11, 11, it.color));
      out.push(text(x + swatch(it), rowY, it.label, LEGEND_SIZE, { fill: CHART_COLORS.muted }));
      x += widths[i] + 14;
    });
  }
  return h.subtitle || legend.length ? rowY + 6 : y;
}

type Plot = { x0: number; x1: number; yTop: number; yBottom: number; ticks: number[] };

/** Y axis caption, ticks, grid and baseline; returns the plot box. `headroom` is extra space
 *  between the caption and the top tick, for labels drawn above the tallest bar. */
function yAxis(top: number, bottomSpace: number, ticks: number[], caption: string, tickSuffix: string, out: string[], headroom = 0): Plot {
  const yTop = top + 14 + LABEL_SIZE + headroom; // caption row, then half a label above the top tick
  out.push(text(PAD, top + LABEL_SIZE + 2, caption, LABEL_SIZE, { fill: CHART_COLORS.muted }));
  const tickW = Math.max(...ticks.map((t) => textWidth(String(t) + tickSuffix, LABEL_SIZE)));
  const x0 = PAD + tickW + 8;
  const x1 = CHART_WIDTH - PAD;
  const yBottom = CHART_HEIGHT - bottomSpace;
  const max = ticks[ticks.length - 1];
  for (const t of ticks) {
    const y = yBottom - ((yBottom - yTop) * t) / max;
    out.push(text(x0 - 6, y + 4, String(t) + tickSuffix, LABEL_SIZE, { anchor: "end", fill: CHART_COLORS.muted }));
    if (t > 0) out.push(line(x0, y, x1, y, CHART_COLORS.grid));
  }
  return { x0, x1, yTop, yBottom, ticks };
}

const yOf = (p: Plot, v: number): number => p.yBottom - ((p.yBottom - p.yTop) * v) / p.ticks[p.ticks.length - 1];

/**
 * Category labels under the axis: all on one line when they fit; ranges ("1971–1974") on two
 * lines ("1971–" over "1974") when that fits; otherwise every k-th label.
 */
function xLabels(p: Plot, labels: string[], out: string[]): void {
  const slot = (p.x1 - p.x0) / labels.length;
  const y1 = p.yBottom + 4 + LABEL_SIZE;
  const fits = (ls: string[]) => Math.max(...ls.map((l) => textWidth(l, LABEL_SIZE))) + 4 <= slot;
  const cx = (i: number) => p.x0 + slot * (i + 0.5);
  if (fits(labels)) {
    labels.forEach((l, i) => out.push(text(cx(i), y1, l, LABEL_SIZE, { anchor: "middle", fill: CHART_COLORS.muted })));
    return;
  }
  const split = labels.map((l) => {
    const k = l.indexOf("–");
    return k > 0 ? [l.slice(0, k + 1), l.slice(k + 1)] : [l];
  });
  if (fits(split.flat())) {
    split.forEach((parts, i) =>
      parts.forEach((s, j) => out.push(text(cx(i), y1 + j * (LABEL_SIZE + 2), s, LABEL_SIZE, { anchor: "middle", fill: CHART_COLORS.muted })))
    );
    return;
  }
  const widest = Math.max(...labels.map((l) => textWidth(l, LABEL_SIZE))) + 4;
  const every = Math.ceil(widest / slot);
  labels.forEach((l, i) => {
    if (i % every === 0) out.push(text(cx(i), y1, l, LABEL_SIZE, { anchor: "middle", fill: CHART_COLORS.muted }));
  });
}

// ---------------------------------------------------------------------------------------------
// Authorship over time

export type GapRun = { from: number; to: number; first: number; last: number };

/** Runs of empty categories, as category indexes and the years they cover. */
export function gapRuns(chart: AuthorshipChart): GapRun[] {
  const runs: GapRun[] = [];
  const t = chart.totals;
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== 0) continue;
    let j = i;
    while (j + 1 < t.length && t[j + 1] === 0) j++;
    runs.push({ from: i, to: j, first: chart.axis.ranges[i][0], last: chart.axis.ranges[j][1] });
    i = j;
  }
  return runs;
}

/** The longest gap label that fits the run's width; "None" turned vertical when nothing fits. */
export function gapLabel(run: GapRun, width: number): { text: string; vertical: boolean } {
  const years = run.first === run.last ? `in ${run.first}` : `${run.first} to ${run.last}`;
  const span = run.first === run.last ? String(run.first) : `${run.first}–${run.last}`;
  for (const s of [`No research articles ${years}`, `None ${span}`, "None"]) {
    if (textWidth(s, LABEL_SIZE) + 8 <= width) return { text: s, vertical: false };
  }
  return { text: "None", vertical: true };
}

export const AUTHORSHIP_STACK = ["first", "middle", "senior"] as const;
const ROLE_LABEL = { first: "First", middle: "Middle", senior: "Senior" } as const;

/** Stacked bars (First, Middle, Senior from the bottom), every category on the axis, gaps labeled. */
export function authorshipSvg(chart: AuthorshipChart, h: Header = {}): string {
  const out: string[] = [];
  const legend = AUTHORSHIP_STACK.map((k) => ({ label: ROLE_LABEL[k], color: CHART_COLORS[k] }));
  const top = header(h, legend, out);
  const labels = chart.axis.categories;
  const twoLine = labels.some((l) => l.includes("–"));
  const p = yAxis(top, twoLine ? 40 : 26, niceTicks(Math.max(0, ...chart.totals)), "articles", "", out);
  const slot = (p.x1 - p.x0) / Math.max(1, labels.length);
  const barW = Math.min(56, slot * 0.62);
  const valuesOf = (k: string) => chart.series.find((s) => s.key === k)?.values ?? [];
  for (let i = 0; i < labels.length; i++) {
    let acc = 0;
    const x = p.x0 + slot * i + (slot - barW) / 2;
    for (const k of AUTHORSHIP_STACK) {
      const v = valuesOf(k)[i] ?? 0;
      if (v <= 0) continue;
      const yA = yOf(p, acc);
      const yB = yOf(p, acc + v);
      out.push(rect(x, yB, barW, yA - yB, CHART_COLORS[k]));
      acc += v;
    }
  }
  for (const run of gapRuns(chart)) {
    const width = slot * (run.to - run.from + 1);
    const cx = p.x0 + slot * run.from + width / 2;
    const g = gapLabel(run, width);
    if (g.vertical) out.push(text(cx + LABEL_SIZE / 2 - 1, p.yBottom - 6, g.text, LABEL_SIZE, { rotate: true, fill: CHART_COLORS.muted }));
    else out.push(text(cx, p.yBottom - 8, g.text, LABEL_SIZE, { anchor: "middle", fill: CHART_COLORS.muted }));
  }
  out.push(line(p.x0, p.yBottom, p.x1, p.yBottom, CHART_COLORS.axis));
  xLabels(p, labels, out);
  return svgDoc(out, h.title ?? "Authorship over time");
}

// ---------------------------------------------------------------------------------------------
// Percentile distribution

export type PercentileBinsData = { labels: string[]; counts: number[]; total: number };

/** Ten bins as a percent of rated research articles, count above each bar, 10% reference line. */
export function percentileSvg(bins: PercentileBinsData, h: Header = {}): string {
  const out: string[] = [];
  const top = header(h, [{ label: "10% expected per bin", color: CHART_COLORS.reference, dashed: true }], out);
  const total = Math.max(1, bins.total);
  const shares = bins.counts.map((c) => (100 * c) / total);
  // Headroom for the count above a bar that reaches the top tick, so it clears the axis caption.
  const p = yAxis(top, 40, niceTicks(Math.max(10, ...shares)), "% of rated research articles", "%", out, LABEL_SIZE + 2);
  const slot = (p.x1 - p.x0) / bins.labels.length;
  const barW = slot * 0.7;
  const xOf = (i: number) => p.x0 + slot * i + (slot - barW) / 2;
  bins.counts.forEach((c, i) => {
    const y = yOf(p, shares[i]);
    if (c > 0) out.push(rect(xOf(i), y, barW, p.yBottom - y, CHART_COLORS.bar));
  });
  const yRef = yOf(p, 10);
  out.push(line(p.x0, yRef, p.x1, yRef, CHART_COLORS.reference, true));
  // Counts last, haloed, so they stay legible where they cross the reference line.
  bins.counts.forEach((c, i) => {
    out.push(text(xOf(i) + barW / 2, yOf(p, shares[i]) - 4, String(c), LABEL_SIZE, { anchor: "middle", fill: CHART_COLORS.muted, halo: true }));
  });
  out.push(line(p.x0, p.yBottom, p.x1, p.yBottom, CHART_COLORS.axis));
  xLabels(p, bins.labels, out);
  out.push(text((p.x0 + p.x1) / 2, CHART_HEIGHT - 8, "NIH percentile", LABEL_SIZE, { anchor: "middle", fill: CHART_COLORS.muted }));
  return svgDoc(out, h.title ?? "Percentile distribution");
}

// ---------------------------------------------------------------------------------------------
// PNG

export function chartFontPath(): string {
  return join(process.cwd(), CHART_FONT_FILE);
}

export type ChartPng = { data: Buffer; width: number; height: number };

/**
 * Rasterize with system fonts off and only the bundled font. `width`/`height` are the PNG's pixel
 * size; the .docx ImageRun should use CHART_WIDTH x CHART_HEIGHT as its transformation.
 */
export function renderPng(svg: string, opts: { scale?: number; fontFile?: string } = {}): ChartPng {
  const fontFile = opts.fontFile ?? chartFontPath();
  if (!existsSync(fontFile)) throw new Error(`Chart font not found at ${fontFile}`);
  const img = new Resvg(svg, {
    fitTo: { mode: "zoom", value: opts.scale ?? PNG_SCALE },
    font: { loadSystemFonts: false, fontFiles: [fontFile], defaultFontFamily: CHART_FONT_FAMILY },
    background: "#ffffff",
  }).render();
  return { data: img.asPng(), width: img.width, height: img.height };
}
