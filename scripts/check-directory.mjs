#!/usr/bin/env node
/**
 * The pure half of the directory lookup (src/lib/directory.ts) plus the two preview branches it
 * feeds (src/lib/bulkAssign.ts).
 * Run: node --experimental-strip-types scripts/check-directory.mjs
 *
 * No prerequisites, no LDAP bind, no DB, no build — same reason check-assign-gate.mjs is pure:
 * every caller of directoryIdentityPayload() ends in POST /reciter/identity/, which creates a
 * real DynamoDB Identity record, so the mapping cannot be exercised in place.
 *
 * Four sections:
 *   1. filter building   — injection safety and prefix-only matching
 *   2. attribute mapping — LDAP entry -> DirectoryPerson, both directories
 *   3. mint payload      — DirectoryPerson -> the ReCiter Identity body
 *   4. preview           — the two new typedCwidPreview branches, and their ORDER
 *
 * The Cornell fixtures are real entries, read from ldaps://query.directory.cornell.edu on
 * 2026-09-07 while sizing the local-only assign backlog. kjc39 and aw847 are both in that
 * backlog today: 255 rows / 67 people assigned to identifiers ReCiter has never had, so nothing
 * was ever written for any of them.
 */

import assert from "node:assert/strict";
import {
  escapeLdapFilter, buildNameFilter, projectWcmPerson, projectCornellPerson,
  directoryIdentityPayload, cornellPersonTypes, ldapDate,
} from "../src/lib/directory.ts";
import { typedCwidPreview } from "../src/lib/bulkAssign.ts";

let n = 0;
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  console.log(`  PASS ${label} -> ${typeof actual === "object" ? JSON.stringify(actual) : actual}`);
  n++;
};
const ok = (label, cond) => check(label, !!cond, true);

// ---------------------------------------------------------------------------- 1. filters
console.log("\nfilter building — a typed string is data, never syntax:");
check("a literal asterisk is escaped, not treated as a wildcard",
  escapeLdapFilter("a*b"), "a\\2ab");
check("parens and backslash are escaped",
  escapeLdapFilter("a(b)c\\d"), "a\\28b\\29c\\5cd");
ok("an injected filter cannot close the enclosing clause",
  !buildNameFilter("x)(uid=*", "(objectClass=person)", []).includes(")(uid=*)"));
ok("tokens are matched as PREFIXES — never a leading wildcard, which would de-index the scan",
  !buildNameFilter("cummings", "(objectClass=person)", []).includes("=*"));
check("multiple tokens are AND-ed, each as its own OR over the name attributes",
  buildNameFilter("kevin cummings", "(objectClass=person)", ["uid"]),
  "(&(objectClass=person)"
  + "(|(givenName=kevin*)(sn=kevin*)(displayName=kevin*)(uid=kevin*))"
  + "(|(givenName=cummings*)(sn=cummings*)(displayName=cummings*)(uid=cummings*)))");

// ------------------------------------------------------------------------- 2. attribute map
console.log("\nattribute mapping — a raw LDAP entry becomes a DirectoryPerson:");

// Real Cornell entry, uid=kjc39, 2026-09-07.
const cummings = projectCornellPerson({
  uid: "kjc39", displayName: "Kevin J. Cummings", givenName: "Kevin", sn: "Cummings",
  mail: "kjc39@cornell.edu", cornelledudeptname1: "CVM - Public and Ecosystem Health DEPT",
  cornelleduwrkngtitle1: "Professor", cornelleduprimaryaffiliation: "faculty",
});
check("cornell: id is the bare netid", cummings.id, "kjc39");
check("cornell: campus marker leads the person types, then the directory's own vocabulary",
  cummings.personTypes, ["cornell-ithaca", "cornell-faculty"]);
check("cornell: working title wins over the university title", cummings.title, "Professor");
check("cornell: no WCM bridge for a Cornell-only person", cummings.wcmCwid, null);

// Real Cornell entry, uid=aw847 — the duplicate-person bridge, live in production today.
const wang = projectCornellPerson({
  uid: "aw847", displayName: "Alan Wang", mail: "aw847@cornell.edu",
  cornelleduprimaryaffiliation: "exception", cornellEduCWID: "alw4013",
});
check("cornell: cornellEduCWID is captured — this is the bridge", wang.wcmCwid, "alw4013");
check("cornell: a nameless-but-present record still projects", wang.name, "Alan Wang");

// Real Cornell entry, uid=mh2482 — alumni. Scholars' Cornell client filters these out at the
// LDAP layer; we deliberately do not, because a 2021 paper still needs attributing.
const alum = projectCornellPerson({
  uid: "mh2482", displayName: "Mingyu He", mail: "mh2482@cornell.edu",
  cornelleduprimaryaffiliation: "alumni",
});
check("cornell: alumni are projected, not dropped", alum.personTypes, ["cornell-ithaca", "cornell-alumni"]);

check("cornell: preferred name beats the legal one — it is what appears on a byline",
  projectCornellPerson({
    uid: "mtw1", givenName: "Martin", sn: "Wells",
    cornelleduprefgivenname: "Marty", cornelleduprefsn: "Wells",
  }).givenName, "Marty");
check("cornell: multi-valued cornelleduaffiliation is the real person-type vocabulary",
  projectCornellPerson({
    uid: "x1", givenName: "A", sn: "B", cornelleduaffiliation: ["academic", "faculty"],
  }).personTypes, ["cornell-ithaca", "cornell-academic", "cornell-faculty"]);
check("cornell: an entry with no uid is not a person", projectCornellPerson({ sn: "Nobody" }), null);

const staff = projectWcmPerson({
  uid: "abc9001", weillCornellEduCWID: "abc9001", displayName: "Jane Q Doe",
  givenName: "Jane", weillCornellEduMiddleName: "Quinn", sn: "Doe",
  mail: ["Jane.Doe@med.cornell.edu"], weillCornellEduDepartment: "Radiology",
  weillCornellEduPersonTypeCode: ["staff"], title: "Research Coordinator",
});
check("wcm: the CWID is the identifier, not the uid attribute", staff.id, "abc9001");
// REVERSED 2026-09-08. This previously asserted ["wcm-staff"], on the rationale that the types
// should be namespaced so they could not be mistaken for Cornell's. The namespacing bought
// nothing — WCM's vocabulary is `academic-*` / `employee-*` / `affiliate-*` / `student-*` and
// Cornell's is `cornell-*`, already disjoint — and it cost a great deal: ED hands back
// ReCiter's OWN person types verbatim, so prefixing them produced a parallel vocabulary no
// cohort filter matches. Confirmed against a live Identity record: paa2013 carries
// "academic-faculty-weillfulltime" and "affiliate-cornell" unprefixed. 16 of the 61 people
// minted on 2026-09-08 were written with the prefixed form and needed repairing.
check("wcm: person types pass through unprefixed — ED already speaks ReCiter's vocabulary",
  staff.personTypes, ["staff"]);
check("wcm: emails are lowercased", staff.emails, ["jane.doe@med.cornell.edu"]);
check("wcm: middle name is carried — it reaches primaryName.middleInitial below",
  staff.middleName, "Quinn");
check("wcm: person types are never empty (ReCiter hides people whose personTypes is empty)",
  projectWcmPerson({ uid: "z1", givenName: "Z", sn: "Q" }).personTypes, ["wcm-directory"]);

// ---------------------------------------------------------------------------- 3. mint payload
console.log("\nmint payload — ReCiter's mandatory fields are uid,firstName,firstInitial,lastName:");

const p = directoryIdentityPayload(staff);
check("uid", p.uid, "abc9001");
check("primaryName carries every mandatory field", p.primaryName, {
  firstName: "Jane", firstInitial: "J", lastName: "Doe", middleName: "Quinn", middleInitial: "Q",
});
check("institution follows the source", p.primaryInstitution, "Weill Cornell Medicine");
check("department becomes an organizational unit of a type the ReCiter enum accepts",
  p.organizationalUnits, [{ organizationalUnitLabel: "Radiology", organizationalUnitType: "DEPARTMENT" }]);
check("primaryEmail is the first email", p.primaryEmail, "jane.doe@med.cornell.edu");
check("cornell people get the Cornell institution",
  directoryIdentityPayload(cummings).primaryInstitution, "Cornell University");
ok("no middle name -> no middleInitial key at all, rather than an empty one",
  !("middleInitial" in directoryIdentityPayload(cummings).primaryName));

// The guard that keeps the confirm honest: a record that cannot satisfy the mandatory fields
// is not mintable, so assignGate must receive inDirectory:false for it and fall back to the
// pre-existing local-only path instead of promising a mint that would fail on the POST.
check("no family name -> not mintable", directoryIdentityPayload(wang), null);
check("no given name -> not mintable",
  directoryIdentityPayload({ ...staff, givenName: null }), null);
ok("…and the mintable record IS mintable", directoryIdentityPayload(cummings) !== null);

// ---------------------------------------------------------------------------------- 4. preview
console.log("\ntypedCwidPreview — what the curator is told BEFORE they press Assign:");

const R = (directory) => typedCwidPreview({
  status: "resolved", cwid: "kjc39", name: null, hasIdentity: false, directory,
});
check("no directory hit -> the pre-existing local-only warning, unchanged",
  R(null), { text: "→ kjc39: no ReCiter identity — records on this row only", tone: "warn" });
check("mintable directory hit -> says an identity will be created",
  R({ source: "cornell", name: "Kevin J. Cummings", title: "Professor", dept: "CVM - Public and Ecosystem Health DEPT", wcmCwid: null, wcmCwidHasIdentity: false, mintable: true }),
  {
    text: "→ Kevin J. Cummings · Professor, CVM - Public and Ecosystem Health DEPT (Cornell directory)"
      + " — not in ReCiter; assigning creates their identity",
    tone: "warn",
  });
check("bridge -> names the identifier the write will ACTUALLY land on",
  R({ source: "cornell", name: "Alan Wang", title: null, dept: null, wcmCwid: "alw4013", wcmCwidHasIdentity: true, mintable: false }),
  { text: "→ Alan Wang: same person as alw4013 in ReCiter — will assign to alw4013", tone: "warn" });
// Order is load-bearing and mirrors assignGate's: a bridged person must never be offered as a
// mint, or the curator is promised a new identity while the write lands on an existing one.
check("bridge WINS over mintable when both are true",
  R({ source: "cornell", name: "Alan Wang", title: null, dept: null, wcmCwid: "alw4013", wcmCwidHasIdentity: true, mintable: true }),
  { text: "→ Alan Wang: same person as alw4013 in ReCiter — will assign to alw4013", tone: "warn" });
check("an unmintable, unbridged directory hit falls back to the local-only warning",
  R({ source: "wcm", name: "Nameless", title: null, dept: null, wcmCwid: null, wcmCwidHasIdentity: false, mintable: false }),
  { text: "→ kjc39: no ReCiter identity — records on this row only", tone: "warn" });
check("a person ReCiter already knows is unaffected by any of this",
  typedCwidPreview({ status: "resolved", cwid: "aer2006", name: "Tony Rosen", hasIdentity: true }),
  { text: "→ Tony Rosen", tone: "neutral" });

// ------------------------------------------------- 5. person-type vocabulary (2026-09-08)
// The bugs this guards, both found by inspecting records PM had already written to prod:
// `cornell-former postdoc` carried a SPACE where every other reader and writer uses
// `cornell-former-postdoc`, and WCM's codes were prefixed into a parallel vocabulary that no
// cohort filter matches.
console.log("\nperson-type vocabulary — one spelling per concept:");

check("a space becomes a hyphen",
  cornellPersonTypes(["former postdoc"]), ["cornell-former-postdoc"]);
check("and the value is lowercased first",
  cornellPersonTypes(["Retired Faculty"]), ["cornell-retired-faculty"]);
ok("longest-first with removal: 'retired faculty' is not ALSO read as 'faculty'",
  !cornellPersonTypes(["retired faculty"]).includes("cornell-faculty"));
check("but a bare 'faculty' still maps",
  cornellPersonTypes(["faculty"]), ["cornell-faculty"]);
check("a known term wrapped in noise resolves to the known term",
  cornellPersonTypes(["exception - w/sponsor"]), ["cornell-exception"]);
ok("an unknown value still slugifies to a well-formed token",
  cornellPersonTypes(["Visiting Scholar / Guest"]).every((t) => /^cornell-[a-z0-9-]+$/.test(t)));
ok("NOTHING this emits may contain whitespace",
  cornellPersonTypes(["former postdoc", "retired faculty", "exception - w/sponsor",
                      "Visiting Scholar / Guest", "email list"]).every((t) => !/\s/.test(t)));

const wcmTyped = projectWcmPerson({ uid: "aaa1001", weillCornellEduCWID: "aaa1001", sn: "Test",
  weillCornellEduPersonTypeCode: ["academic-faculty-weillfulltime", "affiliate-cornell"] });
check("WCM codes pass through UNPREFIXED — they are already ReCiter's vocabulary",
  wcmTyped.personTypes, ["academic-faculty-weillfulltime", "affiliate-cornell"]);
ok("...so affiliate-cornell, live on 483 people, is not mangled",
  wcmTyped.personTypes.includes("affiliate-cornell"));
check("a typeless ED record still gets a non-empty placeholder (empty hides articles)",
  projectWcmPerson({ uid: "bbb1001", weillCornellEduCWID: "bbb1001", sn: "Bare" }).personTypes,
  ["wcm-directory"]);

const cor = projectCornellPerson({ uid: "zz99", sn: "Test", cornelleduaffiliation: ["former postdoc"] });
check("the campus marker leads every Cornell record — campus scoping keys on it",
  cor.personTypes[0], "cornell-ithaca");
ok("and the projected type is the hyphenated form",
  cor.personTypes.includes("cornell-former-postdoc"));

// ------------------------------------------------- 6. create date + multi-valued departments
// The two fields the results table added. Both fail SILENTLY when wrong — a bad parse renders a
// plausible-looking wrong date, and a missed second department just looks like the person only
// has one — so they are asserted rather than eyeballed.
console.log("\ncreate date — an operational attribute becomes a plain YYYY-MM-DD:");
check("generalizedTime with a trailing Z", ldapDate("20240115123456Z"), "2024-01-15");
check("...and with fractional seconds, as AD writes it", ldapDate("20240115123456.0Z"), "2024-01-15");
check("a bare date with no time still parses", ldapDate("20240115"), "2024-01-15");
check("multi-valued: the first value wins", ldapDate(["20240115123456Z"]), "2024-01-15");
check("absent is null, not a crash", ldapDate(undefined), null);
check("a non-date string is discarded, never half-parsed", ldapDate("not-a-date"), null);
// An 18-digit FILETIME opens with year-like digits ("1330…") that would otherwise render as
// year 1330. The year bound is what rejects it.
check("an AD FILETIME integer is rejected, not read as year 1330",
  ldapDate("133000000000000000"), null);
check("a year before 1970 is not a directory record's creation date", ldapDate("18990101"), null);
check("month 00 is rejected", ldapDate("20240015"), null);

console.log("\ndepartments — a joint appointment is not one department:");
const twoDept = projectWcmPerson({
  uid: "ddd1001", weillCornellEduCWID: "ddd1001", givenName: "Dana", sn: "Two",
  weillCornellEduDepartment: ["Medicine", "Pediatrics"],
});
check("wcm: every value is kept", twoDept.depts, ["Medicine", "Pediatrics"]);
check("...and `dept` stays the first, because the mint writes exactly one", twoDept.dept, "Medicine");
check("no department at all is an empty list, not [null]",
  projectWcmPerson({ uid: "e1", weillCornellEduCWID: "e1", sn: "None" }).depts, []);
const corDept = projectCornellPerson({
  uid: "cd1", sn: "Joint", cornelledudeptname1: "Physics", cornelledudeptname2: "Astronomy",
});
check("cornell: numbered department slots both land", corDept.depts, ["Physics", "Astronomy"]);
// The case-insensitive read is the whole reason this column is not permanently blank.
check("created is read case-INSENSITIVELY — servers differ on how they echo attribute names",
  projectWcmPerson({
    uid: "f1", weillCornellEduCWID: "f1", sn: "Lower", createtimestamp: "20200607080910Z",
  }).created, "2020-06-07");
check("...and the camelCase spelling works too",
  projectWcmPerson({
    uid: "f2", weillCornellEduCWID: "f2", sn: "Camel", createTimestamp: "20200607080910Z",
  }).created, "2020-06-07");
check("...as does Active Directory's whenCreated",
  projectWcmPerson({
    uid: "f3", weillCornellEduCWID: "f3", sn: "AD", whenCreated: "20211130000000.0Z",
  }).created, "2021-11-30");
check("a directory that withholds operational attributes yields null, which is a real answer",
  projectWcmPerson({ uid: "f4", weillCornellEduCWID: "f4", sn: "Quiet" }).created, null);

console.log("\nprimary org — 'found in WCM ED' is not 'works at WCM':");
// ou=people carries NewYork-Presbyterian staff alongside WCM's own. gallric is one of them.
// Deriving the institution from `source` would label every one of them Weill Cornell.
const nyp = projectWcmPerson({
  uid: "gallric", weillCornellEduCWID: "gallric", givenName: "R", sn: "G",
  weillCornellEduPrimaryOrg: "NYP",
});
check("an NYP person in ou=people reports NYP, not the directory they were found in",
  nyp.primaryOrg, "NYP");
ok("...and `source` still says wcm, because that is which directory answered", nyp.source === "wcm");
check("a record with no primary org is null, not a guess",
  projectWcmPerson({ uid: "g1", weillCornellEduCWID: "g1", sn: "None" }).primaryOrg, null);
check("cornell publishes no equivalent", corDept.primaryOrg, null);
// RFC 4512 attribute options. ED really returns `weillCornellEduPrimaryOrganization;affiliate`
// next to the bare form, seen on the 2026-09-09 prod probe — so a key carrying a `;option`
// suffix must still be found, or the column silently empties for whoever has one.
check("an attribute carrying a ;option suffix is still read",
  projectWcmPerson({
    uid: "g2", weillCornellEduCWID: "g2", sn: "Opt",
    "weillCornellEduPrimaryOrg;affiliate": "NYP",
  }).primaryOrg, "NYP");
check("...and so is a create date wearing one",
  projectWcmPerson({
    uid: "g3", weillCornellEduCWID: "g3", sn: "Opt2",
    "createTimestamp;x-foo": "20150505214246Z",
  }).created, "2015-05-05");
// The real gallric values from that probe, end to end.
const gallric = projectWcmPerson({
  uid: "gallric", weillCornellEduCWID: "gallric", sn: "G",
  weillCornellEduPrimaryOrg: "NYP", createTimestamp: "20150505214246Z",
  weillCornellEduPrimaryDepartment: "Emergency Medicine",
  weillCornellEduDepartment: "Emergency Medicine",
});
check("live probe values: NYP", gallric.primaryOrg, "NYP");
check("live probe values: the 2015 create date", gallric.created, "2015-05-05");
check("a primary department that repeats the department is ONE entry, not two",
  gallric.depts, ["Emergency Medicine"]);
check("a primary department that DIFFERS is kept, and leads",
  projectWcmPerson({
    uid: "g4", weillCornellEduCWID: "g4", sn: "Two",
    weillCornellEduPrimaryDepartment: "Medicine", weillCornellEduDepartment: "Pediatrics",
  }).depts, ["Medicine", "Pediatrics"]);

console.log("\nminting an NYP person writes NYP, not Weill Cornell:");
// The bug this closes: institution was derived from which DIRECTORY answered, so every NYP
// person in ou=people minted as "Weill Cornell Medicine" and was then counted as WCM by
// INSTITUTION_BUCKETS.wcm in every institution-grouped report.
const nypMint = directoryIdentityPayload({
  ...nyp, givenName: "Richard", familyName: "Gallagher",
});
check("primaryInstitution is the curated NYP literal, not the WCM one",
  nypMint.primaryInstitution, "New York-Presbyterian Hospital");
check("...and institutions[] agrees with it",
  nypMint.institutions, ["New York-Presbyterian Hospital"]);
// MUST match INSTITUTION_BUCKETS.nyp in authorships.controller.ts exactly — a second spelling
// splits the institution across two buckets in reporting.
ok("the literal is the one the nyp bucket already covers",
  nypMint.primaryInstitution === "New York-Presbyterian Hospital");
check("a WCM person is untouched by the mapping",
  directoryIdentityPayload({
    ...nyp, primaryOrg: "WCM", givenName: "A", familyName: "B",
  }).primaryInstitution, "Weill Cornell Medicine");
check("an UNRECOGNISED org token falls back rather than inventing a vocabulary value",
  directoryIdentityPayload({
    ...nyp, primaryOrg: "SOMETHING-NEW", givenName: "A", familyName: "B",
  }).primaryInstitution, "Weill Cornell Medicine");
check("no org token at all is the pre-existing behaviour",
  directoryIdentityPayload({
    ...nyp, primaryOrg: null, givenName: "A", familyName: "B",
  }).primaryInstitution, "Weill Cornell Medicine");
check("case and padding do not defeat the mapping",
  directoryIdentityPayload({
    ...nyp, primaryOrg: " nyp ", givenName: "A", familyName: "B",
  }).primaryInstitution, "New York-Presbyterian Hospital");

console.log(`\n${n}/${n} passed\n`);
