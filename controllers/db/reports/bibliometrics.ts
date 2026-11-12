// Bibliometric report v2 (5h): the measures and section selectors behind the one-person report.
// Pure, no imports, so `npm test` and scripts/check-bibliometric-hindex.mjs load it directly.
//
// The rules live in ReCiterDB, not here. Migration v3.11 (plan phase5h-v2-bibliometric.md, PR R2)
// materializes them as flags that this module only reads:
//
//   analysis_summary_article
//     provisionalNIH     TINYINT       iCite `provisional` (1 = provisional)
//     hasPercentileNIH   TINYINT       iCite returned a percentile; NULL when the work has no
//                                      analysis_nih row (not in iCite)
//     pctExact           DECIMAL(5,2)  ROUND(nih_percentile, 2), exact
//     researchArticleV2  TINYINT       PubMed work, iCite research flag, canonical type not
//                                      Preprint/Review/Letter/Comment/Editorial Article/
//                                      Conference Paper/Erratum/Retraction, counted
//     ratedV2            TINYINT       research article, year >= 1980, has a percentile,
//                                      not provisional
//     recentV2           TINYINT       counted, not rated, and provisional or (no percentile and
//                                      pubDate within 24 months before the nightly run date)
//   analysis_summary_author
//     authorRoleV2       ENUM('first','senior','middle','not_set')  sole author = senior
//     soleAuthor         TINYINT
//   analysis_summary_person_peer (one row per person x roleSet x topN)
//     personIdentifier, facultyRank, cohortEligible, roleSet
//     ('any','first_or_senior','first','senior'), topN (5|10), ratedCount, recentCount,
//     avgTop DECIMAL(6,3), cohortRank, cohortM, runDate, iciteLoadedAt
//
// The module never re-derives a flag from raw fields (a second copy of the rules is how v1
// drifted). It only aggregates flagged rows: counts, medians, top-N averages, bins, lists.
// When a v3.11 column is absent (R2 not applied), `missingV2Columns` names it, every flag reads
// as false, and `keyFigures` / `peerTable` return reasons instead of numbers; nothing throws.
//
// Exact arithmetic: percentiles and RCRs are held as integer hundredths, so sums, averages of
// 5 or 10 values (exact at 3 decimals, as avgTop DECIMAL(6,3)), comparisons and ties are exact.
// Rounding is half-up and happens only at display.

export type Flag = number | boolean | string | null | undefined;

export type BiblioWork = {
  pmid: number;
  sourceType?: string | null;
  pubTypeCounted?: Flag;
  publicationTypeCanonical?: string | null;
  pubDate?: string | Date | null;
  articleYear?: number | null;
  datePublicationAddedToEntrez?: string | null;
  articleTitle?: string | null;
  journalTitleVerbose?: string | null;
  issn?: string | null;
  citationCountNIH?: number | string | null;
  relativeCitationRatioNIH?: number | string | null;
  percentileNIH?: number | string | null;
  // v3.11 (R2)
  pctExact?: number | string | null;
  provisionalNIH?: Flag;
  hasPercentileNIH?: Flag;
  researchArticleV2?: Flag;
  ratedV2?: Flag;
  recentV2?: Flag;
  authorRoleV2?: string | null;
  soleAuthor?: Flag;
};

/** v3.11 columns on the works rows (analysis_summary_article + analysis_summary_author). */
export const V2_WORK_COLUMNS = [
  "provisionalNIH", "hasPercentileNIH", "pctExact", "researchArticleV2", "ratedV2", "recentV2",
  "authorRoleV2", "soleAuthor",
] as const;

/** v3.11 analysis_summary_person_peer columns. */
export const V2_PEER_COLUMNS = [
  "personIdentifier", "facultyRank", "cohortEligible", "roleSet", "topN", "ratedCount",
  "recentCount", "avgTop", "cohortRank", "cohortM", "runDate", "iciteLoadedAt",
] as const;

export const REASONS = {
  needsRated: (n: number) => `Needs ${n} rated`,
  tooRecent: "Too recent to rate",
  cohortTooSmall: "Cohort too small to rank",
  noPubmed: "No PubMed works",
  noPubmedRecord: "Not in PubMed",
  noResearch: "No research articles",
  noRated: "No rated research articles",
  notResearch: "Not a research article",
  before1980: "Published before 1980",
  notInICite: "Not in NIH iCite yet",
  noPercentile: "No NIH percentile",
  v2Unavailable: "Bibliometric v2 data not available yet",
  peerUnavailable: "Peer data not available yet",
} as const;

export const MIN_COHORT = 20;
export const MIN_RATED_TYPICAL = 5;
export const MIN_RATED_DISTRIBUTION = 20;
export const RANKED_MIN_N = [5, 10] as const;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** TINYINT / boolean / 'True' flag. Absent or NULL reads as false. */
export function flag(v: Flag): boolean {
  if (v === true) return true;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return typeof v === "number" && v !== 0;
}

/** The v3.11 work columns missing from the rows (all rows come from one SELECT, so the first row
 *  decides). Empty when the person has no rows. */
export function missingV2Columns(works: BiblioWork[]): string[] {
  if (works.length === 0) return [];
  const row = works[0] as Record<string, unknown>;
  return V2_WORK_COLUMNS.filter((c) => !(c in row));
}

// ---------------------------------------------------------------------------------------------
// Exact numbers

/** Integer hundredths of a DECIMAL string or a driver number ("83.64" -> 8364). Null when empty. */
export function hundredths(v: unknown): number | null {
  if (typeof v === "string") {
    const m = /^\s*(-?)(\d*)(?:\.(\d*))?\s*$/.exec(v);
    if (m && (m[2] !== "" || (m[3] ?? "") !== "")) {
      const frac = (m[3] ?? "").padEnd(3, "0");
      const raw = Number(m[2] || "0") * 100 + Number(frac.slice(0, 2)) + (Number(frac[2]) >= 5 ? 1 : 0);
      return m[1] ? -raw : raw;
    }
  }
  const n = num(v);
  return n === null ? null : Math.round(n * 100);
}

/** Integer thousandths of a DECIMAL(6,3) string or number ("83.640" -> 83640). */
export function thousandths(v: unknown): number | null {
  if (typeof v === "string") {
    const m = /^\s*(-?)(\d*)(?:\.(\d*))?\s*$/.exec(v);
    if (m && (m[2] !== "" || (m[3] ?? "") !== "")) {
      const frac = (m[3] ?? "").padEnd(4, "0");
      const raw = Number(m[2] || "0") * 1000 + Number(frac.slice(0, 3)) + (Number(frac[3]) >= 5 ? 1 : 0);
      return m[1] ? -raw : raw;
    }
  }
  const n = num(v);
  return n === null ? null : Math.round(n * 1000);
}

/** Half-up display of a non-negative integer count of 10^-scale units with `digits` decimals
 *  (digits <= scale): fixed(8364, 2, 1) = "83.6", fixed(199, 3, 2) for 0.199 = "0.20". */
export function fixed(units: number, scale: number, digits: number): string {
  const step = 10 ** (scale - digits);
  const neg = units < 0;
  const r = Math.floor((Math.abs(units) * 2 + step) / (2 * step));
  const s = String(r).padStart(digits + 1, "0");
  const out = digits === 0 ? s : `${s.slice(0, s.length - digits)}.${s.slice(-digits)}`;
  return neg && r !== 0 ? `-${out}` : out;
}

/** The work's percentile in hundredths: pctExact (v3.11), else percentileNIH. */
export function pctOf(w: BiblioWork): number | null {
  return "pctExact" in w ? hundredths(w.pctExact) : hundredths(w.percentileNIH);
}
export const rcrOf = (w: BiblioWork): number | null => hundredths(w.relativeCitationRatioNIH);
export const citesOf = (w: BiblioWork): number => Math.max(0, num(w.citationCountNIH) ?? 0);

/** Percentile with 1 decimal, half-up ("89.6"). */
export const formatPct = (h: number): string => fixed(h, 2, 1);
/** RCR with 2 decimals ("2.21"). */
export const formatRcr = (h: number): string => fixed(h, 2, 2);

// ---------------------------------------------------------------------------------------------
// Row classification

/** PubMed rows carry a positive pmid; external rows are injected with negative ids. */
export function isExternal(w: BiblioWork): boolean {
  const pmid = num(w.pmid);
  if (pmid === null || pmid <= 0) return true;
  const st = str(w.sourceType).toUpperCase();
  return st !== "" && st !== "PUBMED";
}

export function sourceOf(w: BiblioWork): string {
  const st = str(w.sourceType).toUpperCase();
  if (st) return st;
  return isExternal(w) ? "EXTERNAL" : "PUBMED";
}

/** pubTypeCounted = 0 drops errata and retractions. NULL or absent counts. */
export function isCounted(w: BiblioWork): boolean {
  const c = w.pubTypeCounted;
  return !(c === 0 || c === false || c === "0");
}

export function countedWorks(works: BiblioWork[]): BiblioWork[] {
  return works.filter(isCounted);
}

export const isPubmedWork = (w: BiblioWork): boolean => isCounted(w) && !isExternal(w);
export const isResearchArticle = (w: BiblioWork): boolean => isCounted(w) && flag(w.researchArticleV2);
export const isRated = (w: BiblioWork): boolean => isResearchArticle(w) && flag(w.ratedV2);
export const isRecent = (w: BiblioWork): boolean => isCounted(w) && flag(w.recentV2);

export type Role = "first" | "senior" | "middle" | "notSet";
export const ROLES: Array<{ key: Role; label: string }> = [
  { key: "senior", label: "Senior" },
  { key: "first", label: "First" },
  { key: "middle", label: "Middle" },
  { key: "notSet", label: "Not set" },
];
export const roleLabel = (r: Role): string => ROLES.find((x) => x.key === r)!.label;

/** authorRoleV2 as written by STEP 2v2 (sole author = senior; STEP 2b equal-contribution
 *  promotions already applied). Absent or unknown reads as "notSet". */
export function roleOf(w: BiblioWork): Role {
  const r = str(w.authorRoleV2).toLowerCase();
  return r === "first" || r === "senior" || r === "middle" ? r : "notSet";
}

export type RoleSet = "any" | "first_or_senior" | "first" | "senior";
export const ROLE_SETS: Array<{ key: RoleSet; label: string; phrase: string }> = [
  { key: "any", label: "Any position", phrase: "" },
  { key: "first_or_senior", label: "First or senior", phrase: "first- or senior-authored" },
  { key: "first", label: "First", phrase: "first-authored" },
  { key: "senior", label: "Senior", phrase: "senior-authored" },
];

export function inRoleSet(w: BiblioWork, set: RoleSet): boolean {
  const r = roleOf(w);
  if (set === "any") return true;
  if (set === "first_or_senior") return r === "first" || r === "senior";
  return r === set;
}

// ---------------------------------------------------------------------------------------------
// Dates

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

/** Publication year: YEAR(pubDate), else articleYear (the rule STEP 3v2 uses). */
export function workYear(w: BiblioWork): number | null {
  const d = isoDate(w.pubDate);
  if (d) return Number(d.slice(0, 4));
  const y = num(w.articleYear);
  return y !== null && y > 0 ? y : null;
}

// ---------------------------------------------------------------------------------------------
// h-index

/** h-index of citation counts: the largest h with h values >= h. Non-positive and missing
 *  counts are ignored. */
export function hIndex(citations: Array<number | string | null | undefined>): number {
  const sorted = citations.map(num).filter((c): c is number => c !== null && c > 0).sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

export type HIndexes = { hindexNIH: number; h5indexNIH: number };

/**
 * NIH h and h5 over PubMed works of every type (iCite citation counts). v2 (Decision 6) leaves
 * out errata and retractions (pubTypeCounted = 0). `{ stepSix: true }` keeps them, which is
 * ReCiterDB STEP 6's rule for the stored v1 hindexNIH/h5indexNIH. External rows never count.
 * The h5 window is datePublicationAddedToEntrez > asOf - 5 years, asOf being the nightly run
 * date (YYYY-MM-DD).
 */
export function hIndexes(works: BiblioWork[], asOf: string, opts: { stepSix?: boolean } = {}): HIndexes {
  const cutoff = minusYears(asOf, 5);
  const pubmed = works.filter((w) => !isExternal(w) && (opts.stepSix || isCounted(w)));
  const recent = pubmed.filter((w) => {
    const d = str(w.datePublicationAddedToEntrez);
    return d !== "" && d > cutoff;
  });
  return {
    hindexNIH: hIndex(pubmed.map((w) => w.citationCountNIH)),
    h5indexNIH: hIndex(recent.map((w) => w.citationCountNIH)),
  };
}

// ---------------------------------------------------------------------------------------------
// Aggregates

/** Median in exact half-hundredths: returns 2 x the median in hundredths (an integer). */
export function medianX2(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? 2 * s[mid] : s[mid - 1] + s[mid];
}

/** Rated works by percentile desc, then RCR desc (NULL last), then pmid asc: the ROW_NUMBER()
 *  order STEP 5v2 uses to pick the top N. */
export function byInfluence(a: BiblioWork, b: BiblioWork): number {
  const d = (x: number | null, y: number | null) => (x === y ? 0 : x === null ? 1 : y === null ? -1 : y - x);
  return d(pctOf(a), pctOf(b)) || d(rcrOf(a), rcrOf(b)) || (num(a.pmid) ?? 0) - (num(b.pmid) ?? 0);
}

export const ratedInSet = (works: BiblioWork[], set: RoleSet): BiblioWork[] =>
  works.filter((w) => isRated(w) && inRoleSet(w, set)).sort(byInfluence);

export type TopN = {
  n: number;
  ratedCount: number;
  /** Exact average x 1000 (avgTop DECIMAL(6,3) as an integer); null below n rated. */
  avgThousandths: number | null;
  value: number | null;
  /** 1 decimal, half-up, or the reason. */
  text: string;
};

/** Mean of the N highest exact percentiles of rated research articles in the role set. */
export function topNAverage(works: BiblioWork[], set: RoleSet, n: number): TopN {
  const rated = ratedInSet(works, set);
  if (rated.length < n) return { n, ratedCount: rated.length, avgThousandths: null, value: null, text: REASONS.needsRated(n) };
  const sum = rated.slice(0, n).reduce((t, w) => t + (pctOf(w) ?? 0), 0);
  const avgThousandths = (sum * 10) / n; // exact for n in {5, 10}
  return { n, ratedCount: rated.length, avgThousandths, value: avgThousandths / 1000, text: fixed(Math.round(avgThousandths), 3, 1) };
}

/** Share rounded half-up to a whole percent from exact k/n. */
export const sharePercent = (k: number, n: number): number => Math.floor((200 * k + n) / (2 * n));

export type Shown<T> = { shown: true; value: T; text: string } | { shown: false; reason: string };

export type KeyFigures = {
  available: boolean;
  missingColumns: string[];
  counts: {
    counted: number;
    pubmed: number;
    external: number;
    research: number;
    rated: number;
    recent: number;
    /** Counted PubMed works with no analysis_nih row that are not recent (Methods "k PubMed
     *  works not yet in iCite"); null when hasPercentileNIH is absent. */
    notInICite: number | null;
  };
  publications: { total: number; firstYear: number | null; lastYear: number | null; research: number; text: string };
  researchByRole: Shown<Record<"first" | "senior" | "middle", number>>;
  typicalWork: Shown<{ medianX2: number; median: number; n: number }>;
  highlyInfluential: Shown<{ k: number; n: number; percent: number | null; maxPct: number }>;
  mostInfluentialWork: Shown<TopN>;
  hIndex: Shown<HIndexes>;
};

const yearSpan = (works: BiblioWork[]): [number | null, number | null] => {
  const ys = works.map(workYear).filter((y): y is number => y !== null);
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : [null, null];
};

/**
 * The key-figures rows with their minimums applied to unrounded values. `asOf` is the nightly
 * run date that wrote the flags (h5 window).
 */
export function keyFigures(works: BiblioWork[], asOf: string): KeyFigures {
  const missing = missingV2Columns(works);
  const counted = countedWorks(works);
  const pubmed = counted.filter((w) => !isExternal(w));
  const research = counted.filter(isResearchArticle);
  const rated = research.filter(isRated);
  const recent = counted.filter(isRecent);
  const hasICiteFlag = works.length > 0 && "hasPercentileNIH" in (works[0] as object);
  const notInICite = hasICiteFlag
    ? pubmed.filter((w) => (w.hasPercentileNIH === null || w.hasPercentileNIH === undefined) && !isRecent(w)).length
    : null;
  const [firstYear, lastYear] = yearSpan(counted);
  const span = firstYear === null ? "" : firstYear === lastYear ? ` (${firstYear})` : ` (${firstYear} to ${lastYear})`;
  const unavailable = { shown: false as const, reason: REASONS.v2Unavailable };
  const available = missing.length === 0;

  let researchByRole: KeyFigures["researchByRole"];
  if (!available) researchByRole = unavailable;
  else if (research.length === 0) researchByRole = { shown: false, reason: REASONS.noResearch };
  else {
    const c = { first: 0, senior: 0, middle: 0 };
    for (const w of research) { const r = roleOf(w); if (r !== "notSet") c[r]++; }
    researchByRole = { shown: true, value: c, text: `First ${c.first} · Senior ${c.senior} · Middle ${c.middle}` };
  }

  let typicalWork: KeyFigures["typicalWork"];
  const rcrs = rated.map(rcrOf).filter((v): v is number => v !== null);
  if (!available) typicalWork = unavailable;
  else if (rated.length < MIN_RATED_TYPICAL || rcrs.length === 0) typicalWork = { shown: false, reason: REASONS.needsRated(MIN_RATED_TYPICAL) };
  else {
    const m2 = medianX2(rcrs)!;
    // m2 is twice the median in hundredths; half-up to hundredths for display (0.995 -> "1.00").
    typicalWork = { shown: true, value: { medianX2: m2, median: m2 / 200, n: rcrs.length }, text: formatRcr(Math.floor((m2 + 1) / 2)) };
  }

  let highlyInfluential: KeyFigures["highlyInfluential"];
  if (!available) highlyInfluential = unavailable;
  else if (rated.length === 0) highlyInfluential = { shown: false, reason: REASONS.noRated };
  else {
    const k = rated.filter((w) => (pctOf(w) ?? 0) >= 9000).length;
    const n = rated.length;
    const maxPct = Math.max(...rated.map((w) => pctOf(w) ?? 0));
    const percent = n >= 20 ? sharePercent(k, n) : null;
    highlyInfluential = { shown: true, value: { k, n, percent, maxPct }, text: percent === null ? `${k} of ${n}` : `${percent}% (${k} of ${n})` };
  }

  let mostInfluentialWork: KeyFigures["mostInfluentialWork"];
  if (!available) mostInfluentialWork = unavailable;
  else {
    const t = topNAverage(works, "any", 5);
    mostInfluentialWork = t.avgThousandths === null ? { shown: false, reason: t.text } : { shown: true, value: t, text: t.text };
  }

  const h = pubmed.length === 0
    ? { shown: false as const, reason: REASONS.noPubmed }
    : (() => { const v = hIndexes(works, asOf); return { shown: true as const, value: v, text: `${v.hindexNIH} (h5 ${v.h5indexNIH})` }; })();

  return {
    available,
    missingColumns: missing,
    counts: { counted: counted.length, pubmed: pubmed.length, external: counted.length - pubmed.length, research: research.length, rated: rated.length, recent: recent.length, notInICite },
    publications: {
      total: counted.length, firstYear, lastYear, research: research.length,
      text: `${counted.length}${span}${available ? `, including ${research.length} PubMed research ${research.length === 1 ? "article" : "articles"}` : ""}`,
    },
    researchByRole,
    typicalWork,
    highlyInfluential,
    mostInfluentialWork,
    hIndex: h,
  };
}

// ---------------------------------------------------------------------------------------------
// Charts (data only; biblioCharts.ts draws them)

export type YearAxis = {
  /** Category labels, oldest first: "2013" or, binned, "1971–1974". */
  categories: string[];
  /** [first, last] year of each category. */
  ranges: Array<[number, number]>;
  binned: boolean;
};

export const MAX_UNBINNED_SPAN = 25;
export const BIN_YEARS = 5;

/**
 * Every year from the first to the last; when the span exceeds 25 years, 5-year bins aligned to
 * multiples of 5 and clipped to the data ("1971–1974", ..., "2025–2026").
 */
export function yearAxis(years: Array<number | null>): YearAxis {
  const ys = years.filter((y): y is number => typeof y === "number" && Number.isFinite(y));
  if (ys.length === 0) return { categories: [], ranges: [], binned: false };
  const first = Math.min(...ys);
  const last = Math.max(...ys);
  const ranges: Array<[number, number]> = [];
  const binned = last - first + 1 > MAX_UNBINNED_SPAN;
  if (!binned) for (let y = first; y <= last; y++) ranges.push([y, y]);
  else {
    for (let s = first - (((first % BIN_YEARS) + BIN_YEARS) % BIN_YEARS); s <= last; s += BIN_YEARS) {
      ranges.push([Math.max(s, first), Math.min(s + BIN_YEARS - 1, last)]);
    }
  }
  const categories = ranges.map(([a, b]) => (a === b ? String(a) : `${a}–${b}`));
  return { categories, ranges, binned };
}

export function yearIndex(axis: YearAxis, year: number | null): number {
  if (year === null) return -1;
  return axis.ranges.findIndex(([a, b]) => year >= a && year <= b);
}

export type AuthorshipChart = {
  axis: YearAxis;
  series: Array<{ key: "senior" | "first" | "middle"; label: string; values: number[] }>;
  totals: number[];
  /** Runs of empty categories, labeled "2015–2019" or "2023". */
  gaps: string[];
};

/** Research articles (rated or not) per year by role. Null when there are none. */
export function authorshipByYear(works: BiblioWork[]): AuthorshipChart | null {
  const research = countedWorks(works).filter(isResearchArticle);
  const dated = research.filter((w) => workYear(w) !== null);
  if (dated.length === 0) return null;
  const axis = yearAxis(dated.map(workYear));
  const keys = [{ key: "senior", label: "Senior" }, { key: "first", label: "First" }, { key: "middle", label: "Middle" }] as const;
  const series = keys.map((k) => ({ key: k.key, label: k.label, values: new Array(axis.categories.length).fill(0) as number[] }));
  const totals = new Array(axis.categories.length).fill(0) as number[];
  for (const w of dated) {
    const i = yearIndex(axis, workYear(w));
    const s = series.find((x) => x.key === roleOf(w));
    if (i < 0 || !s) continue;
    s.values[i]++;
    totals[i]++;
  }
  const gaps: string[] = [];
  for (let i = 0; i < totals.length; i++) {
    if (totals[i] !== 0) continue;
    let j = i;
    while (j + 1 < totals.length && totals[j + 1] === 0) j++;
    const a = axis.ranges[i][0];
    const b = axis.ranges[j][1];
    gaps.push(a === b ? String(a) : `${a}–${b}`);
    i = j;
  }
  return { axis, series, totals, gaps };
}

export const PERCENTILE_BIN_LABELS = ["0–10", "10–20", "20–30", "30–40", "40–50", "50–60", "60–70", "70–80", "80–90", "90–100"];

/** Rated research articles in 10 bins (90.00 and 100 go in the last). Shown from 20 rated. */
export function percentileBins(works: BiblioWork[]): Shown<{ labels: string[]; counts: number[]; total: number }> {
  const rated = countedWorks(works).filter(isRated);
  if (rated.length < MIN_RATED_DISTRIBUTION) return { shown: false, reason: REASONS.needsRated(MIN_RATED_DISTRIBUTION) };
  const counts = new Array(10).fill(0) as number[];
  for (const w of rated) counts[Math.max(0, Math.min(9, Math.floor((pctOf(w) ?? 0) / 1000)))]++;
  return { shown: true, value: { labels: PERCENTILE_BIN_LABELS, counts, total: rated.length }, text: `${rated.length} rated research articles` };
}

// ---------------------------------------------------------------------------------------------
// Sections

export type TypeTag =
  | "Research article" | "Review" | "Letter" | "Comment" | "Editorial" | "Preprint"
  | "Book chapter" | "Conference paper" | "Other";

const CANONICAL_TAG: Record<string, TypeTag> = {
  "review": "Review",
  "letter": "Letter",
  "comment": "Comment",
  "editorial article": "Editorial",
  "editorial": "Editorial",
  "preprint": "Preprint",
  "book chapter": "Book chapter",
  "book": "Book chapter",
  "conference paper": "Conference paper",
  "conference-paper": "Conference paper",
  "conference-abstract": "Conference paper",
};

/** Type tag from researchArticleV2, then publicationTypeCanonical (Comment keeps its own value
 *  there; pub_type_map's Comment -> Letter fold is not used). */
export function typeTag(w: BiblioWork): TypeTag {
  if (isResearchArticle(w)) return "Research article";
  return CANONICAL_TAG[str(w.publicationTypeCanonical).toLowerCase()] ?? "Other";
}

const isPreprint = (w: BiblioWork): boolean => str(w.publicationTypeCanonical).toLowerCase() === "preprint";

/** Title for matching: tags stripped, lowercased, letters and digits only, single spaces. */
export function normalizeTitle(t: unknown): string {
  return str(t).replace(/<[^>]*>/g, " ").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

/** Preprints (Decision 7) whose normalized title equals a counted non-preprint work's. */
export function supersededPreprints(works: BiblioWork[]): Set<BiblioWork> {
  const counted = countedWorks(works);
  const published = new Set(counted.filter((w) => !isPreprint(w)).map((w) => normalizeTitle(w.articleTitle)).filter(Boolean));
  return new Set(counted.filter((w) => isPreprint(w) && published.has(normalizeTitle(w.articleTitle))));
}

const VENUE_ALIASES: Array<[RegExp, string]> = [
  [/^biorxiv\b/i, "bioRxiv"],
  [/^medrxiv\b/i, "medRxiv"],
  [/^research square\b/i, "Research Square"],
  [/^ssrn\b/i, "SSRN"],
  [/^arxiv\b/i, "arXiv"],
];

/** Venue display name with preprint-server variants collapsed ("bioRxiv : the preprint server
 *  for biology" and "bioRxiv (Cold Spring Harbor Laboratory)" are both "bioRxiv"). */
export function venueName(w: BiblioWork): string {
  const t = str(w.journalTitleVerbose);
  for (const [re, name] of VENUE_ALIASES) if (re.test(t)) return name;
  return t;
}

/** Venue grouping key: ISSN where present, else the normalized name. */
export function venueKey(w: BiblioWork): string {
  const issn = str(w.issn).toUpperCase();
  if (/^\d{4}-?\d{3}[\dX]$/.test(issn)) return `issn:${issn.replace("-", "")}`;
  return `name:${venueName(w).toLowerCase()}`;
}

/** Why a work shows no percentile. Null when it is rated. */
export function unratedReason(w: BiblioWork): string | null {
  if (isRated(w)) return null;
  if (isRecent(w)) return REASONS.tooRecent;
  if (isExternal(w)) return REASONS.noPubmedRecord;
  if (!isResearchArticle(w)) return REASONS.notResearch;
  const y = workYear(w);
  if (y !== null && y < 1980) return REASONS.before1980;
  if (w.hasPercentileNIH === null) return REASONS.notInICite;
  return REASONS.noPercentile;
}

export type InfluentialRow = { work: BiblioWork; role: Role; marked: boolean };

/** Section 7: the 10 highest-rated research articles, then any of the 5 highest first- or
 *  senior-authored ones not already shown (marked), all by percentile then RCR. */
export function mostInfluential(works: BiblioWork[]): InfluentialRow[] {
  const top = ratedInSet(countedWorks(works), "any").slice(0, 10);
  const shown = new Set(top);
  const extra = ratedInSet(countedWorks(works), "first_or_senior").slice(0, 5).filter((w) => !shown.has(w));
  return [...top.map((w) => ({ work: w, marked: false })), ...extra.map((w) => ({ work: w, marked: true }))]
    .sort((a, b) => byInfluence(a.work, b.work))
    .map((r) => ({ ...r, role: roleOf(r.work) }));
}

const byCitations = (a: BiblioWork, b: BiblioWork): number =>
  citesOf(b) - citesOf(a) || (workYear(b) ?? 0) - (workYear(a) ?? 0) || (num(b.pmid) ?? 0) - (num(a.pmid) ?? 0);

export type ListedRow = { work: BiblioWork; role: Role; tag: TypeTag };
const listed = (w: BiblioWork): ListedRow => ({ work: w, role: roleOf(w), tag: typeTag(w) });

/** Section 8: up to 5 PubMed works that are not research articles, by citations. */
export function reviewsAndOther(works: BiblioWork[], n = 5): ListedRow[] {
  return countedWorks(works).filter((w) => !isExternal(w) && !isResearchArticle(w)).sort(byCitations).slice(0, n).map(listed);
}

const ROLE_ORDER: Record<Role, number> = { senior: 0, first: 1, middle: 2, notSet: 3 };

/** Section 9: up to 10 recent works of any type and source, preprints with an accepted
 *  published version left out; senior, first, middle (then not set), newest first. */
export function recentWorks(works: BiblioWork[], n = 10): ListedRow[] {
  const superseded = supersededPreprints(works);
  return countedWorks(works)
    .filter((w) => isRecent(w) && !superseded.has(w))
    .sort((a, b) => ROLE_ORDER[roleOf(a)] - ROLE_ORDER[roleOf(b)]
      || isoDate(b.pubDate).localeCompare(isoDate(a.pubDate))
      || (workYear(b) ?? 0) - (workYear(a) ?? 0)
      || (num(b.pmid) ?? 0) - (num(a.pmid) ?? 0))
    .slice(0, n)
    .map(listed);
}

/** Section 10: up to 5 PubMed works published before 1980, by citations, highest first. */
export function olderWorks(works: BiblioWork[], n = 5): ListedRow[] {
  return countedWorks(works).filter((w) => !isExternal(w) && (workYear(w) ?? 9999) < 1980).sort(byCitations).slice(0, n).map(listed);
}

/** Recent research articles in a role set (the Senior row's "(k too recent to rate)"). */
export function recentResearchInSet(works: BiblioWork[], set: RoleSet): BiblioWork[] {
  return countedWorks(works).filter((w) => isResearchArticle(w) && isRecent(w) && inRoleSet(w, set));
}

// ---------------------------------------------------------------------------------------------
// Peer comparison

export type PeerCellRow = {
  personIdentifier?: string;
  facultyRank?: string | null;
  cohortEligible?: Flag;
  roleSet: string;
  topN: number | string;
  ratedCount?: number | string | null;
  recentCount?: number | string | null;
  avgTop?: number | string | null;
  cohortRank?: number | string | null;
  cohortM?: number | string | null;
  runDate?: string | Date | null;
  iciteLoadedAt?: string | Date | null;
};

/** ceiling(100 R / M), exact. */
export const topPercent = (rank: number, m: number): number => Math.floor((100 * rank + m - 1) / m);

export type PeerCell = {
  topN: number;
  average: TopN;
  /** Stored avgTop x 1000, for the parity check. */
  storedThousandths: number | null;
  /** True when a stored cell exists and its average differs from the recomputed one, NULL on
   *  one side included (the controller logs it; parity must be 0). */
  mismatch: boolean;
  rank: { R: number; M: number; X: number; text: string } | null;
  rankText: string;
};

export type PeerRow = {
  roleSet: RoleSet;
  label: string;
  ratedCount: number;
  recentCount: number;
  /** "12" or, with recent research articles, "0 (2 too recent to rate)" (Senior only). */
  ratedText: string;
  cells: PeerCell[];
};

export type PeerTable =
  | { eligible: false; facultyRank: string | null }
  | { eligible: true; facultyRank: string | null; runDate: string; rows: PeerRow[]; cellsAvailable: boolean };

/**
 * The peer table for a subject. `cells` are the subject's analysis_summary_person_peer rows
 * (empty when the table is absent or the person has no rated article). `eligible` overrides
 * cohortEligible when the caller knows it from elsewhere (needed for a person with no row).
 * Averages are recomputed from the works (same function as the stored cell); ranks come only
 * from the stored snapshot.
 */
export function peerTable(works: BiblioWork[], cells: PeerCellRow[], opts: { eligible?: boolean | null } = {}): PeerTable {
  const stored = new Map(cells.map((c) => [`${c.roleSet}:${num(c.topN)}`, c]));
  const facultyRank = str(cells[0]?.facultyRank) || null;
  const eligible = opts.eligible ?? (cells.length ? flag(cells[0].cohortEligible) : false);
  if (!eligible) return { eligible: false, facultyRank };
  const runDate = isoDate(cells[0]?.runDate);
  const v2 = missingV2Columns(works).length === 0;
  const rows: PeerRow[] = ROLE_SETS.map((rs) => {
    const ratedCount = ratedInSet(countedWorks(works), rs.key).length;
    const recentCount = recentResearchInSet(works, rs.key).length;
    const ratedText = rs.key === "senior" && recentCount > 0 ? `${ratedCount} (${recentCount} too recent to rate)` : String(ratedCount);
    const out = RANKED_MIN_N.map((n): PeerCell => {
      const average = v2 ? topNAverage(works, rs.key, n) : { n, ratedCount, avgThousandths: null, value: null, text: REASONS.v2Unavailable };
      const c = stored.get(`${rs.key}:${n}`);
      const storedThousandths = c ? thousandths(c.avgTop) : null;
      // A stored cell disagrees when its average differs, or when one side has an average and the
      // other does not (the cell's rank then belongs to a different selection, so it is not shown).
      const mismatch = v2 && c !== undefined && storedThousandths !== average.avgThousandths;
      let rank: PeerCell["rank"] = null;
      let rankText: string;
      if (average.avgThousandths === null) rankText = average.text;
      else if (!c || storedThousandths === null) rankText = REASONS.peerUnavailable;
      else {
        const R = num(c.cohortRank);
        const M = num(c.cohortM);
        if (R === null || M === null || M < MIN_COHORT) rankText = REASONS.cohortTooSmall;
        else {
          const X = topPercent(R, M);
          rank = { R, M, X, text: `#${R} of ${M} (top ${X}%)` };
          rankText = rank.text;
        }
      }
      return { topN: n, average, storedThousandths, mismatch, rank, rankText };
    });
    return { roleSet: rs.key, label: rs.label, ratedCount, recentCount, ratedText, cells: out };
  });
  return { eligible: true, facultyRank, runDate, rows, cellsAvailable: cells.length > 0 };
}

/** Header note when the person's current rank differs from the rank stored with the cells. */
export function rankNote(storedRank: string | null | undefined, currentRank: string | null | undefined, runDate: string): string | null {
  const s = str(storedRank);
  const c = str(currentRank);
  if (!s || s.toLowerCase() === c.toLowerCase()) return null;
  return `Ranked as ${s}, the rank held at the ${runDate} nightly run.`;
}

/** Display surname from faculty data (person.lastName), never parsed from an author string. */
export function displaySurname(person: { lastName?: string | null } | null | undefined): string {
  return str(person?.lastName).replace(/\s+/g, " ");
}
