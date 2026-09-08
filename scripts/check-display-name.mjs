#!/usr/bin/env node
/**
 * Item 3 — the duplicate middle name. person.middleName holds a comma-joined variant list
 * ("Young,Y"), so a candidate rendered "Rowan Ashford,A Vance". The comma is in the DATA:
 * every name join in this repo is a plain space, so the fix is one pure normaliser
 * (src/lib/displayName.ts) applied where names are built/parsed.
 * Run: node --experimental-strip-types scripts/check-display-name.mjs
 *
 * No prerequisites, no DB, no build — same reasoning as scripts/check-assign-gate.mjs.
 *
 * Two sections:
 *   1. the rule    — cleanDisplayName's table, run against the real function
 *   2. the wiring  — that the helper is actually APPLIED at every site that builds or parses a
 *                    name on this surface. A green table proves the function; only this proves
 *                    the card stopped rendering the comma.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cleanDisplayName } from "../src/lib/displayName.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let n = 0;
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  console.log(`  PASS ${label} -> ${JSON.stringify(actual)}`);
  n++;
};

// ---------------------------------------------------------------------------------------
console.log("\n1. the rule:");

// The reported case, exactly as it rendered on the card.
check("the reported case: middleName 'Young,Y' loses the redundant initial AND the comma",
  cleanDisplayName("Rowan Ashford,A Vance"), "Rowan Ashford Vance");
check("...comma WITH a following space, same result",
  cleanDisplayName("Rowan Ashford, A Vance"), "Rowan Ashford Vance");
check("...and the initial FIRST across the comma, same result",
  cleanDisplayName("Rowan A,Ashford Vance"), "Rowan Ashford Vance");

// THE COMMA IS THE SIGNAL. A first attempt split on whitespace AND commas together and then
// tested whitespace adjacency, which threw away the one piece of evidence that says "these two
// tokens are one duplicated field". Measured on the dev DB it rewrote 267 candidate names across
// 258 queue rows and fixed ZERO of the 13 that carry the comma — and on the Pick-one homonym
// panel it rendered two DIFFERENT candidates as the same string, on the one surface whose whole
// job is telling near-identical people apart. These six are that regression.
check("a space-separated middle initial is NOT touched — 'Michael S Smith' keeps its S",
  cleanDisplayName("Michael S Smith"), "Michael S Smith");
check("...a given name that merely starts the surname survives ('Li Liu')",
  cleanDisplayName("Li Liu"), "Li Liu");
check("...two space-separated middle initials survive",
  cleanDisplayName("Sarah S J Jones"), "Sarah S J Jones");
check("...'John A Anderson' keeps the A",
  cleanDisplayName("John A Anderson"), "John A Anderson");
check("...'J John Johnson' is left entirely alone",
  cleanDisplayName("J John Johnson"), "J John Johnson");
check("...so two homonyms never collapse to one rendered string",
  cleanDisplayName("Michael S Smith") === cleanDisplayName("Michael Smith"), false);

// A name with no comma is returned unchanged.
check("a name with no comma is untouched", cleanDisplayName("Rowan Vance"), "Rowan Vance");
check("...three tokens, nothing redundant", cleanDisplayName("Renwick Osgood Thale"), "Renwick Osgood Thale");

// A middle name that is NOT a prefix of a neighbour survives verbatim, spelling and case.
check("a non-substring middle name is preserved verbatim",
  cleanDisplayName("Rowan Marie Vance"), "Rowan Marie Vance");
check("...a middle INITIAL that starts nothing adjacent stays",
  cleanDisplayName("Bernard J. Park"), "Bernard J. Park");
check("...a genuine two-initial middle name is untouched",
  cleanDisplayName("John A B Smith"), "John A B Smith");
check("...a generational suffix across the comma is not a prefix, so it stays",
  cleanDisplayName("John Smith, Jr"), "John Smith Jr");
check("...only the SHORTER token can go, so 'Ann' never removes 'Anna' across a comma",
  cleanDisplayName("Ann,Anna Smith"), "Anna Smith");
check("...a non-adjacent prefix is NOT redundant ('Y' is nowhere near 'Young')",
  cleanDisplayName("Y Rowan Ashford"), "Y Rowan Ashford");
check("...an equal-length repeat is left alone (strict prefix only)",
  cleanDisplayName("Han,Han"), "Han Han");
check("...case is compared insensitively but never rewritten",
  cleanDisplayName("Rowan ASHFORD,a Vance"), "Rowan ASHFORD Vance");

// Degenerate inputs.
check("a single-token name", cleanDisplayName("Han"), "Han");
check("a single token with a trailing comma", cleanDisplayName("Han,"), "Han");
check("the empty string", cleanDisplayName(""), "");
check("whitespace only", cleanDisplayName("   "), "");
check("commas only", cleanDisplayName(", ,"), "");
check("null", cleanDisplayName(null), "");
check("undefined", cleanDisplayName(undefined), "");
check("a non-string (a number off a raw DB row)", cleanDisplayName(42), "");

// ---------------------------------------------------------------------------------------
console.log("\n2. the wiring:");

const controller = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");
const tabs = readFileSync(join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"), "utf8");

const between = (src, from, to) => {
  const a = src.indexOf(from);
  const b = to ? src.indexOf(to, a) : src.length;
  assert.ok(a > -1, `wiring probe could not find ${JSON.stringify(from)} — the anchor moved`);
  return src.slice(a, b > -1 ? b : src.length);
};

check("controller imports the shared helper",
  /import \{ cleanDisplayName \} from "\.\.\/\.\.\/src\/lib\/displayName";/.test(controller), true);

// personNames() — the "First Middle Last" lookup behind the Recent-activity resolution_name.
check("personNames() cleans the name it joins",
  /cleanDisplayName\(\[p\.firstName, p\.middleName, p\.lastName\]/.test(
    between(controller, "async function personNames(", "\n// primaryAcademicDivision")), true);

// identityLabel() — ONE call after the fallback chain covers all three name sources, the third
// of which is identityPrimaryName()'s DynamoDB item.
const labelBody = between(controller, "async function identityLabel(", "async function identityPrimaryName(");
check("identityLabel() cleans the chosen name",
  /const name = cleanDisplayName\(bylineName \|\| legalName \|\| await identityPrimaryName\(cwid\)\)/.test(labelBody), true);
check("...so identityPrimaryName()'s result is covered by that same call",
  /await identityPrimaryName\(cwid\)\)/.test(labelBody), true);
check("...and the source ordering it falls back through is unchanged",
  /bylineName \|\| legalName \|\| await identityPrimaryName/.test(labelBody), true);

// top_name — cleaned once in the list response, which is what every card/panel renders.
check("the list response cleans top_name",
  /top_name: json\.top_name \? cleanDisplayName\(json\.top_name\) : json\.top_name,/.test(controller), true);
check("...null/empty top_name is passed through, NOT flattened to \"\"",
  /json\.top_name \? cleanDisplayName\(json\.top_name\) : json\.top_name/.test(controller), true);

// The candidate blob — cleaned at the single parse point, which is what the Pick-one rows and
// the bulk picker both read.
check("AuthorshipsTabs imports the shared helper",
  /import \{ cleanDisplayName \} from "\.\.\/\.\.\/\.\.\/lib\/displayName";/.test(tabs), true);
const parseBody = between(tabs, "const parseCandidates = (json?: string)", "// T4: a row's candidates");
check("parseCandidates() cleans every candidate name",
  /cleanDisplayName\(c\.name\)/.test(parseBody), true);
check("...and still returns [] for a non-array blob",
  /if \(!Array\.isArray\(parsed\)\) return \[\];/.test(parseBody), true);

// The card reads c.name straight from the parsed blob, so parseCandidates has to be the ONLY
// door into candidate_cwids_json — a second raw parse would render the comma again.
// `.candidate_cwids_json` is the property READ (prose and the type declaration don't match it).
const candidateReads = tabs.split("\n").filter((l) => /\.candidate_cwids_json/.test(l)).map((l) => l.trim());
check("every candidate_cwids_json read goes through parseCandidates",
  candidateReads.filter((l) => !l.includes("parseCandidates(")), []);
check("...and there are real reads to speak of (the probe isn't matching nothing)",
  candidateReads.length, 2);

// The component's OTHER JSON.parse is formatAuthorsJson over authors_json, which is immune:
// Scopus bylines are {given, surname} pairs with no middle-name element to duplicate. Same
// reason the server's acceptedBySlot() is left alone — it joins givenName + surname only.
check("the only other blob parse is the {given,surname} Scopus byline, which has no middle name",
  /const formatAuthorsJson[\s\S]*?JSON\.parse\(json\)[\s\S]*?a\?\.given[\s\S]*?a\?\.surname/.test(tabs), true);
check("...and acceptedBySlot() likewise builds givenName + surname only, no middleName",
  /const name = \[r\.givenName, r\.surname\]/.test(controller), true);

console.log(`\n${n} checks passed.\n`);
