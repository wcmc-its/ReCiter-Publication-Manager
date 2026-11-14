// Pure helpers for one /authorships table row: the IO badge, the role line, the article meta
// line, the affiliation highlight and the shortcuts line under the table. Kept out of
// AuthorshipsTabs.tsx so they can be unit-tested without a browser (tests/authorshipRow.test.mjs).

export type IoBand = "High" | "Medium" | "Low";

// The page's own IO bands (>= 90 High, >= 50 Medium, else Low): the same cut points as the
// bulk-assign picker's band counts and the expanded row's candidate scores, so the badge does
// not re-grade the queue against a different scale.
export const ioBand = (v?: number | null): IoBand | null =>
  v == null || Number.isNaN(v) ? null : v >= 90 ? "High" : v >= 50 ? "Medium" : "Low";

// The badge shows a whole number. Floor, not round, so the number never lands in a higher band
// than its colour (89.6 reads "89" in Medium, not "90" in Medium), and 99.8 is not shown as a
// certain 100.
export const ioBadgeText = (v?: number | null): string => (v == null || Number.isNaN(v) ? "—" : String(Math.floor(v)));

export type IoBadgeTone = "slate" | "amber" | "red" | "muted";

// What the IO column shows for a row. A multi-candidate row shows its best candidate's score in
// amber, because nobody is accepted until one is picked. A row with no candidate, or with a
// candidate but no IO score (never retrieved by ReCiter, or a Scopus / OpenAlex row), shows "—".
export const ioBadge = (r: {
  top_cwid?: string | null; top_io_score?: number | null; single_candidate?: boolean; n_candidates?: number;
}): { text: string; tone: IoBadgeTone; band: IoBand | null } => {
  if (!r.top_cwid || r.top_io_score == null) return { text: "—", tone: "muted", band: null };
  const band = ioBand(r.top_io_score);
  if (!r.single_candidate) return { text: ioBadgeText(r.top_io_score), tone: "amber", band };
  return { text: ioBadgeText(r.top_io_score), tone: band === "High" ? "slate" : band === "Medium" ? "amber" : "red", band };
};

// Institution on the role line, shortened the way the prototype writes it ("WCM").
export const shortInstitution = (inst?: string | null): string => {
  const s = (inst || "").trim();
  if (!s) return "";
  if (/^weill[ -]cornell(\s+(medicine|medical college|medical cent(er|re)))?$/i.test(s)) return "WCM";
  if (/^weill cornell medicine[ -]+qatar$/i.test(s)) return "WCM-Q";
  if (/^cornell university$/i.test(s)) return "Cornell";
  if (/^new ?york[ -]presbyterian( hospital)?$/i.test(s)) return "NYP";
  return s;
};

// "Type · Dept · Inst", skipping whatever is missing.
export const roleLine = (type?: string | null, dept?: string | null, inst?: string | null): string =>
  [type, dept, shortInstitution(inst)].map((x) => (x || "").trim()).filter(Boolean).join(" · ");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2025-10-13" (or a full ISO timestamp) → "2025 Oct 13", the prototype's date form. Anything
// that isn't an ISO date comes back unchanged; a year-month date drops the day.
export const formatRowDate = (iso?: string | null): string => {
  const s = (iso || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return s;
  const mon = MONTHS[Number(m[2]) - 1];
  if (!mon) return s;
  return m[3] ? `${m[1]} ${mon} ${Number(m[3])}` : `${m[1]} ${mon}`;
};

// Split an affiliation around its first match of `re`, for a bold institution inside an
// ellipsized single line. No match → the whole string in `pre`.
export const splitAffiliation = (text: string, re: RegExp): { pre: string; hit: string; post: string } => {
  const m = text.match(re);
  if (!m || m.index === undefined) return { pre: text, hit: "", post: "" };
  return { pre: text.slice(0, m.index), hit: m[0], post: text.slice(m.index + m[0].length) };
};

// The source badge before the affiliation.
export const sourceBadgeText = (source?: string | null): string =>
  source === "scopus" ? "Scopus · not in PubMed" : source === "openalex" ? "OpenAlex · not in PubMed" : "PubMed";

// The muted line at the foot of the table. Accept, reject, snooze and selecting rows only work
// in the Open queue, so the parked queues list just moving, undo and the legend.
export const shortcutsLine = (openQueue: boolean): string[] => (openQueue
  ? ["J/K move", "Y accept", "N reject", "S snooze", "X select", "U undo", "? all shortcuts"]
  : ["J/K move", "U undo", "? all shortcuts"]);
