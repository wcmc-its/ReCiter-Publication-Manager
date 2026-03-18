---
phase: 01-search-result-filtering
plan: 02
subsystem: ui
tags: [react, bootstrap, skeleton-loading, pii-stripping, dropdown, profile-modal, css-animation]

# Dependency graph
requires:
  - phase: 01-search-result-filtering/01
    provides: getCapabilities() role model in src/utils/constants.js
provides:
  - Simplified search dropdown (Create Reports only, no Curate Publications)
  - PII-aware Profile modal with canViewPII gate
  - Four skeleton loading components (SkeletonTable, SkeletonCard, SkeletonProfile, SkeletonForm)
  - Shared shimmer animation CSS module
affects: [02-ui-ux-audit, 03-scoped-curation-roles]

# Tech tracking
tech-stack:
  added: [CSS Modules (Skeleton.module.css)]
  patterns: [skeleton loading with CSS-only shimmer, capability-gated PII display]

key-files:
  created:
    - src/components/elements/Common/Skeleton.module.css
    - src/components/elements/Common/SkeletonTable.tsx
    - src/components/elements/Common/SkeletonCard.tsx
    - src/components/elements/Common/SkeletonProfile.tsx
    - src/components/elements/Common/SkeletonForm.tsx
  modified:
    - src/components/elements/Search/Search.js
    - src/components/elements/Profile/Profile.tsx
    - src/components/elements/CurateIndividual/CurateIndividual.tsx
    - src/components/elements/Manage/ManageUsers.tsx
    - src/components/elements/Manage/AdminSettings.tsx
    - src/components/elements/Notifications/Notifications.tsx

key-decisions:
  - "Replaced SplitDropdown with plain Button for Create Reports -- no dropdown needed after Curate Publications removal"
  - "canViewPII derived from getCapabilities (canCurate.all or canCurate.self) rather than broken roleAccess OR logic"
  - "Skeleton components are purpose-built per context (table, card, profile, form) with fixed dimensions -- no size props"
  - "Loader.tsx preserved for modal contexts (Profile, History, Export, AddUser, AppLayout)"

patterns-established:
  - "Skeleton loading: use purpose-built skeleton components from Common/ instead of Loader for page-level loading states"
  - "PII gating: use canViewPII from getCapabilities to conditionally show sensitive fields (emails, relationships)"
  - "CSS Modules: Skeleton.module.css establishes CSS Module usage for component-scoped styles"

requirements-completed: [UIBUG-01, UIBUG-02, UIBUG-03]

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 1 Plan 02: UI Bug Fixes Summary

**Removed Curate Publications from search dropdown, added PII-gated Profile modal with descriptive errors, and replaced Loader spinner with four shimmer skeleton components across all main pages**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T22:42:00Z
- **Completed:** 2026-03-16T22:48:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 12

## Accomplishments
- Search page dropdown simplified from 100+ line role-branch if-else to a single "Create Reports" button for all users -- "Curate Publications" completely eliminated (UIBUG-01)
- Profile modal error message changed from generic "Something went wrong" to descriptive "Unable to load profile data" with actionable guidance; PII (emails, known relationships) now hidden for non-curators via canViewPII gate derived from getCapabilities (UIBUG-02)
- Four skeleton loading components created with CSS-only shimmer animation (#e0e0e0 background, #f0f0f0 highlight), replacing the red Loader spinner on Search, Curate, Manage Users, Admin Settings, and Notifications pages (UIBUG-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix search dropdown and Profile modal** - `cce8a62` (feat)
2. **Task 2: Create skeleton components and replace Loader usage** - `4838e18` (feat)
3. **Task 3: Verify all UI bug fixes** - checkpoint approved (no code commit)

## Files Created/Modified

### Created
- `src/components/elements/Common/Skeleton.module.css` - Shared skeleton base class with shimmer keyframes and per-component layout styles
- `src/components/elements/Common/SkeletonTable.tsx` - 5-row skeleton table for Search and Manage Users loading states
- `src/components/elements/Common/SkeletonCard.tsx` - 3-card skeleton for publication list loading (Curate page)
- `src/components/elements/Common/SkeletonProfile.tsx` - Avatar + name + title + keyword pills skeleton (Curate page header)
- `src/components/elements/Common/SkeletonForm.tsx` - 4-field form skeleton for AdminSettings and Notifications

### Modified
- `src/components/elements/Search/Search.js` - Removed Curate Publications from dropdown (UIBUG-01), replaced Loader with SkeletonTable (UIBUG-03), imported getCapabilities for role detection
- `src/components/elements/Profile/Profile.tsx` - Descriptive error message (UIBUG-02), canViewPII gate hiding emails and relationships for non-curators
- `src/components/elements/CurateIndividual/CurateIndividual.tsx` - Replaced Loader with SkeletonProfile + SkeletonCard
- `src/components/elements/Manage/ManageUsers.tsx` - Replaced Loader with SkeletonTable
- `src/components/elements/Manage/AdminSettings.tsx` - Replaced Loader with SkeletonForm
- `src/components/elements/Notifications/Notifications.tsx` - Swapped Loader import for SkeletonForm

## Decisions Made
- **SplitDropdown replaced with plain Button:** After removing "Curate Publications," only "Create Reports" remained. A SplitDropdown with a single action is unnecessary -- a plain Button is cleaner.
- **canViewPII instead of roleAccess:** The existing `roleAccess` logic used `allowedPermissions.Curator_All || allowedPermissions.Curator_Self` which always evaluated to truthy (string OR string = first truthy string). Replaced with `canViewPII = caps.canCurate.all || caps.canCurate.self` using the capability model from Plan 01.
- **Purpose-built skeletons over generic Skeleton:** Each skeleton (Table, Card, Profile, Form) has fixed dimensions matching its target layout. This avoids prop complexity and ensures skeletons closely match final content shape.
- **Loader.tsx preserved:** Still used in Profile modal, History modal, Export modal, AddUser form, and AppLayout -- contexts where a small centered spinner is appropriate.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 1 is now complete (both Plan 01 auth fix and Plan 02 UI bug fixes)
- All AUTH and UIBUG requirements satisfied
- Application uses capability-based auth model (Plan 01) and clean UI patterns (Plan 02)
- Ready for Phase 2: UI/UX Audit, which can leverage the skeleton and capability patterns established here

## Self-Check: PASSED

All 5 created files exist. All 6 modified files exist. Loader.tsx preserved. Both task commits (cce8a62, 4838e18) found in git log. Summary file exists.

---
*Phase: 01-search-result-filtering*
*Completed: 2026-03-16*
