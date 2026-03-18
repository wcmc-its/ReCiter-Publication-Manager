# Audit: Search (Find People)

**Date:** 2026-03-17
**Auditor:** Claude (AI) + code review + ESLint static analysis
**Route:** /search
**Component(s):** Search.js (477 lines), SearchBar.tsx (183 lines), FilterReview.tsx, Pagination.tsx (94 lines)

## Overview

The Search view is the primary landing page for Curator_All, Reporter_All, and Superuser roles. It displays a paginated table of people with name, organization, institution, pending article count, and an action button. Users can search by name/CWID, filter by org unit/institution/person type, and navigate to individual curation or reporting from the results.

## Screenshot

*Not captured -- no browser environment available. Recommend manual Lighthouse audit at `http://localhost:3000/search`.*

## Findings

### Critical

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| C1 | Pagination arrow icons (ArrowLeft/ArrowRight) use onClick on MUI icon elements without keyboard handlers. These SVG elements have no role, tabIndex, or onKeyDown -- completely inaccessible to keyboard users | Pagination.tsx:83-85 | Replace MUI icon onClick with semantic `<button>` elements wrapping the icons, or add role="button", tabIndex={0}, and onKeyDown handler | M | N |
| C2 | Pagination label "Show records" is not associated with the DropdownButton control -- `<label>` has no `htmlFor` and DropdownButton has no matching `id` | Pagination.tsx:73-74 | Add `htmlFor="show-records-dropdown"` to label and `id="show-records-dropdown"` to DropdownButton, or use `aria-labelledby` | S | N |

### Major

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| M1 | "Reset" text in SearchBar uses `<div>` with onClick but no keyboard handler, no role, no tabIndex -- not keyboard accessible | SearchBar.tsx:175 | Replace with `<Button variant="link">` or add role="button", tabIndex={0}, onKeyDown | S | N |
| M2 | Search results table `<th>` elements lack `scope="col"` attribute -- screen readers cannot associate header cells with data cells | Search.js:417-421 | Add `scope="col"` to all `<th>` elements | S | N |
| M3 | Empty error state renders an empty container with no user feedback (just empty divs) | Search.js:268-281 | Display a meaningful error message with retry action | M | N |
| M4 | "No records found" message uses custom styled paragraph inside a table row -- no ARIA live region to announce result changes to screen readers | Search.js:375-383 | Add `aria-live="polite"` to the results container so screen readers announce when results change | S | N |
| M5 | Conditional column rendering uses empty string `""` instead of `null` when `Pending` column is hidden for non-curators -- this can create inconsistent table column counts | Search.js:362-366, 420 | Return `null` instead of `""` for hidden columns to avoid DOM warnings | S | N |
| M6 | Name component renders a `<button>` with class `text-btn` but button styling may not have sufficient contrast or meet 44px minimum touch target | Search.js:461 | Verify button height meets WCAG 2.5.5 (44px minimum) and contrast ratio meets 4.5:1 | S | N |

### Minor

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| m1 | Page title "Find People" uses `<h1>` which is correct, but heading hierarchy is inconsistent -- `<h3>` used for person count ("X people") skipping h2 | Search.js:402 | Use `<h2>` for subheadings to maintain proper heading hierarchy | S | N |
| m2 | useEffect dependency array is empty `[]` but references `session`, `updatedAdminSettings`, `filters` -- known react-hooks/exhaustive-deps warning | Search.js:115 | Acknowledged as intentional mount-only effect; add eslint-disable comment with explanation if not fixing | S | N |
| m3 | Import of `useHistory` from react-router-dom appears unused (never called after variable declaration) | Search.js:16,25 | Remove unused import and variable | S | N |
| m4 | Inconsistent spacing -- table uses Bootstrap classes but parent container uses custom CSS module classes with ad-hoc spacing | Search.js:388-441 | Align spacing to the 4/8/16/24/32/48px scale from 02-UI-SPEC.md | M | N |
| m5 | `<br />` tag used for vertical spacing (line 398) instead of proper CSS margin/padding | Search.js:398 | Replace with CSS margin-top on the following element | S | N |

## Accessibility

### Lighthouse Score

*Not captured -- requires browser execution. Based on code analysis, estimated score: 65-75/100 due to missing labels, non-interactive element interactions, and heading hierarchy issues.*

### ESLint jsx-a11y Violations

| Rule | Count | Files |
|------|-------|-------|
| jsx-a11y/click-events-have-key-events | 2 | SearchBar.tsx:175 |
| jsx-a11y/no-static-element-interactions | 2 | SearchBar.tsx:175 |
| jsx-a11y/label-has-associated-control | 1 | Pagination.tsx:73 |

*Note: Pagination.tsx violations affect Search, Report, and Group Curation views (shared component).*

### Keyboard Navigation

- **Tab order:** Partially logical -- search input, filter dropdowns, and Search/Reset buttons are in visual order. However, the "Reset" div (SearchBar.tsx:175) is not in the tab order at all since it lacks tabIndex.
- **Focus indicators:** Bootstrap's default focus ring is present on form inputs and the Search button. The "Reset" div has no focus indicator. Pagination arrows have no focus indicator.
- **Keyboard traps:** None detected in code analysis.

## Performance

### Lighthouse Score

*Not captured. Based on code analysis:*
- **Estimated Performance:** 50-65/100 (speculative)
- **First Contentful Paint:** Depends on API response time for initial paginated data fetch
- **Largest Contentful Paint:** The results table body, populated after two API calls (person list + count)

### React Profiler

*Not captured. Based on code analysis:*
- The `RoleSplitDropdown` component is defined inside the `Search` component render body (line 324), meaning it is re-created on every render. While this is acceptable for simple components, it prevents React.memo optimization.
- `filter()` function (line 266) is called on every render without memoization.
- Table row mapping creates new arrow functions per cell for `onClickProfile` callbacks.

## Recommendations

### Fix Now (Phase 2)

1. **C1:** Replace Pagination arrow onClick on SVG icons with semantic buttons (blocks keyboard navigation)
2. **C2:** Associate "Show records" label with dropdown control
3. **M1:** Replace "Reset" div with Button component in SearchBar
4. **M2:** Add `scope="col"` to table headers

### Fix Later (Phase 3+)

1. **M3:** Implement meaningful error state display (M effort)
2. **M4:** Add aria-live region for result count announcements (S effort)
3. **m1:** Fix heading hierarchy (S effort)
4. **m3:** Remove unused useHistory import (S effort)
5. **m4:** Align spacing to design system scale (M effort)
6. Consider memoizing RoleSplitDropdown and filter() function (S effort)
