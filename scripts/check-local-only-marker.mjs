#!/usr/bin/env node
/**
 * Contract for the local-only note marker (src/lib/localOnlyMarker.ts), shared by
 * `case "assign"`'s local_only branch (writer), `case "reopen"`'s marker-first predicate
 * (reader), and scripts/reconcile-local-only-assigns.mjs (writer of RECONCILED_MARKER).
 * Run: node scripts/check-local-only-marker.mjs
 *
 * No prerequisites, no DB, no build: every function under test is pure precisely so this can
 * run anywhere, same reasoning as scripts/check-assign-gate.mjs.
 *
 * Two sections:
 *   1. note reads — noteHasLocalOnlyMarker / noteIsReconciled / isLocalOnlyNote against real
 *      and near-real note text
 *   2. note writes — reconciledNote()'s separator behaviour
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  LOCAL_ONLY_MARKER, RECONCILED_MARKER,
  noteHasLocalOnlyMarker, noteIsReconciled, isLocalOnlyNote, reconciledNote,
} from "../src/lib/localOnlyMarker.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let n = 0;
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  console.log(`  PASS ${label} -> ${JSON.stringify(actual)}`);
  n++;
};

console.log("\nnote reads:");

// The exact text `case "assign"`'s local_only branch renders today (verified byte-identical
// to pre-PM#949 in this ticket's own report).
const PROD_NOTE = `assigned to abt4005 (no ReCiter identity) — ${LOCAL_ONLY_MARKER}`;
check("exact prod note text -> hasLocalOnlyMarker", noteHasLocalOnlyMarker(PROD_NOTE), true);
check("exact prod note text -> isLocalOnlyNote", isLocalOnlyNote(PROD_NOTE), true);

check("same text prefixed by a prior note -> still local-only",
  isLocalOnlyNote(`prior note | ${PROD_NOTE}`), true);

// The never-deployed ad5a7563 variant (a slightly different parenthetical, same marker) —
// defensive, free: nothing in the repo writes this today, but the marker text is what matters,
// not the sentence around it.
const AD5A7563_VARIANT =
  `assigned to abt4005 (no ReCiter identity, not a produced candidate) — ${LOCAL_ONLY_MARKER}`;
check("ad5a7563 variant (different parenthetical, same marker) -> still local-only",
  isLocalOnlyNote(AD5A7563_VARIANT), true);

check("null -> false", noteHasLocalOnlyMarker(null), false);
check("undefined -> false", noteHasLocalOnlyMarker(undefined), false);
check("empty string -> false", noteHasLocalOnlyMarker(""), false);
check("null -> isLocalOnlyNote false", isLocalOnlyNote(null), false);

// A reconciled row: the marker is APPENDED, never removed, so noteHasLocalOnlyMarker stays
// true (this row WAS local-only) but isLocalOnlyNote flips false (it no longer IS — reopen
// must treat it like an ordinary assign now).
const reconciled = reconciledNote(PROD_NOTE, "2026-08-31");
check("reconciledNote(...) result -> hasLocalOnlyMarker still true", noteHasLocalOnlyMarker(reconciled), true);
check("reconciledNote(...) result -> isLocalOnlyNote now false", isLocalOnlyNote(reconciled), false);
check("reconciledNote(...) result -> noteIsReconciled true", noteIsReconciled(reconciled), true);

console.log("\nnote writes — reconciledNote():");
check("appends with ' | ' when there is a prior note",
  reconciledNote("some note", "2026-08-31"), `some note | ${RECONCILED_MARKER} 2026-08-31`);
check("no separator when the prior note is empty",
  reconciledNote("", "2026-08-31"), `${RECONCILED_MARKER} 2026-08-31`);
check("no separator when the prior note is null",
  reconciledNote(null, "2026-08-31"), `${RECONCILED_MARKER} 2026-08-31`);

// ---------------------------------------------------------------------------------------
// Source: the local_only note template in the controller must render this exact marker text,
// not a copy of the string that could silently drift from the shared constant.
console.log("\nsource — controllers/db/authorships.controller.ts renders LOCAL_ONLY_MARKER:");
const src = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");
check("imports LOCAL_ONLY_MARKER from the shared lib",
  /import \{ LOCAL_ONLY_MARKER, noteHasLocalOnlyMarker, noteIsReconciled \} from "\.\.\/\.\.\/src\/lib\/localOnlyMarker"/.test(src), true);
check("local_only note template interpolates the constant, not a literal copy",
  src.includes("(no ReCiter identity) — ${LOCAL_ONLY_MARKER}"), true);
check("reopen keys the local-only predicate off the note marker",
  /noteHasLocalOnlyMarker\(row\.note\)/.test(src) && /noteIsReconciled\(row\.note\)/.test(src), true);

console.log(`\n${n}/${n} passed\n`);
