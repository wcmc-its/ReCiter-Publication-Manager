---
phase: 16-data-driven-ui
verified: 2026-04-14T22:00:00Z
status: passed
score: 12/13 must-haves verified (1 deferred per D-14)
gaps:
  - truth: "No file in scope contains JSON.parse(session.data.userRoles) for visibility decisions"
    status: resolved
    reason: "src/pages/search/index.js was converted to use getPermissionsFromRaw(session.data.permissions) in commit 8e509ee. Session null-check restored. Originally missed from plan-02's files_modified scope."
    artifacts:
      - path: "src/pages/search/index.js"
        issue: "Line 7: const userPermissions = JSON.parse(session.data?.userRoles); used as gate for redirect on line 18: if(userPermissions.length === 0)"
    missing:
      - "Convert getServerSideProps to use getPermissionsFromRaw(session.data.permissions) instead of JSON.parse(session.data?.userRoles)"
      - "Replace userPermissions.length === 0 check with permissions.length === 0 check"
  - truth: "The Grant Proxy button on the curation page appears only when the user has both canCurate and canManageUsers permissions (ROADMAP SC-4)"
    status: failed
    reason: "ROADMAP Success Criteria 4 requires the Grant Proxy button to use permission-based gating. The GrantProxyModal and all proxy UI components were deleted in Phase 14 (decision D-14). No Grant Proxy button exists anywhere in the codebase. SC-4 cannot be verified because the feature it describes is absent."
    artifacts:
      - path: "src/components/elements/CurateIndividual/"
        issue: "GrantProxyModal does not exist -- deleted in Phase 14"
    missing:
      - "Grant Proxy button/modal rebuild with canCurate + canManageUsers permission gate (deferred to v1.1 proxy work per D-14)"
deferred:
  - truth: "The Grant Proxy button on the curation page appears only when the user has both canCurate and canManageUsers permissions"
    addressed_in: "v1.1 proxy work (not a numbered phase yet)"
    evidence: "CONTEXT.md D-14: 'UI-04 (Grant Proxy button) is deferred -- GrantProxyModal and related proxy UI components were deleted in Phase 14. They will be rebuilt with the permission model when v1.1 proxy work resumes.' The deferral was a locked decision established before Phase 16 began."
human_verification:
  - test: "Log in as Curator_Self and inspect the SideNavbar"
    expected: "Only Curate Publications nav item visible (with appropriate icon). No Search, Report, Manage Users, Configuration, Manage Profile, or Manage Notifications items."
    why_human: "Requires a real browser session with a Curator_Self JWT containing permissionResources from the live DB. Cannot be verified statically."
  - test: "Log in as Superuser and inspect the SideNavbar"
    expected: "All 7 nav items visible in displayOrder order with MUI icons (Search, LocalLibrary, Assessment, NotificationsActive, AccountCircle, Group, Settings), correct labels, and orange selection highlight."
    why_human: "Requires real browser session with Superuser JWT and permissionResources populated. MUI icon rendering and color states need visual confirmation."
  - test: "Navigate to /curate/:id as a user without canCurate permission"
    expected: "ReciterTabs renders null (no tabs shown), not an empty tab strip."
    why_human: "Requires a logged-in session without canCurate in the permissions array."
---

# Phase 16: Data-Driven UI Verification Report

**Phase Goal:** The navigation menu and component-level permission checks are driven by database data instead of hardcoded arrays, so that future permission changes via admin UI will immediately affect the rendered UI
**Verified:** 2026-04-14T22:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SideNavbar renders nav items dynamically from permissionResources session data, not from a hardcoded menuItems array | VERIFIED | SideNavbar.tsx lines 145-149: `permissionResources.filter(r => r.resourceType === 'nav').sort(...)`. No hardcoded menuItems array anywhere in file. |
| 2 | Nav item icons are MUI components resolved via iconRegistry, not PNG imports | VERIFIED | MenuListItem.tsx line 26: `<IconComponent fontSize="small" aria-hidden="true" />`. No `import Image from 'next/image'` in MenuListItem or SideNavbar. 11/11 icon registry tests pass. |
| 3 | Nav item labels, routes, and display ordering come from the DB seed data (permissionResources) | VERIFIED | SideNavbar.tsx uses `item.label`, `item.route`, `item.resourceKey` directly from permissionResources. Sort by `a.displayOrder - b.displayOrder`. |
| 4 | A user who lacks a permission does not see the corresponding nav item | VERIFIED | SideNavbar.tsx line 186: `if (!hasPermission(permissions, item.permissionKey)) return null` |
| 5 | Manage Notifications nav item requires all three conditions: canManageNotifications permission AND isVisibleNotification admin setting AND session email present | VERIFIED | SideNavbar.tsx lines 189-191: `if (item.resourceKey === 'nav_notifications') { if (!isVisibleNotification || !session?.data?.email) return null }` |
| 6 | Curate Publications nav item is disabled when no identity is selected (filters empty) | VERIFIED | SideNavbar.tsx line 206: `const disabled = item.resourceKey === 'nav_curate' && Object.keys(filters).length === 0` |
| 7 | ReciterTabs uses hasPermission('canCurate') instead of allowedRoleNames arrays for tab visibility | VERIFIED | ReciterTabs.tsx lines 103-108: `const canCurate = hasPermission(permissions, 'canCurate'); if (!canCurate) { return null }`. No `allowedRoleNames` anywhere in file. |
| 8 | FilterReview.tsx dropdown logic uses 2-3 permission checks instead of 150-line role cascade | VERIFIED | FilterReview.tsx: RoleSplitDropdown is 21 lines using `canCurate` and `canReport`. No `isCuratorSelf`, `isCuratorAll`, `isReporterAll`, `isSuperUser` state variables. |
| 9 | Search.js dropdown and column logic uses permission checks instead of role cascade | VERIFIED | Search.js lines 70-73: `canCurate`, `canReport`, `canManageUsers`, `canSearch` computed from `getPermissionsFromRaw`. No role cascade state variables. |
| 10 | Profile.tsx email visibility uses hasPermission instead of buggy role-label OR | VERIFIED | Profile.tsx line 304: `let roleAccess = hasPermission(permissions, 'canCurate') \|\| hasPermission(permissions, 'canManageUsers')`. Bug fixed. |
| 11 | Login.js post-login redirect uses getLandingPageFromPermissions instead of role-label cascade | VERIFIED | Login.js line 61: `const landingPage = getLandingPageFromPermissions(permissions, userRoles)` |
| 12 | index.js SSR redirect uses getPermissionsFromRaw + getLandingPageFromPermissions instead of role-label cascade | VERIFIED | index.js: 29-line unified getServerSideProps using `getLandingPageFromPermissions`. No role cascade. |
| 13 | No file in scope contains JSON.parse(session.data.userRoles) for visibility decisions | FAILED | `src/pages/search/index.js` line 7: `const userPermissions = JSON.parse(session.data?.userRoles)` used as redirect gate on line 18. File was in RESEARCH.md scope (line 122) but not in plan-02 files_modified. |

**Score:** 11/13 truths verified

### Deferred Items

Items not yet met but explicitly addressed before Phase 16 began via locked decisions.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Grant Proxy button uses permission gate (ROADMAP SC-4 / UI-04) | v1.1 proxy rebuild | CONTEXT.md D-14: "GrantProxyModal and related proxy UI components were deleted in Phase 14. They will be rebuilt with the permission model when v1.1 proxy work resumes." Plan-02 frontmatter: `requirements: [UI-03]  # UI-04, UI-05 deferred per locked decisions D-14, D-15` |
| 2 | checkCurationScope.ts reads permissions from JWT (UI-05) | v1.1 proxy rebuild | CONTEXT.md D-15: "UI-05 (checkCurationScope permission conversion) is deferred. File was deleted in Phase 14." |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/iconRegistry.ts` | Static map from DB icon strings to MUI icon components with getIcon() export | VERIFIED | All 7 canonical icons mapped. HelpOutlineIcon fallback. `getIcon` and `iconRegistry` exported. |
| `src/hooks/usePermissions.ts` | Convenience hook parsing permissions and permissionResources from session | VERIFIED | Exports `usePermissions()` with memoized permissions, permissionResources, hasPermission, session, loading. |
| `types/menu.d.ts` | Updated MenuItem type with icon and permissionKey, without allowedRoleNames/imgUrl/imgUrlActive | VERIFIED | Contains `icon?: SvgIconComponent` and `permissionKey?: string`. No `allowedRoleNames`, `imgUrl`, `imgUrlActive`, or `isRequired`. |
| `src/components/elements/Navbar/SideNavbar.tsx` | Data-driven nav rendering from permissionResources | VERIFIED | Full data-driven rendering. No PNG imports, no hardcoded menuItems. usePermissions + getIcon wired. |
| `src/components/elements/Navbar/MenuListItem.tsx` | MUI icon component rendering instead of PNG Image | VERIFIED | `icon: IconComponent` prop accepted. `<IconComponent fontSize="small" aria-hidden="true" />` rendered. No `import Image`. |
| `__tests__/iconRegistry.test.ts` | Unit tests for icon resolution and fallback | VERIFIED | 11/11 tests pass covering all 7 canonical icons plus null/undefined/empty/unknown fallback cases. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| SideNavbar.tsx | session.data.permissionResources | usePermissions() hook | WIRED | Line 14: `import { usePermissions, PermissionResource } from '../../../hooks/usePermissions'`. Line 143: `const { permissions, permissionResources, session, loading } = usePermissions()` |
| SideNavbar.tsx | src/utils/iconRegistry.ts | getIcon() import | WIRED | Line 15: `import { getIcon } from '../../../utils/iconRegistry'`. Line 208: `const IconComponent = getIcon(item.icon)` |
| MenuListItem.tsx | MUI icon component | icon prop (SvgIconComponent) | WIRED | Signature: `({ title, to, id, icon: IconComponent, disabled })`. Render: `<IconComponent fontSize="small" aria-hidden="true" />` |
| ReciterTabs.tsx | src/utils/permissionUtils.ts | hasPermission import | WIRED | Line 9: `import { getPermissionsFromRaw, hasPermission } from '../../../utils/permissionUtils'`. Line 104: `hasPermission(permissions, 'canCurate')` |
| index.js | src/utils/permissionUtils.ts | getLandingPageFromPermissions imports | WIRED | Line 2: `import { getPermissionsFromRaw, getLandingPageFromPermissions } from "../utils/permissionUtils"`. Line 23: `getLandingPageFromPermissions(permissions, userRoles)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| SideNavbar.tsx | permissionResources | usePermissions() → JSON.parse(session.data.permissionResources) | Yes — JWT populated by findUserPermissionsEnriched() in Phase 15 with DB queries | FLOWING |
| ReciterTabs.tsx | permissions | getPermissionsFromRaw(session.data.permissions) | Yes — JWT permissions set by findUserPermissions() DB JOIN in Phase 15 | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Icon registry resolves all 7 icons | `npx jest --testPathPattern iconRegistry` | 11/11 pass | PASS |
| Full test suite | `npx jest` | 67/67 pass | PASS |
| SideNavbar has no banned PNG patterns | grep for `facultyIcon`, `chartIcon`, `imgUrl`, `allowedRoleNames` in SideNavbar.tsx | Zero hits | PASS |
| allowedRoleNames absent from all component files | `grep -rn "allowedRoleNames" src/ types/` | Zero hits | PASS |
| allowedPermissions absent from component imports | `grep -rn "allowedPermissions" src/components/` | Zero hits (only [...nextauth].jsx which is Phase 15 scope) | PASS |
| search/index.js still uses userRoles | grep for `JSON.parse.*userRoles` in src/pages/search/index.js | Line 7 hit | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| UI-01 | 16-01 | SideNavbar renders menu items from permissionResources data (not hardcoded array) | SATISFIED | SideNavbar.tsx reads `permissionResources`, filters, sorts, maps dynamically |
| UI-02 | 16-01 | Nav item icons, labels, routes, and ordering all come from database | SATISFIED | All 4 properties (icon via getIcon, label, route, displayOrder) come from permissionResources JWT data |
| UI-03 | 16-02 | ReciterTabs no longer uses allowedRoleNames arrays for tab visibility | SATISFIED | ReciterTabs.tsx uses single `hasPermission(permissions, 'canCurate')` gate; zero `allowedRoleNames` references |
| UI-04 | (not claimed in 16-02) | CurateIndividual uses permission set for canGrantProxy check | DEFERRED | GrantProxyModal deleted in Phase 14. Deferred by D-14 before phase started. |
| UI-05 | (not claimed in 16-02) | checkCurationScope.ts reads permissions from JWT | DEFERRED | checkCurationScope.ts deleted in Phase 14. Deferred by D-15 before phase started. |

**Note on ROADMAP requirements mapping:** REQUIREMENTS.md maps UI-04 and UI-05 to Phase 16, but these were explicitly deferred by locked decisions D-14 and D-15 established in the CONTEXT.md before Phase 16 planning began. Plan-02 frontmatter correctly documents the deferral (`requirements: [UI-03]  # UI-04, UI-05 deferred per locked decisions D-14, D-15`).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/pages/search/index.js | 7 | `JSON.parse(session.data?.userRoles)` for redirect gating | Blocker | Fails to use permission system for search page access control. Was in RESEARCH.md scope for conversion but omitted from plan-02 files_modified and not converted. |
| src/pages/search/index.js | 9-16 | Commented-out session check (`if (!session || !session.data)`) | Warning | Session null-check is disabled. If session is null, `session.data?.userRoles` returns undefined, JSON.parse throws, causing 500 instead of redirect to login. |

### Human Verification Required

#### 1. Curator_Self Nav Item Filtering

**Test:** Log in as a Curator_Self user (one with only canCurate permission) and navigate to any page. Observe the SideNavbar.
**Expected:** Only "Curate Publications" nav item is visible. No "Find People", "Create Reports", "Manage Notifications", "Manage Profile", "Manage Users", or "Configuration" items appear.
**Why human:** Requires a real browser session with a Curator_Self JWT token containing permissionResources filtered to only the canCurate permission resource. Cannot be simulated statically.

#### 2. Superuser Full Nav with MUI Icons

**Test:** Log in as a Superuser and observe the SideNavbar in the browser.
**Expected:** All 7 nav items appear in displayOrder order: Find People, Curate Publications, Create Reports, Manage Notifications, Manage Profile, Manage Users, Configuration. Each item shows the correct MUI icon (not a PNG). Selected item has white icon on orange (#e87722) background.
**Why human:** MUI icon rendering, color behavior, and visual correctness require browser inspection. The icon-to-label mapping from DB seed data cannot be verified without a running session.

#### 3. ReciterTabs Hidden Without canCurate

**Test:** Log in as a Reporter_All user (who has canReport and canSearch but NOT canCurate) and navigate to /curate/:id.
**Expected:** No tabs rendered (ReciterTabs returns null). The curation page body is empty or shows an appropriate message — NOT a tab strip with broken content.
**Why human:** Requires a session with permissions that exclude canCurate. Cannot be verified statically.

### Gaps Summary

**1 gap blocking goal achievement:**

**search/index.js not converted (missed file):** `src/pages/search/index.js` still uses `JSON.parse(session.data?.userRoles)` for its access-control redirect in `getServerSideProps`. RESEARCH.md line 122 and Pitfall 5 explicitly listed this file for conversion. However, plan-02's `files_modified` frontmatter omitted it (listing only `src/pages/index.js`, the root index page), and the executor did not convert it. The fix is mechanical: replace lines 7-24 with `getPermissionsFromRaw(session.data.permissions)` and a `permissions.length === 0` check, matching the pattern used in the root `index.js`.

**Note on ROADMAP SC-4 (Grant Proxy button):** This roadmap success criterion cannot be met because the underlying feature (GrantProxyModal) was deleted in Phase 14 before this phase began. The deferral is documented in CONTEXT.md as locked decision D-14 and in plan-02 frontmatter. This is correctly classified as deferred, not a gap introduced by this phase.

**11/13 truths verified. The phase is 85% complete. One mechanical conversion (search/index.js) blocks the "no file in scope" truth. Human verification is also required for browser-dependent behaviors.**

---

_Verified: 2026-04-14T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
