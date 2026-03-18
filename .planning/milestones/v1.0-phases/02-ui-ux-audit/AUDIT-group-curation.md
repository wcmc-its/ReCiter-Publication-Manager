# Audit: Group Curation

**Date:** 2026-03-17
**Auditor:** Claude (AI) + code review + ESLint static analysis
**Route:** /curate (no ID parameter)
**Component(s):** CuratePublications.tsx (128 lines), PublicationsPane.tsx, CuratePublications.module.css, src/pages/curate/index.js

## Overview

The Group Curation view displays pending publications for multiple people at once, paginated in groups. It is navigated to from the Search view after selecting people -- the `curateIdsFromSearchPage` Redux state carries the selected identities. The view shows a header ("About X people with pending publications"), Previous/Next pagination buttons, and a list of publication cards per person. This view is the target of the 02-UI-SPEC.md redesign contract.

## Screenshot

*Not captured -- no browser environment available. Recommend manual Lighthouse audit at `http://localhost:3000/curate` (navigate from Search first to populate Redux state).*

## Findings

### Critical

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| C1 | Direct navigation to /curate with no prior Search page visit results in an empty `curateIdsFromSearchPage` Redux state. The view renders "Curate Publications" heading, the filter section, then an empty publications container with no explanation. There is no empty state messaging, no redirect, and no way for the user to recover without knowing to go to /search first | CuratePublications.tsx:35-36,108 | Add an empty state component that explains "Select people from the Search page to curate their publications" with a link to /search. Guard against empty filteredIds | M | N |
| C2 | Previous/Next pagination buttons lack keyboard focus management -- when a page change dispatches a Redux action and re-renders the publications list, focus is lost to the top of the document. Screen reader users lose their position | CuratePublications.tsx:76-79,114-115 | After page change, manage focus by moving it to the first publication card or the heading. Use `useRef` and `element.focus()` after data loads | M | N |

### Major

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| M1 | Loading state uses old `<Loader />` spinner component instead of Phase 1 skeleton patterns. Group view has no skeleton layout -- it shows a centered spinner until data loads, providing no structural preview | CuratePublications.tsx:108 | Replace with SkeletonCard components matching the publication card layout for better perceived performance | S | Y |
| M2 | getServerSideProps session check is entirely commented out (curate/index.js:5-22) -- the page has no server-side auth protection. Relies entirely on client-side middleware redirect, but if middleware fails, unauthenticated users see the page | src/pages/curate/index.js:5-22 | Uncomment and fix getServerSideProps session validation, or document that middleware is the sole auth gate and verify it covers /curate | M | N |
| M3 | `totalCount` uses a complex inline reduce in useSelector (line 58) that runs on every state change affecting curateIdsFromSearchPage. This is a derived value that should be memoized | CuratePublications.tsx:58 | Extract to a reselect/memoized selector or compute in useEffect | S | N |
| M4 | `filteredIdentities` uses another inline reduce in useSelector (line 41) creating a new object on every call -- breaks React-Redux shallow equality check and causes unnecessary re-renders | CuratePublications.tsx:41 | Extract to a memoized selector using createSelector or useMemo | S | N |
| M5 | FilterSection component receives `buttonUrl="/search"` but the filter section in Group Curation shows selected filters from the Search page (org units, institutions, etc.) without the ability to modify them inline. The "Update Search..." button navigates back to Search, losing the current curation context | CuratePublications.tsx:103-107 | Document this as a UX friction point for redesign. The round-trip to Search to change filters is disruptive | S | N |

### Minor

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| m1 | sectionHeader CSS uses `font-weight: 500` which violates the 02-UI-SPEC.md typography contract (allowed: 400, 600 only) | CuratePublications.module.css:13 | Change to `font-weight: 600` per design contract | S | N |
| m2 | header CSS uses `font-weight: 200` which also violates typography contract | CuratePublications.module.css:2 | Change to `font-weight: 400` per design contract | S | N |
| m3 | spacing uses `padding-bottom: 10px` which does not align to the 4/8/16/24/32/48px scale (10px is off-grid) | CuratePublications.module.css:6 | Change to `padding-bottom: 8px` (sm) or `padding-bottom: 16px` (md) | S | N |
| m4 | `font-size: 20px` for header and `font-size: 28px` for sectionHeader -- correct per design contract | CuratePublications.module.css:4,10 | No action needed | - | - |
| m5 | useEffect has missing dependencies: 'dispatch', 'filteredIds', 'incrementBy' | CuratePublications.tsx:64 | Acknowledged as intentional mount-only effect | S | N |
| m6 | `header` color `#666363` is non-standard -- closest in palette is text secondary `#777777` | CuratePublications.module.css:3 | Align to design contract color palette | S | N |

## Accessibility

### Lighthouse Score

*Not captured. Based on code analysis, estimated score: 60-70/100. Fewer a11y violations than Curate Individual (no custom tabs), but empty state and focus management are critical gaps.*

### ESLint jsx-a11y Violations

| Rule | Count | Files |
|------|-------|-------|
| (none specific to CuratePublications.tsx) | 0 | -- |

*Note: CuratePublications.tsx itself has zero jsx-a11y violations. Its child components (PublicationsPane, Publication.tsx) carry the violations documented in AUDIT-curate.md.*

### Keyboard Navigation

- **Tab order:** Previous/Next buttons are react-bootstrap `<Button>` components -- properly focusable and keyboard accessible. The FilterSection uses button components as well.
- **Focus indicators:** Bootstrap default focus rings present on Previous/Next buttons.
- **Keyboard traps:** None detected. However, focus management after page change is absent (C2).

## Performance

### Lighthouse Score

*Not captured. Based on code analysis:*
- **Estimated Performance:** 40-55/100
- **First Contentful Paint:** Depends on `publicationsFetchGroupData` API call latency (batch scoring endpoint)
- **Largest Contentful Paint:** The publication cards list after group data loads

### React Profiler

*Not captured. Based on code analysis:*
- Inline `useSelector` with `.reduce()` calls (lines 35, 41, 58) run on every Redux state change -- these should be memoized.
- `PublicationsList` is defined as a component inside render scope (line 81) -- recreated on every render, preventing React.memo optimization.
- Each `PublicationsPane` renders multiple `Publication` components (690 lines each) -- heavy render tree for group view with multiple people.
- `publicationsFetchGroupData` fetches articles for up to `incrementBy` (default 20) people at once -- potentially large API payload.

## Recommendations

### Fix Now (Phase 2)

1. **C1:** Add empty state with navigation link when `curateIdsFromSearchPage` is empty
2. **M1:** Replace Loader with skeleton components (Phase 1 regression)
3. **m1+m2:** Fix font-weight values to match design contract (400 and 600 only)

### Fix Later (Phase 3+)

1. **C2:** Implement focus management after pagination (M effort)
2. **M2:** Uncomment or remove getServerSideProps session check (M effort)
3. **M3+M4:** Memoize derived selectors (S effort each)
4. **m3+m6:** Align spacing and colors to design contract (S effort)
5. Extract PublicationsList outside render scope for memoization (S effort)

---

## Redesign Gap Analysis

Comparison of current CuratePublications.tsx implementation against the 02-UI-SPEC.md design contract.

### Navigation & Discovery

| Aspect | Current State | UI-SPEC Target | Gap |
|--------|--------------|----------------|-----|
| Entry point | Must navigate from Search with selected people in Redux | Should be directly accessible with own search/filter | Large gap -- requires architectural change |
| Empty state | No handling -- blank page | Should show guidance and quick-start options | Missing entirely |
| Filter persistence | Filters shown read-only from Search; "Update Search..." returns to /search | Should have inline filter controls for person selection | Major UX friction |
| Person selection | Pre-selected from Search page (all visible people) | Should allow dynamic selection within the view | Missing feature |

### Layout & Structure

| Aspect | Current State | UI-SPEC Target | Gap |
|--------|--------------|----------------|-----|
| Page structure | Header + filter bar + flat list of publication cards | Header + summary stats + person-centric accordion/card layout | Different layout model |
| Person grouping | Publications grouped by person via PublicationsPane | Person cards with expandable publication lists, sorted by score | Similar intent, different execution |
| Pagination | Previous/Next buttons navigating by `incrementBy` people | Infinite scroll or load-more with person-level pagination | Different pagination model |
| Sort order | No visible sort control; order determined by API response | Default: highest scoring articles first, with sort toggle | Missing sort control |

### Typography & Spacing

| Aspect | Current State | UI-SPEC Target | Gap |
|--------|--------------|----------------|-----|
| Header weight | `font-weight: 200` | `font-weight: 400` | Weight 200 not in allowed set |
| Section header weight | `font-weight: 500` | `font-weight: 600` | Weight 500 not in allowed set |
| Spacing | `padding-bottom: 10px` (off-grid) | 4/8/16/24/32/48px scale only | Off-grid values |
| Colors | `#666363` header, `#393a3d` section | `#333333` primary, `#777777` secondary | Non-standard colors |

### Accessibility

| Aspect | Current State | UI-SPEC Target | Gap |
|--------|--------------|----------------|-----|
| Focus management | No focus management after page changes | Focus should move to first new content after pagination | Missing |
| Loading states | Generic Loader spinner | Skeleton components matching card layout | Using old pattern |
| Empty states | No empty state UI | Informative empty state with call to action | Missing |
| Touch targets | Previous/Next buttons meet 44px (min-width: 120px) | All interactive elements >= 44px | Acceptable |

### Scoped Curator Support (Phase 3 Forward-Looking)

| Aspect | Current State | Phase 3 Requirement | Gap |
|--------|--------------|---------------------|-----|
| Data filtering | Shows all people from Search selection | Scoped curators should only see people in their assigned departments/org units | No department-level filtering |
| Permission awareness | No role-based view customization | Scoped curators should see filtered view based on their scope | No scope integration |
| Navigation | Requires Search page as prerequisite | Scoped curators should land directly on their group curation view | No direct-access route for scoped curators |

### Specific Redesign Recommendations (UIUX-02)

1. **Make Group Curation self-contained:** Add person search/filter directly in the view rather than requiring a round-trip to /search. This is the highest-impact UX improvement.

2. **Default sort by score:** Implement "highest scoring articles first" as the default sort order so curators can quickly process high-confidence suggestions.

3. **Person-centric card layout:** Replace flat publication list with person cards containing collapsible publication sublists. Each person card shows: name, org unit, pending count, and top-scoring article preview.

4. **Empty state with guidance:** When no people are selected or found, show: "No pending publications to curate" with options to search for people or adjust filters.

5. **Progressive loading:** Replace all-or-nothing loading with per-person card skeleton loading so partial results appear immediately.

6. **Focus management:** After pagination or Accept/Reject actions, manage keyboard focus to maintain user's position in the list.

7. **Prepare for scoped curators:** The redesign should accept a `scope` prop or read from session to filter visible people by department/org unit. This should be a transparent filter layer that pre-filters the same underlying data.

8. **Typography alignment:** All text in redesigned component must use only font-weights 400 and 600, font sizes from the design contract (12/14/20/28px), and colors from the defined palette.
