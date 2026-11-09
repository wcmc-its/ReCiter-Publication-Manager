#!/usr/bin/env node
/**
 * Configuration page display map, Word export limit key and row summaries
 * (src/lib/adminSettingsDisplay.ts).
 * Run: node scripts/check-admin-settings-display.mjs
 *
 * No prerequisites, no DB, no build: everything under test is pure.
 */

import assert from "node:assert/strict";
import {
  SETTING_DISPLAY, displayName, displayDesc,
  isWordExportSetting, exceedsWordExportLimit, WORD_EXPORT_LIMIT, settingSummary,
} from "../src/lib/adminSettingsDisplay.ts";

// 1. display map renames by viewName and leaves the stored viewLabel alone
const rtf = { viewName: "reportingArticleRTF", viewLabel: "Reporting Article RTF", viewAttributes: [{ maxLimit: "5000" }] };
assert.equal(displayName(rtf), "Word export");
assert.equal(rtf.viewLabel, "Reporting Article RTF");
assert.equal(displayName({ viewName: "reportingArticleCSV", viewLabel: "Reporting Article CSV" }), "Excel export · publications");
assert.equal(displayName({ viewName: "reportingAuthorshipCSV", viewLabel: "Reporting Authorship CSV" }), "Excel export · authorships");
assert.match(displayDesc(rtf), /Word \(\.docx\)/);

// unmapped rows fall through to the DB label and the viewLabel-based description
assert.equal(displayName({ viewName: "headshot", viewLabel: "Headshot" }), "Headshot");
assert.equal(displayDesc({ viewName: "headshot" }), undefined);
assert.equal(displayName({ viewLabel: "Orphan" }), "Orphan");

// a relabelled DB row (display text) never matches the map by label
assert.equal(displayName({ viewName: "somethingElse", viewLabel: "Word export" }), "Word export");
assert.deepEqual(Object.keys(SETTING_DISPLAY).sort(), ["reportingArticleCSV", "reportingArticleRTF", "reportingAuthorshipCSV"]);

// 2. validation key: stable viewName or legacy stored label, never the display text
assert.ok(isWordExportSetting("reportingArticleRTF"));
assert.ok(isWordExportSetting("Reporting Article RTF"));
assert.ok(!isWordExportSetting("Word export"));
assert.ok(!isWordExportSetting("reportingArticleCSV"));
assert.ok(!isWordExportSetting(3)); // roles pass an index through the same argument
assert.equal(WORD_EXPORT_LIMIT, 30000);
assert.ok(exceedsWordExportLimit("30001"));
assert.ok(!exceedsWordExportLimit("30000"));
assert.ok(!exceedsWordExportLimit("5000"));
assert.ok(!exceedsWordExportLimit(""));

// 3. summaries
assert.equal(settingSummary(rtf, true), "Unsaved changes");
assert.equal(settingSummary(rtf, false), "Max 5,000");
assert.equal(settingSummary({ viewName: "reportingAuthorshipCSV", viewAttributes: [{ maxLimit: 50000 }] }, false), "Max 50,000");
assert.equal(settingSummary({ viewName: "EmailNotifications", viewAttributes: [{ labelUserKey: "emailNotifications", isVisible: true }, { maxLimit: 10 }] }, false), "Enabled");
assert.equal(settingSummary({ viewName: "EmailNotifications", viewAttributes: [{ labelUserKey: "emailNotifications", isVisible: false }] }, false), "Off");
assert.equal(settingSummary({ viewName: "findPeople", viewAttributes: [{}, {}, {}] }, false), "3 settings");
assert.equal(settingSummary({ viewName: "headshot", viewAttributes: [{ syntax: "x" }] }, false), "1 setting");
assert.equal(settingSummary({ viewName: "headshot" }, false), "0 settings");

console.log("check-admin-settings-display: all assertions passed");
