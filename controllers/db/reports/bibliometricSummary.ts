// Bibliometric report v2 (5h): the "Summary for reviewers" section, templates S1-S7.
// Pure. It imports types only (erased at runtime), so `npm test` loads it directly; the numbers it
// words come from bibliometrics.ts (keyFigures, peerTable, ratedAtHighest, recentSeniorYears).
//
// Writing rules (spec "Summary for reviewers"):
// - The person is named by surname (person.lastName via displaySurname); no pronouns for people.
// - No evaluative adjectives. Every judgment is a comparison with a stated reference point.
// - Numbers are digits, except at the start of a sentence and in multiples ("twice",
//   "three times"), where they are spelled out.
// - Paragraph 1: S1 or S6. Paragraph 2: S2 and S3. Paragraph 3: S4 and S5. S7 last.
// - Phrase-table thresholds are applied to exact, unrounded values (integer arithmetic).
// - A sentence appears only when its condition holds.

import type { KeyFigures, NearMissWork, PeerCell, PeerTable, Role, RoleSet } from "./bibliometrics";

export type TemplateId = "S1" | "S2a" | "S2b" | "S2c" | "S2d" | "S3" | "S4" | "S5" | "S6" | "S7";

/** A piece of a sentence; italic for journal names. */
export type Run = { text: string; italic?: boolean };

export type Sentence = { id: TemplateId; runs: Run[]; text: string };

export type Summary = {
  /** False when the v3.11 flags are missing; no sentence is written then. */
  available: boolean;
  /** Template ids in output order, each once. */
  fired: TemplateId[];
  paragraphs: Sentence[][];
};

export type SummaryInput = {
  /** Display surname from faculty data (displaySurname(person)). */
  surname: string;
  key: KeyFigures;
  peer: PeerTable;
  /** ratedAtHighest(works): rated research articles at the highest percentile, best first. */
  atHighest: NearMissWork[];
  /** recentSeniorYears(works): years of recent senior-authored research articles. */
  recentSeniorYears: number[];
};

export const MIN_FIRST_OR_SENIOR = 5;
export const NEAR_MISS_PCT = 8500; // 85.00 in hundredths
export const HIGH_PCT = 9000; // 90.00
export const TOP_PERCENT_MAX = 50;

/** S3 headline cell: the first rankable cell in this order. */
export const HEADLINE_ORDER: Array<[RoleSet, number]> = [
  ["first_or_senior", 10],
  ["first_or_senior", 5],
  ["any", 10],
  ["any", 5],
];

/** S3 role phrase; Any position has none ("rated research articles"). */
export const ROLE_SET_PHRASE: Record<RoleSet, string> = {
  any: "",
  first_or_senior: "first- or senior-authored",
  first: "first-authored",
  senior: "senior-authored",
};

const ROLE_ADJECTIVE: Record<Role, string> = {
  first: "first-authored",
  senior: "senior-authored",
  middle: "middle-authored",
  notSet: "",
};

// ---------------------------------------------------------------------------------------------
// Words

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** Cardinal in words for 0 to 9999 ("twenty-eight", "one hundred five"); digits beyond. */
export function numberWord(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${numberWord(n % 100)}` : ""}`;
  return `${ONES[Math.floor(n / 1000)]} thousand${n % 1000 ? ` ${numberWord(n % 1000)}` : ""}`;
}

const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "Two" at the start of a sentence (spelled out, capitalized). */
export const startNumber = (n: number): string => cap(numberWord(n));

/** "twice" for 2, else "three times", "ten times". */
export const times = (x: number): string => (x === 2 ? "twice" : `${numberWord(x)} times`);

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** Surname possessive: "Gouzy's", "van der Berg's", "Jones's". */
export const possessive = (surname: string): string => `${surname}'s`;

/** "2024", "2024 and 2025", "2022, 2024 and 2025". */
export function listYears(years: number[]): string {
  const ys = [...new Set(years)].sort((a, b) => a - b).map(String);
  if (ys.length <= 1) return ys.join("");
  return `${ys.slice(0, -1).join(", ")} and ${ys[ys.length - 1]}`;
}

const RANK_PLURAL: Record<string, string> = {
  "full professor": "full professors",
  "fullprofessor": "full professors",
  "professor": "full professors",
  "associate professor": "associate professors",
  "associate": "associate professors",
  "assistant professor": "assistant professors",
  "assistant": "assistant professors",
  "instructor or lecturer": "instructors and lecturers",
  "instructor": "instructors",
  "lecturer": "lecturers",
};

/** The stored facultyRank as a plural noun phrase ("Assistant Professor" -> "assistant
 *  professors"); an unknown rank reads "faculty at the rank of {rank}". */
export function rankPlural(rank: string | null | undefined): string {
  const r = (rank ?? "").trim();
  const k = r.toLowerCase().replace(/^academic-faculty-/, "");
  if (RANK_PLURAL[k]) return RANK_PLURAL[k];
  return r ? `faculty at the rank of ${r}` : "faculty at the same rank";
}

// ---------------------------------------------------------------------------------------------
// Phrase tables (exact)

/** Ratio phrase from the median RCR m, given as medianX2 (2 x m in hundredths, an integer). */
export function ratioPhrase(medianX2: number): string {
  if (medianX2 < 160) return "less often than"; // m < 0.8
  if (medianX2 < 250) return "about as often as"; // m < 1.25
  if (medianX2 < 350) return "about 1.5 times as often as"; // m < 1.75
  if (medianX2 < 500) return "about twice as often as"; // m < 2.5
  const x = Math.floor((medianX2 + 100) / 200); // round(m), half-up
  return `about ${times(x)} as often as`;
}

/** Multiple phrase from the unrounded share P = 100k/n, with r = P / 10 = 10k/n. */
export function multiplePhrase(k: number, n: number): string {
  if (50 * k < 4 * n) return "below"; // r < 0.8
  if (8 * k < n) return "in line with"; // r < 1.25
  if (40 * k < 7 * n) return "about 1.5 times"; // r < 1.75
  const x = Math.floor((20 * k + n) / (2 * n)); // round(r), half-up
  const r10 = 10 * k; // r = r10 / n
  const word = times(x);
  if (r10 < x * n) return `nearly ${word}`;
  if (r10 === x * n) return `about ${word}`;
  return `more than ${word}`;
}

/** Percentile in hundredths with 1 decimal, half-up ("89.6"). Below the 90th it never prints
 *  "90.0": 89.96 prints "89.96". */
export function pctWords(h: number): string {
  const t = Math.floor((2 * h + 10) / 20);
  const one = `${Math.floor(t / 10)}.${t % 10}`;
  if (h < HIGH_PCT && t >= HIGH_PCT / 10) return `${Math.floor(h / 100)}.${String(h % 100).padStart(2, "0")}`;
  return one;
}

/** The first rankable cell in HEADLINE_ORDER: a stored rank with M >= 20 that agrees with the
 *  recomputed average. Null when there is none (or the subject is not eligible). */
export function headlineCell(peer: PeerTable): { roleSet: RoleSet; cell: PeerCell } | null {
  if (!peer.eligible) return null;
  for (const [rs, n] of HEADLINE_ORDER) {
    const cell = peer.rows.find((r) => r.roleSet === rs)?.cells.find((c) => c.topN === n);
    if (cell && cell.rank && !cell.mismatch) return { roleSet: rs, cell };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Templates

const sentence = (id: TemplateId, ...parts: Array<string | Run>): Sentence => {
  const runs = parts.map((p) => (typeof p === "string" ? { text: p } : p)).filter((r) => r.text !== "");
  return { id, runs, text: runs.map((r) => r.text).join("") };
};

const venueRuns = (w: NearMissWork): Array<string | Run> => {
  const parts: Array<string | Run> = [];
  if (w.venue) parts.push("in ", { text: w.venue, italic: true });
  if (w.year !== null) parts.push(`${w.venue ? " " : ""}(${w.year})`);
  return parts;
};

const withArticle = (adj: string, noun: string): string => (adj ? `a ${adj} ${noun}` : `an ${noun}`);

function s2c(s: string, maxPct: number, at: NearMissWork[]): Sentence[] {
  const pct = pctWords(maxPct);
  const first = sentence("S2c", `${possessive(s)} most influential work sits just below the 90th NIH percentile.`);
  const shown = at.slice(0, 2);
  const one = (w: NearMissWork): Array<string | Run> => {
    const v = venueRuns(w);
    return [withArticle(ROLE_ADJECTIVE[w.role], "article"), ...(v.length ? [" ", ...v] : [])];
  };
  let second: Sentence;
  if (at.length === 1) {
    const v = venueRuns(at[0]);
    second = sentence("S2c", cap(withArticle(ROLE_ADJECTIVE[at[0].role], "article")), ...(at[0].venue ? [", ", ...v, ","] : v.length ? [" ", ...v] : []), ` is at the ${pct}th.`);
  } else if (at.length === 2 && ROLE_ADJECTIVE[shown[0].role] === ROLE_ADJECTIVE[shown[1].role]) {
    const adj = ROLE_ADJECTIVE[shown[0].role];
    const [a, b] = shown.map(venueRuns);
    // "in A (2014) and B (2021)": one "in" for both venues.
    const list = shown[0].venue && shown[1].venue ? [", ", ...a, " and ", ...b.slice(1), ","] : [];
    second = sentence("S2c", `Two ${adj ? `${adj} ` : ""}articles`, ...list, ` are both at the ${pct}th.`);
  } else if (at.length === 2) {
    const [a, b] = shown.map(one);
    second = sentence("S2c", cap(a[0] as string), ...a.slice(1), " and ", ...b, ` are both at the ${pct}th.`);
  } else {
    const [a, b] = shown.map(one);
    second = sentence("S2c", `${startNumber(at.length)} rated research articles are at the ${pct}th, among them `, ...a, " and ", ...b, ".");
  }
  return [first, second];
}

/**
 * The summary paragraphs. Each sentence carries its template id, plain text and runs (journal
 * names italic). Conditions follow the spec's template table; `peer.eligible` is the faculty test.
 */
export function buildSummary(input: SummaryInput): Summary {
  const { key, peer } = input;
  // s mid-sentence, S at the start of a sentence ("van der Berg" -> "Van der Berg").
  const s = input.surname.trim() || "this researcher";
  const S = cap(s);
  if (!key.available) return { available: false, fired: [], paragraphs: [] };

  // Paragraph 1: S1 or S6.
  const p1: Sentence[] = [];
  const rated = key.counts.rated;
  if (key.typicalWork.shown) {
    const { medianX2, n } = key.typicalWork.value;
    p1.push(sentence("S1",
      `${possessive(S)} typical research article is cited ${ratioPhrase(medianX2)} a typical NIH R01-funded paper of the same field and year. `
      + `Across ${n} rated research articles, the median Relative Citation Ratio is ${key.typicalWork.text}.`));
  } else {
    p1.push(sentence("S6", rated === 0
      ? `${S} has no rated research articles, too few for the measures in this report.`
      : `${S} has ${rated} rated research ${plural(rated, "article", "articles")}, too few for the measures in this report. `
        + `${plural(rated, "It is", "They are")} listed below.`));
  }

  // Paragraph 2: S2 (one of a-d) and S3.
  const p2: Sentence[] = [];
  if (key.highlyInfluential.shown) {
    const { k, n, percent, maxPct } = key.highlyInfluential.value;
    if (k >= 1 && n >= 20 && percent !== null) {
      p2.push(sentence("S2a",
        `${startNumber(percent)} percent of ${possessive(s)} ${n} rated research articles are at or above the 90th NIH percentile, `
        + `${multiplePhrase(k, n)} the 10% expected.`));
    } else if (k >= 1) {
      p2.push(sentence("S2b", n === 1
        ? `${possessive(S)} 1 rated research article is at or above the 90th NIH percentile.`
        : `${startNumber(k)} of ${possessive(s)} ${n} rated research articles ${plural(k, "is", "are")} at or above the 90th NIH percentile.`));
    } else if (maxPct >= NEAR_MISS_PCT && input.atHighest.length > 0) {
      p2.push(...s2c(S, maxPct, input.atHighest));
    } else {
      p2.push(sentence("S2d", n === 1
        ? `${possessive(S)} 1 rated research article is below the 90th NIH percentile, at the ${pctWords(maxPct)}th.`
        : `None of ${possessive(s)} ${n} rated research articles reaches the 90th NIH percentile; the highest is at the ${pctWords(maxPct)}th.`));
    }
  }
  const head = headlineCell(peer);
  if (head && head.cell.rank) {
    const { R, M, X } = head.cell.rank;
    const N = head.cell.topN;
    const phrase = ROLE_SET_PHRASE[head.roleSet];
    p2.push(sentence("S3",
      `Among ${M} WCM ${rankPlural(peer.eligible ? peer.facultyRank : null)} with ${N} or more rated ${phrase ? `${phrase} ` : ""}research articles, `
      + `${possessive(s)} ${N} most influential rank #${R}${X <= TOP_PERCENT_MAX ? `, in the top ${X}%` : ""}.`));
  }

  // Paragraph 3: S4 and S5 (faculty only).
  const p3: Sentence[] = [];
  if (peer.eligible) {
    const ratedIn = (rs: RoleSet): number => peer.rows.find((r) => r.roleSet === rs)?.ratedCount ?? 0;
    const f = ratedIn("first");
    const sr = ratedIn("senior");
    if (ratedIn("first_or_senior") < MIN_FIRST_OR_SENIOR) {
      const parts = [f > 0 ? `first author on ${f}` : "", sr > 0 ? `senior author on ${sr}` : ""].filter(Boolean);
      const last = sr > 0 ? sr : f;
      p3.push(sentence("S4", parts.length
        ? `${S} is ${parts.join(" and ")} rated research ${plural(last, "article", "articles")}.`
        : `${S} is not first or senior author on any rated research article.`));
      p3.push(sentence("S4", `With fewer than ${MIN_FIRST_OR_SENIOR} rated first- or senior-authored articles, rankings by author role are not shown yet.`));
      const years = input.recentSeniorYears;
      if (years.length > 0) {
        const k = years.length;
        p3.push(sentence("S5",
          `${S} is senior author on ${k} research ${plural(k, "article", "articles")} from ${listYears(years)}, `
          + `which ${plural(k, "is", "are")} too recent to rate.`));
      }
    }
  }

  // Last: S7.
  const p4: Sentence[] = peer.eligible
    ? []
    : [sentence("S7", "Peer comparison covers WCM-employed full-time faculty with a faculty rank, so it is not shown.")];

  const paragraphs = [p1, p2, p3, p4].filter((p) => p.length > 0);
  const fired = paragraphs.flat().map((x) => x.id).filter((id, i, a) => a.indexOf(id) === i);
  return { available: true, fired, paragraphs };
}

/** Plain text: sentences joined by a space, paragraphs by a blank line. */
export function summaryText(summary: Summary): string {
  return summary.paragraphs.map((p) => p.map((x) => x.text).join(" ")).join("\n\n");
}
