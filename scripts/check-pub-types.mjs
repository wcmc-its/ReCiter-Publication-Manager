#!/usr/bin/env node
/**
 * Publication type taxonomy, peer-review and role defaults, source-type mapping, venue lines
 * and duplicate tests (src/lib/pubTypes.ts).
 * Run: node scripts/check-pub-types.mjs
 *
 * No prerequisites, no DB, no build: everything under test is pure.
 */

import assert from "node:assert/strict";
import {
  PUB_TYPE_GROUPS, PUB_TYPES, isPubType, typeGroupOf,
  defaultPeerReviewed, canBePeerReviewed, peerReviewedOf, defaultRole,
  mapSourceType, venueOf,
  titleSimilarity, isPossibleDuplicate, isDefiniteDuplicate, definiteDuplicateReason,
} from "../src/lib/pubTypes.ts";

// 1. taxonomy
assert.equal(PUB_TYPE_GROUPS.length, 4);
assert.equal(PUB_TYPES.length, 18);
assert.equal(new Set(PUB_TYPES).size, 18);
assert.equal(typeGroupOf("Reference Entry"), "book");
assert.equal(typeGroupOf("Software"), "other");
assert.equal(typeGroupOf("Patent"), undefined);
assert.ok(isPubType("Conference Abstract"));
assert.ok(!isPubType("Presentation"));

// 2. peer review
for (const t of PUB_TYPES) {
  const want = ["Academic Article", "Review", "Conference Paper"].includes(t);
  assert.equal(defaultPeerReviewed(t), want, t);
}
assert.equal(defaultPeerReviewed("Educational Material", { repository: "MedEdPORTAL" }), true);
assert.equal(defaultPeerReviewed("Educational Material", { repository: "mededportal.org" }), true);
assert.equal(defaultPeerReviewed("Educational Material", { repository: "Department site" }), false);
assert.equal(defaultPeerReviewed("Non-Peer-Reviewed Writing", { repository: "MedEdPORTAL" }), false);
assert.equal(canBePeerReviewed("Non-Peer-Reviewed Writing"), false);
assert.equal(canBePeerReviewed("Reference Entry"), true);
assert.equal(peerReviewedOf({ type: "Reference Entry", pr: true }), true);
assert.equal(peerReviewedOf({ type: "Academic Article", pr: false }), false);
assert.equal(peerReviewedOf({ type: "Academic Article" }), true);
assert.equal(peerReviewedOf({ type: "Educational Material", journal: "MedEdPORTAL" }), true);
assert.equal(peerReviewedOf({ type: "Non-Peer-Reviewed Writing", pr: true }), false, "handoff: never");

// 3. role
assert.equal(defaultRole("Edited Book"), "Editor");
assert.equal(defaultRole("Conference Proceedings"), "Editor");
assert.equal(defaultRole("Book Chapter"), "Author");

// 4. source type mapping (handoff table first, then the extras)
const T = (s, t) => mapSourceType(s, t).type;
const D = (s, t) => mapSourceType(s, t).disposition;
assert.equal(T("Crossref", "journal-article"), "Academic Article");
assert.equal(T("OpenAlex", "article"), "Academic Article");
assert.equal(T("Scopus", "Article"), "Academic Article");
assert.equal(T("OpenAlex", "review"), "Review");
assert.equal(T("Scopus", "Review"), "Review");
assert.equal(T("PubMed", ["Journal Article", "Review"]), "Review");
assert.equal(T("Crossref", "book-chapter"), "Book Chapter");
assert.equal(T("Scopus", "Book Chapter"), "Book Chapter");
assert.equal(T("Crossref", "proceedings-article"), "Conference Paper");
assert.equal(T("Scopus", "Conference Paper"), "Conference Paper");
assert.equal(T("Scopus", "cp"), "Conference Paper");
assert.equal(T("Crossref", "posted-content"), "Preprint");
assert.equal(T("OpenAlex", "preprint"), "Preprint");
assert.equal(T("Crossref", "reference-entry"), "Reference Entry");
assert.equal(T("OpenAlex", "reference-entry"), "Reference Entry");
assert.equal(T("Crossref", "dataset"), "Dataset");
assert.equal(T("Crossref", "dissertation"), "Dissertation");
assert.equal(T("Crossref", "report"), "Report");
for (const t of ["lecture-speech", "conference-poster", "LECTURE_SPEECH"]) {
  const m = mapSourceType("ORCID", t);
  assert.deepEqual([m.type, m.disposition, m.hidden], [null, "presentation", true], t);
}
for (const [s, t, notice] of [["OpenAlex", "erratum", "erratum"], ["OpenAlex", "retraction", "retraction"], ["Scopus", "Erratum", "erratum"], ["PubMed", ["Journal Article", "Published Erratum"], "erratum"]]) {
  const m = mapSourceType(s, t);
  assert.deepEqual([m.type, m.disposition, m.hidden, m.notice], [null, "not-counted", true, notice], `${s} ${t}`);
}
assert.equal(T("PubMed", ["Journal Article", "Editorial"]), "Editorial");
assert.equal(T("PubMed", ["Journal Article", "Case Reports"]), "Academic Article");
assert.equal(T("PubMed", "Journal Article"), "Academic Article");
assert.equal(D("PubMed", []), "unmapped");
assert.equal(D("ORCID", "patent"), "out-of-scope");
assert.equal(D("ORCID", "other"), "unmapped");
assert.equal(mapSourceType("ORCID", "other").hidden, false);
assert.equal(D("Crossref", "something-new"), "unmapped");
assert.equal(D("Crossref", "constructor"), "unmapped", "no prototype keys");
assert.equal(D("Nowhere", "article"), "unmapped");
assert.equal(T("ORCID", "edited-book"), "Edited Book");
assert.deepEqual(mapSourceType("ORCID", "blog-post"), { type: "Non-Peer-Reviewed Writing", disposition: "publication", hidden: false, kind: "Blog post" });

// 5. venue lines
assert.equal(venueOf({ type: "Academic Article", journal: "Hepatology", volume: "12", issue: "3", pages: "100-110" }), "Hepatology. 12(3):100-110");
assert.equal(venueOf({ type: "Letter", journal: "Lancet", pages: "e12" }), "Lancet; p. e12");
assert.equal(venueOf({ type: "Book", publisher: "Facet Publishing", place: "London" }), "London: Facet Publishing");
assert.equal(venueOf({ type: "Report", journal: "WCM" }), "WCM");
assert.equal(
  venueOf({ type: "Book Chapter", journal: "Research Data", eds: ["Rachel Okafor", "Simon T Vale"], publisher: "Facet Publishing", place: "London", pages: "1-20" }),
  "In: Rachel Okafor, Simon T Vale, editors. Research Data. London: Facet Publishing; p. 1-20");
assert.equal(venueOf({ type: "Book Chapter", journal: "Research Data" }), "In: Research Data.");
assert.equal(venueOf({ type: "Conference Proceedings", conf: "AMIA 2025, Atlanta", publisher: "AMIA" }), "AMIA 2025, Atlanta. AMIA");
assert.equal(venueOf({ type: "Conference Paper", journal: "Proc AMIA", publisher: "AMIA", pages: "5" }), "Proc AMIA. AMIA; p. 5");
assert.equal(venueOf({ type: "Preprint", journal: "medRxiv" }), "medRxiv (preprint, not peer reviewed)");
assert.equal(venueOf({ type: "Dataset", journal: "Zenodo" }), "Zenodo (dataset)");
assert.equal(venueOf({ type: "Reference Entry", journal: "UpToDate", publisher: "Wolters Kluwer", role: "Section editor", living: "yes", updated: "2026-03" }), "UpToDate (Wolters Kluwer) · section editor · updated 2026 Mar");
assert.equal(venueOf({ type: "Reference Entry", journal: "SEP", living: true }), "SEP · updated continuously");
assert.equal(venueOf({ type: "Non-Peer-Reviewed Writing", journal: "STAT", kind: "Op-ed or commentary" }), "STAT (op-ed or commentary)");
assert.equal(venueOf({ type: "Educational Material", journal: "MedEdPORTAL", kind: "Module", audience: "Students; Residents; Faculty" }), "MedEdPORTAL (module, for students, residents and faculty)");
assert.equal(venueOf({ type: "Educational Material", journal: "Site" }), "Site");
assert.equal(venueOf({ type: "Dissertation", publisher: "Cornell University", degree: "PhD" }), "Cornell University (PhD)");
assert.equal(venueOf({ type: "Dissertation", publisher: "Cornell University" }), "Cornell University (dissertation)");

// 6. duplicates
assert.equal(titleSimilarity("A study of livers.", "a STUDY of livers"), 1);
assert.equal(titleSimilarity("one two", "three four"), 0);
const a = { pmid: "123", doi: "10.1/ABC", title: "Liver disease trends in New York", year: 2025 };
assert.equal(definiteDuplicateReason(a, { pmid: 123 }), "Same PMID 123");
assert.ok(isDefiniteDuplicate({ doi: "10.1/abc" }, { doi: "https://doi.org/10.1/ABC" }));
assert.equal(definiteDuplicateReason({ sourceId: "W123" }, { sourceId: "W123" }), "Same OpenAlex id");
assert.equal(definiteDuplicateReason({ sourceId: "2-s2.0-1" }, { sourceId: "2-s2.0-1" }), "Same Scopus id");
assert.ok(!isDefiniteDuplicate({ doi: "" }, { doi: "" }));
// 6 of 7 distinct words shared = 0.857 -> possible; 5 of 7 -> not
const t1 = "global epidemiology of steatotic liver disease trends";
assert.ok(isPossibleDuplicate({ title: t1, date: "2025-10-01" }, { title: "global epidemiology of steatotic liver disease", year: "2025" }));
assert.ok(!isPossibleDuplicate({ title: t1, year: 2025 }, { title: "global epidemiology of steatotic liver", year: 2025 }));
assert.ok(!isPossibleDuplicate({ title: t1, year: 2025 }, { title: t1, year: 2024 }), "title alone never counts");
assert.ok(!isPossibleDuplicate({ ...a }, { ...a }), "definite is not also possible");
assert.ok(!isPossibleDuplicate({ title: "", year: 2025 }, { title: "", year: 2025 }), "blank titles");
assert.ok(!isPossibleDuplicate({ title: t1 }, { title: t1 }), "no year");

// review fixes: OpenAlex URL-form ids, blank manual-form year, "Yes" living flag
assert.equal(definiteDuplicateReason({ sourceId: "W123" }, { sourceId: "https://openalex.org/W123" }), "Same OpenAlex id");
assert.ok(isPossibleDuplicate(
  { title: "A study of things here now", year: "", date: "2024-01-02" },
  { title: "A study of things here now", year: 2024 },
));
assert.equal(venueOf({ type: "Reference Entry", journal: "UpToDate", living: "Yes" }), "UpToDate · updated continuously");

console.log("check-pub-types: all assertions passed");
