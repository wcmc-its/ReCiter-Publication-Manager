// Bibliometric analysis (5h B2): turns one person's rows into the .docx. No database access, so
// tests/bibliometricDocx.test.mjs can build a document from fixture rows. The metrics come from
// bibliometrics.ts (B1); citations are 5g's (wordBibliography.citationSegments), so a reference
// here looks exactly like one in the Word bibliography export.
//
// Charts are native Word charts (docx/charts ChartRun): a chart part plus an embedded workbook, so
// Word's "Edit Data" works. Every chart sits directly above a table with the same numbers, for
// screen readers and for readers that can't draw native charts.
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";
import { ChartRun } from "docx/charts";
import {
  type BiblioWork,
  type HIndexes,
  PEER_NOT_RANKED,
  type PeerPerson,
  type StoredHIndexes,
  type YearMatrix,
  countedWorks,
  hIndexes,
  isExternal,
  journals,
  mostCited,
  mostInfluential,
  olderArticles,
  peerComparison,
  peerIntro,
  percentileBins,
  positionsByYear,
  recentArticles,
  resolveHIndexes,
  round1,
  summaryProse,
  summaryStats,
  typeBreakdown,
  typeByYear,
  workYear,
  yearAxis,
} from "./bibliometrics";
import { type Segment, type WordArticle, citationSegments } from "./wordBibliography";

export type BiblioPersonHeader = {
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
};

export type BiblioDocInput = {
  uid: string;
  person: BiblioPersonHeader;
  /** The analysis_summary_person row (ranked full-time faculty), or null. */
  ranked: PeerPerson | null;
  /** Every analysis_summary_author x analysis_summary_article row of the person (counted or not). */
  works: BiblioWork[];
  /** Citations for the listed works, by pmid (5g's loadArticles). */
  articles: Map<number, WordArticle>;
  /** The v3.10 peerReviewed column exists. */
  hasPeerReviewed: boolean;
  /** YYYY-MM-DD of the document. Also the CURDATE() for computed h5 and the 730-day window. */
  runDate: string;
  /** When the reciterdb nightly last swapped the summary tables (free text), or null. */
  dataAsOf?: string | null;
};

export type BiblioDocResult = {
  buffer: Buffer;
  counted: number;
  external: number;
  peerShown: boolean;
  hSource: "stored" | "computed";
};

export const LIST_LIMITS = { mostCited: 10, influential: 10, journals: 15, recent: 25, older: 25 } as const;
/** Word refuses hyperlinks over ~2,080 characters; the RTF kept PubMed searches to 220 PMIDs. */
export const PUBMED_LINK_PMIDS = 220;

const FONT = "Arial";
const HYPERLINK_COLOR = "1F5FA8";
const HEADER_FILL = "E8EEF5";
const BORDER = { style: "single" as const, size: 4, color: "BFBFBF" };
// US Letter with 1-inch margins: 6.5 inches of text = 9,360 twips = 624 px at 96 dpi.
const TEXT_TWIPS = 9360;
const CHART_SIZE = { width: 624, height: 300 };
const SERIES_COLORS = ["1F5FA8", "E07B39", "4E9A6E", "8E6BB5", "9A9A9A"];

const fmt = (n: number) => n.toLocaleString("en-US");
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** concat(round(x, 2)) on a FLOAT(6,2) column, as the RTF printed the RCR. */
const round2 = (v: unknown): string => {
  const n = numOrNull(v);
  return n === null ? "n/a" : (Math.round(Math.fround(n) * 100) / 100).toFixed(2);
};
/** 0 is reciterdb's "no percentile yet" (see hasPercentile), not the 0th percentile. */
const pctText = (v: unknown): string => ((numOrNull(v) ?? 0) > 0 ? round1(v) : "n/a");

const text = (t: string, opts: { bold?: boolean; italics?: boolean } = {}) => new TextRun({ text: t, ...opts });
const link = (label: string, url: string) =>
  new ExternalHyperlink({ link: url, children: [new TextRun({ text: label, color: HYPERLINK_COLOR, underline: {} })] });

const runsOf = (segs: Segment[]) =>
  segs.map((s) => {
    const run = new TextRun({
      text: s.text,
      bold: s.bold || undefined,
      italics: s.italics || undefined,
      subScript: s.sub || undefined,
      superScript: s.sup || undefined,
      ...(s.link ? { color: HYPERLINK_COLOR, underline: {} } : {}),
    });
    return s.link ? new ExternalHyperlink({ link: s.link, children: [run] }) : run;
  });

const h1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text(t)] });
const h2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [text(t)] });
const h3 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [text(t)] });
const para = (t: string) => new Paragraph({ children: [text(t)] });
const note = (t: string) => new Paragraph({ style: "ReportMeta", children: [text(t)] });

type Cell = string | { text: string; bold?: boolean };

/** A plain bordered table; `numeric` columns are right-aligned. Widths are fractions of the line. */
function table(header: string[], rows: Cell[][], widths: number[], numeric: boolean[] = []): Table {
  const total = widths.reduce((a, b) => a + b, 0);
  const twips = widths.map((w) => Math.round((w / total) * TEXT_TWIPS));
  const cell = (c: Cell, i: number, head: boolean) => {
    const t = typeof c === "string" ? c : c.text;
    const bold = head || (typeof c !== "string" && c.bold);
    return new TableCell({
      width: { size: twips[i], type: WidthType.DXA },
      shading: head ? { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [
        new Paragraph({
          style: "TableText",
          alignment: numeric[i] && !head ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [text(t, { bold: bold || undefined })],
        }),
      ],
    });
  };
  return new Table({
    width: { size: TEXT_TWIPS, type: WidthType.DXA },
    columnWidths: twips,
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })),
    ],
  });
}

const chart = (opts: {
  name: string;
  title: string;
  categories: string[];
  series: Array<{ name: string; values: number[] }>;
  stacked: boolean;
  valueTitle: string;
  legend: boolean;
}) =>
  new Paragraph({
    keepNext: true,
    spacing: { before: 120, after: 120 },
    children: [
      new ChartRun({
        type: "column",
        stacking: opts.stacked ? "stacked" : "none",
        title: opts.title,
        categories: opts.categories,
        series: opts.series.map((s, i) => ({ name: s.name, values: s.values, color: SERIES_COLORS[i % SERIES_COLORS.length] })),
        legend: opts.legend ? { position: "bottom" } : false,
        font: { name: FONT },
        categoryAxis: { labelRotation: opts.categories.length > 12 ? -45 : 0 },
        valueAxis: { title: opts.valueTitle, numberFormat: "0" },
        transformation: CHART_SIZE,
        altText: { name: opts.name, title: opts.title },
      }),
    ],
  });

/** Rows of a year matrix with any count, oldest first, plus a total column. */
function yearTableRows(m: YearMatrix): Cell[][] {
  const rows: Cell[][] = [];
  m.categories.forEach((cat, i) => {
    if (m.totals[i] === 0) return;
    rows.push([cat, ...m.series.map((s) => fmt(s.values[i])), { text: fmt(m.totals[i]), bold: true }]);
  });
  return rows;
}

function citationList(
  works: BiblioWork[],
  articles: Map<number, WordArticle>,
  metrics: (w: BiblioWork) => string
): Paragraph[] {
  const out: Paragraph[] = [];
  works.forEach((w, i) => {
    const a = articles.get(Number(w.pmid));
    const segs: Segment[] = a ? citationSegments(a) : [{ text: `PMID: ${w.pmid}.` }];
    out.push(
      new Paragraph({
        style: "Citation",
        keepNext: true,
        tabStops: [{ type: TabStopType.LEFT, position: 480 }],
        children: [text(`${i + 1}.\t`), ...runsOf(segs)],
      })
    );
    out.push(new Paragraph({ style: "CitationMetrics", children: [text(metrics(w))] }));
  });
  return out;
}

const pubmedSearchLinks = (pmids: number[]): Array<TextRun | ExternalHyperlink> => {
  const out: Array<TextRun | ExternalHyperlink> = [];
  const chunks: number[][] = [];
  for (let i = 0; i < pmids.length; i += PUBMED_LINK_PMIDS) chunks.push(pmids.slice(i, i + PUBMED_LINK_PMIDS));
  chunks.forEach((c, i) => {
    if (i > 0) out.push(text(", "));
    out.push(link(chunks.length === 1 ? "PubMed list" : `PubMed list ${i + 1}`, `https://pubmed.ncbi.nlm.nih.gov/?term=${c.join("+")}`));
  });
  return out;
};

export const docxFileName = (uid: string, runDate: string) => `BibliometricAnalysis-${uid}-${runDate}.docx`;

export async function buildBibliometricDocx(input: BiblioDocInput): Promise<BiblioDocResult> {
  const { uid, person, ranked, works, articles, hasPeerReviewed, runDate } = input;
  const first = (person.firstName || "").trim();
  const last = (person.lastName || "").trim() || uid;
  const name = [first, last].filter(Boolean).join(" ") || uid;
  const currentYear = Number(runDate.slice(0, 4));

  const counted = countedWorks(works);
  const stats = summaryStats(works, { hasPeerReviewed });
  const h: HIndexes & { source: "stored" | "computed" } = resolveHIndexes(ranked as StoredHIndexes, hIndexes(works, runDate));
  const axis = yearAxis(counted.map(workYear), currentYear);
  const byType = typeByYear(works, axis);
  const byPosition = positionsByYear(works, axis);
  const bins = percentileBins(works);

  const children: Array<Paragraph | Table> = [];

  // 1. Title block
  children.push(h1(`Bibliometric analysis: ${name}`));
  const meta = [`Person ID ${uid}`];
  const dept = (person.department || String(ranked?.department ?? "") || "").trim();
  if (dept) meta.push(dept);
  if (ranked?.facultyRank) meta.push(String(ranked.facultyRank));
  meta.push(`Run ${runDate}`);
  children.push(note(meta.join(" · ")));
  children.push(
    note(
      "Counts cover accepted publications in ReCiter, excluding errata and retractions. Works from other sources " +
        "(Scopus, OpenAlex, Crossref or added by hand) are counted as publications but excluded from every citation metric."
    )
  );

  // 2. Summary
  children.push(h2("Summary"));
  const span = stats.firstYear === null ? "" : stats.firstYear === stats.lastYear ? `, ${stats.firstYear}` : `, ${stats.firstYear}–${stats.lastYear}`;
  const summaryRows: Cell[][] = [
    ["Publications", `${fmt(stats.counted)}${span}${stats.external > 0 ? ` (${fmt(stats.pubmed)} in PubMed, ${fmt(stats.external)} from other sources)` : ""}`],
  ];
  if (stats.peerReviewed !== null) summaryRows.push(["Peer reviewed", fmt(stats.peerReviewed)]);
  summaryRows.push([
    "Author position",
    `First ${fmt(stats.positions.first)} · Last (senior) ${fmt(stats.positions.last)} · Middle ${fmt(stats.positions.middle)}` +
      (stats.positions.notSet > 0 ? ` · Not set ${fmt(stats.positions.notSet)}` : ""),
  ]);
  summaryRows.push(["Citations (NIH iCite, PubMed works)", fmt(stats.totalCitationsNIH)]);
  summaryRows.push(["h-index (NIH iCite)", `${h.hindexNIH} (h5-index ${h.h5indexNIH})`]);
  summaryRows.push(["h-index (Scopus citations)", `${h.hindexScopus} (h5-index ${h.h5indexScopus})`]);
  if (stats.researchWithPercentile > 0) {
    summaryRows.push([
      "Relative Citation Ratio",
      `Median ${round2(stats.medianRCR)}, mean ${round2(stats.meanRCR)} (${fmt(stats.researchWithPercentile)} research articles with an NIH percentile)`,
    ]);
    if (stats.shareTop10 !== null) summaryRows.push(["At or above the 90th NIH percentile", `${Math.round(stats.shareTop10 * 100)}%`]);
  }
  children.push(table(["Measure", "Value"], summaryRows, [2, 5]));
  children.push(new Paragraph({ spacing: { before: 160 }, children: [text(summaryProse(name, stats, h))] }));

  // The RTF's "complete lists" of research articles, as PubMed searches.
  const research = counted.filter((w) => !isExternal(w) && w.publicationTypeNIH === "Research Article");
  const ordered = mostInfluential(research, { n: research.length });
  const lists: Array<[string, BiblioWork[]]> = [
    ["research articles", ordered],
    ["senior-authored", ordered.filter((w) => String(w.authorPosition || "").toLowerCase() === "last")],
    ["first-authored", ordered.filter((w) => String(w.authorPosition || "").toLowerCase() === "first")],
  ];
  if (ordered.length > 0) {
    const runs: Array<TextRun | ExternalHyperlink> = [text("Research articles in PubMed: ")];
    lists.forEach(([label, ws], i) => {
      if (i > 0) runs.push(text("; "));
      runs.push(text(`${fmt(ws.length)} ${label}`));
      if (ws.length) {
        runs.push(text(" ("));
        runs.push(...pubmedSearchLinks(ws.map((w) => Number(w.pmid))));
        runs.push(text(")"));
      }
    });
    runs.push(text(". Lists are in descending order of NIH percentile."));
    children.push(new Paragraph({ style: "ReportMeta", spacing: { before: 120 }, children: runs }));
  }

  // 3. Peer comparison
  children.push(h2("Peer comparison"));
  const peerShown = !!ranked;
  if (ranked) {
    children.push(para(peerIntro(ranked)));
    for (const b of peerComparison(ranked)) {
      children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [text(`${b.label}. `, { bold: true }), text(b.text)] }));
    }
    children.push(note("Ranks compare WCM-employed full-time faculty at the same rank, as of the last ReCiter nightly run."));
  } else {
    children.push(para(PEER_NOT_RANKED));
  }

  // 4. Publications by year and type
  children.push(h2("Publications by year and type"));
  if (axis.categories.length) {
    children.push(
      chart({
        name: "Chart 1",
        title: "Publications by year and type",
        categories: byType.categories,
        series: byType.series.filter((s) => s.values.some((v) => v > 0)).map((s) => ({ name: s.label, values: s.values })),
        stacked: true,
        valueTitle: "Publications",
        legend: true,
      })
    );
    children.push(table(["Year", ...byType.series.map((s) => s.label), "Total"], yearTableRows(byType), [2, 2, 2, 2, 2, 1.4], [false, true, true, true, true, true]));
  }
  if (byType.undated > 0) children.push(note(`${fmt(byType.undated)} ${byType.undated === 1 ? "publication has" : "publications have"} no year and ${byType.undated === 1 ? "is" : "are"} not in the chart.`));
  const breakdown = typeBreakdown(works, hasPeerReviewed);
  if (breakdown.length) {
    children.push(h3("Publication types"));
    const rows: Cell[][] = breakdown.map((r) =>
      hasPeerReviewed ? [r.groupLabel, r.pubType, fmt(r.peerReviewed), fmt(r.notPeerReviewed), fmt(r.total)] : [r.groupLabel, r.pubType, fmt(r.total)]
    );
    children.push(
      hasPeerReviewed
        ? table(["Group", "Type", "Peer reviewed", "Not peer reviewed", "Total"], rows, [2.2, 2.4, 1.6, 1.8, 1.2], [false, false, true, true, true])
        : table(["Group", "Type", "Total"], rows, [3, 3, 1.4], [false, false, true])
    );
  }

  // 5. Authorship roles
  children.push(h2("Authorship roles"));
  if (axis.categories.length) {
    children.push(
      chart({
        name: "Chart 2",
        title: "Author position by year",
        categories: byPosition.categories,
        series: byPosition.series.map((s) => ({ name: s.label, values: s.values })),
        stacked: true,
        valueTitle: "Publications",
        legend: true,
      })
    );
    const widths = [2, ...byPosition.series.map(() => 1.6), 1.4];
    children.push(table(["Year", ...byPosition.series.map((s) => s.label), "Total"], yearTableRows(byPosition), widths, widths.map((_, i) => i > 0)));
  }
  children.push(
    note("Middle means any position other than first or last on a PubMed record. Position not set is a work from another source whose author position isn't recorded.")
  );

  // 6. Citation impact
  children.push(h2("Citation impact"));
  if (bins.total > 0) {
    children.push(
      chart({
        name: "Chart 3",
        title: "NIH percentile of research articles",
        categories: bins.labels,
        series: [{ name: "Research articles", values: bins.counts }],
        stacked: false,
        valueTitle: "Research articles",
        legend: false,
      })
    );
    children.push(table(["NIH percentile", "Research articles"], bins.labels.map((l, i) => [l, fmt(bins.counts[i])]), [3, 2], [false, true]));
    children.push(note(`${fmt(bins.total)} research articles with an NIH percentile. An average paper in its field sits at the 50th percentile.`));
  } else {
    children.push(para("No research article has an NIH percentile yet."));
  }

  // 7. Most cited and most influential
  const cited = mostCited(works, LIST_LIMITS.mostCited);
  children.push(h2("Most cited"));
  if (cited.length) {
    children.push(note("PubMed works by NIH iCite citation count, then Relative Citation Ratio."));
    children.push(
      ...citationList(cited, articles, (w) => `Citations ${fmt(numOrNull(w.citationCountNIH) ?? 0)} · RCR ${round2(w.relativeCitationRatioNIH)} · NIH percentile ${pctText(w.percentileNIH)}`)
    );
  } else {
    children.push(para("No PubMed work has an NIH citation count yet."));
  }
  const inflMetrics = (w: BiblioWork) =>
    `Citations ${fmt(numOrNull(w.citationCountNIH) ?? 0)} · NIH percentile ${pctText(w.percentileNIH)} · RCR ${round2(w.relativeCitationRatioNIH)}`;
  const inflFirstLast = mostInfluential(works, { firstOrLast: true, n: LIST_LIMITS.influential });
  const inflAll = mostInfluential(works, { n: LIST_LIMITS.influential });
  if (inflFirstLast.length || inflAll.length) {
    children.push(h2("Most influential research articles"));
    children.push(note("Research articles by NIH percentile, then Relative Citation Ratio, as measured by NIH iCite."));
    if (inflFirstLast.length) {
      children.push(h3("First or last author"));
      children.push(...citationList(inflFirstLast, articles, inflMetrics));
    }
    if (inflAll.length) {
      children.push(h3("Any author position"));
      children.push(...citationList(inflAll, articles, inflMetrics));
    }
  }

  // 8. Journals
  const venues = journals(works, LIST_LIMITS.journals);
  if (venues.length) {
    children.push(h2("Journals"));
    children.push(
      table(
        ["Journal or venue", "Works", "Years", "SJR"],
        venues.map((j) => [
          j.title,
          fmt(j.count),
          j.firstYear === null ? "" : j.firstYear === j.lastYear ? String(j.firstYear) : `${j.firstYear}–${j.lastYear}`,
          j.sjr === null ? "" : j.sjr.toFixed(3),
        ]),
        [5, 1, 1.6, 1],
        [false, true, false, true]
      )
    );
    children.push(note("SJR is the Scimago Journal Rank on the most recent work that has one."));
  }

  // 9. Recent and older articles
  const recent = recentArticles(works, runDate, LIST_LIMITS.recent);
  if (recent.length) {
    children.push(h2("Recent articles"));
    children.push(note("Research articles added to PubMed in the last two years that don't have an NIH percentile yet. Last- and first-authored articles come first."));
    children.push(...citationList(recent, articles, (w) => `Citations ${numOrNull(w.citationCountNIH) ?? "n/a"} · SJR ${numOrNull(w.journalImpactScore1) ?? "n/a"}`));
  }
  const older = olderArticles(works, LIST_LIMITS.older);
  if (older.length) {
    children.push(h2("Older articles"));
    children.push(note("Research articles published before 1980, which have neither a Relative Citation Ratio nor an NIH percentile."));
    children.push(...citationList(older, articles, (w) => `Citations ${numOrNull(w.citationCountNIH) ?? "n/a"}`));
  }

  // 10. External works
  if (stats.external > 0) {
    children.push(h2("Works from other sources"));
    const bySource = Object.entries(stats.externalBySource)
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `${s.charAt(0)}${s.slice(1).toLowerCase()} ${fmt(n)}`)
      .join(", ");
    children.push(
      para(
        `${fmt(stats.external)} accepted ${stats.external === 1 ? "work comes" : "works come"} from sources other than PubMed (${bySource}). ` +
          "They are counted in the publication totals, types and author positions above, and are never used for citations, the h-index, RCR or percentiles."
      )
    );
  }

  // 11. Methods and sources
  children.push(h2("Methods and sources"));
  // Definitions from the RTF's Explanation section (Mendeley dropped: 5b retired it).
  const methods: Array<[string, string]> = [
    ["Sources.", "Citation count, Relative Citation Ratio and NIH percentile come from NIH iCite and cover PubMed records only. The Scopus h-index variant uses Scopus citation counts on the same PubMed records. SJR is the Scimago Journal Rank. OpenAlex and Crossref supply records for works outside PubMed; their citation counts are never used here."],
    ["Citation count", "is the number of citations an article has received from CrossRef, MEDLINE, PubMed Central and Entrez, according to NIH iCite."],
    ["Relative Citation Ratio (RCR)", "is the ratio between the number of times an article was cited and publications of the same date and field (as inferred by co-citation networks). A value of 1.0 is the median. The benchmark consists of research articles that are the product of NIH R01 grants."],
    ["NIH percentile", "is the RCR as a percentile, where 100 is the highest and 0 the lowest. For example, an article with an NIH percentile of 63.2 has received more citations than 631 of 1,000 NIH-funded research articles from the same year, measured against a field- and time-weighted benchmark. A percentile is not computed for an article published in the past two years."],
    ["Author position", "is inferred by a name-matching heuristic, which fails to identify an author's position about 1.5% of the time. An author can share a first or senior role without being listed first or last; no authoritative source publishes that in a usable form. Corrections can be requested from publications@med.cornell.edu with the CWID, the PMIDs and the correct position."],
    ["h-index", "is the number of an author's articles in PubMed that have been cited, as defined by iCite, at least that many times. The h5-index counts only articles added to PubMed in the past five years. Both include non-research articles such as reviews, editorials and letters, and exclude works from other sources. Scopus and Web of Science usually have slightly higher citation counts, and Google Scholar's h-index is generally much higher."],
    ["ReCiter", "is Weill Cornell Medicine's authoritative publications reporting system. It is curated by Weill Cornell librarians, updated at least weekly, and validated during faculty annual review cycles. Only publications accepted for this person are included."],
    ["Full bibliography.", "This document lists highlights. For a complete list, use Export to Word on the Reports page."],
  ];
  for (const [term, def] of methods) children.push(new Paragraph({ spacing: { after: 100 }, children: [text(term, { bold: true }), text(` ${def}`)] }));
  children.push(note(`Metric source for the h-index: ${h.source === "stored" ? "the ReCiter nightly run" : "computed for this document with the nightly's rule"}.`));
  if (input.dataAsOf) children.push(note(`Data as of the ReCiter nightly run of ${input.dataAsOf}. Document run ${runDate}.`));
  else children.push(note(`Document run ${runDate}.`));

  const doc = new Document({
    creator: "ReCiter Publication Manager",
    title: `Bibliometric analysis: ${name}`,
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 32, bold: true }, paragraph: { spacing: { after: 120 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 22, bold: true }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true } },
        { id: "ReportMeta", name: "Report note", basedOn: "Normal", run: { font: FONT, size: 18, color: "595959" }, paragraph: { spacing: { after: 120 } } },
        { id: "Citation", name: "Citation", basedOn: "Normal", run: { font: FONT, size: 22 }, paragraph: { indent: { left: 480, hanging: 480 }, spacing: { after: 40 } } },
        { id: "CitationMetrics", name: "Citation metrics", basedOn: "Normal", run: { font: FONT, size: 18, color: "595959" }, paragraph: { indent: { left: 480 }, spacing: { after: 140 } } },
        { id: "TableText", name: "Table text", basedOn: "Normal", run: { font: FONT, size: 18 }, paragraph: { spacing: { before: 0, after: 0 } } },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                style: "ReportMeta",
                alignment: AlignmentType.CENTER,
                children: [text(`ReCiter Publication Manager · ${runDate} · page `), new TextRun({ children: [PageNumber.CURRENT] })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  return { buffer, counted: stats.counted, external: stats.external, peerShown, hSource: h.source };
}

/** pmids whose citations the document prints, for the controller's loadArticles call. */
export function listedPmids(works: BiblioWork[], runDate: string): number[] {
  const ids = new Set<number>();
  for (const w of [
    ...mostCited(works, LIST_LIMITS.mostCited),
    ...mostInfluential(works, { firstOrLast: true, n: LIST_LIMITS.influential }),
    ...mostInfluential(works, { n: LIST_LIMITS.influential }),
    ...recentArticles(works, runDate, LIST_LIMITS.recent),
    ...olderArticles(works, LIST_LIMITS.older),
  ]) {
    ids.add(Number(w.pmid));
  }
  return [...ids];
}
