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

export type VenueFitBand = "good" | "poor";

// The venue-fit pill on a row, from authorship_review.top_venue_fit: ln(the proposed person's
// department's share of its accepted papers in the venue's subfield / the campus-wide share).
// >= 1 is a good fit, < -1 a poor one; in between, and when the producer has no value, no pill.
// The "Initials + venue fit" lane's SQL (precisionWhere in controllers/db/authorshipQueueSql.ts)
// uses the same >= 1.
export const venueFitBand = (fit?: number | null): VenueFitBand | null =>
  fit == null || Number.isNaN(fit) ? null : fit >= 1 ? "good" : fit < -1 ? "poor" : null;

// The tooltip on a row's "ORCID match" pill (authorship_review.top_orcid_match = 1): the byline
// author's ORCID is on file for the proposed person. Names the ORCID when the row carries it.
// `source` is the candidate's orcid_source (ReCiterDB #283): where that iD on file comes from.
// Rows ranked before it existed carry none, and the tooltip reads as it always did.
const ORCID_SOURCE_TEXT: Record<string, string> = {
  scholars: "confirmed in Scholars",
  affiliation_manager: "from the Cornell library's list",
  inferred: "inferred from accepted publications",
};
export const orcidMatchTip = (orcid?: string | null, source?: string | null): string => {
  const o = (orcid || "").trim();
  const base = o ? `The byline ORCID ${o} is on file for this person` : "The byline ORCID is on file for this person";
  const from = ORCID_SOURCE_TEXT[source || ""];
  return typeof from === "string" ? `${base} (${from})` : base;   // typeof: "constructor" is a key of every object
};

// The top pick's own entry in candidate_cwids_json (the first one). null when the JSON is
// absent, malformed or holds no such entry.
const topCandidate = (json?: string | null): { campus?: unknown; orcid_source?: unknown } | null => {
  try {
    const parsed = JSON.parse(json || "");
    return Array.isArray(parsed) && parsed[0] && typeof parsed[0] === "object" ? parsed[0] : null;
  } catch {
    return null;
  }
};

// The top pick's orcid_source, for the row's "ORCID match" pill.
export const topOrcidSource = (json?: string | null): string | undefined => {
  const s = topCandidate(json)?.orcid_source;
  return typeof s === "string" ? s : undefined;
};

// Bulk selection inside the "ORCID match" lane (owner decision, 2026-11-18). A Cornell Ithaca
// top pick is selectable as before, unless its iD is only inferred: since ReCiterDB routes the
// inferred list to the Ithaca roster too (2026-11-23), an inferred iD is reviewed one row at a
// time on either campus. A WCM top pick is selectable only when its iD is confirmed in
// Scholars: an inferred iD, or a row with no orcid_source, is reviewed one row at a time.
// Ithaca = the top candidate's campus is "cornell-ithaca", the only value the producer writes
// (ReCiterDB identity_index.py CAMPUS_ITHACA; a WCM candidate carries no campus key). Candidates
// written before `campus` existed have none and are Ithaca when top_person_type starts with
// "Cornell". This narrows the lane's
// bulk paths only, never a single-row action and never another lane. The server's copy of the
// same rule is orcidLaneBulkWhere (controllers/db/authorshipQueueSql.ts).
export const orcidLaneBulkOk = (row: { top_person_type?: string | null; candidate_cwids_json?: string | null }): boolean => {
  const top = topCandidate(row.candidate_cwids_json);
  const ithaca = top?.campus != null ? top.campus === "cornell-ithaca" : (row.top_person_type || "").startsWith("Cornell");
  return (ithaca && top?.orcid_source !== "inferred") || top?.orcid_source === "scholars";
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

// The muted line at the foot of the table. Accept, reject and snooze only work in the Open
// queue. Selecting works there and in Snoozed / Dismissed (for bulk Reopen), not in the two
// review queues.
export const shortcutsLine = (openQueue: boolean, canSelect = openQueue): string[] => (openQueue
  ? ["J/K move", "Y accept", "N reject", "S snooze", "X select", "U undo", "? all shortcuts"]
  : ["J/K move", ...(canSelect ? ["X select"] : []), "U undo", "? all shortcuts"]);

// The muted note above a parked row's Reopen: "Snoozed until 2027 Jan 28" / "Dismissed".
export const parkedNote = (statusView: string, snoozeUntil?: string | null): string =>
  statusView === "dismissed" ? "Dismissed"
    : statusView === "snoozed" ? (snoozeUntil ? `Snoozed until ${formatRowDate(snoozeUntil)}` : "Snoozed")
      : "";

// ---- expanded row (UI refresh PR 4) --------------------------------------------------------

// "99 · High": the Identity-Only Score with its band, as the evidence table's IO row and the
// hover card's IO pill say it. Floored like the badge, so the two never disagree.
export const ioScoreText = (v?: number | null): string => {
  const band = ioBand(v);
  return band ? `${ioBadgeText(v)} · ${band}` : "—";
};

// The footer's Authorship Score line. PubMed rows carry production's score; Scopus and OpenAlex
// rows were never scored by production, and a PubMed row whose person production never
// retrieved has none either.
export const fgLine = (fg?: number | null, source?: string | null): string => {
  if (source === "scopus" || source === "openalex") return `None · ${source === "scopus" ? "Scopus" : "OpenAlex"} rows are not scored by production`;
  if (fg == null || Number.isNaN(fg)) return "None · production never scored this person";
  return `${Math.floor(fg)} · ${fg >= 30 ? "at or above" : "below"} the 30 cut`;
};

// The byline with this row's author pulled out for highlighting. A long author list is elided
// around the target so the line stays a line: the first `edge` names, the target with one
// neighbour each side, and the last name. `target` < 0 (author not found) → no highlight.
export const bylineParts = (authors: string[], target: number, max = 12, edge = 3): { pre: string; tgt: string; post: string } => {
  const list = authors.filter(Boolean);
  if (!list.length) return { pre: "", tgt: "", post: "" };
  const t = target >= 0 && target < list.length ? target : -1;
  const keep = new Set<number>();
  if (list.length <= max) list.forEach((_, i) => keep.add(i));
  else {
    for (let i = 0; i < Math.min(edge, list.length); i++) keep.add(i);
    keep.add(list.length - 1);
    if (t >= 0) [t - 1, t, t + 1].forEach((i) => { if (i >= 0 && i < list.length) keep.add(i); });
  }
  // Join the kept names, writing "…" once for each run of dropped ones.
  const join = (from: number, to: number) => {
    const out: string[] = [];
    let gap = false;
    for (let i = from; i < to; i++) {
      if (keep.has(i)) { if (gap) out.push("…"); out.push(list[i]); gap = false; } else gap = true;
    }
    if (gap) out.push("…");
    return out;
  };
  if (t < 0) return { pre: join(0, list.length).join(", "), tgt: "", post: "" };
  const before = join(0, t), after = join(t + 1, list.length);
  return {
    pre: before.length ? `${before.join(", ")}, ` : "",
    tgt: list[t],
    post: after.length ? `, ${after.join(", ")}` : "",
  };
};

export interface RankableCandidate {
  cwid: string; confidence?: number | null; orcid_match?: boolean;
  already_rejected?: boolean; retired_cwid?: boolean;
}

// The order candidates are listed in on a multi-candidate row: the person the byline ORCID
// belongs to first, then the matcher's confidence, highest first, with no confidence last. Ties
// keep the order the row came in (the producer's). Candidates who already rejected this paper go
// last, and retired CWIDs are left out (the row says why separately).
export const rankCandidates = <C extends RankableCandidate>(cands: C[]): C[] => {
  const live = cands.filter((c) => !c.retired_cwid);
  const conf = (c: C) => (c.confidence == null || Number.isNaN(c.confidence) ? -1 : c.confidence);
  const order = (a: C, b: C) => Number(!!b.orcid_match) - Number(!!a.orcid_match) || conf(b) - conf(a);
  return [
    ...live.filter((c) => !c.already_rejected).sort(order),
    ...live.filter((c) => c.already_rejected).sort(order),
  ];
};

// The three-level match confidence shown on each candidate of a multi-candidate row, from the
// producer's 0..1 number. Nothing when the row has none (rows written before it was stored).
export const CONFIDENCE_HIGH = 0.5;
export const CONFIDENCE_MEDIUM = 0.25;
export type ConfidenceLevel = "High" | "Medium" | "Low";
export const confidenceLevel = (c?: number | null): ConfidenceLevel | null =>
  c == null || Number.isNaN(c) ? null : c >= CONFIDENCE_HIGH ? "High" : c >= CONFIDENCE_MEDIUM ? "Medium" : "Low";
// Its tooltip: "Match confidence 62%".
export const confidenceTip = (c?: number | null): string =>
  confidenceLevel(c) ? `Match confidence ${Math.round(Math.min(1, Math.max(0, c as number)) * 100)}%` : "";

// A click that assigns must be a deliberate single click: not the second click of a double-click
// (the row it removed lets the next row slide under the cursor) and not the mouseup that ends a
// text selection (copying a name or CWID). `detail` is the event's click count.
export const isDeliberateClick = (detail: number, selectedText: string): boolean =>
  detail <= 1 && !selectedText;

// The hint beside "Compare N candidates", and the collapsed row's count line.
export const compareHint = (): string => "Click a person's column heading to assign this authorship to them.";
export const shareLine = (n: number, canPick: boolean): string =>
  `${n} people share this name${canPick ? " · click one to assign" : ""}`;

// ---- review queues and empty states (UI refresh PR 6) --------------------------------------

// One identity in an Identity-conflicts row: the row's proposed identity, and each WCM person
// who already holds ACCEPTED at the same byline slot (accepted_by). `io` is the IO score when the
// row knows one for that person.
export type ConflictIdentity = { cwid: string; name: string; io: number | null; accepted: boolean };

export const conflictIdentities = (r: {
  top_cwid?: string | null; top_name?: string | null; top_io_score?: number | null;
  accepted_by?: Array<{ cwid: string; name: string }>;
}, candidates: Array<{ cwid?: string; io_score?: number | null }> = []): ConflictIdentity[] => {
  const ioOf = (cwid: string) => {
    const c = candidates.find((x) => String(x.cwid || "").toLowerCase() === cwid.toLowerCase());
    return c && c.io_score != null ? c.io_score : null;
  };
  const out: ConflictIdentity[] = [];
  if (r.top_cwid) out.push({ cwid: r.top_cwid, name: r.top_name || r.top_cwid, io: r.top_io_score ?? ioOf(r.top_cwid), accepted: false });
  for (const a of r.accepted_by || []) {
    if (!a?.cwid || out.some((o) => o.cwid.toLowerCase() === a.cwid.toLowerCase())) continue;
    out.push({ cwid: a.cwid, name: a.name || a.cwid, io: ioOf(a.cwid), accepted: true });
  }
  return out;
};

// What "Keep" on one identity of a conflict row sends, using only the row actions that already
// exist (no new server semantics):
//  - the proposed identity: accept (single-candidate row) or assign to it (multi-candidate row).
//    The server never records "not mine" for a candidate who has already accepted the paper, so
//    the other person's acceptance is left alone, and the UI says so.
//  - a person who already accepted it: reject, which records "not mine" for the row's
//    candidates and closes the row. Except when that person is ALSO one of this multi-candidate
//    row's candidates: reject would then write "not mine" over their own acceptance, so the row
//    is dismissed instead (a status write only), which leaves their acceptance as it is.
export const conflictKeep = (
  r: { top_cwid?: string | null; single_candidate?: boolean },
  keepCwid: string,
  candidateCwids: string[] = [],
): { action: "accept" | "assign" | "reject" | "dismiss"; extra?: Record<string, string> } => {
  const same = (a?: string | null) => String(a || "").toLowerCase() === keepCwid.toLowerCase();
  if (same(r.top_cwid)) return r.single_candidate ? { action: "accept" } : { action: "assign", extra: { cwid: r.top_cwid as string } };
  if (!r.single_candidate && candidateCwids.some(same)) return { action: "dismiss" };
  return { action: "reject" };
};

const QUEUE_NOUN: Record<string, string> = {
  open: "unassigned authorships", conflicts: "authorships with an identity conflict",
  duplicates: "possible duplicate authorships", snoozed: "snoozed authorships", dismissed: "dismissed authorships",
};

// The in-card empty state (prototype aEmptyTitle / aEmptyBody). `queueTotal` is the queue's size
// with every filter and the search cleared; null while that count is unknown.
export const emptyState = (args: { statusView: string; queueTotal: number | null; filtersOn: boolean }): { title: string; body: string; canReset: boolean } => {
  const { statusView, queueTotal, filtersOn } = args;
  const noun = QUEUE_NOUN[statusView] || "authorships";
  if (queueTotal === 0) {
    if (statusView === "duplicates") return { title: "No duplicates left", body: "Every PubMed and Scopus pair has been resolved.", canReset: false };
    return statusView === "open"
      ? { title: "Queue is clear", body: "Every open authorship has been assigned, rejected, snoozed, or dismissed.", canReset: false }
      : { title: `No ${noun}`, body: "Nothing is waiting in this queue.", canReset: false };
  }
  return {
    title: "No rows match these filters",
    body: queueTotal == null
      ? "Nothing in this queue matches the current source, filters, or search."
      : `${queueTotal.toLocaleString()} ${queueTotal === 1 ? noun.replace(/authorships/, "authorship") : noun} fall${queueTotal === 1 ? "s" : ""} outside the current source, filters, or search.`,
    canReset: filtersOn,
  };
};

// "Eliot T. Miller" -> "Eliot Miller": the directory search's second try when the byline name
// finds nobody, since ED rarely carries the middle initial a byline prints. Only single-letter
// tokens BETWEEN the first and last are dropped; returns null when there is nothing to drop.
export function dropMiddleInitials(name: string): string | null {
  const t = name.trim().split(/\s+/);
  if (t.length < 3) return null;
  const mid = t.slice(1, -1).filter((w) => !/^([A-Za-z]\.){1,2}$|^[A-Za-z]$/.test(w)); // T, T., T.J. (not "Li")
  return mid.length === t.length - 2 ? null : [t[0], ...mid, t[t.length - 1]].join(" ");
}
