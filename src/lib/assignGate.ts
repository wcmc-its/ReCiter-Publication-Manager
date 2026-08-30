// Which of the "assign" paths runs for a curator-typed person identifier, given what the
// server just found out about it. Pure and dependency-free ONLY so the branch table is
// directly assertable (scripts/check-assign-gate.mjs): every branch it selects over in
// authorships.controller.ts ends in a DynamoDB / ReCiter / MySQL write, so the table cannot
// be exercised in place without doing damage.
//
//   confirm_no_identity   ReCiter has never heard of them → 422, ask once (#925)
//   local_only            …confirmed → resolve the row, write nothing downstream (#925)
//   confirm_off_candidate a real person the AAR producer did not propose → 422, ask once and
//                         NAME them, because confirming writes their real publication record
//   write                 the unchanged authoritative assign (on-candidate, or confirmed)
export type AssignGate = "confirm_no_identity" | "local_only" | "confirm_off_candidate" | "write";

export function assignGate(o: {
  offCandidate: boolean;         // chosen cwid is neither top_cwid nor in candidate_cwids_json
  hasIdentity: boolean;          // reciterIdentitySet() found a named `person` row for it
  confirmNoIdentity: boolean;    // client re-sent confirmNoIdentity:"true"
  confirmOffCandidate: boolean;  // client re-sent confirmOffCandidate:"true"
}): AssignGate {
  // Absence of identity dominates, and is asked first: it decides whether ANY downstream
  // write is possible at all. Its confirmation deliberately does not stand in for the
  // off-candidate one — they warn about opposite consequences ("nothing is written" vs
  // "something IS written to a person you didn't pick from a list").
  if (!o.hasIdentity) return o.confirmNoIdentity ? "local_only" : "confirm_no_identity";
  if (o.offCandidate && !o.confirmOffCandidate) return "confirm_off_candidate";
  return "write";
}

// The identifier as ReCiter STORES it, for a cwid a curator typed by hand. Pure for the same
// reason assignGate is: it picks which Identity record every write below lands in.
//
// `found` is what reciterIdentitySet() returned for [typed, typed.toLowerCase()]. DynamoDB keys
// are byte-exact while every WCM identifier that matters is lowercase — 35,384/35,384 IDM
// roster cwids, 29,845/29,845 authorship_review.top_cwid, 11,389/11,389 cwids baked into
// candidate_cwids_json, all lowercase on 2026-08-29 — so a curator who capitalises misses an
// identity that is plainly there, including this row's own proposed candidate.
//
// A byte-exact hit on what was typed WINS over the lowercased form, and that ordering is
// load-bearing rather than defensive: 14 of the 26,551 typable DynamoDB uids are not lowercase,
// 13 of them have a lowercase twin that is a SEPARATE Identity row, and the mixed-case one is often
// the live one ('DLAMB' has 131 person_article rows and 'dlamb' has 0; 'Arn4002' 59 and 0). One
// pair is two different people — 'Kym9003' is Kyle Merandy, 'kym9003' is Annie Rohan.
// Lowercasing unconditionally would file an authorship under an empty duplicate record, and in
// that last case under the wrong human. Falling back ONLY when the typed string names nothing
// at all cannot do either.
// ponytail: two keys in one BatchGetItem, no roster round-trip and no case-insensitive index —
// "canonical" here means "lowercase", which is true of every identifier this app compares.
// Ceiling: a genuinely mixed-case-native identifier feed would need a real case-folding lookup.
// Upgrade path: give the reciterdb `identity` roster a LOWER(cwid) index and resolve there.
export function canonicalCwid(typed: string, found: Set<string>): string {
  const lower = typed.toLowerCase();
  return found.has(typed) ? typed : found.has(lower) ? lower : typed;
}

// The non-chosen homonyms on a multi-candidate row, i.e. the candidates an assign should
// record a REJECTION for. Assigning one of N proposed homonyms is not only "this person wrote
// it" — it is also "the other N-1 did not", which is exactly what a homonym row means: one of
// these people wrote it and the curator has just said which. That judgment was being discarded
// (verified across 8 recent assigns on 2026-08-29: nothing written for the others in
// GoldStandard, in AdminFeedbackLog, or in person_article). Sibling authorship ROWS for other
// WCM authors on the same paper are a different thing entirely and stay open — 4,338 of them
// on papers that already have a resolution — because "someone else also wrote this paper" is
// not "this person didn't".
//
// Pure, and deliberately shared by BOTH the assign write and the reopen undo, so that "reopen
// reverses exactly what assign wrote" holds by construction instead of by two hand-kept lists.
// reopen passes hasAccepted: () => false: a candidate the write skipped for having already
// accepted the pmid then gets a DELETE too, which is a no-op (the pmid sits in their
// knownpmids, and a rejected-DELETE only ever touches rejectedpmids). Undoing a superset that
// reduces to the written set is the safe direction — re-checking accepted at reopen would
// instead STRAND a rejection for anyone who accepted the article after the assign.
// ponytail: the undo is recomputed, not recorded, so reopen also deletes a rejection the person
// had made themselves on their own /curate page before the assign ever ran — it can't tell the
// two apart. Exposure today is zero (0 of the 219 pairs in the resolved backlog were already
// rejected on 2026-08-29), and `case "reject"`/reopen has carried the identical over-reach since
// PR-1. Ceiling: recomputation. Upgrade path: have the assign stash the cwids it actually wrote
// on the row (there is already a `note` column) and have reopen undo from that list instead.
export function homonymRejections(o: {
  isScopus: boolean;        // scopus rows carry no pmid and gold standard is PMID-keyed, so
                            // there is nothing to reject — same precedent as case "reject",
                            // where a scopus reject is a local dismissal and never a GS write
  singleCandidate: boolean; // one proposed candidate is no homonym judgment: assigning
                            // elsewhere says the producer's single guess was wrong, not that
                            // a set of look-alikes has been narrowed to one
  candidates: string[];     // candidateCwidsFromRow(row) — top_cwid + candidate_cwids_json
  target: string;           // the identity being assigned, canonical (see canonicalCwid)
  hasIdentity: (cwid: string) => boolean; // ReCiter knows the uid. A gold-standard write for
                            // one it doesn't does NOT 404: POST /reciter/goldstandard validates
                            // only uid != null and returns 200, creating an ORPHAN GoldStandard
                            // row no Identity and no PM view ever reads. Failing open here
                            // writes garbage SILENTLY, which is why the skip exists. (The 404
                            // belongs to ExternalArticleController — the scopus lane, not this.)
                            // — 65 of the 219 backfill targets (39 distinct people) are these
  hasAccepted: (cwid: string) => boolean; // their knownpmids already contains this pmid; never
                            // tell ReCiter someone both wrote and didn't write a paper
}): string[] {
  if (o.isScopus || o.singleCandidate) return [];
  return o.candidates.filter((c) => c !== o.target && o.hasIdentity(c) && !o.hasAccepted(c));
}
