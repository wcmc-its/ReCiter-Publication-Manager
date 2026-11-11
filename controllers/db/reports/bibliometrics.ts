// Bibliometric analysis (5h): the metrics behind the one-person .docx. Pure: no imports, so
// `npm test` and scripts/check-bibliometric-hindex.mjs can load it directly. The controller (B2)
// runs the queries, hands the rows to these functions and turns the results into docx tables and
// charts.
//
// Rules (Nov 9 decisions, plan phase5h-bibliometric-docx.md):
// - "Counted works" are the person's analysis_summary_author rows joined to
//   analysis_summary_article, minus pubTypeCounted = 0 (errata, retractions). Those rows are
//   accepted-only already.
// - External works (Scopus, OpenAlex, Crossref, manual: pmid <= 0 or source_type != PUBMED) are
//   listed and counted as publications but never count toward the h-index, citation totals,
//   RCR, percentiles or Most cited.
// - The h-index rule is reciterdb's (populateAnalysisSummaryTables_v2.sql STEP 6): every PubMed
//   row of the person with a citation count > 0, any type; h = the largest rank rn (citations
//   sorted descending) with citations >= rn. The h5-index adds
//   datePublicationAddedToEntrez != '' AND datePublicationAddedToEntrez > CURDATE() - 5 years.
//   STEP 6 runs before STEP 6b adds the external rows, so the stored value is PubMed-only too.

export type BiblioWork = {
  pmid: number;
  sourceType?: string | null;
  authorPosition?: string | null;
  pubType?: string | null;
  pubTypeGroup?: string | null;
  pubTypeCounted?: number | boolean | null;
  publicationTypeCanonical?: string | null;
  publicationTypeNIH?: string | null;
  pubDate?: string | Date | null;
  articleYear?: number | null;
  datePublicationAddedToEntrez?: string | null;
  journalTitleVerbose?: string | null;
  publisher?: string | null;
  journalImpactScore1?: number | null;
  citationCountNIH?: number | null;
  citationCountScopus?: number | null;
  citationCountOpenAlex?: number | null;
  relativeCitationRatioNIH?: number | null;
  percentileNIH?: number | null;
  peerReviewed?: number | boolean | null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// ---------------------------------------------------------------------------------------------
// Row classification

/** PubMed rows carry a positive pmid; external rows are injected with negative ids. */
export function isExternal(w: BiblioWork): boolean {
  const pmid = num(w.pmid);
  if (pmid === null || pmid <= 0) return true;
  const st = str(w.sourceType).toUpperCase();
  return st !== "" && st !== "PUBMED";
}

/** Source label for the external-works line. */
export function sourceOf(w: BiblioWork): string {
  const st = str(w.sourceType).toUpperCase();
  if (st) return st;
  return isExternal(w) ? "EXTERNAL" : "PUBMED";
}

/** pubTypeCounted = 0 drops errata and retractions. Missing (pre-v3.7) or NULL counts. */
export function isCounted(w: BiblioWork): boolean {
  const c = w.pubTypeCounted;
  return !(c === 0 || c === false || (c as unknown) === "0");
}

export function countedWorks(works: BiblioWork[]): BiblioWork[] {
  return works.filter(isCounted);
}

const isPeerReviewed = (w: BiblioWork): boolean => w.peerReviewed === true || num(w.peerReviewed) === 1;
const isResearchArticle = (w: BiblioWork): boolean => !isExternal(w) && w.publicationTypeNIH === "Research Article";

// ---------------------------------------------------------------------------------------------
// h-index

/** h-index of a list of citation counts: the largest h with h values >= h. Non-positive and
 *  missing counts are ignored, as STEP 6's `citationCount > 0` filter does. */
export function hIndex(citations: Array<number | null | undefined>): number {
  const sorted = citations.map(num).filter((c): c is number => c !== null && c > 0).sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

/** YYYY-MM-DD of a Date or date-like string (UTC). Empty when unparseable. */
export function isoDate(v: unknown): string {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  const s = str(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** MySQL DATE_SUB(d, INTERVAL n YEAR): same month and day, clamped to the month's last day. */
export function minusYears(asOf: string, years: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf);
  if (!m) throw new Error(`minusYears: expected YYYY-MM-DD, got ${asOf}`);
  const y = Number(m[1]) - years;
  const mo = Number(m[2]);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const d = Math.min(Number(m[3]), last);
  return `${String(y).padStart(4, "0")}-${m[2]}-${String(d).padStart(2, "0")}`;
}

export type HIndexes = {
  hindexNIH: number;
  h5indexNIH: number;
  hindexScopus: number;
  h5indexScopus: number;
};

/**
 * The four h-indexes with STEP 6's exact row selection: every PubMed row passed in (any type,
 * counted or not), external rows excluded. `asOf` (YYYY-MM-DD) is the CURDATE() of the run being
 * reproduced, or today for a live document. The h5 window compares the
 * datePublicationAddedToEntrez string, which is always YYYY-MM-DD in reciterdb.
 */
export function hIndexes(works: BiblioWork[], asOf: string): HIndexes {
  const cutoff = minusYears(asOf, 5);
  const pubmed = works.filter((w) => !isExternal(w));
  const recent = pubmed.filter((w) => {
    const d = str(w.datePublicationAddedToEntrez);
    return d !== "" && d > cutoff;
  });
  return {
    hindexNIH: hIndex(pubmed.map((w) => w.citationCountNIH)),
    h5indexNIH: hIndex(recent.map((w) => w.citationCountNIH)),
    hindexScopus: hIndex(pubmed.map((w) => w.citationCountScopus)),
    h5indexScopus: hIndex(recent.map((w) => w.citationCountScopus)),
  };
}

export type StoredHIndexes = Partial<Record<keyof HIndexes, number | null>> | null | undefined;

/** The stored analysis_summary_person value wins when the person has a row (NULL there means no
 *  cited paper, i.e. 0). Everyone else gets the computed value. */
export function resolveHIndexes(stored: StoredHIndexes, computed: HIndexes): HIndexes & { source: "stored" | "computed" } {
  if (!stored) return { ...computed, source: "computed" };
  const pick = (k: keyof HIndexes) => num(stored[k]) ?? 0;
  return {
    hindexNIH: pick("hindexNIH"),
    h5indexNIH: pick("h5indexNIH"),
    hindexScopus: pick("hindexScopus"),
    h5indexScopus: pick("h5indexScopus"),
    source: "stored",
  };
}

// ---------------------------------------------------------------------------------------------
// Years

/** Publication year: v3.7 pubDate, else articleYear. */
export function workYear(w: BiblioWork): number | null {
  const d = isoDate(w.pubDate);
  if (d) return Number(d.slice(0, 4));
  const y = num(w.articleYear);
  return y !== null && y > 0 ? y : null;
}

export type YearAxis = {
  /** Chart and table categories, oldest first. The first is "Before YYYY" when collapsed. */
  categories: string[];
  /** First year with its own category. */
  start: number;
  end: number;
  /** True when years before `start` fold into categories[0]. */
  collapsed: boolean;
};

export const MAX_AXIS_YEARS = 30;

/**
 * Zero-filled year axis from the first year to max(currentYear, latest year). When it spans more
 * than `maxYears` years, the years before the most recent `maxYears` fold into one
 * "Before YYYY" column (so at most maxYears + 1 categories).
 */
export function yearAxis(years: Array<number | null>, currentYear: number, maxYears = MAX_AXIS_YEARS): YearAxis {
  const ys = years.filter((y): y is number => typeof y === "number" && Number.isFinite(y));
  if (ys.length === 0) return { categories: [], start: currentYear, end: currentYear, collapsed: false };
  const first = Math.min(...ys);
  const end = Math.max(currentYear, ...ys);
  const collapsed = end - first + 1 > maxYears;
  const start = collapsed ? end - maxYears + 1 : first;
  const categories: string[] = collapsed ? [`Before ${start}`] : [];
  for (let y = start; y <= end; y++) categories.push(String(y));
  return { categories, start, end, collapsed };
}

/** Category index for a year, or -1 when it has none (no year). */
export function yearIndex(axis: YearAxis, year: number | null): number {
  if (year === null || axis.categories.length === 0) return -1;
  if (year < axis.start) return axis.collapsed ? 0 : -1;
  if (year > axis.end) return -1;
  return (axis.collapsed ? 1 : 0) + (year - axis.start);
}

// ---------------------------------------------------------------------------------------------
// Types

export type TypeGroup = "journal" | "conf" | "book" | "other";
export const TYPE_GROUPS: Array<{ key: TypeGroup; label: string }> = [
  { key: "journal", label: "Journal articles" },
  { key: "conf", label: "Conference papers" },
  { key: "book", label: "Books and chapters" },
  { key: "other", label: "Preprints and other" },
];

// Pre-v3.7 fallback: publicationTypeCanonical to group (values seen in analysis_summary_article).
const CANONICAL_GROUP: Record<string, TypeGroup> = {
  "Academic Article": "journal", "Article": "journal", "Review": "journal", "Case Report": "journal",
  "Letter": "journal", "Editorial Article": "journal", "Editorial": "journal", "Comment": "journal",
  "Guideline": "journal", "Short Survey": "journal", "Data Paper": "journal",
  "Conference Paper": "conf", "conference-paper": "conf",
  "Book": "book", "Book Chapter": "book",
};

/** v3.7 pubTypeGroup, else the canonical-type fallback. Counted rows without a group are "other". */
export function groupOf(w: BiblioWork): TypeGroup {
  const g = str(w.pubTypeGroup);
  if (g === "journal" || g === "conf" || g === "book" || g === "other") return g;
  if (w.pubTypeGroup === undefined) {
    const c = CANONICAL_GROUP[str(w.publicationTypeCanonical)];
    if (c) return c;
  }
  return "other";
}

export function typeOf(w: BiblioWork): string {
  return str(w.pubType) || str(w.publicationTypeCanonical) || "Unspecified";
}

export type Series = { key: string; label: string; values: number[] };
export type YearMatrix = { categories: string[]; series: Series[]; totals: number[]; undated: number };

function yearMatrix<K extends string>(
  works: BiblioWork[], axis: YearAxis, keys: Array<{ key: K; label: string }>, keyOf: (w: BiblioWork) => K,
): YearMatrix {
  const n = axis.categories.length;
  const series: Series[] = keys.map((k) => ({ key: k.key, label: k.label, values: new Array(n).fill(0) }));
  const at = new Map(series.map((s) => [s.key, s]));
  const totals = new Array(n).fill(0);
  let undated = 0;
  for (const w of works) {
    const i = yearIndex(axis, workYear(w));
    if (i < 0) { undated++; continue; }
    const s = at.get(keyOf(w));
    if (!s) continue;
    s.values[i]++;
    totals[i]++;
  }
  return { categories: axis.categories, series, totals, undated };
}

/** Counted works per year by type group (chart 1 and its table). */
export function typeByYear(works: BiblioWork[], axis: YearAxis): YearMatrix {
  return yearMatrix(countedWorks(works), axis, TYPE_GROUPS, groupOf);
}

export type TypeBreakdownRow = {
  group: TypeGroup; groupLabel: string; pubType: string;
  peerReviewed: number; notPeerReviewed: number; total: number;
};

/**
 * Counted works per pubType within each group, split by peerReviewed (v3.10). With
 * `hasPeerReviewed` false (column absent) both split columns stay 0 and only `total` is meaningful.
 */
export function typeBreakdown(works: BiblioWork[], hasPeerReviewed: boolean): TypeBreakdownRow[] {
  const rows = new Map<string, TypeBreakdownRow>();
  for (const w of countedWorks(works)) {
    const group = groupOf(w);
    const pubType = typeOf(w);
    const k = `${group}\u0000${pubType}`;
    let r = rows.get(k);
    if (!r) {
      r = { group, groupLabel: TYPE_GROUPS.find((g) => g.key === group)!.label, pubType, peerReviewed: 0, notPeerReviewed: 0, total: 0 };
      rows.set(k, r);
    }
    r.total++;
    if (hasPeerReviewed) {
      if (isPeerReviewed(w)) r.peerReviewed++;
      else r.notPeerReviewed++;
    }
  }
  const order = (g: TypeGroup) => TYPE_GROUPS.findIndex((t) => t.key === g);
  return [...rows.values()].sort((a, b) => order(a.group) - order(b.group) || b.total - a.total || a.pubType.localeCompare(b.pubType));
}

// ---------------------------------------------------------------------------------------------
// Author positions

export type Position = "first" | "middle" | "last" | "notSet";
export const POSITIONS: Array<{ key: Position; label: string }> = [
  { key: "first", label: "First" },
  { key: "middle", label: "Middle" },
  { key: "last", label: "Last" },
  { key: "notSet", label: "Position not set" },
];

/** A NULL position on a PubMed row is middle authorship; on an external row it is unknown. */
export function positionOf(w: BiblioWork): Position {
  const p = str(w.authorPosition).toLowerCase();
  if (p === "first" || p === "last") return p;
  if (p === "middle") return "middle";
  return isExternal(w) ? "notSet" : "middle";
}

export function positionCounts(works: BiblioWork[]): Record<Position, number> {
  const out: Record<Position, number> = { first: 0, middle: 0, last: 0, notSet: 0 };
  for (const w of countedWorks(works)) out[positionOf(w)]++;
  return out;
}

/** Counted works per year by author position (chart 2). "Position not set" is a series only
 *  when the person has such a row. */
export function positionsByYear(works: BiblioWork[], axis: YearAxis): YearMatrix {
  const counted = countedWorks(works);
  const anyNotSet = counted.some((w) => positionOf(w) === "notSet");
  const keys = POSITIONS.filter((p) => p.key !== "notSet" || anyNotSet);
  return yearMatrix(counted, axis, keys, positionOf);
}

// ---------------------------------------------------------------------------------------------
// Citation impact

export const PERCENTILE_BIN_LABELS = ["0–10", "10–20", "20–30", "30–40", "40–50", "50–60", "60–70", "70–80", "80–90", "90–100"];

/** NIH percentile distribution of research articles with a percentile, in 10 bins; 100 goes in
 *  the last bin. */
export function percentileBins(works: BiblioWork[]): { labels: string[]; counts: number[]; total: number } {
  const counts = new Array(10).fill(0);
  let total = 0;
  for (const w of countedWorks(works)) {
    if (!isResearchArticle(w)) continue;
    const p = num(w.percentileNIH);
    if (p === null) continue;
    counts[Math.max(0, Math.min(9, Math.floor(p / 10)))]++;
    total++;
  }
  return { labels: PERCENTILE_BIN_LABELS, counts, total };
}

// Sort helpers: MySQL puts NULL last in DESC order.
const desc = (a: number | null, b: number | null): number => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
};
// `ORDER BY authorPosition DESC`: 'last' > 'first' > NULL.
const positionRank = (w: BiblioWork): number => {
  const p = str(w.authorPosition).toLowerCase();
  return p === "last" ? 0 : p === "first" ? 1 : 2;
};

/** Most cited: counted PubMed rows by NIH citations desc, then RCR desc, then newest pmid. */
export function mostCited(works: BiblioWork[], n = 10): BiblioWork[] {
  return countedWorks(works)
    .filter((w) => !isExternal(w) && (num(w.citationCountNIH) ?? 0) > 0)
    .sort((a, b) => desc(num(a.citationCountNIH), num(b.citationCountNIH))
      || desc(num(a.relativeCitationRatioNIH), num(b.relativeCitationRatioNIH))
      || num(b.pmid)! - num(a.pmid)!)
    .slice(0, n);
}

/** The RTF's "most influential" lists: research articles by NIH percentile desc, then RCR desc
 *  (NULLs last, as MySQL orders them). `firstOrLast` keeps only first- and last-authored rows. */
export function mostInfluential(works: BiblioWork[], opts: { firstOrLast?: boolean; n?: number } = {}): BiblioWork[] {
  const n = opts.n ?? 10;
  return countedWorks(works)
    .filter(isResearchArticle)
    .filter((w) => !opts.firstOrLast || ["first", "last"].includes(str(w.authorPosition).toLowerCase()))
    .sort((a, b) => desc(num(a.percentileNIH), num(b.percentileNIH))
      || desc(num(a.relativeCitationRatioNIH), num(b.relativeCitationRatioNIH))
      || num(b.pmid)! - num(a.pmid)!)
    .slice(0, n);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days from datePublicationAddedToEntrez to asOf (YYYY-MM-DD), or null. */
export function daysSinceAdded(w: BiblioWork, asOf: string): number | null {
  const d = isoDate(w.datePublicationAddedToEntrez);
  if (!d) return null;
  return Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / DAY_MS);
}

/** The RTF's "recent" list: research articles added within 730 days with no percentile yet
 *  (NULL or 0). Last- then first-authored first, then newest. */
export function recentArticles(works: BiblioWork[], asOf: string, n = 25): BiblioWork[] {
  return countedWorks(works)
    .filter(isResearchArticle)
    .filter((w) => { const p = num(w.percentileNIH); return p === null || p === 0; })
    .filter((w) => { const d = daysSinceAdded(w, asOf); return d !== null && d < 730; })
    .sort((a, b) => positionRank(a) - positionRank(b) || num(b.pmid)! - num(a.pmid)!)
    .slice(0, n);
}

/** The RTF's "older" list: research articles before 1980 with no percentile, by position then
 *  NIH citations. */
export function olderArticles(works: BiblioWork[], n = 25): BiblioWork[] {
  return countedWorks(works)
    .filter(isResearchArticle)
    .filter((w) => num(w.percentileNIH) === null && (num(w.articleYear) ?? 9999) < 1980)
    .sort((a, b) => positionRank(a) - positionRank(b)
      || desc(num(a.citationCountNIH), num(b.citationCountNIH))
      || num(b.pmid)! - num(a.pmid)!)
    .slice(0, n);
}

// ---------------------------------------------------------------------------------------------
// Journals

export type JournalRow = { title: string; count: number; firstYear: number | null; lastYear: number | null; sjr: number | null };

/** Top venues of counted works: journalTitleVerbose, else publisher for books and proceedings.
 *  Titles group case-insensitively; SJR is the value on the newest work that has one. */
export function journals(works: BiblioWork[], n = 15): JournalRow[] {
  type Acc = JournalRow & { sjrYear: number };
  const by = new Map<string, Acc>();
  for (const w of countedWorks(works)) {
    const title = str(w.journalTitleVerbose) || str(w.publisher);
    if (!title) continue;
    const k = title.toLowerCase();
    const y = workYear(w);
    let r = by.get(k);
    if (!r) { r = { title, count: 0, firstYear: null, lastYear: null, sjr: null, sjrYear: -Infinity }; by.set(k, r); }
    r.count++;
    if (y !== null) {
      r.firstYear = r.firstYear === null ? y : Math.min(r.firstYear, y);
      r.lastYear = r.lastYear === null ? y : Math.max(r.lastYear, y);
    }
    const s = num(w.journalImpactScore1);
    if (s !== null && (y ?? -Infinity) >= r.sjrYear) { r.sjr = s; r.sjrYear = y ?? -Infinity; }
  }
  return [...by.values()]
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, n)
    .map(({ sjrYear: _ignored, ...r }) => r);
}

// ---------------------------------------------------------------------------------------------
// Summary

export type SummaryStats = {
  counted: number;
  pubmed: number;
  external: number;
  externalBySource: Record<string, number>;
  firstYear: number | null;
  lastYear: number | null;
  /** null when the peerReviewed column is absent (pre-v3.10). */
  peerReviewed: number | null;
  positions: Record<Position, number>;
  totalCitationsNIH: number;
  researchWithPercentile: number;
  medianRCR: number | null;
  meanRCR: number | null;
  /** Share (0..1) of research articles with a percentile at 90 or above; null when none. */
  shareTop10: number | null;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function summaryStats(works: BiblioWork[], opts: { hasPeerReviewed: boolean }): SummaryStats {
  const counted = countedWorks(works);
  const pubmed = counted.filter((w) => !isExternal(w));
  const externalBySource: Record<string, number> = {};
  for (const w of counted) if (isExternal(w)) externalBySource[sourceOf(w)] = (externalBySource[sourceOf(w)] ?? 0) + 1;
  const years = counted.map(workYear).filter((y): y is number => y !== null);
  const research = pubmed.filter(isResearchArticle).filter((w) => num(w.percentileNIH) !== null);
  const rcr = research.map((w) => num(w.relativeCitationRatioNIH)).filter((v): v is number => v !== null);
  return {
    counted: counted.length,
    pubmed: pubmed.length,
    external: counted.length - pubmed.length,
    externalBySource,
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
    peerReviewed: opts.hasPeerReviewed ? counted.filter((w) => isPeerReviewed(w)).length : null,
    positions: positionCounts(works),
    totalCitationsNIH: pubmed.reduce((t, w) => t + Math.max(0, num(w.citationCountNIH) ?? 0), 0),
    researchWithPercentile: research.length,
    medianRCR: median(rcr),
    meanRCR: rcr.length ? rcr.reduce((a, b) => a + b, 0) / rcr.length : null,
    shareTop10: research.length ? research.filter((w) => (num(w.percentileNIH) ?? 0) >= 90).length / research.length : null,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** 2 to 4 sentences under the summary table. */
export function summaryProse(name: string, s: SummaryStats, h: HIndexes): string {
  const out: string[] = [];
  if (s.counted === 0) return `${name} has no accepted publications in ReCiter.`;
  const span = s.firstYear !== null && s.lastYear !== null
    ? (s.firstYear === s.lastYear ? ` in ${s.firstYear}` : ` between ${s.firstYear} and ${s.lastYear}`)
    : "";
  const ext = s.external > 0 ? `: ${s.pubmed.toLocaleString("en-US")} indexed in PubMed and ${s.external.toLocaleString("en-US")} from other sources` : "";
  out.push(`${name} has ${plural(s.counted, "accepted publication")}${span}${ext}.`);
  out.push(`${s.positions.first.toLocaleString("en-US")} ${s.positions.first === 1 ? "is" : "are"} first-authored and ${s.positions.last.toLocaleString("en-US")} last-authored.`);
  if (s.pubmed > 0) {
    out.push(`The PubMed-indexed works have ${plural(s.totalCitationsNIH, "citation")} in NIH iCite, for an h-index of ${h.hindexNIH} (h5-index ${h.h5indexNIH}).`);
  }
  if (s.researchWithPercentile > 0 && s.shareTop10 !== null) {
    const pct = Math.round(s.shareTop10 * 100);
    out.push(`Of ${plural(s.researchWithPercentile, "research article")} with an NIH percentile, ${pct}% ${pct === 1 ? "is" : "are"} at the 90th percentile or above.`);
  }
  return out.join(" ");
}

// ---------------------------------------------------------------------------------------------
// Peer comparison (the RTF's four bullets, from analysis_summary_person)

export type PeerPerson = {
  nameLast?: string | null;
  facultyRank?: string | null;
  countAll?: number | null;
  countFirst?: number | null;
  countSenior?: number | null;
} & Record<string, unknown>;

export type PeerBullet = { key: "FirstSenior" | "Senior" | "First" | "All"; label: string; text: string };

/** MySQL concat(round(x, 1)) on the FLOAT(7,3) top* columns: always one decimal (85 prints
 *  "85.0"). MySQL rounds the column's single-precision value as a double, so 99.950 (stored as
 *  99.9499969...) prints 99.9 and 99.050 prints 99.1, and an exact half rounds to even (87.25
 *  prints 87.2, 87.75 prints 87.8). Math.fround plus half-to-even reproduces that. */
export function round1(v: unknown): string {
  const n = num(v);
  if (n === null) return "N/A";
  const x = Math.fround(n) * 10;
  const f = Math.floor(x);
  const d = x - f;
  const r = d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1);
  return (r / 10).toFixed(1);
}

const PEER_DEFS: Array<{ key: PeerBullet["key"]; label: string; noun: string; few: (last: string) => string; count: (p: PeerPerson) => number }> = [
  {
    key: "FirstSenior", label: "First or senior", noun: "first- or senior-authored research articles",
    few: (last) => `${last} has fewer than five first- or senior-authored research articles, so the average NIH percentile is not provided.`,
    count: (p) => (num(p.countFirst) ?? 0) + (num(p.countSenior) ?? 0),
  },
  {
    key: "Senior", label: "Senior", noun: "senior-authored research articles",
    few: (last) => `${last} has fewer than five senior-authored research articles, so the average NIH percentile is not provided.`,
    count: (p) => num(p.countSenior) ?? 0,
  },
  {
    key: "First", label: "First", noun: "first-authored research articles",
    few: (last) => `${last} has fewer than five first-authored research articles, so the average NIH percentile is not provided.`,
    count: (p) => num(p.countFirst) ?? 0,
  },
  {
    key: "All", label: "Any position", noun: "authored research articles",
    few: () => "Individual has fewer than five research articles, so the average NIH percentile is not provided.",
    count: (p) => num(p.countAll) ?? 0,
  },
];

/**
 * The RTF's four peer bullets, word for word in plain prose, with its 5- and 10-article
 * thresholds (>= 10: top 5 and top 10; >= 5: top 5 only; else a fallback sentence).
 */
export function peerComparison(p: PeerPerson): PeerBullet[] {
  const last = str(p.nameLast) || "This person";
  const rank = str(p.facultyRank).toLowerCase();
  return PEER_DEFS.map((d) => {
    const c = d.count(p);
    const f = (k: string) => p[`${k}${d.key}`];
    const most = d.key === "All" ? "research articles" : d.noun;
    let text: string;
    if (c >= 10) {
      text = `The five and ten most influential ${most} have an average NIH percentile of ${round1(f("top5Percentile"))} and ${round1(f("top10Percentile"))}, respectively (higher is better). `
        + `There are ${num(f("top5Denominator")) ?? "N/A"} WCM-employed full-time faculty at the ${rank} level with five or more ${d.noun}, and ${num(f("top10Denominator")) ?? "N/A"} who have written ten or more. `
        + `Within these groups, ${last}'s percentiles rank at #${num(f("top5Rank")) ?? "N/A"} and #${num(f("top10Rank")) ?? "N/A"}, respectively (lower is better).`;
    } else if (c >= 5) {
      text = `The five most influential ${most} have an average NIH percentile of ${round1(f("top5Percentile"))} (higher is better). `
        + `There are ${num(f("top5Denominator")) ?? "N/A"} WCM-employed full-time faculty at the ${rank} level with five or more ${d.noun}. `
        + `Within this group, this percentile ranks at #${num(f("top5Rank")) ?? "N/A"} (lower is better).`;
    } else {
      text = d.few(last);
    }
    return { key: d.key, label: d.label, text };
  });
}

/** The RTF's lead sentence above the bullets. */
export function peerIntro(p: PeerPerson): string {
  const last = str(p.nameLast) || "This person";
  return `For the purpose of this analysis, ${last} has authored ${num(p.countAll) ?? 0} research articles appearing in PubMed, `
    + `${num(p.countFirst) ?? 0} of which were written as a first author and ${num(p.countSenior) ?? 0} as a senior author. `
    + "Any articles written in the last two years or prior to 1980 are excluded from this analysis, but are included in either the \"Recent articles\" or \"Older articles\" sections.";
}

export const PEER_NOT_RANKED = "The peer comparison covers WCM-employed full-time faculty with a faculty rank only, so it is not shown for this person.";
