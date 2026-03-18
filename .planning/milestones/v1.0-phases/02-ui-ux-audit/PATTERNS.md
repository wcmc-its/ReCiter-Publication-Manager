# Design Patterns and Standards

**Date:** 2026-03-17
**Source:** Synthesized from 8 view audits (Search, Individual Curation, Report, Group Curation, Manage Users, Configuration, Notifications, Login/NoAccess) + 02-UI-SPEC.md design contract
**Authority:** This document is the prescriptive reference for all UI work in Phase 3+. All new and modified components MUST conform to these patterns.

---

## Component Reuse Patterns

### Library Usage Rules

| Library | Use For | DO NOT Use For |
|---------|---------|----------------|
| react-bootstrap | Buttons, Modals, Forms, Accordions, Tables, Pagination, Dropdowns, Tabs, Cards, Alerts, Badges, NavBar, InputGroup | Custom interactive components that need MUI-specific behavior |
| @mui/icons-material | Icons only (ArrowLeft, ArrowRight, Check, Close, NavigateBefore, NavigateNext, etc.) | Layout, forms, or any non-icon component |
| @mui/material Autocomplete | Multi-select tag inputs (Departments, Roles in AddUser) -- exception to the MUI-for-icons-only rule because react-bootstrap has no equivalent | Single-select dropdowns (use Form.Select), text inputs, buttons |
| CSS Modules | Component-scoped styling (`{ComponentName}.module.css`) | Global styles (use `globals.css`), utility classes (use Bootstrap) |
| Bootstrap utility classes | Quick layout: `d-flex`, `justify-content-center`, `mb-3`, `mt-2`, `fw-bold`, `text-primary`, `text-danger` | Complex component-specific styling (use CSS Modules) |

**Rule:** A component MUST NOT mix react-bootstrap and MUI for the same purpose. If a component uses `<Form.Control>` for text inputs, it MUST NOT also use `<TextField>` for text inputs in the same view. The exception is MUI Autocomplete for multi-select, which has no react-bootstrap equivalent.

### Existing Components: Reuse As-Is

| Component | Location | Used By |
|-----------|----------|---------|
| PageHeader | Common/PageHeader.tsx | ManageUsers, AdminSettings, AddUser, Search, Report |
| SkeletonTable | Common/SkeletonTable.tsx | ManageUsers, Search |
| SkeletonCard | Common/SkeletonCard.tsx | Group Curation (recommended) |
| SkeletonProfile | Common/SkeletonProfile.tsx | Individual Curation |
| SkeletonForm | Common/SkeletonForm.tsx | AdminSettings, Notifications (recommended) |
| Loader | Common/Loader.tsx | Modal contexts ONLY (AddUser loading) |
| ToastContainerWrapper | ToastContainerWrapper/ToastContainerWrapper.tsx | All views with toast feedback |
| Footer | Footer/Footer.tsx | Login, NoAccess |
| Divider | Common/Divider.tsx | Publication list separators |

### Existing Components: Need Refactoring Before Reuse

| Component | Location | Issue | Recommended Fix |
|-----------|----------|-------|-----------------|
| Tabs.js | Tabs/Tabs.js:30-57 | 12+ a11y violations: uses `<a>` as tabs without href, keyboard support, or ARIA | Replace with react-bootstrap `<Nav variant="tabs">` + `<Tab.Content>` |
| Pagination.tsx | Pagination/Pagination.tsx:73,83-85 | Arrow icons not keyboard accessible, label not associated with dropdown | Wrap ArrowLeft/ArrowRight in semantic `<button>`, add htmlFor to label |
| Dropdown.tsx | Dropdown/Dropdown.tsx:87-102 | `<div onClick>` with nested `<span onClick>` -- no keyboard support | Replace with react-bootstrap `<Dropdown>` component |
| Publication.tsx | Publication/Publication.tsx (690 lines) | Fragile monolith: display + state + styling mixed. Evidence toggle inaccessible | Extract: EvidenceTable, ActionButtons, ArticleMetadata sub-components |
| AuthorsComponent.tsx | Common/AuthorsComponent.tsx:21,25 | `<span onClick>` without keyboard handlers for author names | Replace with `<button className="text-btn">` |
| Header.tsx | Header/Header.tsx:22 | `<a onClick>` for Logout -- no keyboard support, no href | Replace with `<button>` or add keyboard handler |

### New Components to Create (Phase 3+)

| Component | Purpose | Priority |
|-----------|---------|----------|
| GroupCurationHeader | Page title + summary count + sort control | Phase 3 (Group Curation redesign) |
| PersonCard | Name + title + pending count + collapsible article list | Phase 3 (Group Curation redesign) |
| SortControl | Dropdown to sort person list (by score, name, count) | Phase 3 (Group Curation redesign) |
| EmptyGroupState | Empty/no-selection state with navigation CTA | Phase 3 (Group Curation redesign) |
| ErrorState | Reusable error state with retry action | Phase 2 (fix pass) |
| FormLabel | Wrapper for consistent label styling (replaces `<p>` used as labels in AdminSettings) | Phase 2 (fix pass) |

### Naming Conventions

- Component files: PascalCase with `.tsx` extension (e.g., `PersonCard.tsx`)
- CSS Modules: `{ComponentName}.module.css` (e.g., `PersonCard.module.css`)
- Sub-components: Nested in parent directory (e.g., `Publication/EvidenceTable.tsx`)
- Test files: `{ComponentName}.test.tsx` co-located with component

---

## Spacing and Layout System

### Target Spacing Scale

All new and modified components MUST use only these values:

| Token | Value | Bootstrap Class | Usage |
|-------|-------|-----------------|-------|
| xs | 4px | `m-1` / `p-1` | Icon gaps, badge internal padding |
| sm | 8px | `m-2` / `p-2` | Compact element spacing, inline button margins |
| md | 16px | `m-3` / `p-3` | Default element spacing, card internal padding |
| lg | 24px | `m-4` / `p-4` (approximate) | Section padding, accordion body padding |
| xl | 32px | `m-5` / `p-5` (approximate) | Layout gaps between major sections |
| 2xl | 48px | Custom CSS only | Page-level vertical spacing |

**Note:** Bootstrap's spacing scale does not map exactly to this scale at lg/xl. Use Bootstrap utilities where the values are close, and CSS Modules for exact values.

### Fixed Layout Dimensions

| Element | Value | Source |
|---------|-------|--------|
| Sidebar collapsed | 82px | AppLayout.module.css (preserved) |
| Sidebar expanded | 250px | AppLayout.module.css (preserved) |
| Header height | 60px | Header.module.css (preserved) |
| Main content padding | 20px vertical, 40px horizontal | AppLayout.module.css (preserved) |
| Touch target minimum | 44px height and width | WCAG 2.5.5 (all interactive elements) |

### Current Spacing Deviations

| File:Line | Current Value | Target Value | View |
|-----------|---------------|--------------|------|
| ManageUsers.module.css:5 | `padding: 15px` | `padding: 16px` (md) | Manage Users |
| ManageUsers.module.css:13 | `padding-top: 5px` | `padding-top: 4px` (xs) | Manage Users |
| CuratePublications.module.css:6 | `padding-bottom: 10px` | `padding-bottom: 8px` (sm) or `16px` (md) | Group Curation |
| Login.module.css:35 | `margin-top: 5px` | `margin-top: 4px` (xs) | Login |
| Login.js:86,103 | `marginBottom: '10px'` (inline) | `mb-2` (8px) or `mb-3` (16px) | Login |
| Login.js:119 | `marginTop: '15px'` (inline) | `mt-3` (16px) | Login |
| Notifications.module.css:5 | `margin-left: 25px` | `margin-left: 24px` (lg) | Notifications |
| Login.module.css:31 | `margin-bottom: 20px` | `margin-bottom: 24px` (lg) or `16px` (md) | Login |

**Rule:** DO NOT use inline `style={{ }}` for spacing. Use Bootstrap utility classes or CSS Modules with values from the spacing scale.

---

## Color and Typography

### Color Palette

| Role | Value | Usage | Rule |
|------|-------|-------|------|
| Dominant (60%) | `#ffffff` | Page background, card backgrounds | Default -- no action needed |
| Secondary (30%) | `#f5f5f5` | Filter bar background, modal headers, sidebar hover | Use for all surface backgrounds |
| Accent (10%) | `#cf4520` | Header bar ONLY | MUST NOT use for buttons, links, or interactive elements |
| Primary interactive | `#337ab7` | Links, text buttons, "View Profile" actions | Use for all clickable text |
| Secondary interactive | `#0d6efd` | Bootstrap primary blue -- text-btn class | Consolidate with `#337ab7` for consistency |
| Destructive | `#dc3545` | Reject button, error states | MUST NOT use for non-destructive actions (Login sign-in button M7 violation) |
| Success | `#66FF66` | Accept button background | Use only for positive confirmation actions |
| Dark surface | `#2E414F` | Table headers (Search view) | Use for data table headers |
| Evidence surface | `#202B3C` | Evidence table headers, score badges | Use for evidence/detail table headers |
| Text primary | `#333333` | Body text, button labels | Default text color |
| Text secondary | `#777777` | Faculty title, secondary labels | Subtitle and supporting text |
| Text muted | `#999999` | Disabled text, placeholder text | Disabled/inactive elements only |
| Highlight | `#EBF4BC` | Author name highlighting in citations | Author highlighting only |
| Tag background | `#d9d9d9` | Article type badges, profile tags | Badge/tag backgrounds |

### Current Color Deviations

| File:Line | Current Value | Target Value | Issue |
|-----------|---------------|--------------|-------|
| CuratePublications.module.css:3 | `#666363` | `#777777` (text-secondary) | Non-standard color |
| ManageUsers.module.css:2 | `rgb(193 233 235)` (teal) | `#f5f5f5` (secondary surface) | Non-palette color for filter bar |
| ManageUsers.module.css:23 | `#0d6efd` (textButton) | `#337ab7` (primary interactive) | Inconsistent blue for text buttons |
| NoAccess.module.css:8 | `color: red` | `#dc3545` (destructive) | Use named value for consistency |
| Login.js:122 | `btn-danger` (red) for sign-in | `btn-primary` (blue) | Red button for non-destructive action |
| Login.module.css:16 | `#999` text color | `#777777` (text-secondary) or `#333333` (text-primary) | Non-standard grey |

### Typography

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 14px | 400 (regular) | 1.5 | Article metadata, evidence text, filter labels |
| Label | 12px | 600 (semibold) | 1.4 | Badges, status tags, button text, small captions |
| Heading | 20px | 400 (regular) | 1.3 | Page titles (h1), section headers |
| Display | 28px | 600 (semibold) | 1.2 | Score display, person count summary |

**Allowed weights:** 400 (regular) and 600 (semibold) ONLY.

**Font stack:** `"Open Sans", sans-serif, Arial` for all text.

### Current Font Weight Violations

| File:Line | Current Weight | Target Weight | View |
|-----------|---------------|---------------|------|
| globals.css:87-92 | `font-weight: 200` (h1) | `font-weight: 400` | Global |
| CuratePublications.module.css:2 | `font-weight: 200` | `font-weight: 400` | Group Curation header |
| CuratePublications.module.css:13 | `font-weight: 500` | `font-weight: 600` | Group Curation section header |
| Login.module.css:43 | `font-weight: 500` | `font-weight: 600` | Login button (unused class) |
| UsersTable.module.css:19 | `font-weight: 500` | `font-weight: 600` | Users table "No Records Found" |

**Rule:** DO NOT use font-weight values 200, 300, 500, 700, or 800. All text MUST use either 400 (regular) or 600 (semibold).

---

## Interaction Patterns

### Loading States

| Context | Pattern | Component |
|---------|---------|-----------|
| Page with data table | SkeletonTable | Common/SkeletonTable.tsx |
| Page with card layout | SkeletonCard (repeated) | Common/SkeletonCard.tsx |
| Page with form | SkeletonForm | Common/SkeletonForm.tsx |
| Profile section | SkeletonProfile | Common/SkeletonProfile.tsx |
| Modal loading | Loader (spinner) | Common/Loader.tsx |
| Inline loading (e.g., button) | Spinner inside button | react-bootstrap `<Spinner size="sm">` |

**Rule:** DO NOT use Loader (spinner) for page-level loading. Use the appropriate Skeleton component. Loader.tsx is reserved for modal contexts only.

**Current violations:**
- Report.tsx:381-385, 402-405 -- uses Loader instead of SkeletonTable/SkeletonForm (Phase 1 regression)
- CuratePublications.tsx:108 -- uses Loader instead of SkeletonCard (Phase 1 regression)
- AddUser.tsx:171 -- uses Loader instead of SkeletonForm

### Error States

**Pattern:** Descriptive message + actionable guidance + retry button (where applicable).

```jsx
<div role="alert" className="error-state">
  <h2>Unable to load data</h2>
  <p>The service may be temporarily unavailable.</p>
  <Button onClick={handleRetry}>Try Again</Button>
</div>
```

**Current violations:**
- Search.js:268-281 -- empty error state (no message, no guidance)
- Group Curation -- no empty state when curateIdsFromSearchPage is empty (C1)
- NoAccess.tsx -- no actionable guidance (M3)

### Empty States

**Pattern:** Clear heading + explanation + navigation CTA.

```jsx
<div className="empty-state">
  <h2>No results found</h2>
  <p>Try adjusting your search criteria or filters.</p>
  <Button variant="link" onClick={handleNavigate}>Go to Search</Button>
</div>
```

**Current violations:**
- Group Curation -- blank page when no people selected
- Manage Users UsersTable -- "No Records Found" as bare `<p>` inside `<tbody>` (invalid HTML)

### Modals

**Pattern:** react-bootstrap `<Modal>` with:
- `aria-labelledby` pointing to modal title
- Focus trap (react-bootstrap handles this natively)
- Escape key to close (react-bootstrap handles this natively)
- Close button in header

### Toasts

**Pattern:** react-toastify with:
- Position: `"top-right"`
- Success: `autoClose: 2000`, `theme: "colored"`
- Error: `autoClose: 2000`, `theme: "colored"` (consider making errors persistent)
- DO NOT rely on toasts as the only feedback mechanism for critical actions (Login error M2 violation)

### Dropdowns/Selects

**Pattern:** react-bootstrap `<Form.Select>` with visible `<Form.Label>` or `aria-label`.

**Rule:** Every `<Form.Select>` MUST have either a visible `<Form.Label>` with `htmlFor` association OR an `aria-label` attribute. DO NOT use placeholder aria-labels like "Default select example".

### Accordion

**Pattern:** react-bootstrap `<Accordion>` with `defaultActiveKey`. Provides native keyboard support (Enter/Space to expand, Tab between items).

**Current usage:** AdminSettings.tsx -- correct pattern.

### Pagination

**Pattern:** Shared `Pagination.tsx` component with "Show records" dropdown and Previous/Next navigation.

**Required fixes:**
1. Wrap arrow icons in semantic `<button>` elements
2. Associate "Show records" label with dropdown via `htmlFor`/`id`
3. Add `aria-label` to Previous/Next buttons

### Accept/Reject

**Pattern:** Immediate action with "Undo" available. No confirmation dialog.

**Rationale:** Accept/Reject are high-frequency curation actions. Confirmation dialogs create friction that contradicts the "blitz through easy accepts" design goal.

### Form Inputs

**Rule:** Every `<Form.Control>` MUST have an associated label via one of:
1. `<Form.Label>` inside a `<Form.Group>` with matching `controlId` (preferred)
2. `aria-label` attribute on the input
3. `aria-labelledby` pointing to a visible label element

**Rule:** Every `<Form.Group>` MUST have a unique `controlId`. DO NOT reuse controlId values within a page.

**Current violations:**
- Login.js:86-101 -- form inputs with no labels (C1)
- AdminSettings.tsx:153-232 -- `<p>` tags as labels without htmlFor (C2)
- AdminSettings.tsx:195-203 -- checkbox with empty id (C1)
- Notifications.tsx:50,64,67,71 -- duplicate controlId across 4 checkboxes (C1)
- AddUser.tsx:175,186,224 -- duplicate controlId "formGridCwid" across 3 form groups (M5)

---

## Accessibility Standards

### Compliance Target

**WCAG 2.1 AA** -- all new and modified components MUST meet this standard.

### ESLint Enforcement

- `eslint-plugin-jsx-a11y` in **strict mode** is configured in `.eslintrc.json`
- Component mappings: Button -> button, Image -> img, Link -> a
- All jsx-a11y errors MUST be resolved or have documented eslint-disable overrides with justification
- Baseline: 64 errors across 32 files (as of Plan 01)

### Mandatory Rules

1. **All onClick on non-button elements:** MUST have `role="button"`, `tabIndex={0}`, and `onKeyDown` handler -- OR replace with a semantic `<button>` element (strongly preferred).

2. **All form inputs:** MUST have associated labels via `htmlFor`/`id`, `aria-label`, or `aria-labelledby`.

3. **All images:** MUST have `alt` text. Use meaningful alt for informative images, `alt=""` for decorative images. DO NOT include words "image", "photo", or "picture" in alt text (screen readers already announce the element type).

4. **Color contrast:** Minimum 4.5:1 for normal text (14px), 3:1 for large text (18px+ or 14px bold).

5. **Focus indicators:** Use Bootstrap default `:focus-visible` styling. DO NOT override with `outline: none`. Every interactive element MUST have a visible focus indicator.

6. **Heading hierarchy:** Use sequential heading levels (h1 -> h2 -> h3). DO NOT skip levels. Each page MUST have exactly one `<h1>`.

7. **Table semantics:** All data tables MUST have `<caption>` or `aria-label`, `<th>` elements with `scope="col"` or `scope="row"`, and valid HTML structure (`<tr>` only inside `<thead>`/`<tbody>`).

8. **Error announcements:** Error messages MUST use `role="alert"` or `aria-live="assertive"` for immediate screen reader announcement.

9. **ID uniqueness:** Every `id` attribute on the page MUST be unique. DO NOT reuse `controlId` values across `<Form.Group>` elements.

---

## Cross-View Issue Summary

### Aggregate Finding Counts

| View | Critical | Major | Minor | Total | ESLint Violations |
|------|----------|-------|-------|-------|-------------------|
| Search | 2 | 6 | 5 | 13 | 5 |
| Individual Curation | 5 | 8 | 6 | 19 | 35 |
| Report | 2 | 7 | 9 | 18 | 9 |
| Group Curation | 2 | 5 | 6 | 13 | 0 (child components carry violations) |
| Manage Users | 2 | 7 | 7 | 16 | 5 |
| Configuration | 2 | 6 | 6 | 14 | 0 (semantic HTML issues not caught by linter) |
| Notifications | 1 | 5 | 6 | 12 | 0 (semantic HTML issues not caught by linter) |
| Login/NoAccess | 2 | 6 | 9 | 17 | 4 |
| **TOTAL** | **18** | **50** | **54** | **122** | **58 unique** |

### Top 5 Most Common Issues

| # | Issue Pattern | Occurrences | Views Affected |
|---|---------------|-------------|----------------|
| 1 | onClick on non-button elements (`<div>`, `<span>`, `<p>`, `<a>`) without keyboard support | 21+ violations across codebase | All 8 views |
| 2 | Form inputs without associated labels (missing htmlFor, missing aria-label, `<p>` used as label) | 12+ instances | Login, Configuration, Notifications, Manage Users, Individual Curation |
| 3 | Loader (spinner) used instead of Skeleton components for page-level loading | 4 instances | Report, Group Curation, AddUser, (Notifications has no loading at all) |
| 4 | Duplicate or empty `id` attributes on form elements | 3 views affected | Configuration (empty id), Notifications (duplicate controlId x4), AddUser (duplicate controlId x3) |
| 5 | Missing table semantics (no scope, no caption, invalid HTML in tbody) | 3 tables | Search, Individual Curation (evidence table), Manage Users |

### Priority Fix List for Phase 2 (Critical Items)

These items MUST be fixed in Plan 03. Sorted by impact (number of views affected, then severity).

| # | Item | Views Affected | Effort | Source |
|---|------|----------------|--------|--------|
| 1 | Replace custom Tabs.js with react-bootstrap Tab (12+ violations eliminated) | Individual Curation | L | AUDIT-curate C1+C2 |
| 2 | Fix shared Pagination component (keyboard + label association) | Search, Report, Group Curation, Manage Users | M | AUDIT-search C1+C2 |
| 3 | Fix Header.tsx Logout anchor (keyboard support) | Login, NoAccess, all authenticated pages | S | AUDIT-login-noaccess M1+M6 |
| 4 | Add alt text to Identity.js image | Individual Curation | S | AUDIT-curate C3 |
| 5 | Fix Login form labels and autoFocus | Login | S | AUDIT-login-noaccess C1+C2 |
| 6 | Fix AdminSettings form label associations and checkbox id | Configuration | M | AUDIT-configuration C1+C2 |
| 7 | Fix Notifications duplicate controlId | Notifications | S | AUDIT-notifications C1 |
| 8 | Fix ManageUsers Reset and Search keyboard accessibility | Manage Users | S | AUDIT-manage-users C1+C2 |
| 9 | Make evidence toggle and Show History keyboard-accessible | Individual Curation | M | AUDIT-curate C4+C5 |
| 10 | Replace Loader with Skeleton components (Phase 1 regression) | Report, Group Curation | S | AUDIT-report M5+M6, AUDIT-group-curation M1 |

### Deferred Fix List for Phase 3+

| # | Item | Effort | Source |
|---|------|--------|--------|
| 1 | Extract Publication.tsx into sub-components | XL | AUDIT-curate M8 |
| 2 | Refactor Dropdown.tsx to react-bootstrap Dropdown | M | AUDIT-curate M7 |
| 3 | Implement meaningful error states in Search, Group Curation, NoAccess | M | Multiple audits |
| 4 | Align all spacing to 4/8/16/24/32/48px scale | M | Multiple audits |
| 5 | Consolidate font weights to 400/600 only | S | Multiple audits |
| 6 | Consolidate interactive blue colors (#337ab7 vs #0d6efd) | S | Multiple audits |
| 7 | Fix all variable name typos in Report components | S | AUDIT-report m5+m6 |
| 8 | Remove @ts-nocheck from FilterSection.tsx | M | AUDIT-report M3 |
| 9 | Complete Notifications feature (load preferences, fix backend) | XL | AUDIT-notifications |
| 10 | Improve NoAccess page with actionable guidance | M | AUDIT-login-noaccess M3 |
| 11 | Add table semantics (caption, scope) across all data tables | S | Multiple audits |
| 12 | Fix AddUser CssTextField styled component render performance | S | AUDIT-manage-users |
| 13 | Fix JSON.parse error handling in AdminSettings | M | AUDIT-configuration M3 |

---

*Design Patterns document: 2026-03-17*
*Derived from: 8 AUDIT-*.md files + 02-UI-SPEC.md + CONVENTIONS.md*
