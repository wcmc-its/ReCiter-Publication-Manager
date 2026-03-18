---
phase: 01-search-result-filtering
verified: 2026-03-16T23:10:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 1: Search Result Filtering Verification Report

**Phase Goal:** Fix authentication routing, capability model, and three UI bugs (search dropdown, profile modal, skeleton loading)
**Verified:** 2026-03-16T23:10:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user with valid roles can log in and reach correct landing page regardless of role combination | VERIFIED | getCapabilities() runtime test passed all assertions; middleware uses capability checks exclusively |
| 2 | Middleware uses capability-based checks (canCurate, canReport, canSearch, canManageUsers, canConfigure) instead of role-count comparisons | VERIFIED | Zero `userRoles.length ==` occurrences in middleware.ts; all route checks use caps.can* |
| 3 | SAML and local auth providers both produce session with {userId, personIdentifier, email, userRoles[]} | VERIFIED | JWT callback unified at line 138-153 of nextauth.jsx; both providers populate token.username, token.databaseUser, token.userRoles |
| 4 | Auth flow logs role resolution and routing decisions with [AUTH] prefix | VERIFIED | 15 [AUTH] log points in nextauth.jsx; 6 redirect-triggered log points in middleware.ts |
| 5 | A SAML user with no admin_users row gets auto-created with status=1 and baseline access | VERIFIED | findOrCreateSamlUser creates with status: 1 (line 63 admin.users.controller.ts); imported and called in nextauth.jsx line 109 |
| 6 | Curator_Self + Reporter_All combo: curate scope stays self-only, Reporter_All adds canReport | VERIFIED | Runtime test confirmed: canCurate.self=true, canCurate.all=false, canReport=true, landing=/curate/paa2013 |
| 7 | Superuser explicitly has ALL capabilities in the mapping | VERIFIED | ROLE_CAPABILITIES.Superuser has canCurate.all, canReport, canSearch, canManageUsers, canConfigure all true |
| 8 | Capabilities are derived on every request from roles in JWT, not stored in JWT | VERIFIED | middleware.ts calls getCapabilities(userRoles) on every request; JWT callback stores only userRoles (not pre-derived caps) |
| 9 | Search page dropdown does NOT contain "Curate publications" as an action for any user | VERIFIED | Only occurrences are code comments; RoleSplitDropdown returns a plain "Create Reports" Button |
| 10 | Search page dropdown contains "Create Reports" as the remaining action | VERIFIED | setDropdownTitle("Create Reports") line 108; RoleSplitDropdown renders <Button>{"Create Reports"}</Button> |
| 11 | Clicking "View Profile" loads profile modal with descriptive error on failure | VERIFIED | Error message "Unable to load profile data. The person record may be incomplete or temporarily unavailable..." at Profile.tsx line 504 |
| 12 | Non-curators see profile without emails and without Known Relationships | VERIFIED | canViewPII gate at line 62 blocks emails (line 286) and Known Relationships (line 335) for non-curators |
| 13 | All loading states on main pages use skeleton components with shimmer animation | VERIFIED | Search, CurateIndividual, ManageUsers, AdminSettings, Notifications all import and render Skeleton* components instead of Loader |
| 14 | Skeleton components use shimmer animation with #e0e0e0 background and #f0f0f0 highlight | VERIFIED | Skeleton.module.css lines 5-6: background-color: #e0e0e0; gradient with #f0f0f0; @keyframes shimmer defined |
| 15 | Loader.tsx preserved for modal contexts | VERIFIED | Loader.tsx exists; Profile.tsx still imports and uses it |

**Score:** 15/15 truths verified

---

### Required Artifacts

#### Plan 01-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/constants.js` | getCapabilities() and getLandingPage() utilities | VERIFIED | Both exported as function declarations; ROLE_CAPABILITIES also exported |
| `src/middleware.ts` | Capability-based Edge middleware routing | VERIFIED | Imports getCapabilities, getLandingPage; uses caps.can* for all route decisions |
| `src/pages/api/auth/[...nextauth].jsx` | Unified JWT/session callbacks with [AUTH] logging | VERIFIED | 15 [AUTH] log occurrences; findOrCreateSamlUser imported and called; JWT callback covers both providers |
| `src/pages/index.js` | Capability-based landing page redirect | VERIFIED | Imports getCapabilities, getLandingPage; uses both for server-side redirect |
| `src/components/elements/Navbar/SideNavbar.tsx` | Capability-based menu filtering | VERIFIED | Imports getCapabilities; uses capabilityKey on each MenuItem; no allowedRoleNames matching |
| `controllers/db/admin.users.controller.ts` | SAML auto-create with status=1 | VERIFIED | findOrCreateSamlUser creates with status: 1; findOrCreateAdminUsers still creates with status: 0 |
| `types/menu.d.ts` | capabilityKey field added to MenuItem | VERIFIED | capabilityKey?: string added on line 10 |

#### Plan 01-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/elements/Search/Search.js` | Curate Publications removed; SkeletonTable wired | VERIFIED | RoleSplitDropdown returns Create Reports Button; imports SkeletonTable; renders it in isDisplayLoader() and isDisplayLoaderTable() |
| `src/components/elements/Profile/Profile.tsx` | Descriptive error + canViewPII gate | VERIFIED | Error text matches spec; canViewPII = caps.canCurate.all || caps.canCurate.self; gates emails and relationships |
| `src/components/elements/Common/Skeleton.module.css` | Shimmer animation CSS | VERIFIED | @keyframes shimmer; #e0e0e0 background; #f0f0f0 highlight; 95 lines of purpose-built layout classes |
| `src/components/elements/Common/SkeletonTable.tsx` | Skeleton table component | VERIFIED | 5-row skeleton; imports Skeleton.module.css; exports default |
| `src/components/elements/Common/SkeletonCard.tsx` | Skeleton card component | VERIFIED | 3-card skeleton; imports Skeleton.module.css; exports default |
| `src/components/elements/Common/SkeletonProfile.tsx` | Skeleton profile component | VERIFIED | Avatar + name + title + keyword pills; imports Skeleton.module.css; exports default |
| `src/components/elements/Common/SkeletonForm.tsx` | Skeleton form component | VERIFIED | 4-field form skeleton; imports Skeleton.module.css; exports default |
| `src/components/elements/CurateIndividual/CurateIndividual.tsx` | SkeletonProfile + SkeletonCard replaces Loader | VERIFIED | Imports both; renders `<><SkeletonProfile /><SkeletonCard /></>` when identityFetching || reciterFetching |
| `src/components/elements/Manage/ManageUsers.tsx` | SkeletonTable replaces Loader | VERIFIED | Imports SkeletonTable; renders on loading state at line 176 |
| `src/components/elements/Manage/AdminSettings.tsx` | SkeletonForm replaces Loader | VERIFIED | Imports SkeletonForm; renders when loading at line 133 |
| `src/components/elements/Notifications/Notifications.tsx` | SkeletonForm replaces Loader | VERIFIED | Imports SkeletonForm |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `constants.js getCapabilities()` | `middleware.ts` | Import + call with userRoles | WIRED | Line 2 import; line 31 call `getCapabilities(userRoles)` |
| `constants.js getCapabilities()` | `index.js` | Import + call for landing page redirect | WIRED | Line 2 import; line 45 `getCapabilities(userRoles)` |
| `constants.js getCapabilities()` | `SideNavbar.tsx` | Import + call for menu visibility | WIRED | Line 25 import; line 223 call outside .map() loop |
| `nextauth.jsx jwt callback` | `middleware.ts` | JWT token.userRoles consumed by middleware | WIRED | nextauth sets token.userRoles line 148; middleware reads decodedTokenJson.userRoles line 19 |
| `admin.users.controller.ts findOrCreateSamlUser` | `nextauth.jsx SAML authorize` | Called when no admin_users row | WIRED | Imported line 6; called line 109 |
| `Search.js RoleSplitDropdown` | `router.push` | Create Reports button triggers redirect | WIRED | onClick calls redirectToCurate("report", identity.identity) |
| `Profile.tsx` | `constants.js getCapabilities` | canViewPII derived from capabilities | WIRED | Line 14 import; line 61 `getCapabilities(userPermissions)` |
| `CurateIndividual.tsx` | `SkeletonProfile.tsx` | Import and render during loading | WIRED | Line 5 import; line 118 render |
| `Search.js` | `SkeletonTable.tsx` | Import and render during loading | WIRED | Line 14 import; lines 395 and 412 render |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| AUTH-01 | 01-01 | User with valid roles reaches correct landing page regardless of role combination | SATISFIED | getCapabilities() runtime test passed all role combos; middleware exclusively capability-based |
| AUTH-02 | 01-01 | Middleware uses capability-based checks instead of role-count comparisons | SATISFIED | Zero `userRoles.length ==` in middleware.ts; confirmed by grep |
| AUTH-03 | 01-01 | SAML and local auth produce identical session structures | SATISFIED | Unified JWT callback lines 138-153; both paths populate same token fields |
| AUTH-04 | 01-01 | Auth flow logs role resolution and routing decisions | SATISFIED | 15 [AUTH] log points in nextauth.jsx; redirect logging in middleware.ts |
| UIBUG-01 | 01-02 | "Curate publications" not available on Find People page | SATISFIED | Only appears in code comments; RoleSplitDropdown returns Create Reports button |
| UIBUG-02 | 01-02 | View Profile loads without error; descriptive message on failure; PII hidden for non-curators | SATISFIED | Error text at Profile.tsx line 504; canViewPII gate blocks emails and Known Relationships |
| UIBUG-03 | 01-02 | All loading animations use skeleton/spinner design (no legacy red GIF) | SATISFIED | 5 skeleton components created; Loader replaced on Search, Curate, ManageUsers, AdminSettings, Notifications |

No orphaned requirements: all 7 Phase 1 requirements (AUTH-01 through AUTH-04, UIBUG-01 through UIBUG-03) are claimed in plan frontmatter and verified in code. REQUIREMENTS.md Traceability table matches.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/middleware.ts` | 93 | Comment contains word "placeholder" | Info | Not an implementation stub — explains intentional interim behavior for notifications route (allow-all until notification feature is ready). Documented in CONTEXT.md. No action needed. |

No implementation stubs, no empty handlers, no console.log-only implementations found in phase deliverables.

---

### Human Verification Required

The following items cannot be verified programmatically:

#### 1. Auth routing with real session

**Test:** Log in with a user who has Curator_Self + Reporter_All roles.
**Expected:** Landing page is /curate/:own-id (not /search, not /noaccess).
**Why human:** Requires a running Next.js server with real DB session; edge middleware behavior cannot be unit-tested statically.

#### 2. Shimmer animation visual quality

**Test:** Navigate to /search while data is loading.
**Expected:** Gray shimmer bars animate smoothly left-to-right, no red spinner visible.
**Why human:** CSS animation rendering cannot be verified by static code analysis.

#### 3. Profile modal PII stripping for non-curators

**Test:** Log in as a user without Curator_All or Curator_Self role; open a profile modal.
**Expected:** Emails and Known Relationships sections are absent from the modal.
**Why human:** Requires live session with actual role data and API response.

#### 4. SAML auto-create flow

**Test:** Attempt SAML login with a CWID not present in admin_users.
**Expected:** Login succeeds, user lands on /search with baseline access (canReport + canSearch), admin_users row created with status=1.
**Why human:** Requires SAML IdP integration; cannot mock in static verification.

---

### Gaps Summary

No gaps found. All 15 observable truths verified. All 7 requirements (AUTH-01 through AUTH-04, UIBUG-01 through UIBUG-03) satisfied. All key links wired. All 4 task commits (039ad88, ef29d93, cce8a62, 4838e18) confirmed in git log.

The capability model runtime test passed all assertions including the critical Curator_Self + Reporter_All edge case, Superuser full-capabilities check, and empty-roles baseline check.

---

_Verified: 2026-03-16T23:10:00Z_
_Verifier: Claude (gsd-verifier)_
