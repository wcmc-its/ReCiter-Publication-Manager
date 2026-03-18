# Audit: Individual Curation

**Date:** 2026-03-17
**Auditor:** Claude (AI) + code review + ESLint static analysis
**Route:** /curate/[id] (e.g., /curate/paa2013)
**Component(s):** CurateIndividual.tsx (183 lines), Publication.tsx (690 lines, fragile), Tabs.js (63 lines), TabSuggested.js, TabAccepted.js, TabRejected.js, TabAddPublication.tsx (629 lines, fragile), HistoryModal.tsx, Identity.js, Dropdown.tsx (111 lines)

## Overview

The Individual Curation view is the core workflow for curators. It shows a person's profile card (name, title, org unit, photo, inferred keywords), followed by tabs (Accepted/Suggested/Rejected/Add Publication). Each tab lists articles with Accept/Reject/Undo buttons and expandable evidence tables. This is the highest-interaction view in the application.

## Screenshot

*Not captured -- no browser environment available. Recommend manual Lighthouse audit at `http://localhost:3000/curate/paa2013`.*

## Findings

### Critical

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| C1 | Custom Tabs component uses `<a>` tags without href as tab controls -- not keyboard accessible, not focusable, no key events. All 4 tab links (Accepted/Suggested/Rejected/Add Publication) trigger anchor-is-valid, click-events-have-key-events, and interactive-supports-focus errors | Tabs.js:32-57 | Replace custom tab implementation with react-bootstrap `<Nav>` + `<Tab>` components which handle ARIA roles, keyboard navigation, and focus management natively. Or add tabIndex={0}, onKeyDown handlers, and proper ARIA attributes | L | N |
| C2 | `<ul>` element assigned `role="tablist"` is a non-interactive element given an interactive role. The `<li>` children lack `role="presentation"` and the `<a>` children lack `role="tab"` with proper `aria-selected` state | Tabs.js:30 | Use semantic `<button>` elements for tabs, or properly implement WAI-ARIA tabs pattern with role="tab", aria-selected, aria-controls, and keyboard arrow navigation | L | N |
| C3 | Identity.js profile image completely missing `alt` attribute -- screen readers cannot identify the image at all | Identity.js:33 | Add `alt={personName + " profile photo"}` or `alt=""` if decorative. This is the only `jsx-a11y/alt-text` error in the entire codebase | S | N |
| C4 | Evidence toggle uses `<p onClick>` (Publication.tsx:640) -- paragraph element with click handler has no keyboard support, no role, no tabIndex. Users cannot expand/collapse evidence with keyboard | Publication.tsx:640 | Replace `<p>` with `<button>` element styled as text link, or add role="button", tabIndex={0}, onKeyDown | M | N |
| C5 | "Show History" link uses `<span onClick>` with nested `<div>` -- not keyboard accessible and uses block element inside inline element (invalid HTML nesting) | Publication.tsx:634 | Replace with `<button className="text-btn">Show History</button>` | S | N |

### Major

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| M1 | CurateIndividual.tsx profile image alt text reads "Profile photo" -- triggers `img-redundant-alt` because the word "photo" is redundant when screen readers already announce it as an image | CurateIndividual.tsx:135 | Change alt to person's name, e.g., `alt={fullName(identityData.primaryName)}` | S | N |
| M2 | Profile.tsx image at line 514 has redundant alt text (img-redundant-alt violation) | Profile.tsx:514 | Remove redundant words ("image", "photo", "picture") from alt attribute | S | N |
| M3 | TabAccepted.js, TabRejected.js, TabSuggested.js each have identical anchor-as-button violation at line 226/236 -- `<a>` with onClick used as "select all" toggle without href, keyboard handler, or button semantics | TabAccepted.js:226, TabRejected.js:226, TabSuggested.js:236 | Replace `<a>` with `<button>` for the select/deselect all toggle | S | N |
| M4 | TabAddPublication.tsx has 2 label-has-associated-control violations -- form inputs for PubMed search lack properly associated labels | TabAddPublication.tsx:495,522 | Add `htmlFor` to labels matching input `id` attributes, or wrap inputs in label elements | S | N |
| M5 | TabAddPublication.tsx has an anchor-as-button at line 554 with onClick -- "Clear" action link is inaccessible | TabAddPublication.tsx:554 | Replace with `<button>` element | S | N |
| M6 | HistoryModal.tsx "Show More" uses `<div className="text-btn" onClick>` -- not keyboard accessible | HistoryModal.tsx:76 | Replace with `<button>` element | S | N |
| M7 | Dropdown.tsx (sort component on curation) wraps entire dropdown in `<div onClick>` with nested `<span onClick>` elements for options -- triple a11y violation (click-events-have-key-events, no-static-element-interactions on 3 elements) | Dropdown.tsx:87,98,102 | Refactor to use react-bootstrap Dropdown component or add proper ARIA dropdown pattern with keyboard support | M | N |
| M8 | Publication.tsx is 690 lines -- a fragile monolith mixing display logic, evidence formatting, state management, and button rendering. Any fix risks regression | Publication.tsx:1-690 | Extract sub-components: EvidenceTable, ActionButtons, ArticleMetadata, AuthorsList. Apply fixes to extracted components to isolate risk | XL | N |

### Minor

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| m1 | Accept/Reject/Undo buttons use `<button>` with Bootstrap classes -- correct semantics. However, button height should be verified against 44px WCAG 2.5.5 target | Publication.tsx:155-166 | Verify button height meets 44px minimum. Current CSS uses `p-2` padding which may be insufficient depending on font size | S | N |
| m2 | Evidence table headers lack `scope="col"` | Publication.tsx:657-660 | Add `scope="col"` to all `<th>` elements in evidence table | S | N |
| m3 | `toogleEvidence` function name is misspelled (should be "toggleEvidence") | Publication.tsx:54 | Rename to `toggleEvidence` across component | S | N |
| m4 | useEffect in CurateIndividual.tsx has empty dependency array but references router, session, dispatch | CurateIndividual.tsx:57 | Acknowledged as intentional mount-only effect | S | N |
| m5 | Conditional rendering uses `""` (empty string) instead of `null` for falsy branches in multiple places | Publication.tsx:633 | Use `null` instead of `""` for cleaner React rendering | S | N |
| m6 | Profile photo uses Next.js `<Image>` component in CurateIndividual but raw `<img>` in Identity.js -- inconsistent approach | Identity.js:33, CurateIndividual.tsx:133 | Standardize on Next.js Image component across all profile photos | M | N |

## Accessibility

### Lighthouse Score

*Not captured. Based on code analysis, estimated score: 45-60/100. Multiple critical issues: custom tabs without ARIA, missing img alt, multiple onClick-without-keyboard handlers, missing form labels.*

### ESLint jsx-a11y Violations

| Rule | Count | Files |
|------|-------|-------|
| jsx-a11y/anchor-is-valid | 8 | Tabs.js:32,39,46,53; TabAccepted.js:226; TabRejected.js:226; TabSuggested.js:236; TabAddPublication.tsx:554 |
| jsx-a11y/click-events-have-key-events | 10 | Tabs.js:32,39,46,53; TabAccepted.js:226; TabRejected.js:226; TabSuggested.js:236; TabAddPublication.tsx:554; Publication.tsx:634,640 |
| jsx-a11y/no-static-element-interactions | 6 | TabAccepted.js:226; TabRejected.js:226; TabSuggested.js:236; TabAddPublication.tsx:554; Publication.tsx:634; HistoryModal.tsx:76 |
| jsx-a11y/interactive-supports-focus | 4 | Tabs.js:32,39,46,53 |
| jsx-a11y/no-noninteractive-element-to-interactive-role | 1 | Tabs.js:30 |
| jsx-a11y/no-noninteractive-element-interactions | 1 | Publication.tsx:640 |
| jsx-a11y/img-redundant-alt | 2 | CurateIndividual.tsx:133; Profile.tsx:514 |
| jsx-a11y/alt-text | 1 | Identity.js:33 |
| jsx-a11y/label-has-associated-control | 2 | TabAddPublication.tsx:495,522 |

**Total: 35 violations across curation-related components** (more than half of all 64 codebase violations)

### Keyboard Navigation

- **Tab order:** Broken. The custom Tabs.js component renders `<a>` elements without `tabIndex` -- they are not focusable. Evidence expand/collapse is via `<p onClick>` -- also not in tab order. Accept/Reject buttons ARE properly focusable (semantic `<button>` elements).
- **Focus indicators:** Bootstrap buttons have visible focus rings. Custom tab links have no focus indicator because they are not focusable.
- **Keyboard traps:** None detected, but the inability to reach tabs or evidence toggle via keyboard effectively traps keyboard users in the action buttons area.

## Performance

### Lighthouse Score

*Not captured. Based on code analysis:*
- **Estimated Performance:** 55-70/100
- **First Contentful Paint:** Depends on identity + publications API calls (two sequential fetches)
- **Largest Contentful Paint:** Publications list after reciterFetchData completes

### React Profiler

*Not captured. Based on code analysis:*
- Publication.tsx (690 lines) renders once per article. With many articles (20+ per page), this is a significant render tree.
- Evidence formatting (`formatEvidenceTable`) is called on each render, processing complex nested objects without memoization.
- `displayAuthors` creates new components on each render call.
- Skeleton loading (SkeletonProfile + SkeletonCard) is properly used during data fetch -- good pattern from Phase 1.

## Recommendations

### Fix Now (Phase 2)

1. **C1+C2:** Replace custom Tabs.js with react-bootstrap Nav+Tab (eliminates 12+ violations)
2. **C3:** Add alt text to Identity.js image (only jsx-a11y/alt-text error in codebase)
3. **C4+C5:** Make evidence toggle and Show History keyboard-accessible with semantic elements
4. **M3:** Replace anchor-as-button in TabAccepted/TabRejected/TabSuggested
5. **M4:** Fix label associations in TabAddPublication.tsx

### Fix Later (Phase 3+)

1. **M7:** Refactor Dropdown.tsx to use react-bootstrap Dropdown (M effort)
2. **M8:** Extract Publication.tsx into sub-components (XL effort -- do when other fixes touch this file)
3. **m2:** Add scope="col" to evidence table headers (S effort)
4. **m6:** Standardize profile photo component usage (M effort)
