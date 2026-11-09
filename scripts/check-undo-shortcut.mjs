#!/usr/bin/env node
/**
 * Global toast host + "Undo · U" (src/lib/undoShortcut.ts, ToastHost.tsx, AuthorshipsTabs.tsx).
 * Run: node scripts/check-undo-shortcut.mjs
 *
 * 1. The U-key gate and the one-Undo-at-a-time registry, run for real.
 * 2. Source checks: one ToastContainer (in _app), no admin-setting gate, no per-call position or
 *    theme overrides left, and Authorships' Undo moved onto showUndoToast with its 12s window.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { isUndoKey, handleUndoKey, registerUndo, clearUndo, runUndo } from "../src/lib/undoShortcut.ts";

const key = (k, extra = {}) => ({
  key: k, metaKey: false, ctrlKey: false, altKey: false, target: { tagName: "BODY" },
  defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra,
});
const noOverlay = { querySelector: () => null };
const overlay = { querySelector: (s) => (s.includes('[role="dialog"]') ? {} : null) };

// 1a. which keystrokes count
assert.equal(isUndoKey(key("u"), noOverlay), true);
assert.equal(isUndoKey(key("U"), noOverlay), true, "Shift/Caps Lock U still undoes");
assert.equal(isUndoKey(key("y"), noOverlay), false);
for (const m of ["metaKey", "ctrlKey", "altKey"]) assert.equal(isUndoKey(key("u", { [m]: true }), noOverlay), false, m);
for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) assert.equal(isUndoKey(key("u", { target: { tagName } }), noOverlay), false, tagName);
assert.equal(isUndoKey(key("u", { target: { tagName: "DIV", isContentEditable: true } }), noOverlay), false, "contenteditable");
assert.equal(isUndoKey(key("u"), overlay), false, "not behind an open dialog");

// 1b. registry: nothing registered -> key passes through untouched
let ran = 0;
let e = key("u");
assert.equal(handleUndoKey(e, noOverlay), false);
assert.equal(e.defaultPrevented, false);

// one Undo runs once, and dismisses its toast
let dismissed = 0;
const a = registerUndo(() => ran++, { dismiss: () => dismissed++ });
e = key("u");
assert.equal(handleUndoKey(e, noOverlay), true);
assert.equal(e.defaultPrevented, true);
assert.deepEqual([ran, dismissed], [1, 1]);
assert.equal(handleUndoKey(key("u"), noOverlay), false, "second U is a no-op");
assert.equal(runUndo(a), false, "and so is a late button click");

// a newer Undo replaces (and dismisses) the older one; the older id is dead
let ranA = 0, ranB = 0, dismissedA = 0;
const oldId = registerUndo(() => ranA++, { dismiss: () => dismissedA++ });
const newId = registerUndo(() => ranB++);
assert.equal(dismissedA, 1, "showing a new Undo toast takes the old one down");
assert.equal(runUndo(oldId), false);
clearUndo(oldId); // the old toast's exit animation finishing must not clear the new Undo
assert.equal(handleUndoKey(key("u"), noOverlay), true);
assert.deepEqual([ranA, ranB], [0, 1]);
assert.equal(runUndo(newId), false);

// closing the toast (timeout) ends the shortcut
const c = registerUndo(() => ran++);
clearUndo(c);
assert.equal(handleUndoKey(key("u"), noOverlay), false);

// canUndo gates the key only; the button still works
let gate = false, ranD = 0;
const d = registerUndo(() => ranD++, { canUndo: () => gate });
e = key("u");
assert.equal(handleUndoKey(e, noOverlay), false);
assert.equal(e.defaultPrevented, false, "a gated U is left alone");
gate = true;
assert.equal(handleUndoKey(key("u"), overlay), false, "the dialog check still applies");
assert.equal(runUndo(d), true, "button click ignores the keyboard gate");
assert.equal(ranD, 1);
console.log("1. undo shortcut + registry: ok");

// 2. source checks
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const grep = (re) => spawnSync("git", ["-C", root, "grep", "--untracked", "-nE", re, "--", "src"]).stdout.toString().trim();

const containers = grep("<ToastContainer( |>|$)").split("\n");
assert.equal(containers.length, 1, "exactly one ToastContainer");
assert.ok(containers[0].startsWith("src/components/elements/ToastHost/ToastHost.tsx:"));
assert.equal(grep("ToastContainerWrapper|showToasts"), "", "the per-page wrappers and the showToasts gate are gone");
assert.match(read("src/pages/_app.tsx"), /<ToastHost \/>/, "mounted once in _app");
assert.equal(grep("theme: ?['\"]colored|position: ?['\"]top-right"), "", "no per-call position/theme overrides left");

const host = read("src/components/elements/ToastHost/ToastHost.tsx");
for (const prop of ['position="bottom-center"', "autoClose={5000}", "hideProgressBar", 'theme="dark"', 'role="status"']) {
  assert.ok(host.includes(prop), `host sets ${prop}`);
}
assert.ok(host.includes("Undo · U"));

const tabs = read("src/components/elements/Authorships/AuthorshipsTabs.tsx");
assert.ok(!/<Snackbar open=\{!!undo\}/.test(tabs), "Authorships' undo Snackbar is gone");
assert.ok(!/k === "u"/.test(tabs), "and so is its own U handler");
const effect = tabs.slice(tabs.indexOf("showUndoToast(undo.label"), tabs.indexOf("}, [undo]);"));
assert.match(effect, /autoClose: 12000/, "keeps the 12s window");
assert.match(effect, /doUndoRef\.current\?\.\(\)/, "undo still runs doUndo (reopen the whole batch)");
assert.match(effect, /canUndo: \(\) => !overlayOpenRef\.current && !reportViewRef\.current/, "same overlay/report gates as its other shortcuts");
console.log("2. source: ok");
