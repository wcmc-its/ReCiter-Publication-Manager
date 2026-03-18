---
phase: 02-ui-ux-audit
plan: 03
subsystem: ui
tags: [accessibility, wcag, jest, testing-library, jsx-a11y, react-bootstrap, skeleton, keyboard]

# Dependency graph
requires:
  - phase: 02-ui-ux-audit (plans 01-02)
    provides: eslint-plugin-jsx-a11y strict mode, 8 AUDIT-*.md files, PATTERNS.md, user-approved 10 Critical fix list
  - phase: 01-search-result-filtering
    provides: skeleton components (SkeletonTable, SkeletonCard, SkeletonForm, SkeletonProfile)
provides:
  - Jest test infrastructure (jest.config.js + jest.setup.js using next/jest + React 16 compatible stack)
  - 10 Critical accessibility violations fixed across 15 source files
  - 33 jsx-a11y violations eliminated (64 baseline to 31 remaining)
  - 2 smoke test files with 10 tests covering Pagination and Tabs components
  - LIGHTHOUSE-COMPARISON.md with before/after accessibility analysis
affects: [03-scoped-roles, future UI work]

# Tech tracking
tech-stack:
  added: [jest@27.5.1, jest-environment-jsdom@27.5.1, @testing-library/react@12.1.5, @testing-library/jest-dom@5.17.0]
  patterns: [next/jest config, smoke test pattern with Redux Provider mock, react-bootstrap Nav for accessible tabs]

key-files:
  created:
    - jest.config.js
    - jest.setup.js
    - __tests__/components/Pagination.test.tsx
    - __tests__/components/Tabs.test.tsx
    - .planning/phases/02-ui-ux-audit/LIGHTHOUSE-COMPARISON.md
  modified:
    - package.json
    - src/components/elements/Tabs/Tabs.js
    - src/components/elements/Pagination/Pagination.tsx
    - src/components/elements/Header/Header.tsx
    - src/components/elements/Identity/Identity.js
    - src/components/elements/CurateIndividual/CurateIndividual.tsx
    - src/components/elements/Login/Login.js
    - src/components/elements/Manage/AdminSettings.tsx
    - src/components/elements/Notifications/Notifications.tsx
    - src/components/elements/Manage/ManageUsers.tsx
    - src/components/elements/Publication/Publication.tsx
    - src/components/elements/Publication/HistoryModal.tsx
    - src/components/elements/Report/Report.tsx
    - src/components/elements/CuratePublications/CuratePublications.tsx
    - src/components/elements/Profile/Profile.tsx
    - src/components/elements/Search/SearchBar.tsx

key-decisions:
  - "Used --legacy-peer-deps for test dependency install due to React 16 + MUI peer dep conflict"
  - "Old Tabs.js rewritten to react-bootstrap Nav (not deleted) since legacy App.js still imports it"
  - "Profile.tsx show-more and img-redundant-alt fixed as bonus since they were directly related to Critical fix patterns"
  - "SearchBar.tsx Reset div fixed as bonus since identical pattern to ManageUsers Critical fix"
  - "Smoke tests focus on Pagination and Tabs (components with most a11y changes) rather than full component tree"

patterns-established:
  - "Semantic buttons for onClick handlers: replace div/span/a onClick with <button type='button' className='btn btn-link'>"
  - "Form label association: Form.Label with htmlFor + matching id on Form.Control"
  - "Unique controlId per Form.Group: use descriptive names (disableNotifications, acceptedPubs, etc.)"
  - "Skeleton loading pattern: SkeletonForm for filter loading, SkeletonTable for results, SkeletonCard for cards"
  - "Jest smoke test pattern: mock next-auth/client, wrap in Redux Provider, verify key elements render"

requirements-completed: [UIUX-03]

# Metrics
duration: 14min
completed: 2026-03-17
---

# Phase 2 Plan 3: Critical A11y Fixes Summary

**Jest test infrastructure with React 16 compatible stack, 10 Critical accessibility violations fixed across 15 files (33 ESLint violations eliminated), and smoke tests for Pagination/Tabs components**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-17T02:52:07Z
- **Completed:** 2026-03-17T03:06:00Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments
- Jest 27 + @testing-library/react 12 test infrastructure fully configured with next/jest
- All 10 user-approved Critical accessibility violations fixed
- 33 jsx-a11y ESLint violations eliminated (52% of 64 baseline)
- 15 source files now have zero jsx-a11y errors
- 2 smoke test files with 10 passing tests
- LIGHTHOUSE-COMPARISON.md documenting before/after accessibility analysis

## Task Commits

Each task was committed atomically:

1. **Task 1: Set up Jest test infrastructure** - `3320577` (chore)
2. **Task 2: Fix critical a11y violations and write smoke tests** - `7d2e2a0` (fix)
3. **Task 3: Lighthouse re-run and before/after comparison** - `f864cd6` (docs)

## Files Created/Modified

### Created
- `jest.config.js` - Jest config using next/jest with jsdom environment
- `jest.setup.js` - Test setup importing @testing-library/jest-dom
- `__tests__/components/Pagination.test.tsx` - 8 smoke tests for Pagination accessibility
- `__tests__/components/Tabs.test.tsx` - 2 smoke tests for react-bootstrap Tabs replacement
- `.planning/phases/02-ui-ux-audit/LIGHTHOUSE-COMPARISON.md` - Before/after accessibility comparison

### Modified
- `package.json` - Added test scripts and pinned test dependency versions
- `src/components/elements/Tabs/Tabs.js` - Replaced custom tabs with react-bootstrap Nav (Fix #1)
- `src/components/elements/Pagination/Pagination.tsx` - Semantic buttons for arrows, label association (Fix #2)
- `src/components/elements/Header/Header.tsx` - Logout anchor replaced with button (Fix #3)
- `src/components/elements/Identity/Identity.js` - Added meaningful alt text to image (Fix #4)
- `src/components/elements/CurateIndividual/CurateIndividual.tsx` - Fixed redundant alt text
- `src/components/elements/Login/Login.js` - Added labels, removed autoFocus, fixed input type (Fix #5)
- `src/components/elements/Manage/AdminSettings.tsx` - Form.Label with htmlFor, unique checkbox id (Fix #6)
- `src/components/elements/Notifications/Notifications.tsx` - Unique controlId per Form.Group, fix aria-labels (Fix #7)
- `src/components/elements/Manage/ManageUsers.tsx` - Button for Reset/Search, Enter key handler (Fix #8)
- `src/components/elements/Publication/Publication.tsx` - Evidence toggle and Show History as buttons (Fix #9)
- `src/components/elements/Publication/HistoryModal.tsx` - Show More div replaced with button
- `src/components/elements/Report/Report.tsx` - Loader replaced with SkeletonForm/SkeletonTable (Fix #10)
- `src/components/elements/CuratePublications/CuratePublications.tsx` - Loader replaced with SkeletonCard (Fix #10)
- `src/components/elements/Profile/Profile.tsx` - Fixed redundant alt text and Show more span
- `src/components/elements/Search/SearchBar.tsx` - Reset div replaced with Button

## Decisions Made
- Used `--legacy-peer-deps` for test dependency install because React 16 + MUI 5 have conflicting peer deps (MUI wants React 17+)
- Rewrote legacy Tabs.js to use react-bootstrap Nav rather than deleting it, since App.js (legacy `/app/[uid]` route) still imports it
- Fixed Profile.tsx and SearchBar.tsx as bonus items since they followed the exact same patterns as the 10 Critical fixes
- AdminSettings checkbox rendered unconditionally (was previously hidden when isVisible=false, preventing toggle back on)
- Skeleton components chosen per content type: SkeletonForm for filter loading, SkeletonTable for search results, SkeletonCard for publication cards

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed Profile.tsx img-redundant-alt and span onClick**
- **Found during:** Task 2 (fixing img alt text pattern)
- **Issue:** Profile.tsx had same img-redundant-alt violation as CurateIndividual.tsx (M2 in AUDIT-curate) and a span onClick for "Show more"
- **Fix:** Changed alt from "Profile Image" to person name, replaced span onClick with button
- **Files modified:** src/components/elements/Profile/Profile.tsx
- **Verification:** `npx next lint --file src/components/elements/Profile/Profile.tsx` shows zero jsx-a11y errors
- **Committed in:** 7d2e2a0 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Fixed SearchBar.tsx Reset div onClick**
- **Found during:** Task 2 (fixing ManageUsers Reset pattern)
- **Issue:** SearchBar.tsx had identical div onClick pattern for "Reset" as ManageUsers.tsx (M1 in AUDIT-search)
- **Fix:** Replaced `<div onClick>` with `<Button variant="link">`
- **Files modified:** src/components/elements/Search/SearchBar.tsx
- **Verification:** `npx next lint --file src/components/elements/Search/SearchBar.tsx` shows zero jsx-a11y errors
- **Committed in:** 7d2e2a0 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both missing critical - same patterns as planned fixes)
**Impact on plan:** Both were direct extensions of planned fix patterns. No scope creep.

## Issues Encountered
- npm install required `--legacy-peer-deps` flag due to React 16 + @mui/material peer dependency conflict. This is a known issue in the project (React 16 paired with MUI 5 which expects React 17+). Resolution: use the flag, which is safe since all test deps are compatible with React 16.
- react-bootstrap Nav.Link renders `<a role="button" tabIndex={0}>` (not `<button>`). This is accessible but means ESLint jsx-a11y still sees anchor elements. However, these anchors have proper keyboard support via role + tabIndex, so no jsx-a11y violations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (UI/UX Audit) is now complete with all 3 plans executed
- Test infrastructure ready for Phase 3 development (Jest + RTL configured)
- 31 remaining jsx-a11y violations documented in LIGHTHOUSE-COMPARISON.md with Phase 3+ deferral plan
- PATTERNS.md is the authoritative design reference for all future UI work
- 02-UI-SPEC.md (Group Curation redesign contract) ready for Phase 3 implementation

## Self-Check: PASSED

All 6 created files verified present. All 3 task commits verified in git log.

---
*Phase: 02-ui-ux-audit*
*Completed: 2026-03-17*
