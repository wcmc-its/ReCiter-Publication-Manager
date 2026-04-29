---
phase: 09-scoped-roles-and-proxy-ui
plan: 03
subsystem: ui
tags: [react, scope-label, proxy-badge, scope-filter, sidebar, search, css-modules, mui-tooltip]

# Dependency graph
requires:
  - phase: 09-scoped-roles-and-proxy-ui
    plan: 01
    provides: Proxy API endpoints, scope-filtered person search, getCapabilities/scopeResolver utilities
  - phase: 08-auth-pipeline
    provides: JWT/session enriched with scopeData/proxyPersonIds, capability-based middleware
provides:
  - ScopeLabel component for sidebar scope display with truncation and MUI Tooltip
  - ProxyBadge component for inline proxy indicator in search results
  - ScopeFilterCheckbox component for scope filtering toggle with hint text
  - SideNavbar integration with ScopeLabel and Curator_Scoped menu access
  - Search.js integration with scope filtering, proxy badges, and capability-based dropdown logic
affects: [09-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [ScopeLabel truncation with +N more suffix, useEffect-based scope filter re-trigger, proxyPersonIds passed through Name component props]

key-files:
  created:
    - src/components/elements/Navbar/ScopeLabel.tsx
    - src/components/elements/Navbar/ScopeLabel.module.css
    - src/components/elements/Search/ProxyBadge.tsx
    - src/components/elements/Search/ScopeFilterCheckbox.tsx
    - src/components/elements/Search/ScopeFilterCheckbox.module.css
  modified:
    - src/components/elements/Navbar/SideNavbar.tsx
    - src/components/elements/Search/Search.js
    - types/next-auth.d.ts

key-decisions:
  - "ProxyBadge rendered inline after name button via proxyPersonIds prop pass-through to Name component"
  - "Scope filter re-trigger uses useEffect on scopeFilterChecked with skipInit ref to avoid double initial load"
  - "Curator_Scoped dropdown logic reuses isCuratorAll flag for identical action behavior (curate + report + profile)"

patterns-established:
  - "Pattern: Pass proxyPersonIds to child Name component for ProxyBadge rendering"
  - "Pattern: useRef for skipping initial useEffect execution when adding reactive scope filter toggle"
  - "Pattern: showScopeFilter derived from caps.canCurate.scoped && !caps.canCurate.all for conditional UI rendering"

requirements-completed: [PORT-10, PORT-11]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 9 Plan 03: Scope Label, Proxy Badge, and Scope Filter Search Integration Summary

**ScopeLabel sidebar badge, ProxyBadge inline indicator, and ScopeFilterCheckbox with server-side scope filtering integrated into SideNavbar and Search page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T05:01:16Z
- **Completed:** 2026-03-28T05:06:13Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Created 3 presentational components (ScopeLabel, ProxyBadge, ScopeFilterCheckbox) with CSS modules matching the UI design contract
- Integrated ScopeLabel into SideNavbar below Navigation header with conditional rendering for scoped curators
- Added Curator_Scoped to Find People and Curate Publications menu visibility
- Integrated ScopeFilterCheckbox and ProxyBadge into Search.js with server-side scope filtering via scopeOrgUnits, scopePersonTypes, and proxyPersonIds

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ScopeLabel, ProxyBadge, and ScopeFilterCheckbox components** - `a4a1316` (feat)
2. **Task 2: Integrate ScopeLabel into SideNavbar.tsx with Curator_Scoped menu access** - `fa9ede6` (feat)
3. **Task 3: Integrate ScopeFilterCheckbox and ProxyBadge into Search.js with scope filtering** - `f8d30bc` (feat)

## Files Created/Modified
- `src/components/elements/Navbar/ScopeLabel.tsx` - Sidebar scope badge with truncated display (max 3 items), proxy count suffix, MUI Tooltip
- `src/components/elements/Navbar/ScopeLabel.module.css` - Dark navy theme styling (11px, #a8b4cc text, 20px horizontal padding)
- `src/components/elements/Search/ProxyBadge.tsx` - Inline blue (#2563a8) pill badge showing "Proxy" text
- `src/components/elements/Search/ScopeFilterCheckbox.tsx` - Form.Check switch with label and hint text
- `src/components/elements/Search/ScopeFilterCheckbox.module.css` - Switch control and hint styling
- `src/components/elements/Navbar/SideNavbar.tsx` - Added ScopeLabel rendering, scope/proxy parsing, Curator_Scoped in menu arrays
- `src/components/elements/Search/Search.js` - Added scope filter state, capability-based rendering, server-side scope params, proxy badges, Curator_Scoped dropdown handling
- `types/next-auth.d.ts` - Added scopeData and proxyPersonIds fields to Session type

## Decisions Made
- ProxyBadge is rendered inline after the name button inside the Name component by passing proxyPersonIds as a prop, keeping the badge visually adjacent to the person name
- Scope filter toggle re-triggers search via a dedicated useEffect rather than calling searchData directly, avoiding stale state issues with React's async setState
- Curator_Scoped dropdown logic sets isCuratorAll=true to reuse the existing Curator_All dropdown behavior (Curate Publications + Create Reports + View Profile), since the scope restriction is enforced server-side
- Added scopeData and proxyPersonIds to next-auth Session type definition to fix TypeScript compilation errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merged feature/v1.1-port into worktree**
- **Found during:** Pre-Task 1 (initial file reading)
- **Issue:** Worktree branch was based on old master commit without Phase 7/8 deliverables (getCapabilities, scopeResolver, Curator_Scoped role, updated SideNavbar/Search.js)
- **Fix:** Fast-forward merged feature/v1.1-port into worktree branch
- **Files modified:** 190 files (full feature branch fast-forward)
- **Verification:** scopeResolver.ts, getCapabilities in constants.js, and updated SideNavbar/Search.js all confirmed present
- **Committed in:** (fast-forward merge, no new commit)

**2. [Rule 3 - Blocking] Added scopeData and proxyPersonIds to Session type**
- **Found during:** Task 3 (TypeScript compilation check)
- **Issue:** next-auth.d.ts Session type did not include scopeData or proxyPersonIds properties, causing TS2339 errors
- **Fix:** Added optional scopeData and proxyPersonIds string fields to Session.data type, also changed userRoles and adminSettings from Array to any for compatibility
- **Files modified:** types/next-auth.d.ts
- **Verification:** npx tsc --noEmit --skipLibCheck passes with zero errors
- **Committed in:** f8d30bc (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were prerequisites for the planned work. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 presentational components ready for use in Plan 04 (AddUser form and GrantProxyModal)
- SideNavbar shows scope label and menu items for Curator_Scoped users
- Search page has full scope filtering with server-side params and proxy badge rendering
- TypeScript compilation passes cleanly
- Session type definition includes scope/proxy fields for all downstream components

## Self-Check: PASSED

All 6 created files verified on disk. All 3 task commits verified in git log. SUMMARY.md exists. TypeScript compilation passes.

---
*Phase: 09-scoped-roles-and-proxy-ui*
*Completed: 2026-03-28*
