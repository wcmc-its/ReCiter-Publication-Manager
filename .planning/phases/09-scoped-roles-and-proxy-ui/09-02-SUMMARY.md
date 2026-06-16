---
phase: 09-scoped-roles-and-proxy-ui
plan: 02
subsystem: ui
tags: [react, mui-autocomplete, scope-ui, proxy-ui, adduser-form, users-table, css-modules]

# Dependency graph
requires:
  - phase: 09-scoped-roles-and-proxy-ui
    provides: Plan 01 proxy API endpoints, person-types endpoint, scope-filtered person search, user CRUD with scope persistence
  - phase: 08-auth-pipeline
    provides: JWT/session with scope/proxy claims, capability-based middleware, Curator_Scoped role support
provides:
  - CurationScopeSection component with dual MUI Autocomplete pickers (person types, org units)
  - ProxyAssignmentsSection component with debounced person search and proxy token rendering
  - AddUser.tsx integration with conditional scope/proxy sections, mount-time option fetching, edit preload, save logic
  - UsersTable.tsx Role column with inline scope summary and proxy count display
affects: [09-03-PLAN, 09-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [Conditional form section rendering driven by role selection, 300ms debounced async Autocomplete search, parseJsonColumn helper for MySQL JSON columns in UI]

key-files:
  created:
    - src/components/elements/AddUser/CurationScopeSection.tsx
    - src/components/elements/AddUser/CurationScopeSection.module.css
    - src/components/elements/AddUser/ProxyAssignmentsSection.tsx
    - src/components/elements/AddUser/ProxyAssignmentsSection.module.css
  modified:
    - src/components/elements/AddUser/AddUser.tsx
    - src/components/elements/Manage/UsersTable.tsx
    - src/components/elements/Manage/UsersTable.module.css

key-decisions:
  - "CurationScopeSection accepts baseSx and renderOrgTags as props from parent AddUser to maintain visual consistency without duplication"
  - "ProxyAssignmentsSection implements its own renderTags inline since proxy tokens show personIdentifier which differs from org tag format"
  - "UsersTable defines its own ROLE_LABELS map (local copy) to avoid circular dependency with AddUser"
  - "Scope section title and field styles use own CSS module classes matching AddUser patterns rather than importing parent styles"

patterns-established:
  - "Pattern: Conditional form sections driven by selectedRoles.includes() or .some() checks"
  - "Pattern: Scope/proxy data cleared via useEffect watching selectedRoles to prevent stale state"
  - "Pattern: parseJsonColumn(val) in UI for safe parsing of Sequelize JSON columns"

requirements-completed: [PORT-08, PORT-09, PORT-13]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 9 Plan 02: Scope and Proxy UI Components for AddUser and UsersTable Summary

**CurationScopeSection and ProxyAssignmentsSection components integrated into AddUser form with conditional rendering, scope option fetching, proxy debounced search, and UsersTable Role column with inline scope summary**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T05:01:14Z
- **Completed:** 2026-03-28T05:06:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created CurationScopeSection with two MUI Autocomplete pickers for person types and organizational units, using baseSx styling and light token rendering from parent
- Created ProxyAssignmentsSection with 300ms debounced person search API, async Autocomplete, and inline light token rendering for proxy persons
- Integrated both components into AddUser.tsx with conditional rendering, scope option fetching on mount, edit preload from user detail and proxy endpoints, and proxy save on form submit
- Added Role column to UsersTable with inline scope summary (e.g., "Curator -- Scoped (Faculty, Surgery)") and proxy count display

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CurationScopeSection and ProxyAssignmentsSection components** - `107d440` (feat)
2. **Task 2: Integrate scope/proxy sections into AddUser.tsx and update UsersTable.tsx** - `968d369` (feat)

## Files Created/Modified
- `src/components/elements/AddUser/CurationScopeSection.tsx` - Scope assignment form with dual Autocomplete pickers (person types + org units)
- `src/components/elements/AddUser/CurationScopeSection.module.css` - Layout styles for scope section, field labels, hints
- `src/components/elements/AddUser/ProxyAssignmentsSection.tsx` - Proxy person search with 300ms debounce, async API call, light token rendering
- `src/components/elements/AddUser/ProxyAssignmentsSection.module.css` - Layout styles for proxy section
- `src/components/elements/AddUser/AddUser.tsx` - Added imports, Curator_Scoped role, scope/proxy state, option fetching, edit preload, submit logic, conditional rendering
- `src/components/elements/Manage/UsersTable.tsx` - Added Role column with ROLE_LABELS, parseJsonColumn, scope inline summary, proxy count
- `src/components/elements/Manage/UsersTable.module.css` - Added roleLabel, roleMuted, proxyCount styles

## Decisions Made
- CurationScopeSection receives baseSx and renderOrgTags as props from parent AddUser rather than defining its own -- keeps styling consistent and DRY
- ProxyAssignmentsSection implements its own renderTags inline because proxy tokens display personIdentifier which is a different format than org unit tags
- UsersTable defines its own local ROLE_LABELS map rather than importing from AddUser to avoid circular dependency between the two components
- Both CSS modules define their own section title and field styles matching AddUser patterns -- intentional duplication for component encapsulation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merged feature/v1.1-port into worktree**
- **Found during:** Pre-Task 1 (environment setup)
- **Issue:** Worktree was on master (c4f2348), missing all Phase 7/8/9 Plan 01 deliverables
- **Fix:** Fast-forward merged feature/v1.1-port into worktree branch
- **Verification:** All Phase 8/9 files present, TypeScript compilation passes

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Merge was a prerequisite -- plan depends on Phase 9 Plan 01 API endpoints and Phase 8 capability model. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CurationScopeSection and ProxyAssignmentsSection ready for use in admin user management flow
- Plans 03-04 can now build on this UI foundation for Search scope filtering, ScopeLabel, ProxyBadge, and GrantProxyModal
- TypeScript compilation passes with no errors

## Self-Check: PASSED

All 7 files verified on disk. Both task commits (107d440, 968d369) verified in git log. SUMMARY.md exists. TypeScript compilation passes.

---
*Phase: 09-scoped-roles-and-proxy-ui*
*Completed: 2026-03-28*
