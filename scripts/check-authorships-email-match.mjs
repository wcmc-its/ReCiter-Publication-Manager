#!/usr/bin/env node
/**
 * Round 2, item 1 — the affiliation email address as a DECISIVE match criterion.
 * Run: node scripts/check-authorships-email-match.mjs [--src <path to AuthorshipsTabs.tsx>]
 *
 * PubMed prints the corresponding author's address inside the raw affiliation
 * ("... Electronic address: abc1001@med.cornell.edu."), and at all three Cornell domains the
 * local part IS the person identifier. The owner's decision is that an exact match to a
 * candidate's cwid pins that candidate to the TOP of the pick-one list, PRE-SELECTS its radio
 * and shows an "Email match" badge.
 *
 * "Cosmetically first" is the failure mode this guards. Ranking on that card is decided in
 * THREE separate expressions — the sort comparator, the unfolded/folded split behind "Show
 * all", and the `lead` strength gate — and a criterion added to only one of them looks right
 * on the happy path and does nothing on the others. So the ranking slab is lifted out of the
 * .tsx, type-stripped with the repo's own TypeScript and RUN, exactly as
 * scripts/check-authorships-filter-body.mjs does: each of the three is asserted with a fixture
 * that ONLY that expression can get right.
 *
 * No DB, no AWS, no build, no renderer. The two JSX branches (the badge) can't be evaluated
 * without React, so they are asserted against source text — the same posture as
 * scripts/check-authorships-no-suggestion.mjs.
 *
 * --src is for proving this check is not vacuous: point it at a copy with the change reverted
 * (or mutated) and every section must go red.
 */

import ts from "typescript";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
let failures = 0;
const assert = (cond, label) => {
  console.log(`  ${cond ? PASS : FAIL} ${label}`);
  if (!cond) failures++;
};
const eq = (actual, expected, label) =>
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${label}${JSON.stringify(actual) === JSON.stringify(expected) ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);

const argIdx = process.argv.indexOf("--src");
const SRC_PATH = argIdx > -1 ? process.argv[argIdx + 1]
  : join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx");
const src = readFileSync(SRC_PATH, "utf8");

// lift [from, to) out of the source; "" when either anchor is missing, so a reverted file
// fails loudly at the `new Function` below instead of silently testing nothing.
const slab = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + 1);
  return a > -1 && b > a ? src.slice(a, b) : "";
};
const run = (body, params = []) => {
  const js = ts.transpileModule(body, {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...params, js);
};

// ---------------------------------------------------------------------------
console.log("\n1. cornellEmailIds() — the pure helper, run for real");
let ids = () => { throw new Error("helper not extracted"); };
try {
  const helper = slab("const CORNELL_EMAIL_RE", "// Wrap the WCM institution token").replace(/\bexport /g, "");
  assert(/cornellEmailIds/.test(helper) && helper.length > 100, "helper slab located in the .tsx");
  assert(/^export const cornellEmailIds/m.test(src), "cornellEmailIds is EXPORTED (a pure helper, testable on its own)");
  ids = run(`${helper}\nreturn cornellEmailIds;`)();
} catch (e) {
  assert(false, `helper is runnable (${e.message})`);
}
const ok = (input, expected, label) => {
  let got;
  try { got = ids(input); } catch (e) { got = `threw: ${e.message}`; }
  eq(got, expected, label);
};

// the shape PubMed actually writes
ok("Department of Medicine, Weill Cornell Medicine, New York, NY, USA. Electronic address: abc1001@med.cornell.edu.",
  ["abc1001"], "WCM CWID off a real PubMed affiliation, sentence-final period and all");
ok("Cornell University, Ithaca, NY, USA. Electronic address: abc123@cornell.edu",
  ["abc123"], "Cornell Ithaca NetID (bare cornell.edu)");
ok("Weill Cornell Medicine-Qatar, Doha, Qatar. Electronic address: zzz4004@qatar-med.cornell.edu",
  ["zzz4004"], "WCM-Qatar identifier");

// case
ok("ELECTRONIC ADDRESS: ABC1001@MED.CORNELL.EDU", ["abc1001"], "uppercase address, lowercased on the way out");
ok("Xy9001@Med.Cornell.Edu", ["xy9001"], "mixed-case domain still matches");

// more than one address, and more than one affiliation in the one string
ok("Dept A, Weill Cornell Medicine. Electronic address: aaa1001@med.cornell.edu. Dept B, Cornell University. Electronic address: bbb2002@cornell.edu.",
  ["aaa1001", "bbb2002"], "two affiliations, two addresses — both returned, first-seen order");
ok("<ccc3003@med.cornell.edu>; ddd4004@qatar-med.cornell.edu; eee5005@cornell.edu",
  ["ccc3003", "ddd4004", "eee5005"], "three addresses across all three domains in one string");
ok("aaa1001@med.cornell.edu and again AAA1001@med.cornell.edu", ["aaa1001"], "the same person twice is de-duplicated");

// trailing punctuation
for (const [suffix, label] of [[".", "period"], [",", "comma"], [";", "semicolon"], [")", "paren"], [">", "angle"], [" ", "space"], ["", "end of string"]])
  ok(`Electronic address: abc1001@med.cornell.edu${suffix} more text`, ["abc1001"], `trailing ${label} does not enter the identifier`);

// nothing to find
ok(undefined, [], "undefined affiliation");
ok("", [], "empty affiliation");
ok("Weill Cornell Medicine, 1300 York Ave, New York, NY 10065, USA.", [], "an affiliation with no address at all");
ok("Electronic address: someone@nyu.edu", [], "a non-Cornell address is ignored");
ok("Electronic address: someone@gmail.com", [], "a personal address is ignored");

// ANCHORED domain — the traps
ok("Electronic address: evil@notcornell.edu", [], "left-anchored: notcornell.edu must NOT match");
ok("Electronic address: evil@mycornell.edu", [], "left-anchored: mycornell.edu must NOT match");
ok("Electronic address: evil@cornell.edu.evil.com", [], "right-anchored: cornell.edu.evil.com must NOT match");
ok("Electronic address: evil@med.cornell.edu.evil.com", [], "right-anchored: med.cornell.edu.evil.com must NOT match");
ok("Electronic address: evil@cornell.education", [], "right-anchored: cornell.education must NOT match");
ok("Electronic address: evil@cornell.edu-mail.com", [], "right-anchored: a hyphen continuation must NOT match");
ok("Electronic address: evil@weill.cornell.edu", [], "only the three named hosts count — weill.cornell.edu is not one");

// not-an-error cases
ok("Electronic address: nobody9999@med.cornell.edu", ["nobody9999"],
  "a local part matching NO candidate is returned, not swallowed and not an error (the card just finds no candidate for it)");

// ---------------------------------------------------------------------------
console.log("\n2. ranking — all THREE places, run for real");
// The three expressions live in one contiguous run of statements broken by the hover-card
// block; both halves are lifted and re-joined so this check does not depend on that block.
let rank = null;
try {
  const body = [
    slab("const eligibleForLead = candidates.filter", "const [showAll"),
    slab("const top = ranked[0];", "const selectedCwid = pickedCwid;"),
  ];
  assert(body.every((x) => x.length > 80), "ranking slabs located");
  rank = run(
    `${body.join("\n")}\nreturn { ranked: ranked, unfolded: unfolded, folded: folded, lead: lead, emailCwid: emailCwid };`,
    ["r", "candidates", "pickedCwid", "onPick", "useEffect", "cornellEmailIds"],
  );
} catch (e) {
  assert(false, `ranking slab is runnable (${e.message})`);
}
// useEffect stub runs the effect body immediately, which is what makes the seed observable.
const model = (aff, candidates, pickedCwid) => {
  const picks = [];
  try {
    const out = rank({ author_affiliation: aff }, candidates, pickedCwid, (c) => picks.push(c),
      (fn) => fn(), ids);
    return { ...out, picks, order: out.ranked.map((c) => c.cwid) };
  } catch (e) {
    // a slab that no longer defines what it is asked for (the change reverted, a rename) must
    // turn every assertion below red, not crash the run half-way through it.
    return { ranked: [], unfolded: [], folded: [], lead: null, emailCwid: `threw: ${e.message}`, picks, order: `threw: ${e.message}` };
  }
};

const STRONG = { cwid: "aaa9001", name: "A", given_match: "full", io_score: 92, confidence: 0.9 };
const WEAK = { cwid: "bbb9002", name: "B", io_score: 0.62, confidence: 0.1 };
const AFF = (local) => `Dept, Weill Cornell Medicine, New York, NY, USA. Electronic address: ${local}@med.cornell.edu.`;

// 2a. the sort comparator
eq(model(AFF("nobody"), [STRONG, WEAK]).order, ["aaa9001", "bbb9002"],
  "baseline (no email match): the full-name/IO-92 candidate leads");
eq(model(AFF("BBB9002"), [STRONG, WEAK]).order, ["bbb9002", "aaa9001"],
  "comparator: an email match on the IO-0.62 candidate outranks a full-name match scored 92");

// 2b. the unfolded/folded split — an UNSCORED, name-mismatched email match must not be
// hidden behind "Show all", which is what would happen if only the comparator were changed.
const UNSCORED = { cwid: "ccc9003", name: "C" };
const foldBase = model(AFF("nobody"), [STRONG, UNSCORED]);
eq(foldBase.folded.map((c) => c.cwid), ["ccc9003"], "baseline: an unscored candidate is folded away");
const foldEmail = model(AFF("ccc9003"), [STRONG, UNSCORED]);
eq(foldEmail.folded.map((c) => c.cwid), [], "fold split: an email match is never folded away");
eq(foldEmail.unfolded.map((c) => c.cwid), ["ccc9003", "aaa9001"], "fold split: it is unfolded, and first");

// 2c. the `lead` strength gate — a flat tie of weak candidates highlights nobody, but the
// email match must be strong enough to become the highlighted lead on its own.
const WEAKER = { cwid: "ddd9004", name: "D", confidence: 0.2 };
assert(model(AFF("nobody"), [UNSCORED, WEAKER]).lead === undefined,
  "baseline: no candidate is strong enough to be the lead");
assert(model(AFF("ccc9003"), [UNSCORED, WEAKER]).lead?.cwid === "ccc9003",
  "lead gate: an unscored, name-mismatched email match IS strong enough to lead");

// ---------------------------------------------------------------------------
console.log("\n3. pre-selection — seeds the real pick, never stomps one");
eq(model(AFF("BBB9002"), [STRONG, WEAK]).picks, ["bbb9002"],
  "an email match seeds onPick, so the radio is pre-selected AND 'Assign selected' (gated on a real pick) lights up");
eq(model(AFF("BBB9002"), [STRONG, WEAK], "aaa9001").picks, [],
  "a pick the curator has already made is NOT stomped");
eq(model(AFF("nobody"), [STRONG, WEAK]).picks, [],
  "no email match, no seed — the card still demands an explicit pick");
eq(model(undefined, [STRONG, WEAK]).picks, [], "a row with no affiliation text at all seeds nothing");
// an email match on an already-rejected candidate: badge yes (section 4 renders off the raw
// candidate list), radio no. Rejected candidates are excluded from `ranked`, which is where
// emailCwid comes from, so the seed cannot select a candidate whose radio is disabled.
const REJECTED = { cwid: "eee9005", name: "E", already_rejected: true };
const rej = model(AFF("eee9005"), [STRONG, REJECTED]);
eq(rej.picks, [], "an email match on an ALREADY-REJECTED candidate does not seed the radio");
eq(rej.order, ["aaa9001"], "...and does not enter the ranked/lead set either");

// ---------------------------------------------------------------------------
console.log("\n4. the badge (JSX — asserted on source, no renderer here)");
const chipBlock = slab('{rejected && <Chip kind="warn">Already rejected</Chip>}', "</span>");
assert(/\{!!isEmail\(c\) && <Chip kind="ok">Email match<\/Chip>\}/.test(chipBlock),
  'an "Email match" chip renders through the existing Chip component, kind="ok"');
assert(chipBlock.indexOf("Email match") < chipBlock.indexOf("Full name match"),
  "it leads the match chips it outranks (after the two warn chips)");
assert(/\{\(!!isEmail\(c\) \|\| c\.given_match === "full"/.test(src),
  "the chip row is shown for an email match even when the candidate has no other signal");

console.log(failures ? `\n${failures} FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
