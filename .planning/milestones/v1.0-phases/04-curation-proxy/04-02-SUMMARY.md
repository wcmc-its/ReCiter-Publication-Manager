---
phase: 04-curation-proxy
plan: 02
subsystem: ui, api
tags: [react, mui-autocomplete, proxy, curation, manage-users, sequelize]

# Dependency graph
requires:
  - phase: 04-curation-proxy
    plan: 01
    provides: AdminUsersProxy model, proxy CRUD API endpoints, search-persons endpoint
provides:
  - ProxyAssignmentsSection component with debounced person autocomplete
  - AddUser form proxy integration (load, save, conditional visibility)
  - UsersTable proxy count column with singular/plural/empty formatting
  - Enriched listAllUsers with AdminUsersProxy include
affects: [04-03-PLAN, 04-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ProxyAssignmentsSection follows CurationScopeSection fieldset pattern (same CSS, same CssTextField prop)"
    - "Proxy section visibility gated by hasCurationRole (any Curator_All/Scoped/Self) vs hasScopedRole"
    - "Proxy count column uses em dash/singular/plural pattern from UI-SPEC"

key-files:
  created:
    - src/components/elements/AddUser/ProxyAssignmentsSection.tsx
    - src/components/elements/AddUser/ProxyAssignmentsSection.module.css
  modified:
    - src/components/elements/AddUser/AddUser.tsx
    - src/components/elements/Manage/UsersTable.tsx
    - controllers/db/manage-users/user.controller.ts

key-decisions:
  - "hasCurationRole checks all three curator roles (All, Scoped, Self) since any curator may need proxy assignments"
  - "Proxy save happens after user create/update with separate fetch call and toast notification"
  - "UsersTable colSpan updated from 5 to 6 for no-records row to account for new Proxies column"

patterns-established:
  - "Proxy section uses same Collapse + boolean prop pattern as CurationScopeSection"
  - "Proxy count display: em dash for 0, '1 person' for singular, 'N people' for plural"

requirements-completed: [PROXY-01, PROXY-03]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 4 Plan 02: Manage Users Proxy UI Summary

**ProxyAssignmentsSection with debounced person autocomplete, AddUser form integration with load/save, and UsersTable proxy count column**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T22:50:41Z
- **Completed:** 2026-03-17T22:54:45Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ProxyAssignmentsSection component with 300ms debounced person autocomplete, 2-char minimum, and display format "Last, First (cwid) - OrgUnit"
- AddUser form loads existing proxies in edit mode and saves assignments on submit with toast notification
- UsersTable displays Proxies column with correct singular/plural/empty formatting from enriched listAllUsers query

## Task Commits

Each task was committed atomically:

1. **Task 1: ProxyAssignmentsSection component and AddUser integration** - `2e48711` (feat)
2. **Task 2: Proxy count column in UsersTable and enriched listAllUsers** - `5c8df2a` (feat)

## Files Created/Modified
- `src/components/elements/AddUser/ProxyAssignmentsSection.tsx` - Autocomplete multi-select for proxy person assignment with debounce
- `src/components/elements/AddUser/ProxyAssignmentsSection.module.css` - Fieldset styling matching CurationScopeSection pattern
- `src/components/elements/AddUser/AddUser.tsx` - Integrated ProxyAssignmentsSection with state, edit-load, save, and conditional render
- `src/components/elements/Manage/UsersTable.tsx` - Added Proxies column with count formatting
- `controllers/db/manage-users/user.controller.ts` - Added AdminUsersProxy to listAllUsers includes

## Decisions Made
- hasCurationRole checks all three curator role labels (Curator_All, Curator_Scoped, Curator_Self) for proxy section visibility, since any curator may need proxy assignments
- Proxy save executes as a separate fetch after the user create/update response, with toast notification on success
- UsersTable no-records colSpan updated from 5 to 6 to match the new column count

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated colSpan for no-records row**
- **Found during:** Task 2
- **Issue:** Adding a new Proxies column increased the header count to 6, but the no-records row still had colSpan=5
- **Fix:** Changed colSpan from 5 to 6
- **Files modified:** src/components/elements/Manage/UsersTable.tsx
- **Committed in:** 5c8df2a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial fix for table layout correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Manage Users proxy UI complete: assign and view proxies from the admin interface
- Ready for Plan 04-03 (Curation page proxy grant modal) which provides curator self-service proxy assignment
- Ready for Plan 04-04 (Middleware and scope enforcement) which enforces proxy access checks

---
*Phase: 04-curation-proxy*
*Completed: 2026-03-17*
