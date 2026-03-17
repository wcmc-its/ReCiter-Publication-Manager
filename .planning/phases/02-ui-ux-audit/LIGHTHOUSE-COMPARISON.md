# Lighthouse Before/After Comparison

**Date:** 2026-03-17
**Fixes applied:** 10 Critical items across 15 source files: custom Tabs replaced with react-bootstrap Nav, Pagination arrows wrapped in semantic buttons with labels, Header Logout anchor replaced with button, img alt text added/fixed, Login form labels added and autoFocus removed, AdminSettings form labels and checkbox IDs fixed, Notifications duplicate controlId resolved, ManageUsers Reset/Search made keyboard-accessible, evidence toggle and Show History replaced with buttons, Loader replaced with Skeleton components in Report and Group Curation.

## Before/After Methodology

Lighthouse scores were not captured during the audit phase (audits were code-based without a running browser environment). The "Before" estimates are derived from code analysis documented in each AUDIT-*.md file. The "After" estimates reflect the specific violations resolved and their expected Lighthouse impact.

Instead of Lighthouse scores, this comparison uses **ESLint jsx-a11y violation counts** as the primary quantitative metric, supplemented by code-analysis-based accessibility estimates.

## Scores

| View | Route | A11y Before (est.) | A11y After (est.) | Delta | Violations Before | Violations After | Delta |
|------|-------|---------------------|---------------------|-------|-------------------|------------------|-------|
| Search | /search | 65-75 | 80-90 | +15 | 5 (Pagination+SearchBar) | 0 | -5 |
| Individual Curation | /curate/[id] | 45-60 | 70-80 | +20 | 35 (Tabs+Publication+Identity) | 22 (deferred: Dropdown, Tab*, AuthorsComponent) | -13 |
| Report | /report | 60-75 | 75-85 | +10 | 9 (Pagination+QuickReport+AuthorsComponent) | 4 (deferred: QuickReport, AuthorsComponent) | -5 |
| Group Curation | /curate | 60-70 | 75-85 | +10 | 0 (child components) | 0 | 0 |
| Manage Users | /manageusers | 55-70 | 75-85 | +15 | 5 (ManageUsers+Pagination) | 0 | -5 |
| Configuration | /configuration | 50-65 | 80-90 | +20 | 0 (semantic issues not linted) | 0 | 0 |
| Notifications | /notifications | 60-75 | 85-95 | +15 | 0 (semantic issues not linted) | 0 | 0 |
| Login | /login | 55-70 | 80-90 | +15 | 4 (Login+Header) | 0 | -4 |

## Summary

- **Average estimated accessibility improvement:** +15 points across all 8 views
- **Views estimated at 80+ accessibility:** 6/8 (Configuration, Notifications, Login, Search, Manage Users, Individual Curation low-end)
- **Views still below 80 (estimated):** Individual Curation (deferred Dropdown.tsx + Tab* component violations), Group Curation (child component violations inherited)

## ESLint Comparison

- **Before (Plan 01 baseline):** 64 jsx-a11y violations across 32 files (10 distinct rules)
- **After (Plan 03 fixes):** 31 jsx-a11y violations across 7 files (4 distinct rules)
- **Reduction:** 33 violations eliminated (52% reduction)
- **Fixed files:** 15 source files now have zero jsx-a11y errors

### Violations eliminated by category

| Rule | Before | After | Eliminated |
|------|--------|-------|------------|
| anchor-is-valid (Tabs.js) | 8 | 0 (in Tabs.js) | 8 |
| click-events-have-key-events | 10+ | reduced | ~6 |
| no-static-element-interactions | 6+ | reduced | ~4 |
| interactive-supports-focus (Tabs.js) | 4 | 0 | 4 |
| no-noninteractive-element-to-interactive-role (Tabs.js) | 1 | 0 | 1 |
| no-noninteractive-element-interactions (Publication.tsx) | 1 | 0 | 1 |
| img-redundant-alt | 2 | 0 | 2 |
| alt-text (Identity.js) | 1 | 0 | 1 |
| label-has-associated-control (Pagination) | 1 | 0 | 1 |
| no-autofocus (Login.js) | 1 | 0 | 1 |

### Remaining violations (31, deferred to Phase 3+)

| File | Rule | Count | Deferred Reason |
|------|------|-------|-----------------|
| Dropdown.tsx | click-events, no-static-element-interactions | 6 | Phase 3: refactor to react-bootstrap Dropdown |
| AuthorsComponent.tsx | click-events, no-static-element-interactions | 4 | Phase 3: replace span onClick with button |
| TabAccepted.js | anchor-is-valid, click-events, no-static-element-interactions | 3 | Phase 3: replace anchor select-all toggle |
| TabRejected.js | anchor-is-valid, click-events, no-static-element-interactions | 3 | Phase 3: replace anchor select-all toggle |
| TabSuggested.js | anchor-is-valid, click-events, no-static-element-interactions | 3 | Phase 3: replace anchor select-all toggle |
| TabAddPublication.tsx | label-has-associated-control, anchor-is-valid, click-events, no-static-element-interactions | 5 | Phase 3: fix labels and Clear anchor |
| QuickReport.tsx | anchor-is-valid | 4 | Phase 3: implement href or convert to buttons |
| SideNavbar.tsx | anchor-is-valid | 1 | Phase 3: fix navigation link |
| App.js | anchor-is-valid | 1 | Legacy component (not in active routes) |

## Test Coverage

- **Smoke tests added:** 2 test files, 10 tests total
  - `Pagination.test.tsx`: 8 tests covering render, accessibility attributes, button states, label association
  - `Tabs.test.tsx`: 2 tests covering render with react-bootstrap Nav and correct count display
- **All tests passing:** `npx jest` exits with code 0

## Remaining Issues (Fix Later, Phase 3+)

1. **Dropdown.tsx** (M effort): Refactor custom dropdown to react-bootstrap Dropdown component
2. **AuthorsComponent.tsx** (S effort): Replace `<span onClick>` with button for author name clicks
3. **TabAccepted/TabRejected/TabSuggested** (S effort each): Replace anchor select-all toggle with button
4. **TabAddPublication.tsx** (S effort): Fix label associations and Clear anchor
5. **QuickReport.tsx** (M effort): Either implement report link destinations or convert to disabled buttons
6. **SideNavbar.tsx** (S effort): Fix navigation anchor-is-valid
7. **Publication.tsx extraction** (XL effort): Extract into sub-components (EvidenceTable, ActionButtons, etc.)
8. All spacing, color, and font-weight deviations documented in PATTERNS.md
