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
