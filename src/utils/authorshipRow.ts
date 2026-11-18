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
export const orcidMatchTip = (orcid?: string | null): string => {
  const o = (orcid || "").trim();
  return o ? `The byline ORCID ${o} is on file for this person` : "The byline ORCID is on file for this person";
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
  cwid: string; given_match?: string; io_score?: number | null; confidence?: number | null;
  already_rejected?: boolean; retired_cwid?: boolean;
}

// The order candidates are listed in on a multi-candidate row: a full given-name match first,
// then IO, then the matcher's confidence (the AAR producer's own key). Candidates who already
// rejected this paper go last, and retired CWIDs are left out (the row says why separately).
export const rankCandidates = <C extends RankableCandidate>(cands: C[]): C[] => {
  const live = cands.filter((c) => !c.retired_cwid);
  const full = (c: C) => (c.given_match === "full" ? 1 : 0);
  const byScore = (a: C, b: C) => (b.io_score ?? -1) - (a.io_score ?? -1) || (b.confidence ?? -1) - (a.confidence ?? -1);
  return [
    ...live.filter((c) => !c.already_rejected).sort((a, b) => full(b) - full(a) || byScore(a, b)),
    ...live.filter((c) => c.already_rejected).sort(byScore),
  ];
};

// The hint beside "Compare N candidates", and the collapsed row's count line.
export const compareHint = (pickedName?: string | null): string => (pickedName
  ? `Accept assigns to ${pickedName}. Click another column to switch.`
  : "Click a column to pick who gets this authorship.");
export const shareLine = (n: number, picked: boolean): string =>
  `${n} people share this name${picked ? "" : " · pick one"}`;

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
