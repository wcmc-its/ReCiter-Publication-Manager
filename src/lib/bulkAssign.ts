// Pure, dependency-free selection/assignment logic for the Authorships bulk bar (T4 —
// "Find others like this" + bulk-assign one cwid to many rows, the Vickers case: many open
// rows for the same author name, each proposing several WCM homonyms). Split out of
// AuthorshipsTabs.tsx for the same reason as assignGate.ts (src/lib/assignGate.ts): every
// branch here feeds a selection that ends in a real GoldStandard write, so the table needs to
// be directly assertable (scripts/check-bulk-assign.mjs) rather than only exercised by hand.
//
// Four pieces:
//   1. eligibility — which OPEN rows are checkbox-selectable at all: the existing
//                    single-candidate bulk ACCEPT set, multi-candidate bulk-ASSIGN-only rows
//                    (T4), and (B-8) single-candidate rows whose one proposed person has no
//                    ReCiter identity — also ASSIGN-only, since the write for them is a
//                    local-only record, never an Accept
//   2. candidates  — the union of proposed candidates across a selection, for the
//                    "Assign selected (N) to…" picker (name/cwid, ranked by how many
//                    selected rows propose them)
//   3. partition   — given a cwid the server has already canonicalized and identity-checked
//                    (B-8's lookup endpoint), which selected rows already have it as a
//                    candidate (onCandidate) and which don't (offCandidate) — EVERY row still
//                    submits now, nothing is skipped; assignConfirmFlags derives the one
//                    confirm flag each row's submit needs from that split plus whether the
//                    cwid has a ReCiter identity at all, mirroring assignGate()'s own
//                    dominance rule (src/lib/assignGate.ts) — plus a doBulkAccept-style
//                    failure bucketing for rows that came back rejected anyway
//   4. authorKey   — the normalized "same person, different byline spelling" key behind
//                    "Show N others like this" (T5)

// T5: normalized author key — "same person, different byline spelling" — for "Show N others
// like this". A curator sees "Bernard Park" on one row and "Bernard J. Park" on another; the
// free-text search box's LIKE '%Bernard Park%' misses the second one outright (the substring
// isn't there), so the button needs its own equality key instead: lowercase FIRST whitespace
// token + '|' + lowercase LAST whitespace token, which both bylines share regardless of what
// sits in the middle. The SQL side (controllers/db/authorships.controller.ts buildWhere,
// body.likeAuthor) computes the exact same two tokens with
// LOWER(SUBSTRING_INDEX(wcm_author,' ',1)) / LOWER(SUBSTRING_INDEX(wcm_author,' ',-1)) — this
// function is the client/test copy of that same rule, not a second definition of it.
// ponytail: first/last WHITESPACE TOKEN, not real name parsing. A single-token name keys on
// itself twice ("Park" -> "park|park"), which matches SUBSTRING_INDEX's own behavior when
// there's no delimiter to split on. The ceiling this leaves is compound surnames — "van der
// Berg" keys on "berg" alone (its last token), so it silently merges with any other "…berg" on
// the same first name. That's a real false-positive class, not a hidden bug: acceptable at
// today's ~16k-row table with no index and no name library, because the alternative (a real
// tokenizer/name-parts library) is a much bigger lift for a "propose more candidates to look
// at" button, not a write path — every row it surfaces still goes through its own per-row
// assign/accept gate before anything is written.
export function authorKey(wcmAuthor?: string): string {
  const tokens = (wcmAuthor || "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  const first = tokens[0].toLowerCase();
  const last = tokens[tokens.length - 1].toLowerCase();
  return `${first}|${last}`;
}

// Row shape both eligibility checks need — kept minimal/structural (not the full
// AuthorshipRow) so this file has no dependency on the component module.
export interface SelectableRow {
  single_candidate?: boolean;
  identity_in_reciter?: boolean;
  top_already_rejected?: boolean;
  top_cwid?: string;
  source?: "pubmed" | "scopus";
}

// The existing single-candidate bulk-ACCEPT set: toggleSelect's pre-T4 gate, eligibleRows,
// the "Accept near-certain"/"Select all matching" bar, and authorshipSelectable server-side
// all agree on this. Unchanged by T4 — a multi-candidate row must never satisfy it, which is
// what keeps "Accept selected" from ever bulk-accepting one of the newly-selectable rows.
export function isAcceptEligible(row: SelectableRow): boolean {
  return !!row.single_candidate && row.identity_in_reciter !== false
    && !row.top_already_rejected && !!row.top_cwid;
}

// T4: multi-candidate rows become selectable too, but only for bulk ASSIGN, never accept.
// Scopus is excluded — homonym-rejection recording (homonymRejectionTargets in
// authorships.controller.ts) is pubmed-lane only: a scopus row carries no pmid and gold
// standard is PMID-keyed, so there is no homonym judgment for a multi-candidate scopus row
// to record and nothing for "Find others like this" grouping to gain by including it.
export function isMultiAssignEligible(row: SelectableRow): boolean {
  return !row.single_candidate && row.source !== "scopus";
}

// B-8 addendum: an OPEN single-candidate row whose one proposed person (top_cwid) has no
// ReCiter identity at all (identity_in_reciter === false) — the nns9003 case: 16 rows all
// propose the same no-identity cwid, each showing the no-identity pill + "Assign…" instead of
// Accept, and until this predicate existed isAcceptEligible AND isMultiAssignEligible both
// refused them, so isBulkSelectable was false and even bulk-assign couldn't reach them. On
// candidate for THIS person's row is exactly assignGate's confirm_no_identity -> local_only
// branch (src/lib/assignGate.ts) — a real, curator-confirmed decision recorded per row, just
// never written into a publication record. Bulk ACCEPT must never include these — a no-identity
// row has nothing Accept could write to — so this is deliberately NOT folded into
// isAcceptEligible; it only widens isBulkSelectable, below, for assign. Any source: the write is
// row-scoped local-only regardless of pubmed/scopus (no gold-standard/ExternalArticle write
// happens for a no-identity target either way).
export function isNoIdentityAssignEligible(row: SelectableRow): boolean {
  return !!row.single_candidate && !!row.top_cwid
    && row.identity_in_reciter === false && !row.top_already_rejected;
}

// Checkbox-selectable at all, on the currently-viewed queue. statusView is passed in rather
// than folded into SelectableRow because it's a view-level fact, not a row-level one — the
// pre-T4 toggleSelect gated the same way, on statusView, not on a `status` field on the row.
export function isBulkSelectable(row: SelectableRow, statusView: string): boolean {
  if (statusView !== "open") return false;
  return isAcceptEligible(row) || isMultiAssignEligible(row) || isNoIdentityAssignEligible(row);
}

export interface CandidateLite {
  cwid: string;
  name?: string;
}

// The union of candidates proposed across a set of selected rows, each annotated with how
// many of those rows propose it — "Name (cwid) — matches k of N selected" in the bulk-assign
// picker, sorted by k desc. `rowCandidateLists` is the caller's own per-row candidate
// extraction (parseCandidates(row.candidate_cwids_json) for a multi row, a single
// [{cwid: top_cwid, name: top_name}] for a single-candidate one) — kept out of this file so
// it carries no JSON-parsing or AuthorshipRow-shaped dependency.
export function unionCandidates(rowCandidateLists: CandidateLite[][]): Array<CandidateLite & { matches: number }> {
  const byCwid = new Map<string, CandidateLite & { matches: number }>();
  for (const list of rowCandidateLists) {
    const seen = new Set<string>(); // one row proposing the same cwid twice still counts once
    for (const c of list) {
      if (!c?.cwid || seen.has(c.cwid)) continue;
      seen.add(c.cwid);
      const existing = byCwid.get(c.cwid);
      if (existing) { existing.matches += 1; if (!existing.name && c.name) existing.name = c.name; }
      else byCwid.set(c.cwid, { cwid: c.cwid, name: c.name, matches: 1 });
    }
  }
  return [...byCwid.values()].sort((a, b) => b.matches - a.matches || a.cwid.localeCompare(b.cwid));
}

// Which selected rows already have the chosen cwid as one of THEIR OWN proposed candidates
// (onCandidate) vs. which don't (offCandidate) — informational now, not a submit/skip split:
// B-8 replaced the old "off-candidate rows are skipped, never sent" dead end (the sts2022 prod
// incident — 10/10 rows skipped, Assign disabled) with the bulk equivalent of the per-row
// OFF_CANDIDATE/NO_RECITER_IDENTITY 422 confirms, so EVERY row in both buckets submits; see
// assignConfirmFlags below for the one confirm flag each row's submit carries.
// `candidatesOf` mirrors unionCandidates' own extraction so the two can never disagree about
// what a row proposes. `cwid` is expected to already be the server-canonicalized form
// (authorshipLookupCwid's response), same as case "assign"'s own `target`.
export function partitionForAssign<T>(
  rows: T[], candidatesOf: (row: T) => CandidateLite[], cwid: string,
): { onCandidate: T[]; offCandidate: T[] } {
  const onCandidate: T[] = [];
  const offCandidate: T[] = [];
  for (const row of rows) {
    const has = candidatesOf(row).some((c) => c.cwid === cwid);
    (has ? onCandidate : offCandidate).push(row);
  }
  return { onCandidate, offCandidate };
}

// Which confirm flag(s) ONE row's bulk-assign submit needs, given (a) whether the chosen cwid
// is on THAT row's own candidate list (partitionForAssign's offCandidate membership) and (b)
// whether the lookup found a ReCiter identity for the cwid at all (one fact for the whole
// batch — the same cwid, looked up once). This is exactly assignGate()'s own dominance rule
// (src/lib/assignGate.ts) re-expressed for the client: absence of identity is asked first and
// is NOT stood in for by the off-candidate confirm — they warn about opposite consequences
// ("nothing is written" vs. "something IS written to a person you didn't pick from a list") —
// so a no-identity cwid gets confirmNoIdentity regardless of on/off-candidate, and only an
// on-candidate, has-identity row needs no flag at all (straight to "write", same as an
// unconfirmed single-row assign today).
export function assignConfirmFlags(offCandidate: boolean, hasIdentity: boolean): Record<string, "true"> {
  if (!hasIdentity) return { confirmNoIdentity: "true" };
  if (offCandidate) return { confirmOffCandidate: "true" };
  return {};
}

// Bucket a bulk-assign submit batch's settled failures the way doBulkAccept buckets accept
// failures (AuthorshipsTabs.tsx), extended with the two 422 codes `case "assign"` in
// authorships.controller.ts can return. B-8: every selected row submits now, each carrying the
// confirm flag assignConfirmFlags derived for it, so OFF_CANDIDATE/NO_RECITER_IDENTITY landing
// here would mean that derivation itself disagreed with what the server just found — a real
// anomaly to bucket and surface, not the expected outcome the old toSkip pre-submit split used
// to describe. `conflict409` covers every 409 the assign endpoint can send (a scopus
// dup-conflict, or the rejectedpmids data-integrity guard) — assign has no MULTI_CANDIDATE code
// of its own (that's accept-only), so unlike doBulkAccept's dup bucket this one can't be split
// further by cause.
export interface AssignFailureReason {
  status?: number;
  code?: string;
}
export function bucketAssignFailures(reasons: AssignFailureReason[]): {
  offCandidate: number; noIdentity: number; conflict409: number; other: number;
} {
  let offCandidate = 0, noIdentity = 0, conflict409 = 0, other = 0;
  for (const r of reasons) {
    if (r.status === 422 && r.code === "OFF_CANDIDATE") offCandidate++;
    else if (r.status === 422 && r.code === "NO_RECITER_IDENTITY") noIdentity++;
    else if (r.status === 409) conflict409++;
    else other++;
  }
  return { offCandidate, noIdentity, conflict409, other };
}
