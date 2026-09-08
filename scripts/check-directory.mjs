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
  directoryIdentityPayload,
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
check("wcm: person types are namespaced so they can't be mistaken for Cornell's",
  staff.personTypes, ["wcm-staff"]);
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

console.log(`\n${n}/${n} passed\n`);
