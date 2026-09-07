#!/usr/bin/env node
/**
 * "Same work as a PubMed article" ⇒ accepting it is a real gold-standard accept of that PMID,
 * on BOTH /authorships and /curate/<cwid>. Source-inspection only, so this runs with no DB, no
 * AWS creds and no build — same reason as the other scripts/check-*.mjs beside it.
 * Run: node scripts/check-scopus-accept-equivalence.mjs
 *
 * Sections:
 *   1. case "accept" — samePmid takes the gold-standard lane, never addExternalArticle, and
 *      reads the PMID off the row rather than the request body.
 *   2. matched_pmid_verdict 'same' is written only together with a terminal status (openStatusWhere
 *      returns any verdicted row to the OPEN feed, so a 'same' on an open row would mis-route it).
 *   3. case "reopen" — a same-work accept undoes the gold-standard write, not an ExternalArticle,
 *      and clears the 'same' verdict so the row lands back in "Possible duplicates".
 *   4. AuthorshipsTabs.tsx — the accept button, its single_candidate gate, and the force-add
 *      prompt correctly NOT offered for a same-work 409.
 *   5. ExternalPublicationCard.tsx — "Same as PMID N" at the 409 WARNING, defensive matchedId
 *      parsing, and the primary Add button gated on onAcceptPmid actually being supplied.
 *   6. The OpenAlex tab passes onAcceptPmid (its Add button was a silent no-op without it).
 *   7-12. Regression guards for the nine defects an adversarial review confirmed against the
 *      first working version of this change. The twin PMID comes from ReCiter's candidate set
 *      for the SAME person, so it is normally already in their record — which is what makes the
 *      already-accepted / already-rejected / double-listing cases the mainline, not edge cases.
 *      12 records a deliberate omission: no entryPath is sent (see the handoff for why).
 */

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

const controllerSrc = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");
const tabsSrc = readFileSync(join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"), "utf8");
const cardSrc = readFileSync(join(ROOT, "src/components/elements/CurateIndividual/ExternalPublicationCard.tsx"), "utf8");
const openalexTabSrc = readFileSync(join(ROOT, "src/components/elements/CurateIndividual/TabAddExternalPublication.tsx"), "utf8");
const reciterTabsSrc = readFileSync(join(ROOT, "src/components/elements/CurateIndividual/ReciterTabs.tsx"), "utf8");
const gsControllerSrc = readFileSync(join(ROOT, "controllers/goldstandard.controller.ts"), "utf8");
const actionsSrc = readFileSync(join(ROOT, "src/redux/actions/actions.js"), "utf8");

// The switch cases, sliced the way the sibling scripts do it.
const sliceCase = (name) => {
  const start = controllerSrc.indexOf(`case "${name}": {`);
  if (start < 0) return "";
  const next = controllerSrc.indexOf('\n      case "', start + 10);
  const dflt = controllerSrc.indexOf("\n      default:", start);
  const end = next > 0 && next < dflt ? next : dflt;
  return controllerSrc.slice(start, end > 0 ? end : undefined);
};
const acceptCase = sliceCase("accept");
const reopenCase = sliceCase("reopen");
const verdictCase = sliceCase("verdict");

// ---------------------------------------------------------------------------------------
console.log('\n1. case "accept" — samePmid takes the gold-standard lane:');
assert(/const sameWork = isScopus && String\(body\.samePmid\) === "true"/.test(acceptCase),
  "sameWork requires BOTH a scopus row and an explicit samePmid flag");
assert(/const acceptPmid = sameWork \? Number\(row\.matched_pmid\) : \(pmid as number\)/.test(acceptCase),
  "the PMID comes from row.matched_pmid, never from the request body");
assert(!/body\.(samePmid|pmid)\s*\)?\s*(as )?[Nn]umber/.test(acceptCase) && !/Number\(body\./.test(acceptCase),
  "no client-supplied PMID is ever coerced and accepted");
assert(/if \(sameWork && row\.matched_pmid == null\)[\s\S]{0,160}return res\.status\(400\)/.test(acceptCase),
  "a samePmid accept on a row with no matched_pmid is a 400, not a NaN write");
assert(/if \(isScopus && !sameWork\) \{/.test(acceptCase),
  "the ExternalArticle branch is skipped for a same-work accept");
assert(/addExternalArticle/.test(acceptCase) && acceptCase.indexOf("addExternalArticle") > acceptCase.indexOf("if (isScopus && !sameWork)"),
  "addExternalArticle is reachable ONLY inside the !sameWork branch");
assert(/getRejectedPmidsByCwid\(\[cwid\]\)\)\[cwid\]\?\.has\(acceptPmid\)/.test(acceptCase),
  "the already-rejected guard runs against acceptPmid (not the null scopus row.pmid)");
assert(/writeGoldStandard\(cwid, acceptPmid, "known", "UPDATE", curator\.userID\)/.test(acceptCase),
  "a real gold-standard known write for acceptPmid");
assert(/appendFeedbackLog\(curator\.userID, cwid, acceptPmid, "ACCEPTED"\)/.test(acceptCase),
  "the feedback log (and via it the pending count) is written for acceptPmid");
assert(/reciterIdentitySet\(\[cwid\]\)/.test(acceptCase),
  "the orphan-identity guard still fronts every accept, same-work included");

// ---------------------------------------------------------------------------------------
console.log("\n2. 'same' is only ever written alongside a terminal status:");
assert(/matched_pmid_verdict: "same"/.test(acceptCase),
  "case \"accept\" writes matched_pmid_verdict 'same'");
const sameWrite = acceptCase.slice(acceptCase.indexOf('matched_pmid_verdict: "same"') - 400, acceptCase.indexOf('matched_pmid_verdict: "same"') + 120);
assert(/status: "accepted"/.test(sameWrite),
  "the SAME update also sets status 'accepted' (openStatusWhere sends any verdicted OPEN row back to the feed)");
assert(!/matched_pmid_verdict: "same"/.test(verdictCase),
  'case "verdict" still never writes \'same\' — it stays the "distinct"-only action');
assert(/verdict !== "distinct"/.test(verdictCase),
  'case "verdict" still rejects anything but "distinct"');

// ---------------------------------------------------------------------------------------
console.log('\n3. case "reopen" — a same-work accept has a real undo:');
assert(/const wasSameWork = isScopus && row\.matched_pmid_verdict === "same"/.test(reopenCase),
  "reopen recognises a same-work accept from the verdict the accept wrote");
assert(/const undoPmid = wasSameWork \? Number\(row\.matched_pmid\) : \(pmid as number\)/.test(reopenCase),
  "reopen deletes the twin's PMID, not the null scopus row.pmid");
assert(/if \(isScopus && !wasSameWork\) \{/.test(reopenCase),
  "the ExternalArticle revoke branch is skipped for a same-work row (it never created one)");
assert(/writeGoldStandard\(reverseCwid, undoPmid, "known", "DELETE", curator\.userID\)/.test(reopenCase),
  "the gold-standard undo uses undoPmid");
assert(/wasSameWork \? \{ matched_pmid_verdict: null \} : \{\}/.test(reopenCase),
  "reopen clears a 'same' verdict so the row returns to 'Possible duplicates', not the open feed");
assert(!/wasSameWork[\s\S]{0,200}"distinct"/.test(reopenCase),
  "a 'distinct' verdict is NOT cleared by reopen — 'never re-flag' outlives an undo");

// ---------------------------------------------------------------------------------------
console.log("\n4. /authorships client — the accept button and the force-add prompt:");
assert(/onAction\("accept",\s*\{\s*samePmid:\s*true\s*\}\)/.test(tabsSrc),
  'the button sends accept/{samePmid:true} (no PMID from the client)');
assert(/\{canAcceptSame && \(/.test(tabsSrc),
  "the accept button renders only when canAcceptSame (see section 9 for what that gate covers)");
assert(/Same paper — accept PMID \$\{r\.matched_pmid\}/.test(tabsSrc),
  "the label names the PMID being accepted");
assert(/onAction\("dismiss",\s*\{\s*reason:\s*"dup_of_matched_pmid"\s*\}\)/.test(tabsSrc),
  '"Same paper — dismiss" survives: deduplicating and attributing stay separate claims');
assert(/&& !extra\?\.samePmid/.test(tabsSrc),
  '"Add anyway" is NOT offered when a same-work accept 409s (force-add would create the duplicate)');
assert(/<CounterpartActions row=\{r\}/.test(tabsSrc) && (tabsSrc.match(/<CounterpartActions row=\{r\}/g) || []).length === 2,
  "both CounterpartActions call sites thread the row");

// ---------------------------------------------------------------------------------------
console.log('\n5. /curate card — "Same as PMID N" at the duplicate prompt:');
assert(/const samePmidCandidates = /.test(cardSrc), "samePmidCandidates helper defined");
assert(/if \(m\.type && m\.type\.includes\('DOI'\)\) continue/.test(cardSrc),
  "DOI-typed matches are excluded — their matchedId is a DOI, not a PMID");
assert(/\/\^\\d\{1,8\}\$\/\.test\(id\)/.test(cardSrc),
  "matchedId must look like a PMID before it is offered (ReCiter promises no shape)");
assert(/props\.onAcceptPmid && samePmidCandidates\(addState\?\.matches\)\.map/.test(cardSrc),
  "one button per candidate, and only when the consumer can actually accept a PMID");
assert(/Same as PMID \{candidate\}/.test(cardSrc), '"Same as PMID N" label present');
assert(/Add anyway/.test(cardSrc), '"Add anyway" is still offered beside it, not replaced');
const warnBox = cardSrc.slice(cardSrc.indexOf("status === 'warning'"), cardSrc.indexOf("<div className={styles.actions}>"));
assert(/samePmidCandidates/.test(warnBox),
  "the offer lives in the WARNING box only (a BLOCKED 409 is already in the record)");
assert(/\{props\.onAcceptPmid && \(\n\s*<button/.test(cardSrc),
  "the primary Add button renders only when onAcceptPmid was supplied (no silent no-op)");

// ---------------------------------------------------------------------------------------
console.log("\n6. the OpenAlex tab can accept a PMID at all:");
assert(/onAcceptPmid:\s*\(pmid: number, item: any\) => Promise<any>,/.test(openalexTabSrc),
  "TabAddExternalPublication declares onAcceptPmid as REQUIRED (an optional prop is how it went dead)");
assert(/const doAcceptPmid = \(pmid: number, item: any\) => \{/.test(openalexTabSrc),
  "TabAddExternalPublication implements doAcceptPmid");
assert(/onAcceptPmid=\{\(pmid, it\) => doAcceptPmid\(pmid, it\)\}/.test(openalexTabSrc),
  "it is passed to the card");
assert(/<TabAddExternalPublication[\s\S]{0,300}onAcceptPmid=\{handleAcceptPmid\}/.test(reciterTabsSrc),
  "ReciterTabs supplies handleAcceptPmid to the OpenAlex tab");

// ---------------------------------------------------------------------------------------
// Regression guards for the nine defects the adversarial review confirmed. Each of these is a
// concrete failure that reached working, type-checking, all-green code — they are the reason
// this file exists, so do not relax one without re-deriving why it was safe.
console.log("\n7. already-in-the-record guards (the twin PMID comes from the person's OWN candidate set):");
assert(/if \(sameWork && \(await getKnownPmidsByCwid\(\[cwid\]\)\)\[cwid\]\?\.has\(acceptPmid\)\)/.test(acceptCase),
  "a same-work accept on an ALREADY-ACCEPTED pmid is refused (else reopen would DELETE a pre-existing acceptance)");
assert(/status\(422\)[\s\S]{0,220}Same paper — dismiss/.test(acceptCase),
  "...and it names the action that does fit, rather than dead-ending the curator");
assert(acceptCase.indexOf("getKnownPmidsByCwid") < acceptCase.indexOf("writeGoldStandard"),
  "the guard runs BEFORE the gold-standard write");

console.log("\n8. a verdict can only land on an OPEN row:");
assert(/if \(row\.status !== "open"\) return res\.status\(409\)/.test(verdictCase),
  "case \"verdict\" refuses a resolved row — overwriting a 'same' would strand the gold-standard write with no undo");

console.log("\n9. /authorships button matches every server precondition (no dead ends):");
assert(/const canAcceptSame = !!r\.single_candidate && r\.matched_pmid != null && r\.identity_in_reciter !== false/.test(tabsSrc),
  "identity_in_reciter is honoured, same as the card's right rail — the server 422s without it");
assert(/\{canAcceptSame && \(/.test(tabsSrc), "the button renders off canAcceptSame");

console.log("\n10. /curate never silently overrides a decision the person already has on record:");
assert(/const known = props\.recordStatusOf && props\.recordStatusOf\(candidate\)/.test(cardSrc),
  "each candidate is checked against the person's record before an accept is offered");
assert(/if \(known\) return \(/.test(cardSrc),
  "an already-ruled-on PMID gets an explanation, never a bare 'Same as' button");
assert(/previously rejected for this person/.test(cardSrc),
  "the REJECTED case is called out by name (Java's UPDATE merge would silently un-reject it)");

console.log("\n11. accepting a candidate does not double-list it:");
assert(/const prevTabFor = \(pmid: number\): any => \{/.test(reciterTabsSrc),
  "prevTabFor resolves which tab the article must be removed from");
assert(/status === 'PENDING' \? 'NULL'/.test(reciterTabsSrc),
  "it maps getPmidStatus's 'PENDING' back to the 'NULL' tab value");
assert(/updatePublicationAssertion\(newObject, "ACCEPTED", prevTabFor\(newObject\.pmid\)\)/.test(reciterTabsSrc),
  "handleAcceptPmid passes it (undefined only ever ADDS, leaving a duplicate row and a wrong count)");

console.log("\n12. entryPath is NOT sent (see the handoff): PUBMED_SEARCH seeds ArticleProvenance src='PM':");
assert(!/entryPath/.test(reciterTabsSrc) && !/entryPath/.test(gsControllerSrc) && !/entryPath/.test(actionsSrc),
  "no entryPath plumbing — Java's PUBMED_SEARCH branch would relabel curator-found work MAN -> MAN_FROM_PM, unrepairably");

console.log(failures ? `\n${failures} FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
