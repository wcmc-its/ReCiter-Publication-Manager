// Bibliometric report v2 (5h P4): one person's rows -> the .docx. No database access, so
// tests/bibliometricDocx.test.mjs builds documents from the P1 fixture rows.
//
// Sections, in the spec's order (ReCiter Research/Spec Bibliometric report v2 ... "Report layout"):
//    1 Header                  name, department, rank, person ID, nightly-run date, scope line
//    2 Summary for reviewers   bibliometricSummary.ts (templates S1-S7)
//    3 Key figures             measure, value, reference point; reasons below the minimums
//    4 Peer comparison         analysis_summary_person_peer ranks; S7 sentence when not eligible
//    5 Authorship over time    PNG chart (biblioCharts.ts), research articles by role
//    6 Percentile distribution PNG chart, from 20 rated research articles
//    7 Most influential research articles
//    8 Reviews and other works
//    9 Recent work
//   10 Older work
//   11 Methods and sources
// A section with nothing to show is left out, except Peer comparison (S7 instead).
//
// Every number comes from bibliometrics.ts (P1), which only aggregates the v3.11 flags; nothing
// here decides which works count. Unrated values print a reason, never 0, "n/a" or a blank.
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { CHART_HEIGHT, CHART_WIDTH, authorshipSvg, percentileSvg, renderPng } from "./biblioCharts";
import {
  type BiblioWork,
  type KeyFigures,
  type PeerCellRow,
  type PeerTable,
  type Role,
  REASONS,
  V2_PEER_COLUMNS,
  isCounted,
  authorshipByYear,
  displaySurname,
  formatPct,
  formatRcr,
  isExternal,
  isRecent,
  keyFigures,
  mostInfluential,
  olderWorks,
  pctOf,
  peerTable,
  percentileBins,
  rankNote,
  ratedAtHighest,
  rcrOf,
  recentSeniorYears,
  recentWorks,
  reviewsAndOther,
  roleLabel,
  venueName,
  workYear,
} from "./bibliometrics";
import { type Run, buildSummary, rankPlural } from "./bibliometricSummary";
import { type AuthorName, type WordArticle, inlineSegments } from "./wordBibliography";

export type BiblioPersonHeader = {
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
};

export type BiblioDocInput = {
  uid: string;
  person: BiblioPersonHeader;
  /** Every analysis_summary_author x analysis_summary_article row of the person (counted or not),
   *  with the v3.11 flags. */
  works: BiblioWork[];
  /** The person's analysis_summary_person_peer rows (empty when none). */
  cells: PeerCellRow[];
  /** Cohort eligibility today, for a person with no stored cell (no rated article). The stored
   *  cohortEligible wins when cells exist. */
  eligibleNow: boolean;
  /** Rank from person_person_type today ("Assistant Professor"), or null. */
  currentRank: string | null;
  /** Authors, titles and DOIs of the listed works, by pmid (word.report.controller loadArticles). */
  articles: Map<number, WordArticle>;
  /** YYYY-MM-DD of the nightly run that wrote the flags; also the h5 window anchor. */
  runDate: string;
  /** When analysis_nih was loaded (the iCite snapshot), YYYY-MM-DD, or null. */
  iciteDate?: string | null;
};

export type BiblioDocResult = {
  buffer: Buffer;
  counted: number;
  external: number;
  peerShown: boolean;
  /** Template ids of the summary, in order. */
  fired: string[];
  /** Section headings in order (tests and logs). */
  sections: string[];
  /** Stored cells whose average disagrees with the recomputed one (parity must be 0). */
  mismatches: string[];
};

/** Section row limits (spec "Report layout"); section 7 (10 + up to 5 marked) is fixed in mostInfluential. */
export const LIST_LIMITS = { reviews: 5, recent: 10, older: 5 } as const;

export const SCOPE_LINE = "Citation measures use only PubMed research articles that have an NIH percentile.";
export const PEER_NOTE =
  "Averages are NIH percentiles; higher is better. Ranks compare WCM-employed full-time faculty at the same rank, all measured the same way. " +
  "Top-N averages reflect the impact of a person's most influential work, and they reward sustained productivity.";

const FONT = "Calibri";
const HYPERLINK_COLOR = "1F5FA8";
const HEADER_FILL = "F2F2F2";
const MUTED = "595959";
const BORDER = { style: "single" as const, size: 4, color: "BFBFBF" };
// US Letter with 1-inch margins: 6.5 inches of text = 9,360 twips = 624 px at 96 dpi.
const TEXT_TWIPS = 9360;
const TEXT_PX = 624;

const fmt = (n: number) => n.toLocaleString("en-US");

// ---------------------------------------------------------------------------------------------
// Pure helpers the controller also uses

/** Rank codes in person_person_type, most senior first (STEP 5v2's levels and labels). */
export const RANK_CODES: Array<[string, string]> = [
  ["academic-faculty-fullprofessor", "Full Professor"],
  ["academic-faculty-associate", "Associate Professor"],
  ["academic-faculty-assistant", "Assistant Professor"],
  ["academic-faculty-instructor", "Instructor or Lecturer"],
  ["academic-faculty-lecturer", "Instructor or Lecturer"],
];
export const FULL_TIME_CODE = "academic-faculty-weillfulltime";

/** Today's rank and cohort eligibility from person_person_type codes: weillfulltime plus a rank.
 *  With two rank codes the most senior is shown (the nightly breaks that tie with the primary
 *  title; the stored cells carry its answer and take precedence in the report). */
export function rankFromPersonTypes(types: Array<string | null | undefined>): { rank: string | null; eligible: boolean } {
  const set = new Set(types.map((t) => String(t ?? "").trim().toLowerCase()));
  const hit = RANK_CODES.find(([code]) => set.has(code));
  const rank = hit ? hit[1] : null;
  return { rank, eligible: rank !== null && set.has(FULL_TIME_CODE) };
}

// The P1 module's V2_WORK_COLUMNS, split by table.
const ARTICLE_V2 = ["provisionalNIH", "hasPercentileNIH", "pctExact", "researchArticleV2", "ratedV2", "recentV2"] as const;
const AUTHOR_V2 = ["authorRoleV2", "soleAuthor"] as const;
/** Every column the v2 document reads that v3.11 adds; the probe needs all of them. */
export const REQUIRED_V2 = {
  analysis_summary_article: [...ARTICLE_V2],
  analysis_summary_author: [...AUTHOR_V2],
  analysis_summary_person_peer: [...V2_PEER_COLUMNS],
} as const;

/** The required v3.11 table.column names missing from an information_schema listing. Pure. */
export function missingV2Schema(present: Array<{ table: string; column: string }>): string[] {
  const have = new Set(present.map((r) => `${String(r.table).toLowerCase()}.${String(r.column).toLowerCase()}`));
  const missing: string[] = [];
  for (const [table, cols] of Object.entries(REQUIRED_V2)) {
    for (const c of cols) if (!have.has(`${table}.${c}`.toLowerCase())) missing.push(`${table}.${c}`);
  }
  return missing;
}

export const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** One row per pmid, numbers parsed (pctExact stays the DECIMAL string for exact arithmetic). */
export function toWorks(rows: any[]): BiblioWork[] {
  const seen = new Set<number>();
  const works: BiblioWork[] = [];
  for (const r of rows) {
    const pmid = Number(r.pmid);
    if (seen.has(pmid)) continue;
    seen.add(pmid);
    works.push({
      ...r,
      pmid,
      articleYear: toNum(r.articleYear),
      pubTypeCounted: toNum(r.pubTypeCounted),
      citationCountNIH: toNum(r.citationCountNIH),
      relativeCitationRatioNIH: toNum(r.relativeCitationRatioNIH),
      percentileNIH: toNum(r.percentileNIH),
      provisionalNIH: toNum(r.provisionalNIH),
      hasPercentileNIH: toNum(r.hasPercentileNIH),
      researchArticleV2: toNum(r.researchArticleV2),
      ratedV2: toNum(r.ratedV2),
      recentV2: toNum(r.recentV2),
      soleAuthor: toNum(r.soleAuthor),
    });
  }
  return works;
}

/** True when the nightly that wrote these rows ran the v2 steps. STEP 3v2 sets every PubMed row's
 *  flags to 0 or 1, so a NULL flag on a counted PubMed row means they were never filled (old
 *  procedure, or 3v2 off that night). External rows are filled separately by 6v2; a NULL there
 *  only drops the work from Recent work, so it does not block the report. */
export function flagsFilled(works: BiblioWork[]): boolean {
  return works
    .filter((w) => isCounted(w) && !isExternal(w))
    .every((w) => w.researchArticleV2 !== null && w.ratedV2 !== null && w.recentV2 !== null);
}

export const docxFileName = (uid: string, runDate: string) => `BibliometricAnalysis-${uid}-${runDate}.docx`;

/** pmids whose authors and titles the document prints, for the controller's loadArticles call. */
export function listedPmids(works: BiblioWork[]): number[] {
  const ids = new Set<number>();
  for (const r of mostInfluential(works)) ids.add(Number(r.work.pmid));
  for (const r of reviewsAndOther(works, LIST_LIMITS.reviews)) ids.add(Number(r.work.pmid));
  for (const r of recentWorks(works, LIST_LIMITS.recent)) ids.add(Number(r.work.pmid));
  for (const r of olderWorks(works, LIST_LIMITS.older)) ids.add(Number(r.work.pmid));
  return [...ids];
}

// ---------------------------------------------------------------------------------------------
// docx building blocks

type Inline = TextRun | ExternalHyperlink;
const text = (t: string, opts: { bold?: boolean; italics?: boolean; color?: string } = {}) => new TextRun({ text: t, ...opts });
const link = (label: string, url: string) =>
  new ExternalHyperlink({ link: url, children: [new TextRun({ text: label, color: HYPERLINK_COLOR, underline: {} })] });

const h1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text(t)] });
const h2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [text(t)] });
const para = (children: Inline[] | string, style?: string) =>
  new Paragraph({ style, children: typeof children === "string" ? [text(children)] : children });
const note = (t: string) => para(t, "ReportNote");

type Cell = string | Inline[];

/** A bordered table with a shaded header row; `numeric` columns are right-aligned. Widths are
 *  fractions of the text column. */
function table(header: string[], rows: Cell[][], widths: number[], numeric: boolean[] = []): Table {
  const total = widths.reduce((a, b) => a + b, 0);
  const twips = widths.map((w) => Math.round((w / total) * TEXT_TWIPS));
  const cell = (c: Cell, i: number, head: boolean) =>
    new TableCell({
      width: { size: twips[i], type: WidthType.DXA },
      shading: head ? { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [
        new Paragraph({
          style: "TableText",
          alignment: numeric[i] && !head ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: typeof c === "string" ? [text(c, { bold: head || undefined })] : c,
        }),
      ],
    });
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

/** A chart PNG at the text-column width, alt text equal to the chart title, caption below. */
function chartBlock(svg: string, title: string, caption: string): Paragraph[] {
  const png = renderPng(svg);
  const height = Math.round((CHART_HEIGHT * TEXT_PX) / CHART_WIDTH);
  return [
    new Paragraph({
      keepNext: true,
      spacing: { before: 120, after: 60 },
      children: [
        new ImageRun({
          type: "png",
          data: png.data,
          transformation: { width: TEXT_PX, height },
          altText: { name: title, title, description: title },
        }),
      ],
    }),
    note(caption),
  ];
}

// ---------------------------------------------------------------------------------------------
// Citations in table cells

/** "Gouzy A, Poquet Y, Neyrolles O" or, from four authors, "Gouzy A … Neyrolles O". */
export function shortAuthors(authors: AuthorName[]): string {
  const names = authors.map((a) => a.name).filter(Boolean);
  if (names.length <= 3) return names.join(", ");
  return `${names[0]} … ${names[names.length - 1]}`;
}

/** Short citation: authors, title, venue (ISO abbreviation where present), year, then a PubMed
 *  or DOI link. Built from the work row, with authors and DOI from the loaded article. */
export function citationRuns(w: BiblioWork, a: WordArticle | undefined): Inline[] {
  const groups: Inline[][] = [];
  const authors = shortAuthors(a?.authors ?? []);
  if (authors) groups.push([text(`${authors}.`)]);
  const title = inlineSegments(a?.articleTitle ?? w.articleTitle ?? "");
  const titleText = title.map((s) => s.text).join("").trim();
  if (titleText) {
    const runs: Inline[] = title.map((s) => text(s.text, { italics: s.italics || undefined, bold: s.bold || undefined }));
    if (!/[.?!]["'”’)]*\s*$/.test(titleText)) runs.push(text("."));
    groups.push(runs);
  }
  const venue = String(w.journalTitleISOabbreviation ?? "").trim() || venueName(w);
  if (venue) groups.push([text(venue, { italics: true }), text(".")]);
  const y = workYear(w);
  if (y !== null) groups.push([text(`${y}.`)]);
  const pmid = Number(w.pmid);
  const doi = String(a?.doi ?? "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  if (!isExternal(w) && pmid > 0) groups.push([link(`PMID ${pmid}`, `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`)]);
  else if (doi && doi.toLowerCase() !== "null") groups.push([link(`doi ${doi}`, `https://doi.org/${doi}`)]);
  if (!groups.length) return [text("Untitled work")];
  return groups.flatMap((g, i) => (i ? [text(" "), ...g] : g));
}

const roleText = (r: Role): string => roleLabel(r);

/** NIH citation count, or why there is none. */
function citationsText(w: BiblioWork): string {
  if (isExternal(w)) return REASONS.noPubmedRecord;
  const c = w.citationCountNIH;
  if (c === null || c === undefined || c === "") return REASONS.notInICite;
  const n = Number(c);
  return Number.isFinite(n) ? fmt(Math.max(0, n)) : REASONS.notInICite;
}

/** RCR with 2 decimals, or why there is none. The loader stores a missing RCR as 0, so a 0 on a
 *  work without a percentile is read as missing, not printed as 0.00. */
function rcrText(w: BiblioWork): string {
  const r = rcrOf(w);
  const noPct = w.hasPercentileNIH === 0 || w.hasPercentileNIH === "0" || w.hasPercentileNIH === false;
  if (r !== null && !(r === 0 && noPct)) return formatRcr(r);
  if (isExternal(w)) return REASONS.noPubmedRecord;
  if (isRecent(w)) return REASONS.tooRecent;
  if (w.hasPercentileNIH === null || w.hasPercentileNIH === undefined) return REASONS.notInICite;
  return "No RCR";
}

// ---------------------------------------------------------------------------------------------
// Sections

function keyFigureRows(key: KeyFigures): Cell[][] {
  // The repo compiles without strictNullChecks, so `shown` does not narrow the union.
  const show = (s: { shown: boolean; text?: string; reason?: string }): string => (s.shown ? s.text : s.reason) ?? "";
  const typicalLabel = key.typicalWork.shown
    ? `Typical work: median Relative Citation Ratio, ${key.typicalWork.value.n} rated research ${key.typicalWork.value.n === 1 ? "article" : "articles"}`
    : "Typical work: median Relative Citation Ratio of rated research articles";
  const h = key.hIndex.shown ? `${key.hIndex.value.hindexNIH} (h5-index ${key.hIndex.value.h5indexNIH})` : show(key.hIndex);
  return [
    ["Most influential work: average NIH percentile of the 5 most influential rated research articles", show(key.mostInfluentialWork), "50 = a typical R01-funded paper"],
    [typicalLabel, show(key.typicalWork), "1.0 = a typical R01-funded paper"],
    ["Highly influential articles: rated research articles at or above the 90th NIH percentile", show(key.highlyInfluential), "About 10% of R01-funded papers"],
    ["Publications", key.publications.text, ""],
    ["Author role, PubMed research articles", show(key.researchByRole), ""],
    ["h-index, NIH iCite", h, "Includes reviews and letters"],
  ];
}

function peerSection(peer: PeerTable, surname: string, runDate: string, currentRank: string | null): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  if (!peer.eligible) {
    out.push(para("Peer comparison covers WCM-employed full-time faculty with a faculty rank, so it is not shown."));
    return out;
  }
  // No stored cell (nothing rated yet): the cohort is today's rank, the one eligibility came from.
  const cohort = rankPlural(peer.facultyRank || currentRank);
  out.push(para(`${surname} is compared with WCM ${cohort} as of the ${peer.runDate || runDate} nightly run. A top-5 average needs 5 rated research articles in the role; a top-10 average needs 10. A rank needs at least 20 qualifying faculty.`));
  const rows: Cell[][] = peer.rows.map((r) => [
    r.label,
    r.ratedText,
    r.cells[0].average.text,
    r.cells[1].average.text,
    r.cells[0].rankText,
    r.cells[1].rankText,
  ]);
  out.push(table(["Role set", "Rated research articles", "Average of top 5", "Average of top 10", "Rank, top 5", "Rank, top 10"], rows, [1.5, 1.6, 1.3, 1.3, 1.6, 1.6]));
  out.push(note(PEER_NOTE));
  return out;
}

// ---------------------------------------------------------------------------------------------

export async function buildBibliometricDocx(input: BiblioDocInput): Promise<BiblioDocResult> {
  const { uid, person, works, articles, runDate } = input;
  const first = (person.firstName || "").trim();
  const surname = displaySurname(person) || uid;
  const name = [first, (person.lastName || "").trim()].filter(Boolean).join(" ") || uid;

  const key = keyFigures(works, runDate);
  const peer = peerTable(works, input.cells, input.cells.length ? {} : { eligible: input.eligibleNow });
  const summary = buildSummary({
    surname,
    key,
    peer,
    atHighest: ratedAtHighest(works),
    recentSeniorYears: recentSeniorYears(works),
  });
  const mismatches = peer.eligible
    ? peer.rows.flatMap((r) => r.cells.filter((c) => c.mismatch).map((c) => `${r.roleSet}:${c.topN}`))
    : [];

  const children: Array<Paragraph | Table> = [];
  const sections: string[] = [];
  const section = (title: string) => {
    sections.push(title);
    children.push(h2(title));
  };

  // 1. Header
  const storedRank = input.cells.length ? String(input.cells[0].facultyRank ?? "").trim() || null : null;
  const rankShown = storedRank || input.currentRank;
  children.push(h1(`Bibliometric analysis: ${name}`));
  // With no person row the name is already the uid; print it once.
  children.push(para([text([name, (person.department || "").trim(), rankShown || "", name === uid ? "" : uid].filter(Boolean).join(" · "), { bold: true })]));
  const rn = rankNote(storedRank, input.currentRank, runDate);
  const counted = key.counts.counted;
  children.push(
    para(
      `Data from the ReCiter nightly run of ${runDate}. The report covers the ${fmt(counted)} ${counted === 1 ? "publication" : "publications"} accepted for this person in ReCiter. ${SCOPE_LINE}` +
        (rn ? ` ${rn}` : ""),
      "ReportNote"
    )
  );

  // 2. Summary for reviewers
  section("Summary for reviewers");
  for (const p of summary.paragraphs) {
    const runs: Run[] = [];
    p.forEach((s, i) => {
      if (i > 0) runs.push({ text: " " });
      runs.push(...s.runs);
    });
    children.push(new Paragraph({ children: runs.map((r) => text(r.text, { italics: r.italic || undefined })) }));
  }

  // 3. Key figures
  section("Key figures");
  children.push(note("Each figure is shown next to a reference point. A figure below its minimum record size shows the reason instead."));
  children.push(table(["Measure", surname, "Reference point"], keyFigureRows(key), [4.3, 2.9, 2.4]));

  // 4. Peer comparison (S7 sentence when not eligible)
  section("Peer comparison");
  children.push(...peerSection(peer, surname, runDate, input.currentRank));

  // 5. Authorship over time
  const authorship = authorshipByYear(works);
  if (authorship) {
    section("Authorship over time");
    const title = "Research articles by year and author role";
    const n = authorship.totals.reduce((a, b) => a + b, 0);
    const subtitle = authorship.axis.binned ? "5-year bins; the record spans more than 25 years" : undefined;
    const gaps = authorship.gaps.length ? ` Years with none: ${authorship.gaps.join(", ")}.` : "";
    children.push(
      ...chartBlock(
        authorshipSvg(authorship, { title, subtitle }),
        title,
        `ReCiter, ${runDate} · the ${fmt(n)} PubMed research ${n === 1 ? "article" : "articles"} with a year, rated or not; reviews, letters, comments, editorials, preprints and works from other sources excluded.${gaps}`
      )
    );
  }

  // 6. Percentile distribution
  const bins = percentileBins(works);
  if (bins.shown) {
    section("Percentile distribution");
    const title = "NIH percentile of rated research articles";
    children.push(
      ...chartBlock(
        percentileSvg(bins.value, { title, subtitle: `${fmt(bins.value.total)} rated research articles in 10-point bins` }),
        title,
        "If a record matched R01-funded papers, about 10% of its rated research articles would fall in each bin (dashed line)."
      )
    );
  }

  // 7. Most influential research articles
  const influential = mostInfluential(works);
  if (influential.length) {
    section("Most influential research articles");
    const marked = influential.some((r) => r.marked);
    const top = influential.filter((r) => !r.marked).length;
    children.push(
      note(
        `${top === key.counts.rated ? `All ${fmt(top)} rated research ${top === 1 ? "article" : "articles"}` : `The ${fmt(top)} highest-rated research articles`}, by NIH percentile, then Relative Citation Ratio.` +
          (marked ? " Rows marked * are among the 5 highest first- or senior-authored articles and fall outside the top 10." : "")
      )
    );
    const rows: Cell[][] = influential.map((r) => {
      const pct = pctOf(r.work);
      return [
        [...(r.marked ? [text("* ", { bold: true })] : []), ...citationRuns(r.work, articles.get(Number(r.work.pmid)))],
        roleText(r.role),
        pct === null ? REASONS.noPercentile : formatPct(pct),
        rcrText(r.work),
        citationsText(r.work),
      ];
    });
    children.push(table(["Article", "Role", "NIH percentile", "RCR", "Citations"], rows, [5.6, 1, 1.1, 0.9, 1], [false, false, true, true, true]));
  }

  // 8. Reviews and other works
  const others = reviewsAndOther(works, LIST_LIMITS.reviews);
  if (others.length) {
    section("Reviews and other works");
    children.push(note("PubMed works that are not research articles, by NIH iCite citation count. They count toward the h-index, not toward the peer comparison."));
    children.push(
      table(
        ["Work", "Type", "Role", "Citations", "RCR"],
        others.map((r) => [citationRuns(r.work, articles.get(Number(r.work.pmid))), r.tag, roleText(r.role), citationsText(r.work), rcrText(r.work)]),
        [5.4, 1.2, 0.9, 1, 0.9],
        [false, false, false, true, true]
      )
    );
  }

  // 9. Recent work
  const recent = recentWorks(works, LIST_LIMITS.recent);
  if (recent.length) {
    section("Recent work");
    const total = key.counts.recent;
    children.push(
      note(
        `Works too recent to rate: NIH iCite marks them provisional, or they have no NIH percentile and appeared within two years of the nightly run. Senior-authored first, then first, middle and not set, newest first.` +
          (total > recent.length ? ` The ${fmt(recent.length)} listed of ${fmt(total)}.` : "")
      )
    );
    children.push(
      table(
        ["Work", "Type", "Role", "Citations"],
        recent.map((r) => [citationRuns(r.work, articles.get(Number(r.work.pmid))), r.tag, roleText(r.role), citationsText(r.work)]),
        [5.8, 1.4, 1, 1.2],
        [false, false, false, true]
      )
    );
  }

  // 10. Older work
  const older = olderWorks(works, LIST_LIMITS.older);
  if (older.length) {
    section("Older work");
    children.push(note("PubMed works published before 1980, which NIH iCite does not rate, by citation count, highest first."));
    children.push(
      table(
        ["Work", "Type", "Role", "Citations"],
        older.map((r) => [citationRuns(r.work, articles.get(Number(r.work.pmid))), r.tag, roleText(r.role), citationsText(r.work)]),
        [5.8, 1.4, 1, 1.2],
        [false, false, false, true]
      )
    );
  }

  // 11. Methods and sources
  section("Methods and sources");
  const notInICite = key.counts.notInICite ?? 0;
  const methods: Array<[string, string]> = [
    ["Accepted work:", "a publication accepted for this person in ReCiter, excluding errata and retractions. Works from other sources (Scopus, OpenAlex, Crossref or added by hand) count toward the publication total and Recent work only."],
    ["Research article:", "a PubMed work that NIH iCite flags as a research article and that ReCiter does not type as a review, letter, comment, editorial, conference paper or preprint."],
    ["Rated research article:", "a research article published in 1980 or later with an NIH percentile that iCite does not mark provisional. A missing percentile is never treated as 0."],
    ["Recent work:", "an accepted work of any type that is not rated because iCite marks it provisional, or because it has no NIH percentile and appeared within two years of the nightly run."],
    ["Relative Citation Ratio (RCR):", "citations relative to papers of the same field and year, from NIH iCite. 1.0 is the median of papers from NIH R01 grants."],
    ["NIH percentile:", "the RCR expressed as a percentile of R01-funded papers. 50 is typical, and 10% of papers reach the 90th."],
    ["Minimums:", "the typical-work median and the top-5 average need 5 rated research articles, a top-10 average needs 10, and the percentile distribution needs 20. Under 20 rated, the highly influential share is given as a count."],
    ["Peer comparison:", "WCM-employed full-time faculty (the Weill full-time person type) at the same rank, the rank being the primary appointment's, measured with these same rules by the nightly run. A cell ranks the subject among members with at least N rated research articles in that role; ties share a rank, and a cohort under 20 is not ranked."],
    ["Author position:", "inferred by name matching, which misses about 1.5% of the time. Shared first or senior authorship is recognized only when PubMed marks equal contribution. A sole author counts as Senior. Corrections: publications@med.cornell.edu with the CWID, the PMIDs and the correct position."],
    ["h-index:", "NIH iCite citation counts over PubMed works of every type, including reviews and letters, excluding errata, retractions and works from other sources. The h5-index counts works added to PubMed in the five years before the nightly run. Scopus and Web of Science run slightly higher, Google Scholar much higher."],
    ["Source:", "ReCiter, Weill Cornell Medicine's authoritative publication system, curated by WCM librarians and validated during annual faculty review. For a full bibliography, use Export to Word on the Reports page."],
  ];
  for (const [term, def] of methods) {
    children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [text(term, { bold: true }), text(` ${def}`)] }));
  }
  const data = [`Data from the ReCiter nightly run of ${runDate}`];
  if (input.iciteDate) data.push(`NIH iCite data loaded ${input.iciteDate}`);
  children.push(
    note(
      `${data.join("; ")}.` +
        (notInICite > 0 ? ` ${fmt(notInICite)} PubMed ${notInICite === 1 ? "work is" : "works are"} not in NIH iCite yet and ${notInICite === 1 ? "is" : "are"} not rated.` : "")
    )
  );

  const doc = new Document({
    creator: "ReCiter Publication Manager",
    title: `Bibliometric analysis: ${name}`,
    styles: {
      default: { document: { run: { font: FONT, size: 22 }, paragraph: { spacing: { after: 160, line: 259 } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 32, bold: true }, paragraph: { spacing: { before: 0, after: 120 }, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { before: 280, after: 100 }, keepNext: true } },
        { id: "ReportNote", name: "Report note", basedOn: "Normal", run: { font: FONT, size: 18, color: MUTED }, paragraph: { spacing: { before: 60, after: 120 } } },
        { id: "TableText", name: "Table text", basedOn: "Normal", run: { font: FONT, size: 18 }, paragraph: { spacing: { before: 0, after: 0, line: 240 } } },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                style: "ReportNote",
                alignment: AlignmentType.CENTER,
                children: [text(`Bibliometric analysis · ${uid} · ReCiter nightly run ${runDate} · page `), new TextRun({ children: [PageNumber.CURRENT] })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  return {
    buffer,
    counted,
    external: key.counts.external,
    peerShown: peer.eligible,
    fired: summary.fired,
    sections,
    mismatches,
  };
}
