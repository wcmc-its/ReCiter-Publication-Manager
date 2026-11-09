#!/usr/bin/env node
/**
 * PillGroup roving-focus math (src/components/ui/pillGroupKeys.ts).
 * Run: node scripts/check-ui-primitives.mjs
 *
 * No prerequisites, no DB, no build: the function under test is pure.
 */

import assert from "node:assert/strict";
import { nextPillIndex } from "../src/components/ui/pillGroupKeys.ts";

const none = [false, false, false, false];

// 1. arrows step and wrap, both axes
assert.equal(nextPillIndex("ArrowRight", 0, none), 1);
assert.equal(nextPillIndex("ArrowDown", 2, none), 3);
assert.equal(nextPillIndex("ArrowRight", 3, none), 0);
assert.equal(nextPillIndex("ArrowLeft", 0, none), 3);
assert.equal(nextPillIndex("ArrowUp", 1, none), 0);

// 2. Home / End
assert.equal(nextPillIndex("Home", 2, none), 0);
assert.equal(nextPillIndex("End", 0, none), 3);

// 3. disabled options are skipped, including at the ends
const mid = [false, true, true, false];
assert.equal(nextPillIndex("ArrowRight", 0, mid), 3);
assert.equal(nextPillIndex("ArrowLeft", 3, mid), 0);
const ends = [true, false, false, true];
assert.equal(nextPillIndex("Home", 2, ends), 1);
assert.equal(nextPillIndex("End", 1, ends), 2);
assert.equal(nextPillIndex("ArrowRight", 2, ends), 1);

// 4. only one enabled option: arrows stay on it
assert.equal(nextPillIndex("ArrowRight", 1, [true, false, true]), 1);

// 5. unhandled keys and all-disabled groups return null (Space/Enter go to the native click)
assert.equal(nextPillIndex(" ", 0, none), null);
assert.equal(nextPillIndex("Enter", 0, none), null);
assert.equal(nextPillIndex("Tab", 0, none), null);
assert.equal(nextPillIndex("ArrowRight", 0, [true, true]), null);

console.log("check-ui-primitives: all assertions passed");
