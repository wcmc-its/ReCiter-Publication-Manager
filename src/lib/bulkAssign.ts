// Pure, dependency-free selection/assignment logic for the Authorships bulk bar (T4 —
// "Find others like this" + bulk-assign one cwid to many rows, the Vickers case: many open
// rows for the same author name, each proposing several WCM homonyms). Split out of
// AuthorshipsTabs.tsx for the same reason as assignGate.ts (src/lib/assignGate.ts): every
// branch here feeds a selection that ends in a real GoldStandard write, so the table needs to
// be directly assertable (scripts/check-bulk-assign.mjs) rather than only exercised by hand.
//
// Three pieces:
//   1. eligibility — which OPEN rows are checkbox-selectable at all, and which of those are
//                    further restricted to the existing single-candidate bulk ACCEPT
//   2. candidates  — the union of proposed candidates across a selection, for the
//                    "Assign selected (N) to…" picker (name/cwid, ranked by how many
//                    selected rows propose them)
//   3. partition   — given a chosen cwid, which selected rows actually have it as a
//                    candidate (submitted) and which don't (skipped, never sent to the
//                    server), plus a doBulkAccept-style failure bucketing for the ones that
//                    were submitted and came back rejected

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

// Checkbox-selectable at all, on the currently-viewed queue. statusView is passed in rather
// than folded into SelectableRow because it's a view-level fact, not a row-level one — the
// pre-T4 toggleSelect gated the same way, on statusView, not on a `status` field on the row.
export function isBulkSelectable(row: SelectableRow, statusView: string): boolean {
  if (statusView !== "open") return false;
  return isAcceptEligible(row) || isMultiAssignEligible(row);
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

// Which selected rows actually propose the chosen cwid (submitted to the server) vs. don't
// (skipped locally — no request made). The confirm-step summary ("Assign k rows to X; m rows
// will be skipped") and the submit loop both read off this split. `candidatesOf` mirrors
// unionCandidates' own extraction so the two can never disagree about what a row proposes.
export function partitionForAssign<T>(
  rows: T[], candidatesOf: (row: T) => CandidateLite[], cwid: string,
): { toSubmit: T[]; toSkip: T[] } {
  const toSubmit: T[] = [];
  const toSkip: T[] = [];
  for (const row of rows) {
    const has = candidatesOf(row).some((c) => c.cwid === cwid);
    (has ? toSubmit : toSkip).push(row);
  }
  return { toSubmit, toSkip };
}

// Bucket a bulk-assign submit batch's settled failures the way doBulkAccept buckets accept
// failures (AuthorshipsTabs.tsx), extended with the two 422 codes `case "assign"` in
// authorships.controller.ts can return. Pre-submit skips (partitionForAssign's toSkip) are
// never in this input at all — those are reported separately, without a request ever firing.
// `conflict409` covers every 409 the assign endpoint can send (a scopus dup-conflict, or the
// rejectedpmids data-integrity guard) — assign has no MULTI_CANDIDATE code of its own (that's
// accept-only), so unlike doBulkAccept's dup bucket this one can't be split further by cause.
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
