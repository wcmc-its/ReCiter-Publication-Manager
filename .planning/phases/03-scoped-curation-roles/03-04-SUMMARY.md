---
phase: 03-scoped-curation-roles
plan: 04
subsystem: ui
tags: [react, redux, scope-filter, navbar, search, curate, rbac]

# Dependency graph
requires:
  - phase: 03-01
    provides: scopeResolver.ts isPersonInScope(), getCapabilities() with canCurate.scoped, AdminUsersPersonType model
  - phase: 03-02
    provides: JWT scopeData embedding, getPersonWithTypes helper, middleware Curator_Scoped routing
provides:
  - ScopeFilterCheckbox component for scope-aware search filtering
  - EditOutlined curate icon for in-scope people in search results
  - ScopeLabel navbar component showing curator scope summary
  - Scope-check redirect on curate page for out-of-scope access
  - /api/db/person/scopecheck endpoint for client-side scope verification
  - includeScopeData flag for person API to return PersonPersonTypes
affects: [03-05-admin-ui-scope-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [client-side scope check with API fallback, Redux scope filter persistence, conditional curate icon rendering]

key-files:
  created:
    - src/components/elements/Search/ScopeFilterCheckbox.tsx
    - src/components/elements/Navbar/ScopeLabel.tsx
    - src/pages/api/db/person/scopecheck.ts
  modified:
    - src/components/elements/Search/Search.js
    - src/components/elements/Navbar/SideNavbar.tsx
    - src/pages/curate/[id].js
    - src/redux/methods/methods.js
    - src/redux/actions/actions.js
    - src/redux/reducers/reducers.js
    - controllers/db/person.controller.ts
    - types/personapi.body.d.ts

key-decisions:
  - "Scope filter uses existing personTypes/orgUnits API filters rather than new endpoint"
  - "includeScopeData flag on person API returns PersonPersonTypes for client-side scope matching"
  - "Curate page scope check is client-side with API fetch, complementing middleware route-level enforcement"
  - "Curate icon uses MUI EditOutlined with Tooltip for accessibility, consistent with UI-SPEC"

patterns-established:
  - "Scope-aware search: checkbox controls Redux state, triggers refetch with scope as filter params"
  - "Two-tier scope enforcement: middleware checks route access, component checks person-level scope"

requirements-completed: [SCOPE-02, SCOPE-03]

# Metrics
duration: 12min
completed: 2026-03-17
---

# Phase 3 Plan 4: Scope-Aware UI Summary

**ScopeFilterCheckbox on Search page, curate icon for in-scope people, ScopeLabel in navbar, and scope-check redirect on curate page**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-17T16:07:53Z
- **Completed:** 2026-03-17T16:20:38Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Scope filter checkbox on Search page filters results to curator's scope (personTypes/orgUnits)
- EditOutlined curate icon appears only for in-scope people; out-of-scope shows report-only actions
- ScopeLabel in sidebar displays "Curating: X, Y, +N more" for scoped curators
- Curate page checks scope on mount and redirects with persistent error toast for out-of-scope access
- "Curate Publications" nav link routes to /search?scopeFilter=true for pre-checked scope filter

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scope filter checkbox and scope-aware actions to Search page** - `e1bb742` (feat)
2. **Task 2: Add ScopeLabel to sidebar navbar and scope-check redirect on curate page** - `c33a31b` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `src/components/elements/Search/ScopeFilterCheckbox.tsx` - Scope filter checkbox component with react-bootstrap Form.Check
- `src/components/elements/Navbar/ScopeLabel.tsx` - Scope label showing "Curating: X, Y" in sidebar
- `src/pages/api/db/person/scopecheck.ts` - Lightweight scope-check API using getPersonWithTypes
- `src/components/elements/Search/Search.js` - Added scope imports, checkbox, curate icon, name click routing
- `src/components/elements/Navbar/SideNavbar.tsx` - Added ScopeLabel, scoped canCurate check, scopeFilter nav link
- `src/pages/curate/[id].js` - Added scope check on mount with redirect and toast
- `src/redux/methods/methods.js` - Added UPDATE_SCOPE_FILTER action type
- `src/redux/actions/actions.js` - Added updateScopeFilter action creator
- `src/redux/reducers/reducers.js` - Added showOnlyScopeFiltered reducer
- `controllers/db/person.controller.ts` - Added includeScopeData branch to return PersonPersonTypes
- `types/personapi.body.d.ts` - Added includeScopeData optional field

## Decisions Made
- Scope filter uses existing personTypes/orgUnits API filters rather than creating a new dedicated endpoint; this is efficient because the person controller already supports these filter dimensions
- includeScopeData flag added to person API to return PersonPersonTypes in search results for client-side scope matching; this avoids making separate API calls per person
- Curate page scope check is client-side with a lightweight API fetch to /api/db/person/scopecheck, complementing the middleware route-level enforcement from Plan 02
- Curate icon uses MUI EditOutlined with both Tooltip wrapper and titleAccess for sighted and screen reader accessibility per UI-SPEC requirements

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Curate page is [id].js not [id].tsx**
- **Found during:** Task 2 (curate page scope check)
- **Issue:** Plan referenced src/pages/curate/[id].tsx but actual file is [id].js
- **Fix:** Modified the existing [id].js file instead
- **Files modified:** src/pages/curate/[id].js
- **Verification:** File exists and contains scope check code
- **Committed in:** c33a31b (Task 2 commit)

**2. [Rule 3 - Blocking] Redux file paths differ from plan**
- **Found during:** Task 1 (Redux modifications)
- **Issue:** Plan referenced src/redux/methods.js but actual path is src/redux/methods/methods.js (and same for reducers, actions)
- **Fix:** Used actual file paths for edits
- **Files modified:** src/redux/methods/methods.js, src/redux/actions/actions.js, src/redux/reducers/reducers.js
- **Verification:** Imports resolve correctly with existing codebase structure
- **Committed in:** e1bb742 (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added includeScopeData to person API**
- **Found during:** Task 1 (scope-aware search results)
- **Issue:** PersonPersonTypes not returned in search results by default, needed for client-side scope matching
- **Fix:** Added includeScopeData flag to person controller and PersonApiBody type
- **Files modified:** controllers/db/person.controller.ts, types/personapi.body.d.ts
- **Verification:** When flag is set, PersonPersonTypes included in person search response
- **Committed in:** e1bb742 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness and integration with actual codebase structure. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All user-facing scope UI is complete (search filtering, curate icon, scope label, access denial)
- Plan 05 (admin UI scope management) can proceed with CurationScopeSection form and ManageUsers table enhancements
- The ScopeLabel, ScopeFilterCheckbox, and curate page scope check all depend on scopeData in JWT (established in Plan 02)

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 03-scoped-curation-roles*
*Completed: 2026-03-17*
