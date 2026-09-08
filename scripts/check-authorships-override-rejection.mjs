#!/usr/bin/env node
/**
 * Round 2, item 2 — overriding an existing assertion from the Authorships queue.
 * Run: node scripts/check-authorships-override-rejection.mjs [--src <AuthorshipsTabs.tsx>] [--ctl <authorships.controller.ts>]
 *
 * The owner chose all three override paths. Two of them already existed and are only VERIFIED
 * here (section 7): `reopen` un-assigns an accepted/assigned row by DELETEing the gold-standard
 * `known` entry, and un-rejects a "Reject all" by DELETEing the `rejected` entry for every
 * candidate. The third — picking an "Already rejected" candidate — was refused on purpose:
 * authorships.controller.ts answered 409 before writeGoldStandard, guarding the invariant that a
 * pmid is never in knownpmids and rejectedpmids at once (goldStandardRejections.ts).
 *
 * The UI is the smaller half, so this checks the SERVER first and by EXECUTION, not by reading:
 * the guard slab is lifted out of the controller, type-stripped with the repo's own TypeScript
 * and RUN against stubbed gold-standard calls, exactly as scripts/check-authorships-email-match.mjs
 * does for the ranking. What it has to prove is an ORDER, not a boolean — the prior rejection is
 * DELETED before the `known` merge, and a failed DELETE aborts instead of falling through — and
 * a source grep cannot see an order.
 *
 * The two JSX gates (radio, Assign button) have no renderer in this repo (no test framework at
 * all — see package.json), so they are asserted on source text, the same posture as
 * scripts/check-authorships-no-suggestion.mjs. Everything that is an EXPRESSION is run.
 *
 * --src / --ctl / --bulk are for proving this check is not vacuous: point them at copies with the
 * change reverted or mutated and the corresponding section must go red.
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
const eq = (actual, expected, label) => {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  assert(same, `${label}${same ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
};
const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const SRC_PATH = arg("--src", join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"));
const CTL_PATH = arg("--ctl", join(ROOT, "controllers/db/authorships.controller.ts"));
const BULK_PATH = arg("--bulk", join(ROOT, "src/lib/bulkAssign.ts"));
const src = readFileSync(SRC_PATH, "utf8");
const ctl = readFileSync(CTL_PATH, "utf8");
const bulk = readFileSync(BULK_PATH, "utf8");

// lift [from, to) out of `text`; "" when either anchor is missing, so a reverted file fails
// loudly at the compile/run below instead of silently testing nothing.
const slabOf = (text) => (from, to) => {
  const a = text.indexOf(from);
  const b = text.indexOf(to, a + 1);
  return a > -1 && b > a ? text.slice(a, b) : "";
};
const ctlSlab = slabOf(ctl);
const srcSlab = slabOf(src);
const strip = (body, module = ts.ModuleKind.None) => ts.transpileModule(body, {
  compilerOptions: { target: ts.ScriptTarget.ES2019, module },
}).outputText;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runAsync = (body, params = []) => new AsyncFunction(...params, strip(body));
const run = (body, params = []) => new Function(...params, strip(body));

// ---------------------------------------------------------------------------
console.log("\n1. the assign guard — the real slab, RUN, with the gold-standard calls stubbed");

// The guard through the positive write. Ends at the homonym-rejection comment, the first thing
// AFTER the `known` merge, so the whole ordered sequence is inside the slab. (Not at
// `const alsoRejected = ...` — the confirm's own preview uses that same line.)
const guard = ctlSlab(
  "// Data-integrity guard: never let an assign add pmid to knownpmids while it's still",
  '// ...and the other homonyms. Same write "None of these" makes for each of them, so',
);
assert(guard.length > 400 && /getRejectedPmidsByCwid/.test(guard) && /writeGoldStandard/.test(guard),
  "guard slab located in the controller");

const PARAMS = ["getRejectedPmidsByCwid", "writeGoldStandard", "identityLabel",
  "homonymRejectionTargets", "res", "row", "target", "pmid", "overrideRejection", "curator"];
let guardFn = null;
try {
  guardFn = runAsync(`${guard}\nreturn "WROTE_KNOWN";`, PARAMS);
} catch (e) {
  assert(false, `guard slab is runnable (${e.message})`);
}

const TARGET = "abc1001";
const PMID = 34567890;

// One assign attempt. `priorRejection` = is PMID already in target's rejectedpmids;
// `gsStatus` maps a call signature to the status writeGoldStandard should answer with.
const attempt = async ({ priorRejection = true, override = false, gsStatus = {}, others = ["bbb2002"] } = {}) => {
  const calls = [];
  const res = {
    status(code) {
      return {
        json(body) { return { responded: code, body }; },
        send(text) { return { responded: code, body: text }; },
      };
    },
  };
  const stubs = {
    getRejectedPmidsByCwid: async () => (priorRejection ? { [TARGET]: new Set([PMID]) } : {}),
    writeGoldStandard: async (uid, pmid, kind, flag) => {
      calls.push(`${kind}:${flag}:${uid}:${pmid}`);
      return gsStatus[`${kind}:${flag}`] ?? 200;
    },
    identityLabel: async (c) => (c === TARGET ? "Jane Doe · Medicine" : "Bob Roe"),
    homonymRejectionTargets: async () => others,
    res, row: { source: "pubmed" }, target: TARGET, pmid: PMID,
    overrideRejection: override, curator: { userID: 42 },
  };
  let out;
  try {
    out = await guardFn(...PARAMS.map((k) => stubs[k]));
  } catch (e) {
    out = { responded: `threw: ${e.message}` };
  }
  return { out, calls };
};

// 1a. no override — still refused, still writes NOTHING. This is the behaviour the guard
// exists for, and the whole point of not deleting it.
const plain = await attempt({ override: false });
eq(plain.out?.responded, 409, "a plain assign onto an already-rejected candidate is still refused (409)");
eq(plain.calls, [], "...and nothing at all is written — not the known merge, not a rejection delete");
assert(plain.out?.body?.code === "PRIOR_REJECTION",
  'the 409 carries code "PRIOR_REJECTION" so the client can route it into the row\'s confirm banner');
assert(typeof plain.out?.body?.message === "string" && /Jane Doe/.test(plain.out.body.message),
  "...and NAMES the person (identityLabel), not just the identifier");
assert(/It also records "not mine" for Bob Roe \(bbb2002\)\./.test(String(plain.out?.body?.message)),
  '...and keeps the standing promise honest: it NAMES who else this records "not mine" for');
eq(plain.out?.body?.alsoRejected, ["bbb2002"], "...and hands the client that list machine-readably, as the 422s do");
const alone = await attempt({ others: [] });
assert(!/not mine/.test(String(alone.out?.body?.message)),
  "...and says nothing of the sort when this row proposes nobody else");

// 1b. override — the rejection is CLEARED FIRST, then the article is assigned. The order is
// the invariant: any other order puts the pmid in both lists, which is what the guard protects.
const over = await attempt({ override: true });
eq(over.out, "WROTE_KNOWN", "with confirmOverrideRejection the assign proceeds to the positive write");
eq(over.calls, [`rejected:DELETE:${TARGET}:${PMID}`, `known:UPDATE:${TARGET}:${PMID}`],
  "...having DELETEd the prior rejection FIRST and merged `known` second — never both at once");

// 1c. the flag must not manufacture work. A target with no prior rejection is untouched by it.
const noPrior = await attempt({ priorRejection: false, override: true });
eq(noPrior.out, "WROTE_KNOWN", "no prior rejection + override: the ordinary assign still happens");
eq(noPrior.calls, [`known:UPDATE:${TARGET}:${PMID}`],
  "...and no spurious rejection DELETE is issued for someone who never rejected it");
const noPriorPlain = await attempt({ priorRejection: false, override: false });
eq(noPriorPlain.calls, [`known:UPDATE:${TARGET}:${PMID}`],
  "baseline unchanged: an ordinary assign is exactly one `known` merge");

// 1d. a failed DELETE must ABORT. Falling through would leave the rejection in place and add
// the known entry on top of it — the exact both-lists state the guard exists to prevent.
const undoFailed = await attempt({ override: true, gsStatus: { "rejected:DELETE": 502 } });
eq(undoFailed.out?.responded, 502, "if clearing the rejection fails, the request aborts");
eq(undoFailed.calls, [`rejected:DELETE:${TARGET}:${PMID}`],
  "...and the `known` merge never runs, so the pmid is never in both lists");
assert(/nothing was written/.test(String(undoFailed.out?.body)),
  "...and says so plainly rather than leaving a half-applied override");

// ---------------------------------------------------------------------------
console.log("\n2. the override flag is opt-in, parsed the same way `force` is");
const flagLine = (ctl.match(/^\s*const overrideRejection = .*$/m) || [""])[0].trim();
assert(/String\(body\.confirmOverrideRejection\) === "true"/.test(flagLine),
  "confirmOverrideRejection is read off the request body, string-compared like force/confirmOffCandidate");
let readFlag = () => "no flag line";
try { readFlag = run(`${flagLine}\nreturn overrideRejection;`, ["body"]); } catch { /* stays red below */ }
eq(readFlag({}), false, "absent → false: every caller that does not ask for it keeps hitting the 409");
eq(readFlag({ confirmOverrideRejection: "yes" }), false, 'any other value is not an opt-in ("yes" is not "true")');
eq(readFlag({ confirmOverrideRejection: "true" }), true, 'only "true" opts in');
eq(readFlag({ confirmOverrideRejection: true }), true,
  "a JSON boolean true also opts in — String(true) === \"true\", the same latitude `force` has had all along");

// ---------------------------------------------------------------------------
console.log("\n3. the confirm keeps the standing \"also records not mine\" promise honest");
// An ordinary ON-CANDIDATE assign raises no confirm at all today, so this 409 is the only place
// a curator is ever told, before the write, who else the assign rejects. It must therefore carry
// the same clause confirm_no_identity and confirm_mint carry — and derive it from the same
// function the WRITE uses, or a confirm could promise a set that never lands.
const priorConfirm = ctlSlab("if (!overrideRejection) {", "const undo = await writeGoldStandard");
assert(priorConfirm.length > 300, "prior-rejection confirm slab located");
assert(/const alsoRejected = await homonymRejectionTargets\(row, target, pmid as number\);/.test(priorConfirm),
  "it previews through the same homonymRejectionTargets() the write below calls");
assert(/identityLabel\(c\)/.test(priorConfirm), "...naming those people, not listing bare cwids");
assert(/also records "not mine" for/.test(priorConfirm) && /\$\{alsoRejectedNote\}/.test(priorConfirm),
  "...and the clause actually reaches the message the curator reads");
assert(/alsoRejected,/.test(priorConfirm), "...and the machine-readable list is on the response too, as the 422s do it");
eq((ctl.match(/let alsoRejectedNote = "";/g) || []).length, 3,
  "all three assign confirms carry it (see this file's report: three copies, deliberately not extracted)");

// ---------------------------------------------------------------------------
console.log("\n4. the client routes the 409 to a confirm, not to a dead toast — RUN");
const dispatch = srcSlab("const scopusDup = e?.status === 409", "if (kind) {");
assert(dispatch.length > 200 && /PRIOR_REJECTION/.test(dispatch), "kind-dispatch slab located");
let kindOf = () => "slab missing";
try {
  kindOf = run(`${dispatch}\nreturn kind;`, ["e", "row", "action", "extra"]);
} catch (e) { assert(false, `kind dispatch is runnable (${e.message})`); }

const PUBMED = { source: "pubmed" };
const SCOPUS = { source: "scopus" };
eq(kindOf({ status: 409, code: "PRIOR_REJECTION" }, PUBMED, "assign", {}), "prior_rejection",
  "409 PRIOR_REJECTION becomes the prior_rejection confirm");
eq(kindOf({ status: 409, code: "PRIOR_REJECTION" }, SCOPUS, "assign", {}), "prior_rejection",
  "...on a scopus row too — it is NOT swallowed by the scopusDup branch into \"Force add anyway\"");
eq(kindOf({ status: 409, code: "MULTI_CANDIDATE" }, PUBMED, "assign", {}), "multi_candidate",
  "the sibling 409 codes are undisturbed");
eq(kindOf({ status: 422, code: "OFF_CANDIDATE" }, PUBMED, "assign", {}), "off_candidate",
  "...and so are the 422s");
eq(kindOf({ status: 409 }, SCOPUS, "assign", {}), "dup",
  "a codeless scopus 409 is still the duplicate prompt");
eq(kindOf({ status: 502 }, PUBMED, "assign", {}), null,
  "an unrelated failure still gets the plain error toast, not a confirm");

const extraSlab = srcSlab('extra: kind === "no_identity"', "message: String(e?.message || e),");
assert(extraSlab.length > 100, "retry-flag slab located");
let extraOf = () => ({ extra: "slab missing" });
try { extraOf = run(`return ({ ${extraSlab} });`, ["kind", "extra"]); } catch { /* stays red below */ }
eq(extraOf("prior_rejection", { cwid: TARGET }).extra, { cwid: TARGET, confirmOverrideRejection: "true" },
  "confirming re-sends the SAME assign plus confirmOverrideRejection — the picked cwid is carried through");
eq(extraOf("off_candidate", { cwid: TARGET }).extra, { cwid: TARGET, confirmOffCandidate: "true" },
  "the other retries are unchanged");
eq(extraOf("dup", {}).extra, { force: "true" }, "...including the scopus force-add");

// the banner's own words — a confirm the curator cannot read is not a confirm
const banner = srcSlab('{conflict.kind === "no_identity" ? "No ReCiter identity"', "</div>");
assert(/prior_rejection" \? "This person already rejected this article"/.test(banner),
  "the banner titles the prior_rejection case (it would otherwise read \"Possible duplicate\")");
assert(/prior_rejection" \? "Overturn the rejection and assign"/.test(src),
  "...and its confirm button says what confirming does");

// ---------------------------------------------------------------------------
console.log("\n5. the client gates that used to make an already-rejected candidate unpickable");
const labelBlock = srcSlab("<label key={c.cwid || i} onClick={(e) => e.stopPropagation()}", "<span style={{ flex: 1, minWidth: 0 }}>");
assert(labelBlock.length > 300, "candidate row slab located");
assert(!/disabled=\{rejected\}/.test(labelBlock), "the radio is no longer disabled for an already-rejected candidate");
assert(/checked=\{checked\} onChange=\{\(\) => onPick\(c\.cwid\)\}/.test(labelBlock),
  "...and picking it still goes through the same onPick as any other candidate");
assert(!/cursor: rejected \? "not-allowed"/.test(labelBlock), 'the "not-allowed" cursor is gone');
assert(/cursor: "pointer",/.test(labelBlock), "...replaced by a plain pointer");
// still visibly a rejection — overridable must not mean indistinguishable
assert(/rejected \? "#fecaca"/.test(labelBlock) && /rejected \? "#fef2f2"/.test(labelBlock)
  && /opacity: rejected \? 0\.8 : 1/.test(labelBlock),
  "the row is still red-bordered, red-tinted and dimmed — the prior rejection stays visible");
assert(/\{rejected && <Chip kind="warn">Already rejected<\/Chip>\}/.test(src),
  '...and still carries the "Already rejected" chip');

const assignBtn = srcSlab('<button style={btn("accept", acting || !pickedCwid', "</button>");
assert(assignBtn.length > 100, "Assign button slab located");
assert(!/already_rejected/.test(assignBtn), "the Assign button no longer refuses an already-rejected pick");
assert(/disabled=\{acting \|\| !pickedCwid\}/.test(assignBtn),
  "...it is gated on an explicit pick alone, exactly as it is for every other candidate");
assert(/\{pickedRejected \? "Override rejection & assign" : "Assign selected"\}/.test(assignBtn),
  "the button RENAMES itself so the override is read before the click, not only after it");

const pickedRejectedLine = srcSlab("const pickedRejected = !!pickedCwid", "\n  return (");
assert(pickedRejectedLine.length > 40, "pickedRejected slab located");
let pr = () => "slab missing";
try { pr = run(`${pickedRejectedLine}\nreturn pickedRejected;`, ["pickedCwid", "candidates"]); } catch { /* red below */ }
const A = { cwid: "aaa1001" };
const R = { cwid: "rrr2002", already_rejected: true };
eq(pr("rrr2002", [A, R]), true, "picking the rejected candidate flips the button label");
eq(pr("aaa1001", [A, R]), false, "picking an ordinary candidate on the same row does not");
eq(pr(undefined, [A, R]), false, "nothing picked → no label flip (and the button is disabled anyway)");

// the pin/seed from item 1 must NOT start applying to rejected candidates as a side effect
assert(/const eligibleForLead = candidates\.filter\(\(c\) => !c\.already_rejected\);/.test(src),
  "rejected candidates are STILL excluded from eligibleForLead — an overridable candidate never jumps the ranking");
assert(/const emailCwid = ranked\.find\(\(c\) => isEmail\(c\)\)\?\.cwid;/.test(src),
  "...so the item-1 email seed still comes off `ranked` and can never auto-select a rejected candidate");

// ---------------------------------------------------------------------------
console.log("\n6. bulk deliberately does NOT override (unattended: no confirm can be shown)");
// ESNext module kind so the .ts's own `export`s survive into the data: URI import
const bulkMod = await import(
  `data:text/javascript;base64,${Buffer.from(strip(bulk, ts.ModuleKind.ESNext)).toString("base64")}`);
eq(bulkMod.isAcceptEligible({ single_candidate: true, top_cwid: "a", top_already_rejected: true }), false,
  "isAcceptEligible still excludes an already-rejected row");
eq(bulkMod.isAcceptEligible({ single_candidate: true, top_cwid: "a" }), true, "...and still admits an ordinary one");
eq(bulkMod.isNoIdentityAssignEligible({ single_candidate: true, top_cwid: "a", identity_in_reciter: false, top_already_rejected: true }), false,
  "isNoIdentityAssignEligible still excludes one too");
// the real enforcement: no bulk caller can even ASK for the override. (Matched with the
// trailing `:` so the recorded decision, which names the flag in prose, doesn't satisfy it.)
assert(!/confirmOverrideRejection\s*:/.test(bulk),
  "bulkAssign.ts never EMITS the flag — assignConfirmFlags() cannot produce it");
const bulkCall = srcSlab("const doBulkAssign = useCallback", "}, [assignConfirm, doActionAsync,");
assert(bulkCall.length > 1000 && /assignConfirmFlags\(/.test(bulkCall), "doBulkAssign slab located");
assert(!/confirmOverrideRejection/.test(bulkCall),
  "doBulkAssign sends only assignConfirmFlags(), so a bulk row that hits the guard 409s and is counted, never overridden");
assert(/if \(r\.status === 409\) conflict409\+\+;/.test(bulk),
  "...and that 409 is bucketed as a conflict rather than swallowed, so the curator is told");
assert(/ROUND 2, ITEM 2 — DECIDED: bulk does NOT get the rejection override/.test(bulk),
  "the decision is recorded where the predicates are, so it does not read as an oversight later");

// ---------------------------------------------------------------------------
console.log("\n7. paths (b) and (c) — verifying what ALREADY existed, not new behaviour");
const reopen = ctlSlab('case "reopen": {', 'case "verdict": {');
assert(reopen.length > 1000, "reopen slab located");
assert(/writeGoldStandard\(reverseCwid, undoPmid, "known", "DELETE", curator\.userID\)/.test(reopen),
  "(b) un-assign: reopen DELETEs the gold-standard `known` entry an accept/assign wrote");
assert(/writeGoldStandard\(other, pmid as number, "rejected", "DELETE", curator\.userID\)/.test(reopen),
  "(b) ...and takes back the homonym rejections that assign wrote alongside it");
assert(/} else if \(row\.status === "rejected"\) \{[\s\S]*?candidateCwidsFromRow\(row\)[\s\S]*?writeGoldStandard\(target, pmid as number, "rejected", "DELETE"/.test(reopen),
  '(c) un-reject: reopen DELETEs the rejection for EVERY candidate "Reject all" rejected');
const reopenBtn = srcSlab('<button style={btn("ghost", acting)}', ">Reopen</button>");
assert(reopenBtn.length > 40 && /onAction\("reopen"\)/.test(reopenBtn),
  "both are reachable from this view — the card shows a Reopen button on a resolved row");

console.log("\n8. a failed override must not eat the rejection it just cleared");
const assignBody = ctlSlab("// Whether this assign actually deleted a prior rejection",
                           "[authorships] feedbacklog (assign) non-fatal");
assert(assignBody.length > 200, "assign slab located");
assert(/let overturned = false;/.test(assignBody) && /overturned = true;/.test(assignBody),
  "the assign path records whether it actually deleted a prior rejection");
assert(/if \(overturned\)[\s\S]{0,900}?writeGoldStandard\(target, pmid as number, "rejected", "UPDATE"/.test(assignBody),
  "a failed `known` write RESTORES that rejection instead of leaving the person with neither");
assert(/previous rejection has been put back/.test(assignBody),
  "...and says so, rather than the old bare 'Gold-standard write failed' that implied nothing changed");
assert(/could NOT be restored/.test(assignBody),
  "...and when the restore ALSO fails, names exactly what is now missing");

console.log(failures ? `\n${failures} FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
