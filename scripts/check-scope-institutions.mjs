#!/usr/bin/env node
// Self-test for the institution scope axis (admin_users.scope_institutions -> person.primaryInstitution).
// Run: node --experimental-strip-types scripts/check-scope-institutions.mjs
import assert from "node:assert/strict";
import { hasConfiguredScope, isPersonInScope, withoutScopeKeys } from "../src/utils/scopeResolver.ts";

const qatar = { personTypes: null, orgUnits: null, institutions: ["Weill Cornell Medical College in Qatar", "Hamad Medical Corporation"] };

assert.equal(hasConfiguredScope(qatar), true);
assert.equal(hasConfiguredScope({ personTypes: null, orgUnits: null, institutions: [] }), false);
assert.equal(hasConfiguredScope({ personTypes: null, orgUnits: null }), false); // pre-existing tokens without the key
assert.equal(hasConfiguredScope(null), false);

assert.equal(isPersonInScope(qatar, "Medicine", ["academic-faculty"], "Hamad Medical Corporation"), true);
assert.equal(isPersonInScope(qatar, "Medicine", ["academic-faculty"], "Weill Cornell Medical College"), false);
assert.equal(isPersonInScope(qatar, "Medicine", ["academic-faculty"], null), false);
// AND across axes: institution alone isn't enough when orgUnits is also restricted
assert.equal(isPersonInScope({ ...qatar, orgUnits: ["Pediatrics"] }, "Medicine", [], "Hamad Medical Corporation"), false);
// legacy 3-arg callers (no institution passed) still work when institutions is unrestricted
assert.equal(isPersonInScope({ personTypes: null, orgUnits: ["Medicine"] }, "Medicine", []), true);

assert.deepEqual(withoutScopeKeys({ scopeInstitutions: ["x"], scopeOrgUnits: [], nameOrUids: ["a"] }), { nameOrUids: ["a"] });

console.log("check-scope-institutions: PASS");
