#!/usr/bin/env node
/**
 * The per-uid debounce/coalesce in controllers/analysisRefresh.ts.
 * Run: node --experimental-strip-types scripts/check-analysis-refresh.mjs
 *
 * fetch and the Cornell lookup are stubbed; nothing is called. Four claims:
 *   1. N writes for one uid inside the quiet window arm ONE timer (not N).
 *   2. A write that lands while a run is in flight yields exactly one more run — not zero
 *      (the accept would be missed) and not one per write (the race this exists to prevent).
 *   3. Two uids never share a timer or an in-flight slot.
 *   4. A Cornell-only uid is never run.
 */

import assert from "node:assert/strict";
import { scheduleAnalysisRefresh, __test } from "../controllers/analysisRefresh.ts";

const { timers, running, dirty, run, guard } = __test;
const cornellOnly = new Set(["jma7"]);
guard.isCornellOnly = async (uid) => cornellOnly.has(uid);
const tick = () => new Promise((r) => setImmediate(r)); // the guard lookup is async

// A fetch whose completion the test controls, so a "write mid-run" can be staged.
const calls = [];
let release;
globalThis.fetch = (url) => new Promise((resolve) => {
  calls.push(String(url));
  release = () => resolve({ status: 200, arrayBuffer: async () => new ArrayBuffer(0) });
});

// 1. debounce: one timer per uid however many writes
for (let i = 0; i < 300; i++) scheduleAnalysisRefresh("abc1234");
assert.equal(timers.size, 1);
scheduleAnalysisRefresh("xyz9999");
assert.equal(timers.size, 2, "second uid gets its own timer");
for (const t of timers.values()) clearTimeout(t); // don't hold the process open for 60s
timers.clear();

// 2. coalesce: writes during a run → exactly one follow-up run
const p1 = run("abc1234");
await tick();
assert.equal(calls.length, 1, "first run is in flight");
assert.ok(running.has("abc1234"));
for (let i = 0; i < 5; i++) await run("abc1234"); // five writes land mid-run
assert.equal(calls.length, 1, "mid-run writes do not start overlapping runs");
assert.ok(dirty.has("abc1234"), "…but they mark the uid dirty");
release(); await p1;
await tick();
assert.equal(calls.length, 2, "one follow-up run, not five");
assert.ok(!dirty.has("abc1234"));
release(); await new Promise((r) => setImmediate(r));
assert.ok(!running.has("abc1234"), "in-flight slot released");
assert.equal(calls.length, 2, "and nothing further");

// 3. the URL asks for a cache-only re-analysis of exactly that uid
assert.match(calls[0], /uid=abc1234&analysisRefreshFlag=true$/);
assert.ok(!/retrievalRefreshFlag/.test(calls[0]), "never a PubMed refetch");

// 4. Cornell-only: no ReCiter call, slot released
await run("jma7");
assert.equal(calls.length, 2, "Cornell-only uid is not run");
assert.ok(!running.has("jma7"));

console.log("ok — analysisRefresh debounce/coalesce");
