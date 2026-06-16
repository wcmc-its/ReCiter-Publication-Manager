---
phase: 11-polish-and-testing
plan: 03
subsystem: ui
tags: [a11y, jsx-a11y, eslint, wcag, buttons, keyboard-accessibility, semantic-html]

# Dependency graph
requires:
  - phase: 11-polish-and-testing
    plan: 02
    provides: eslint-plugin-jsx-a11y strict mode configuration and label-control fixes
provides:
  - Zero jsx-a11y violations across entire codebase (strict mode)
  - WCAG 2.1 AA keyboard accessibility for all interactive elements
  - Semantic button elements replacing non-interactive click handlers
affects: [11-polish-and-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [button with reset styles for interactive non-native elements, role/tabIndex/onKeyDown for overlay backdrops, eslint-disable for MUI-mandated patterns]

key-files:
  created: []
  modified:
    - src/components/elements/Dropdown/Dropdown.tsx
    - src/components/elements/Report/ExportModal.tsx
    - src/components/elements/Report/CheckboxSelect.tsx
    - src/components/elements/Report/CheckList.tsx
    - src/components/elements/Common/AuthorsComponent.tsx
    - src/components/elements/Header/Header.tsx
    - src/components/elements/Search/SearchBar.tsx
    - src/components/elements/Publication/HistoryModal.tsx
    - src/components/elements/Profile/Profile.tsx
    - src/components/elements/Navbar/SideNavbar.tsx
    - src/components/elements/CurateIndividual/GrantProxyModal.tsx
    - src/components/elements/Publication/Publication.tsx
    - src/components/elements/AddUser/AddUser.tsx
    - src/components/elements/App/App.js
    - src/components/elements/Identity/Identity.js
    - src/components/elements/Login/Login.js
    - src/components/elements/TabAccepted/TabAccepted.js
    - src/components/elements/TabRejected/TabRejected.js
    - src/components/elements/TabSuggested/TabSuggested.js
    - src/components/elements/Tabs/Tabs.js

key-decisions:
  - "Used eslint-disable for MUI Autocomplete li element (AddUser.tsx) -- MUI renderOption API mandates li, no workaround"
  - "Used eslint-disable for Publication.tsx card onMouseDown -- focus tracking event on container div, not an interactive element"
  - "Used role=button + tabIndex + onKeyDown for overlay backdrops (ExportModal, Profile) since they must remain divs for layout"
  - "Replaced ul/li tab structure with div/button role=tab in legacy Tabs.js for strict a11y compliance"

patterns-established:
  - "Pattern: button with reset styles (background:none, border:none, padding:0, font:inherit, color:inherit) for replacing interactive span/div/anchor elements"
  - "Pattern: role=button + tabIndex=0 + onKeyDown Enter/Space for overlay backdrop close divs"
  - "Pattern: eslint-disable-next-line for framework-mandated non-interactive element patterns (MUI Autocomplete li)"

requirements-completed: [A11Y-01]

# Metrics
duration: 9min
completed: 2026-04-07
---

# Phase 11 Plan 03: A11y Interaction Fixes Summary

**All click-events, static-element, anchor-is-valid, and noninteractive jsx-a11y violations resolved across 20 component files with zero visual change -- build compiles clean**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-07T03:20:20Z
- **Completed:** 2026-04-07T03:29:32Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- Fixed all 35 jsx-a11y interaction violations in 13 TSX component files (click-events-have-key-events, no-static-element-interactions, anchor-is-valid, no-noninteractive-element-interactions)
- Discovered and fixed 18 additional jsx-a11y violations in 7 legacy JS files that the original eslint scan missed (build-time linting catches .js files)
- Full eslint audit with jsx-a11y strict mode reports zero violations across all src/ files (.tsx, .jsx, .js)
- Next.js build compiles successfully with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix click-events, static-element, anchor-is-valid, noninteractive violations (13 TSX files)** - `b75e5d1` (feat)
2. **Task 2: Final audit -- fix remaining JS file violations and build verification** - `3618ed2` (fix)

## Files Created/Modified

### TSX files (Task 1)
- `src/components/elements/Dropdown/Dropdown.tsx` - Moved onClick from wrapper div to button, replaced span items with buttons (6 violations)
- `src/components/elements/Report/ExportModal.tsx` - Added role/tabIndex/onKeyDown to overlay div, eslint-disable on modal stop-propagation (4 violations)
- `src/components/elements/Report/CheckboxSelect.tsx` - Replaced div items with button elements (4 violations)
- `src/components/elements/Common/AuthorsComponent.tsx` - Replaced clickable span author names with buttons (4 violations)
- `src/components/elements/Header/Header.tsx` - Replaced anchor logout link with button (3 violations: anchor-is-valid + click + static)
- `src/components/elements/Search/SearchBar.tsx` - Replaced div Reset button with button element (2 violations)
- `src/components/elements/Report/CheckList.tsx` - Replaced div checklist items with buttons (2 violations)
- `src/components/elements/Publication/HistoryModal.tsx` - Replaced div Show More with button (2 violations)
- `src/components/elements/Profile/Profile.tsx` - Added role/tabIndex/onKeyDown to overlay backdrop (2 violations)
- `src/components/elements/Navbar/SideNavbar.tsx` - Replaced div compact toggle with button, added aria-label (2 violations)
- `src/components/elements/CurateIndividual/GrantProxyModal.tsx` - Replaced span tag delete with button, added aria-label="Remove" and min touch target (2 violations)
- `src/components/elements/Publication/Publication.tsx` - Added eslint-disable for card onMouseDown focus tracking (1 violation)
- `src/components/elements/AddUser/AddUser.tsx` - Added eslint-disable for MUI Autocomplete renderOption li (1 violation)

### JS files (Task 2 -- deviation)
- `src/components/elements/App/App.js` - Replaced anchor href="#" Refresh link with button
- `src/components/elements/Identity/Identity.js` - Added alt text to profile img element
- `src/components/elements/Login/Login.js` - Removed autoFocus prop (no-autofocus rule)
- `src/components/elements/TabAccepted/TabAccepted.js` - Replaced anchor Search PubMed link with button
- `src/components/elements/TabRejected/TabRejected.js` - Replaced anchor Search PubMed link with button
- `src/components/elements/TabSuggested/TabSuggested.js` - Replaced anchor Search PubMed link with button
- `src/components/elements/Tabs/Tabs.js` - Replaced ul/li/a tab structure with div/button role="tab" with ARIA attributes

## Decisions Made
- Used eslint-disable comments for two cases where the element type is mandated by external constraints: MUI Autocomplete renderOption requires `<li>`, and Publication card `onMouseDown` is focus tracking not interactive intent
- Used `role="button"` + `tabIndex={0}` + `onKeyDown` for overlay backdrop divs rather than converting to button, since these are full-screen overlay containers where `<button>` would be semantically incorrect
- Replaced legacy Tabs.js `<ul>/<li>/<a>` Bootstrap tab pattern with `<div>/<div>/<button role="tab">` to satisfy both anchor-is-valid and no-noninteractive-element-to-interactive-role rules
- Removed `autoFocus` from login form per jsx-a11y/no-autofocus strict rule (accessibility concern for screen reader users)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed jsx-a11y violations in 7 legacy JS files not covered by plan**
- **Found during:** Task 2 (build verification)
- **Issue:** Plan only targeted .tsx/.jsx files. The initial eslint command used `--ext .tsx,.jsx` which missed violations in .js files. The `next build` command runs eslint on all files and found 18 additional violations in App.js, Identity.js, Login.js, TabAccepted.js, TabRejected.js, TabSuggested.js, and Tabs.js
- **Fix:** Applied same patterns (anchor->button, add alt text, remove autoFocus, replace tab anchors with buttons)
- **Files modified:** 7 JS files listed above
- **Verification:** `npx next build` compiles successfully, `npx eslint --ext .tsx,.jsx,.js src/ | grep -c jsx-a11y` outputs 0
- **Committed in:** 3618ed2 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Publication.tsx parse error from JSX comment syntax**
- **Found during:** Task 2 (build verification)
- **Issue:** The eslint-disable comment in Task 1 used JSX comment syntax `{/* */}` directly after `return (` which caused a parsing error (`)` expected)
- **Fix:** Changed to JS line comment `// eslint-disable-next-line` which is valid in that position
- **Files modified:** src/components/elements/Publication/Publication.tsx
- **Verification:** Build compiles without parse error
- **Committed in:** 3618ed2 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for the build to pass. The JS file violations were simply not visible to the original eslint command. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None

## Next Phase Readiness
- jsx-a11y strict mode is now fully enforced across the entire codebase with zero violations
- All interactive elements have keyboard support (native buttons or role+tabIndex+onKeyDown)
- Build compiles cleanly -- ready for remaining Phase 11 plans

## Self-Check: PASSED

- FOUND: 11-03-SUMMARY.md
- FOUND: commit b75e5d1 (Task 1)
- FOUND: commit 3618ed2 (Task 2)
- FOUND: All 20 modified component files exist on disk
- Verification: `npx eslint --ext .tsx,.jsx,.js src/ | grep -c jsx-a11y` outputs 0
- Verification: `npx next build` compiles successfully

---
*Phase: 11-polish-and-testing*
*Completed: 2026-04-07*
