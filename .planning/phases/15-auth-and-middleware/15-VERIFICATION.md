---
phase: 15-auth-and-middleware
verified: 2026-04-14T20:15:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 15: Auth and Middleware Verification Report

**Phase Goal:** A user who logs in receives a JWT containing their resolved permission keys and UI resources, and the middleware enforces route access using that permission set -- all without changing any visible behavior
**Verified:** 2026-04-14T20:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | findUserPermissionsEnriched returns distinct permission keys for a user's roles | VERIFIED | controllers/db/userroles.controller.ts:68-154; 4-table JOIN (admin_users -> admin_users_roles -> admin_role_permissions -> admin_permissions) with DISTINCT; 10 unit tests pass |
| 2 | findUserPermissionsEnriched returns permission resources for the resolved permissions | VERIFIED | controllers/db/userroles.controller.ts:137-152; admin_permission_resources query guarded by permissions.length > 0; Test 6 and Test 10 pass |
| 3 | After login via direct credentials, the JWT contains permissions and permissionResources fields | VERIFIED | nextauth.jsx:157-168 (direct login); apiResponse.permissions and apiResponse.permissionResources set with try/catch; JWT callback:313-318 serializes both as JSON strings |
| 4 | After login via SAML, the JWT contains permissions and permissionResources fields | VERIFIED | nextauth.jsx:42-52 (SAML path in findOrcreateAdminUser); createdAdminUser.permissions and .permissionResources set with try/catch; same JWT callback picks them up |
| 5 | The session exposes permissions and permissionResources to client-side components | VERIFIED | nextauth.jsx:284: session.data = token (entire token copied); token.permissions and token.permissionResources are present in token; accessible as session.data.permissions and session.data.permissionResources |
| 6 | The existing userRoles field remains in the JWT unchanged | VERIFIED | nextauth.jsx:308-311: token.userRoles = apiResponse.userRoles preserved; no modification to existing assignment |
| 7 | Middleware checks route access using permission keys from JWT, not role labels | VERIFIED | middleware.ts:52-80; getPermissionsFromRaw(decoded.permissions) -> hasPermission(permissions, requiredPermission); no role-label conditionals for route decisions |
| 8 | A ROUTE_PERMISSIONS lookup map defines which permission is required for each of the 7 protected routes | VERIFIED | middleware.ts:7-15; 7 entries confirmed: /manageusers->canManageUsers, /configuration->canConfigure, /curate->canCurate, /report->canReport, /search->canSearch, /notifications->canManageNotifications, /manageprofile->canManageProfile |
| 9 | A user with empty permissions gets baseline canSearch + canReport access | VERIFIED | middleware.ts:55-57: if (permissions.length === 0) permissions = ['canSearch', 'canReport']; Tests 18-20 pass |
| 10 | A Curator_Self user accessing another user's curate page is redirected to their own curate page | VERIFIED | middleware.ts:85-88: pathName !== '/curate/' + personIdentifier triggers redirectToLandingPage; Tests 11-12 pass |
| 11 | A Curator_Self user accessing /search is redirected to their curate page | VERIFIED | middleware.ts:73-80: lacks canSearch -> getLandingPageFromPermissions -> redirect; Test 13 passes |
| 12 | A Curator_All user can access /search and /curate but not /manageusers | VERIFIED | Tests 5, 6, 7 pass; Curator_All permissions don't include canManageUsers |
| 13 | A Superuser can access all 7 protected routes | VERIFIED | Tests 2, 3, 4 pass with all 7 permissions |
| 14 | A user with no session cookie is redirected to /login | VERIFIED | middleware.ts:102-106: else branch redirects to /login URL; Test 21 passes |
| 15 | Requests containing .git in the path receive 403 status | VERIFIED | middleware.ts:26-28: new NextResponse(null, { status: 403 }); Test 22 passes |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controllers/db/userroles.controller.ts` | findUserPermissionsEnriched function | VERIFIED | Exists, 88 lines of implementation (lines 68-155), exports both findUserPermissions (original) and findUserPermissionsEnriched (new) |
| `src/pages/api/auth/[...nextauth].jsx` | JWT callback with permissions + permissionResources | VERIFIED | Imports findUserPermissionsEnriched, wires into both SAML and direct login paths, JWT callback at lines 313-318 serializes both fields |
| `src/middleware.ts` | Permission-based middleware with ROUTE_PERMISSIONS map | VERIFIED | 113 lines, ROUTE_PERMISSIONS exported at line 7, all 3 permissionUtils helpers imported and used |
| `__tests__/permissionsEnriched.test.ts` | Unit tests for permission resolution (min 80 lines) | VERIFIED | 267 lines, 10 test cases, all pass |
| `__tests__/middleware.test.ts` | Unit tests for middleware route enforcement (min 100 lines) | VERIFIED | 328 lines, 24 test cases, all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| controllers/db/userroles.controller.ts | src/db/db | sequelize.query for permission resolution SQL | VERIFIED | Line 120: permRows = await sequelize.query(...); Line 139: permissionResources = await sequelize.query(...) |
| src/pages/api/auth/[...nextauth].jsx | controllers/db/userroles.controller.ts | import findUserPermissionsEnriched | VERIFIED | Line 7: import { findUserPermissions, findUserPermissionsEnriched } from '../../../../controllers/db/userroles.controller' |
| src/pages/api/auth/[...nextauth].jsx | JWT token | token.permissions = JSON.stringify | VERIFIED | Lines 313-318: token.permissions and token.permissionResources set in jwt callback |
| src/middleware.ts | src/utils/permissionUtils | import getPermissionsFromRaw, hasPermission, getLandingPageFromPermissions | VERIFIED | Line 3: import { getPermissionsFromRaw, hasPermission, getLandingPageFromPermissions } from './utils/permissionUtils' |
| src/middleware.ts | JWT token | jwt_decode reads permissions and userRoles from decoded token | VERIFIED | Line 52: getPermissionsFromRaw(decoded.permissions); Line 41: JSON.parse(tokenObj.userRoles) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| controllers/db/userroles.controller.ts | permissions, permissionResources | sequelize.query with 4-table JOIN and resource JOIN | Yes -- SQL queries against admin_permissions, admin_role_permissions, admin_permission_resources | FLOWING |
| src/pages/api/auth/[...nextauth].jsx | token.permissions | findUserPermissionsEnriched -> JWT callback serialization | Yes -- enriched.permissions flows directly into token.permissions | FLOWING |
| src/middleware.ts | permissions[] | getPermissionsFromRaw(decoded.permissions) from JWT | Yes -- decoded from signed JWT cookie, falls back to baseline if empty | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 56 tests pass (10 permissionsEnriched + 24 middleware + 22 permissionUtils) | npx jest --config jest.config.js --no-cache | 56 passed, 3 suites, 0.618s | PASS |
| findUserPermissionsEnriched exported from controller | grep "export const findUserPermissionsEnriched" controllers/db/userroles.controller.ts | Line 68 matched | PASS |
| ROUTE_PERMISSIONS has 7 entries | grep -c "can" (mapped from ROUTE_PERMISSIONS block) | 7 entries confirmed | PASS |
| allowedPermissions import removed from middleware | grep "allowedPermissions" src/middleware.ts | No match (exit 1) | PASS |
| isCuratorAll/isReporterAll/isSuperUser removed from middleware | grep "isCuratorAll\|isReporterAll\|isSuperUser" src/middleware.ts | No match | PASS |
| try/catch wraps both enrichment calls | Lines 43-51 (SAML), 160-168 (direct login) | Both present with console.error fallback | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 15-01 | findUserPermissions() resolves permissions from DB via role->permission JOINs at login time | SATISFIED | findUserPermissionsEnriched in userroles.controller.ts:68-154 performs 4-table JOIN |
| AUTH-02 | 15-01 | findUserPermissions() fetches permission_resources for the user's resolved permissions | SATISFIED | userroles.controller.ts:137-152 queries admin_permission_resources when permissions.length > 0 |
| AUTH-03 | 15-01 | JWT token contains permissions (string array) and permissionResources (object array) | SATISFIED | nextauth.jsx:313-318; both serialized as JSON strings via JSON.stringify |
| AUTH-04 | 15-01 | Session passes permissions and permissionResources to client-side components | SATISFIED | nextauth.jsx:284: session.data = token; entire token copied including new fields |
| MW-01 | 15-02 | Middleware checks permission set from JWT instead of deriving capabilities via getCapabilities() | SATISFIED | middleware.ts:52: getPermissionsFromRaw(decoded.permissions); no getCapabilities() present |
| MW-02 | 15-02 | Route-to-permission mapping defined as a simple lookup object in middleware code | SATISFIED | middleware.ts:7-15: ROUTE_PERMISSIONS with 7 entries; used at lines 69-74 |
| MW-03 | 15-02 | Baseline fallback grants canSearch + canReport when permission set is empty | SATISFIED | middleware.ts:55-57: if (permissions.length === 0) permissions = ['canSearch', 'canReport'] |
| MW-04 | 15-02 | Curation scope logic (self/scoped/proxy) remains unchanged in middleware | SATISFIED | middleware.ts:65-66: isSelfOnly uses r.roleLabel === 'Curator_Self' with broader-role exclusion list; lines 85-98 enforce self-only curate/notifications/manageprofile restrictions |
| MW-05 | 15-02 | Landing page redirect uses permission set instead of capability model | SATISFIED | middleware.ts:78: getLandingPageFromPermissions(permissions, userRoles) used for all redirect decisions |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/pages/api/auth/[...nextauth].jsx | 12 | import { allowedPermissions } from "../../../utils/constants" | Info | allowedPermissions is still imported and used in grantDefaultRolesToAdminUser (line 109-110) for role-label comparison in default role assignment logic. This is legitimate -- it is not used for route enforcement, only for the default role grant heuristic. Not a stub or blocker. |

### Human Verification Required

None -- all phase-15 behaviors are verifiable programmatically. The session data shape (session.data.permissions accessible in browser) requires a live login to confirm end-to-end, but the code path is fully wired and unit-tested.

### Gaps Summary

No gaps. All 15 observable truths verified. All 9 requirement IDs (AUTH-01 through AUTH-04, MW-01 through MW-05) satisfied with direct code evidence. All 56 tests pass. The allowedPermissions import in nextauth.jsx is not a gap -- it is used for default role assignment logic (not route enforcement) and is unrelated to Phase 15's scope.

---

_Verified: 2026-04-14T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
