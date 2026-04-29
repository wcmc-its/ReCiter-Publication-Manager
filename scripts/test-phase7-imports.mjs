#!/usr/bin/env node
/**
 * Phase 7 Import Validation Script
 * Verifies all Phase 7 exports load correctly after build.
 * Run: npx tsx scripts/test-phase7-imports.mjs
 *
 * Prerequisites: npm run build must have completed successfully.
 */

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
let failures = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
  } else {
    console.log(`  ${FAIL} ${label}`);
    failures++;
  }
}

// --- Test 1: scopeResolver exports ---
console.log('\n1. scopeResolver.ts exports:');
try {
  const scopeResolver = await import('../src/utils/scopeResolver.ts');
  assert(typeof scopeResolver.isPersonInScope === 'function', 'isPersonInScope is a function');
  assert(typeof scopeResolver.isProxyFor === 'function', 'isProxyFor is a function');

  // Test isPersonInScope with sample inputs
  const scope = { personTypes: ['academic-faculty'], orgUnits: null };
  assert(scopeResolver.isPersonInScope(scope, null, ['academic-faculty']) === true, 'isPersonInScope returns true for matching personType');
  assert(scopeResolver.isPersonInScope(scope, null, ['student']) === false, 'isPersonInScope returns false for non-matching personType');
  assert(scopeResolver.isPersonInScope(null, null, []) === true, 'isPersonInScope returns true for null scope');

  // Test isProxyFor with sample inputs
  assert(scopeResolver.isProxyFor(['abc123', 'def456'], 'abc123') === true, 'isProxyFor returns true for included person');
  assert(scopeResolver.isProxyFor(['abc123'], 'xyz789') === false, 'isProxyFor returns false for non-included person');
  assert(scopeResolver.isProxyFor(null, 'abc123') === false, 'isProxyFor returns false for null proxyPersonIds');
} catch (e) {
  console.log(`  ${FAIL} scopeResolver import failed: ${e.message}`);
  failures++;
}

// --- Test 2: constants.js exports ---
console.log('\n2. constants.js exports:');
try {
  const constants = await import('../src/utils/constants.js');
  assert(constants.allowedPermissions.Curator_Scoped === 'Curator_Scoped', 'Curator_Scoped in allowedPermissions');
  assert(typeof constants.ROLE_CAPABILITIES === 'object', 'ROLE_CAPABILITIES is an object');
  assert(typeof constants.getCapabilities === 'function', 'getCapabilities is a function');
  assert(typeof constants.getLandingPage === 'function', 'getLandingPage is a function');

  // Verify ROLE_CAPABILITIES has all 5 roles
  const roleCount = Object.keys(constants.ROLE_CAPABILITIES).length;
  assert(roleCount === 5, `ROLE_CAPABILITIES has 5 entries (got ${roleCount})`);

  // Test getCapabilities with sample inputs
  const superCaps = constants.getCapabilities([{ roleLabel: 'Superuser', personIdentifier: 'test1' }]);
  assert(superCaps.canCurate.all === true, 'Superuser gets canCurate.all=true');
  assert(superCaps.canManageUsers === true, 'Superuser gets canManageUsers=true');

  const scopedCaps = constants.getCapabilities([{ roleLabel: 'Curator_Scoped', personIdentifier: 'test2' }]);
  assert(scopedCaps.canCurate.scoped === true, 'Curator_Scoped gets canCurate.scoped=true');
  assert(scopedCaps.canSearch === true, 'Curator_Scoped gets canSearch=true');
  assert(scopedCaps.canManageUsers === false, 'Curator_Scoped gets canManageUsers=false');

  // Test getLandingPage
  assert(constants.getLandingPage(superCaps) === '/search', 'Superuser lands on /search');
  assert(constants.getLandingPage(scopedCaps) === '/search', 'Curator_Scoped lands on /search');

  const selfCaps = constants.getCapabilities([{ roleLabel: 'Curator_Self', personIdentifier: 'cwid123' }]);
  assert(constants.getLandingPage(selfCaps) === '/curate/cwid123', 'Curator_Self lands on /curate/:id');

  // Verify NextJS14-specific functions preserved
  assert(typeof constants.setReportFilterKeyNames === 'function', 'setReportFilterKeyNames preserved');
  assert(typeof constants.setIsVisible === 'function', 'setIsVisible preserved');
} catch (e) {
  console.log(`  ${FAIL} constants import failed: ${e.message}`);
  failures++;
}

// --- Summary ---
console.log(`\n${'='.repeat(50)}`);
if (failures === 0) {
  console.log(`${PASS} All Phase 7 import tests passed!`);
  process.exit(0);
} else {
  console.log(`${FAIL} ${failures} test(s) failed.`);
  process.exit(1);
}
