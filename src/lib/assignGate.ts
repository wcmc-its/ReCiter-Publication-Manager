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
