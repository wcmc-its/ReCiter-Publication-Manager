// A person's display name can arrive carrying the SAME name element twice — full form and
// initial — comma-joined inside ONE column: person.middleName literally holds "Young,Y", which
// renders as "Rowan Ashford,A Vance" on the Authorships card. The comma is in the DATA, not in
// any formatting code: every name join in this repo is a plain space (personNames() and
// identityLabel() in controllers/db/authorships.controller.ts, and the AAR producer's own bake
// into top_name/candidate_cwids_json), so no join can fix it and every render site would
// otherwise have to. Pure and dependency-free so the rule is directly assertable
// (scripts/check-display-name.mjs) without a DB or a build — same reasoning as assignGate.ts and
// localOnlyMarker.ts — and so both sides share ONE copy of it: the controller cleans the names
// it looks up, the card cleans the ones the producer baked into candidate_cwids_json.
//
// THIS IS A DISPLAY-LAYER PATCH. The real fix belongs upstream, in the AAR producer's aar_db.py
// and the ReCiter Identity mirror feeding it — a middleName column should not hold a
// comma-separated variant list in the first place. Nothing here writes: the stored value is
// untouched.
//
// THE COMMA IS THE WHOLE SIGNAL, AND IT MUST SURVIVE TOKENISATION. A first attempt split on
// whitespace AND commas together and then tested whitespace adjacency, which discards the one
// piece of evidence that says "these two tokens are a duplicated field". Measured against the
// dev database, that rule rewrote 267 candidate names across 258 queue rows while fixing ZERO of
// the 13 names that actually contain the comma: it deleted correct given names and real middle
// initials ("Michael S Smith" -> "Michael Smith", "Li Liu" -> "Liu"), and on the Pick-one
// homonym panel — a surface whose entire job is telling near-identical people apart — it
// rendered two DIFFERENT candidates as the same string.
//
// So: a token is dropped ONLY when it sits directly across a COMMA from a token it is a
// case-insensitive STRICT prefix of. A name with no comma is returned with its tokens intact,
// whatever they look like. "Rowan Ashford,A Vance" drops the "Y" that flanks the comma opposite
// "Young"; "Michael S Smith" and "Li Liu" carry no comma and are untouched. Only the SHORTER
// token can go, so "Ann,Anna" keeps "Anna" and an equal-length repeat survives ("Han,Han" can be
// two real elements). Tokens are never rewritten, only dropped, so case and spelling survive.
//
// Deliberately NOT handled: a duplicate that is merely space-separated ("Young Y Han"). There is
// no signal there to separate it from a genuine middle initial, and guessing costs more than the
// defect — see the 267 above.
export function cleanDisplayName(name: unknown): string {
  if (typeof name !== "string") return "";
  // Groups of whitespace-separated tokens, split on the commas that carry the signal. A name
  // with no comma yields ONE group and can never lose a token.
  const groups = name
    .split(",")
    .map((group) => group.split(/\s+/).filter(Boolean))
    .filter((group) => group.length > 0);
  const strictPrefix = (short: string, long: string) =>
    long.length > short.length && long.toLowerCase().startsWith(short.toLowerCase());
  const out: string[] = [];
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    // The pair that flanks a comma: this group's FIRST token against the previous group's LAST.
    // Either side can be the initial — the producer writes "Young,Y", but "Y,Young" is the same
    // defect — so the shorter one is the one that goes.
    const prev = out[out.length - 1];
    const first = group[0];
    if (g > 0 && prev !== undefined && first !== undefined) {
      if (strictPrefix(first, prev)) {
        group.shift();
      } else if (strictPrefix(prev, first)) {
        out.pop();
      }
    }
    out.push(...group);
  }
  return out.join(" ");
}
