# Audit: Report (Create Reports)

**Date:** 2026-03-17
**Auditor:** Claude (AI) + code review + ESLint static analysis
**Route:** /report
**Component(s):** Report.tsx (450 lines), SearchSummary.tsx (444 lines), FilterSection.tsx (170 lines), QuickReport.tsx (21 lines), CheckboxSelect.tsx, DatePicker.tsx, SliderFilter.tsx, Pagination.tsx (shared), ExportModal.tsx

## Overview

The Report view enables bibliometric reporting across the publication database. Users select filters (author, date range, journal, article type, etc.), search, then view/sort/export results. Export options include CSV (authorship report, article report) and RTF. The view loads filter options from admin settings and uses paginated results with sort controls. Linked from Search via "Create Reports" button.

## Screenshot

*Not captured -- no browser environment available. Recommend manual Lighthouse audit at `http://localhost:3000/report`.*

## Findings

### Critical

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| C1 | QuickReport.tsx uses `<Link href=''>` (empty href) on two anchor links ("NewPubs report" and "TrendingPubs report") -- 4 anchor-is-valid violations. These links go nowhere and are completely inaccessible to keyboard users | QuickReport.tsx:11,15 | Either implement the href destinations or replace with `<button>` elements if the feature is not yet implemented. If placeholder, disable them with `aria-disabled="true"` and explanatory text | M | N |
| C2 | Pagination component shared with Search view has same critical issues: arrow icons not keyboard accessible, label not associated with dropdown | Pagination.tsx:73,83-85 | See AUDIT-search.md C1 and C2 -- fix in shared component benefits all views | M | N |

### Major

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| M1 | SearchSummary.tsx TODO comments at lines 82 and 130 indicate filter data is not fetched on page load -- if `reportsResultsIds` is not populated, the export functions silently fail or do nothing | SearchSummary.tsx:78-84,125-132 | Implement data fetching in the TODO branches, or disable export buttons when data is unavailable with user-visible feedback | M | N |
| M2 | FilterSection.tsx renders `<>` fragments without keys in a `.map()` call -- React key warning and potential rendering issues | FilterSection.tsx:147-162 | Add `key={index}` to the outer fragment or wrap in a `<div>` | S | N |
| M3 | FilterSection.tsx has `@ts-nocheck` at line 1 -- completely disables TypeScript checking for the entire file, masking potential type errors | FilterSection.tsx:1 | Remove `@ts-nocheck` and fix any resulting type errors | M | N |
| M4 | Sort dropdown in SearchSummary uses `eventKey` values that concatenate option and direction (e.g., `${sortOption}_DESC`) -- if `sortOption` is an object (which it is after line 61-63 formatting), the eventKey becomes `[object Object]_DESC` | SearchSummary.tsx:382,390 | Fix eventKey to use `sortOption.labelName` or the original key, not the formatted object | M | N |
| M5 | Loading state uses old `<Loader />` component (spinner) instead of Phase 1 skeleton components when filter data is loading | Report.tsx:381-385 | Replace with SkeletonForm or appropriate skeleton pattern from Phase 1 for consistent loading experience | S | Y |
| M6 | Loading state for search results also uses `<Loader />` spinner | Report.tsx:402-405 | Replace with SkeletonTable for consistent loading pattern | S | Y |
| M7 | AuthorsComponent.tsx (used in ReportResults to display article authors) has 4 a11y violations -- click handlers on `<span>` elements without keyboard support for author name clicks | AuthorsComponent.tsx:21,25 | Replace `<span onClick>` with `<button className="text-btn">` for clickable author names | S | N |

### Minor

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| m1 | Report.tsx has 2 react-hooks/exhaustive-deps warnings for useEffect hooks | Report.tsx:173,206 | Acknowledged as intentional -- document with eslint-disable comments if not fixing | S | N |
| m2 | SearchSummary.tsx has 1 react-hooks/exhaustive-deps warning | SearchSummary.tsx:65 | Same as above | S | N |
| m3 | CheckboxSelect.tsx has 2 react-hooks/exhaustive-deps warnings | CheckboxSelect.tsx:32,37 | Same as above | S | N |
| m4 | DatePicker.tsx has 1 react-hooks/exhaustive-deps warning | DatePicker.tsx:42 | Same as above | S | N |
| m5 | Variable name typo: `reportFiltersLabes` should be `reportFiltersLabels` -- used in Report.tsx and FilterSection.tsx | Report.tsx:67, FilterSection.tsx:141 | Rename to `reportFiltersLabels` across all references | S | N |
| m6 | Variable name typo: `serFormatedSOrtOptions` should be `setFormattedSortOptions` | SearchSummary.tsx:35 | Rename to follow consistent camelCase pattern | S | N |
| m7 | Export buttons ("Export to CSV", "Export to RTF") use `disabled={count == 0}` with loose equality instead of strict `===` | SearchSummary.tsx:403,404 | Use strict equality `count === 0` | S | N |
| m8 | Page title "Create Reports" uses `<h1>` -- consistent with other views. Good. | Report.tsx:389 | No action needed | - | - |
| m9 | Filter section uses `<div className="break">` for visual separation between filter rows -- semantically meaningless | FilterSection.tsx:160 | Use CSS `border-bottom` or `<hr>` for visual separation, or remove if not needed | S | N |

## Accessibility

### Lighthouse Score

*Not captured. Based on code analysis, estimated score: 60-75/100. Critical anchor-is-valid issues in QuickReport, shared Pagination issues, and missing keyboard support for author clicks.*

### ESLint jsx-a11y Violations

| Rule | Count | Files |
|------|-------|-------|
| jsx-a11y/anchor-is-valid | 4 | QuickReport.tsx:11 (x2), QuickReport.tsx:15 (x2) |
| jsx-a11y/click-events-have-key-events | 2 | AuthorsComponent.tsx:21, 25 |
| jsx-a11y/no-static-element-interactions | 2 | AuthorsComponent.tsx:21, 25 |
| jsx-a11y/label-has-associated-control | 1 | Pagination.tsx:73 (shared) |

### Keyboard Navigation

- **Tab order:** Filter section uses react-bootstrap components (Button, DropdownButton, CheckboxSelect) which provide keyboard support natively. The "Search" and "Reset" buttons are accessible.
- **Focus indicators:** Bootstrap default focus rings present on filter controls. Sort dropdown (react-bootstrap DropdownButton) has native keyboard support.
- **Keyboard traps:** None detected. QuickReport links with empty href can receive focus but go nowhere -- confusing but not trapping.

## Performance

### Lighthouse Score

*Not captured. Based on code analysis:*
- **Estimated Performance:** 55-70/100
- **First Contentful Paint:** Filter options load on mount, initial search may be deferred
- **Largest Contentful Paint:** Results table after search query completes

### React Profiler

*Not captured. Based on code analysis:*
- Report.tsx has 15+ useState declarations and 2 useEffect hooks -- large component state surface area.
- Admin settings parsing happens synchronously in the first useEffect -- JSON.parse called 8+ times for different setting views.
- `highlightSelectedAuthors` creates new author objects on each call without memoization.
- SearchSummary creates a new `Excel.Workbook()` instance on every render (line 49) -- this is expensive and should be created lazily only when exporting.

## Recommendations

### Fix Now (Phase 2)

1. **C1:** Fix QuickReport empty href links -- either implement destinations or convert to disabled buttons
2. **C2:** Fix shared Pagination component (see AUDIT-search.md -- single fix benefits all views)
3. **M5+M6:** Replace Loader with skeleton components for loading states (Phase 1 regression)
4. **M7:** Fix AuthorsComponent.tsx click handlers for keyboard accessibility

### Fix Later (Phase 3+)

1. **M1:** Implement TODO data fetching in SearchSummary export functions (M effort)
2. **M3:** Remove @ts-nocheck from FilterSection.tsx and fix type errors (M effort)
3. **M4:** Fix sort option eventKey object serialization bug (M effort)
4. **m5-m6:** Fix variable name typos across Report components (S effort)
5. Move Excel.Workbook creation to export handler rather than render-time (S effort)
6. Consider extracting Report admin settings parsing into a custom hook (M effort)
