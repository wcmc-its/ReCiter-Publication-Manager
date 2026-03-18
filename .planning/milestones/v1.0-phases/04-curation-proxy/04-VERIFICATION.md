---
phase: 04-curation-proxy
verified: 2026-03-17T23:30:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 4: Curation Proxy Verification Report

**Phase Goal:** Proxy curation — allow users to curate publications for specific people beyond their normal scope
**Verified:** 2026-03-17T23:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All truths are drawn from the four plan `must_haves.truths` blocks (Plans 01–04).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Proxy relationships can be created and queried from admin_users_proxy table | VERIFIED | `AdminUsersProxy.ts` — full Sequelize model, tableName `admin_users_proxy`, unique composite index `idx_user_person`. Registered in `init-models.ts` line 225. |
| 2 | Proxy person IDs are embedded in JWT at login time alongside scope data | VERIFIED | `[...nextauth].jsx` lines 161–163: `token.proxyPersonIds = JSON.stringify(parsed.proxyPersonIds)` in JWT callback. Session callback line 134–136 passes through to `session.data.proxyPersonIds`. |
| 3 | isProxyFor utility correctly determines if a user is proxy for a given person | VERIFIED | `scopeResolver.ts` lines 63–69: `export function isProxyFor(proxyPersonIds, personIdentifier)` — null/empty guard, then `includes`. All 5 unit tests in `proxy.test.ts` cover the spec'd behaviors. |
| 4 | getCapabilities includes proxyPersonIds array for downstream access checks | VERIFIED | `constants.js` line 125: `canCurate: { all: false, self: false, scoped: false, personIdentifier: null, scopeData: null, proxyPersonIds: [] }` — field initialized. |
| 5 | Proxy CRUD endpoints accept and persist proxy assignment data | VERIFIED | Four files confirmed substantive: `proxy/index.ts` (GET list by userID + personIdentifier, POST replace-all with transaction), `grant.ts` (POST replace-all by personIdentifier), `search-persons.ts`, `search-users.ts`. All include auth header check. |
| 6 | Superuser can assign proxy people to a user from the AddUser/EditUser form | VERIFIED | `ProxyAssignmentsSection.tsx` exists with legend, helper text, debounced autocomplete. `AddUser.tsx` imports it (line 14), loads existing proxies on edit (line 239), saves on submit (lines 140–175), shows correct toast. |
| 7 | Proxy assignments are persisted to admin_users_proxy table on save | VERIFIED | `AddUser.tsx` POSTs to `/api/db/admin/proxy` with `personIdentifiers` array. `proxy/index.ts` POST handler performs destroy+bulkCreate in a transaction. |
| 8 | UsersTable shows proxy count column with correct singular/plural/empty formatting | VERIFIED | `UsersTable.tsx` line 23: `<th>Proxies</th>`. Lines 65–68: count 0 → em dash, 1 → "1 person", N → "N people". |
| 9 | ProxyAssignmentsSection only appears when user has a curation role | VERIFIED | `AddUser.tsx` lines 67–69: `hasCurationRole` checks all three curator roles. Section rendered inside `Collapse in={hasCurationRole}`. |
| 10 | Proxied users display with teal [PROXY] badge in search results | VERIFIED | `ProxyBadge.tsx` — `backgroundColor: '#17a2b8'`, fontSize 10px, fontWeight 600. `Search.js` line 437: `isProxy={isProxyFor(proxyPersonIds, identity.personIdentifier)}`. Name component renders `<ProxyBadge />` at line 562 when `isProxy`. |
| 11 | Scope filter checkbox includes proxy matches when checked | VERIFIED | `Search.js` lines 151–152 and 292–293: `scopeFilters = { ...scopeFilters, proxyPersonIds }` added when scope filter active. `person.controller.ts` lines 48–65: OR logic combining scope AND conditions with `personIdentifier IN proxyPersonIds`. |
| 12 | ScopeLabel in sidebar shows proxy count alongside scope summary | VERIFIED | `ScopeLabel.tsx` props include `proxyCount?: number`, constructs "Curating: X + N proxied people" or "Curating: N proxied people". `SideNavbar.tsx` lines 224–231 parses proxyPersonIds from session, passes `proxyCount` to ScopeLabel. |
| 13 | Grant Proxy Access button visible on curation page for curators who can curate the person | VERIFIED | `CurateIndividual.tsx` line 178: "Grant Proxy Access" button rendered conditionally on `canCurateThisPerson`. |
| 14 | Proxy user can navigate to /curate/:id for a proxied person without being redirected | VERIFIED | `curate/[id].js` lines 46–51: parses `proxyPersonIds`, calls `isProxyFor(proxyPersonIds, personId)`, returns early if true — bypasses scope API call and redirect. |
| 15 | Proxy user can navigate to /manageprofile/:id for a proxied person without being redirected | VERIFIED | `manageprofile/[userId].tsx` lines 27–30: same proxy override pattern as curate page — `isProxyFor` short-circuits before scope check. |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/models/AdminUsersProxy.ts` | Sequelize model for admin_users_proxy junction table | VERIFIED | 101 lines. Contains `class AdminUsersProxy extends Model`, `tableName: 'admin_users_proxy'`, `idx_user_person` unique composite index, all 4 CRUD association mixins. |
| `src/utils/scopeResolver.ts` | isProxyFor utility function | VERIFIED | Exports `isProxyFor`, `isPersonInScope`, `ScopeData`. All three exports confirmed. |
| `src/pages/api/db/admin/proxy/index.ts` | Proxy list and save API | VERIFIED | 111 lines. Handles GET (by userID with person enrichment, by personIdentifier for GrantProxyModal), POST (replace-all with transaction). Auth header check on first line. |
| `src/pages/api/db/admin/proxy/grant.ts` | Grant proxy from curation page API | VERIFIED | 46 lines. POST handler, personIdentifier+userIds body, destroy+bulkCreate transaction, auth guard. |
| `src/pages/api/db/admin/proxy/search-persons.ts` | Person search API for proxy autocomplete | VERIFIED | 39 lines. Op.or on firstName/lastName/personIdentifier, limit 20, 2-char minimum. |
| `src/pages/api/db/admin/proxy/search-users.ts` | Admin user search API for grant proxy modal | VERIFIED | 56 lines. Filters by Curator_All/Scoped/Self roles, status=1, limit 20. Nested Sequelize include for role filtering. |
| `__tests__/utils/proxy.test.ts` | Unit tests for isProxyFor (min_lines: 30) | WARN | 28 lines — 2 lines below the 30-line minimum specified in plan frontmatter. All 5 required test cases are present and substantive (null, empty array, match, no-match, single-element). The shortfall is whitespace/comment lines, not missing test coverage. |
| `src/components/elements/AddUser/ProxyAssignmentsSection.tsx` | Autocomplete multi-select for proxy person assignment | VERIFIED | 107 lines. Legend "Proxy Assignments", helper text, debounced 300ms search, getOptionLabel with lastName/firstName/personIdentifier/orgUnit format, isOptionEqualToValue by personIdentifier. |
| `src/components/elements/AddUser/ProxyAssignmentsSection.module.css` | Fieldset styling matching CurationScopeSection | VERIFIED | `background-color: #f5f5f5`, `border: 1px solid #dee2e6`, legend 20px/400 weight, helper text 14px/#777777. |
| `src/components/elements/Search/ProxyBadge.tsx` | Teal pill badge component for PROXY indicator | VERIFIED | 20 lines. `backgroundColor: '#17a2b8'`, fontSize 10px, fontWeight 600, marginLeft 8px, verticalAlign middle, "PROXY" text. |
| `src/components/elements/CurateIndividual/GrantProxyModal.tsx` | Modal for granting proxy access from curation page | VERIFIED | 225 lines. All required strings present: "Grant Proxy Access", "Select users who can curate publications for", "Save Proxy Assignments", "Discard Changes", "Search users...", "Proxy access granted. Changes take effect on the user's next login.", error toast. |
| `src/components/elements/CurateIndividual/CurateIndividual.tsx` | Grant Proxy Access button and PROXY badge on curation page | VERIFIED | Imports GrantProxyModal, ProxyBadge, isProxyFor. ProxyBadge rendered at line 161, "Grant Proxy Access" button at line 178. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `controllers/db/userroles.controller.ts` | `admin_users_proxy` table | `getProxyDataForUser` SQL query | WIRED | Line 37: `SELECT personIdentifier FROM admin_users_proxy WHERE userID = :userID`. Return at line 110 includes `proxyPersonIds`. |
| `src/pages/api/auth/[...nextauth].jsx` | `token.proxyPersonIds` | JWT callback embedding | WIRED | Lines 161–163: `if (parsed.proxyPersonIds && parsed.proxyPersonIds.length > 0) token.proxyPersonIds = JSON.stringify(...)`. Session callback passes to `session.data.proxyPersonIds`. |
| `src/utils/scopeResolver.ts` | `proxyPersonIds` array | `isProxyFor` function | WIRED | `export function isProxyFor(proxyPersonIds: string[] | null, personIdentifier: string): boolean` — correct signature, correct guard, correct includes. |
| `src/components/elements/AddUser/AddUser.tsx` | `ProxyAssignmentsSection` | import and conditional render | WIRED | Line 14: `import ProxyAssignmentsSection from './ProxyAssignmentsSection'`. Rendered at line 424 inside `Collapse in={hasCurationRole}`. |
| `src/components/elements/AddUser/AddUser.tsx` | `/api/db/admin/proxy` | fetch for load/save | WIRED | Load at line 239 (GET with userID), save at lines 140 and 164 (POST with personIdentifiers array). |
| `controllers/db/manage-users/user.controller.ts` | `AdminUsersProxy` | include in listAllUsers findAndCountAll | WIRED | Lines 76–78: `{ model: models.AdminUsersProxy, as: 'adminUsersProxies', attributes: ['personIdentifier'] }`. |
| `src/components/elements/Search/Search.js` | `ProxyBadge` | import and conditional render per proxyPersonIds | WIRED | Line 20: `import ProxyBadge from './ProxyBadge'`. Line 437: `isProxy={isProxyFor(proxyPersonIds, identity.personIdentifier)}`. Name component renders ProxyBadge at line 562. |
| `src/components/elements/Search/Search.js` | `proxyPersonIds` filter | session.data.proxyPersonIds parsed and sent to API | WIRED | Lines 76–78: parse from session. Lines 151–152 and 292–293: added to API filter body when scope filter active. |
| `controllers/db/person.controller.ts` | `admin_users_proxy` OR scope filter | Op.or combining scope conditions with proxy personIdentifier IN | WIRED | Lines 48–65: OR logic wraps existing AND conditions with proxy `personIdentifier IN proxyPersonIds`. |
| `src/components/elements/CurateIndividual/CurateIndividual.tsx` | `GrantProxyModal` | import and state-controlled render | WIRED | Line 20: `import GrantProxyModal from './GrantProxyModal'`. State `showGrantProxy` controls modal show prop. |
| `src/pages/curate/[id].js` | `isProxyFor` check | expanded access check combining scope OR proxy | WIRED | Line 8: `import { isPersonInScope, isProxyFor }`. Lines 46–51: proxy check before scope API call, returns early on match. |
| `src/pages/manageprofile/[userId].tsx` | `isProxyFor` check | expanded access check combining scope OR proxy | WIRED | Line 8: import confirmed. Lines 27–30: same proxy override pattern as curate page. |
| `GrantProxyModal` | `/api/db/admin/proxy/grant` | POST on save | WIRED | `GrantProxyModal.tsx` line 114: `fetch('/api/db/admin/proxy/grant', { method: 'POST', ... })`. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROXY-01 | 04-01, 04-02 | Superuser can assign one user as a curation proxy for another user from Manage Users | SATISFIED | ProxyAssignmentsSection in AddUser form, proxy CRUD API, adminUsersProxy table model all in place. |
| PROXY-02 | 04-04 | Curators with existing curation privileges can grant proxy access from individual curation page | SATISFIED | GrantProxyModal component, "Grant Proxy Access" button on CurateIndividual, grant API endpoint. |
| PROXY-03 | 04-01, 04-02 | Proxy relationships are many-to-many (a user can proxy for multiple people, a person can have multiple proxies) | SATISFIED | admin_users_proxy junction table with unique (userID, personIdentifier) constraint allows many-to-many. replace-all pattern handles multi-assignment. |
| PROXY-04 | 04-03 | Proxied users display with a [PROXY] badge in Find People search results for the proxy user | SATISFIED | ProxyBadge component, Search.js renders it conditionally via isProxyFor per result row. Search.test.tsx confirms badge renders. |
| PROXY-05 | 04-03 | Proxy user can filter search results to show only their proxied users via a checkbox filter | SATISFIED | Scope filter checkbox passes proxyPersonIds to person API. Person controller combines scope AND proxy with OR logic. |
| PROXY-06 | 04-01, 04-04 | Proxy user can navigate to and curate publications on behalf of their proxied users | SATISFIED | curate/[id].js proxy override bypasses scope check. manageprofile/[userId].tsx same pattern. isProxyFor utility in scopeResolver. |

All 6 PROXY requirements satisfied. No orphaned requirements detected — all IDs claimed in plan frontmatter are accounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `controllers/db/userroles.controller.ts` | 105 | `console.log('[AUTH] Proxy lookup failed')` | INFO | Intentional fallback log in try-catch. Safe error handling — proxy table may not exist yet in some environments. |
| `__tests__/utils/proxy.test.ts` | (all) | 28 lines vs plan min_lines: 30 | INFO | 2 lines under the frontmatter threshold. All 5 required test cases are present. Shortfall is not missing test coverage. |

No stub patterns (return null, placeholder components, TODO/FIXME in implementation paths, empty handlers) found in any of the 15+ files examined.

---

### Human Verification Required

The plan included a `checkpoint:human-verify` gate (Task 3 of Plan 04) which the SUMMARY documents as APPROVED. The following items cannot be confirmed programmatically and rely on that human checkpoint:

**1. Autocomplete debounce behavior**
- Test: Type a single character in ProxyAssignmentsSection or GrantProxyModal, verify no fetch fires. Type 2+ characters, verify results appear after 300ms.
- Expected: No API calls for < 2 characters, debounced search at 300ms threshold.
- Why human: Cannot verify timing behavior from static code analysis.

**2. Proxy badge visual appearance**
- Test: Log in as a proxy user, search for a proxied person, observe badge color and placement.
- Expected: Teal pill badge reading "PROXY" appears inline with person name in search results and on curation page.
- Why human: Visual appearance and color rendering cannot be confirmed from code alone.

**3. End-to-end proxy assignment workflow (APPROVED by user in Plan 04 checkpoint)**
- The SUMMARY records Task 3 checkpoint as APPROVED. The user confirmed all 6 verification steps passed (assign proxy in Manage Users, see badge in search, scope filter includes proxy, navigate to curation page without redirect, Grant Proxy Access modal, direct URL navigation).

---

### Gaps Summary

No gaps found. All 15 observable truths are VERIFIED, all 13 key links are WIRED, all 6 PROXY requirements are SATISFIED.

The only near-gap is `proxy.test.ts` at 28 lines vs the plan's `min_lines: 30` threshold — but all 5 specified test cases are present and the tests are substantive. This is a cosmetic shortfall in line count, not a functional gap.

The phase goal is achieved: proxy curation is operational across the full workflow — database model, auth pipeline, admin UI (Manage Users), search visibility (badge + filter), and curation page access (Grant Proxy modal + access override).

---

_Verified: 2026-03-17T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
