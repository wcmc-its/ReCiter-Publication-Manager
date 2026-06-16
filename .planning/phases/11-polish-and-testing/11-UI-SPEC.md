---
phase: 11
slug: polish-and-testing
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-06
---

# Phase 11 -- UI Design Contract

> Visual and interaction contract for the polish-and-testing phase. This phase does not introduce new UI surfaces. It fixes 58 a11y violations, verifies skeleton loading under React 18 StrictMode, and adds RTL component tests. The contract below documents the existing visual system as the reference standard that all a11y fixes must conform to.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | Bootstrap 5 + MUI (@mui/material) |
| Icon library | Bootstrap Icons (via react-bootstrap) |
| Font | DM Sans (body), Space Grotesk (headings/display) |

Source: `styles/globals.css` `:root` custom properties, existing component CSS Modules

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding, tag margins |
| sm | 8px | Compact element spacing, form input padding-y |
| lg | 16px | Default element spacing, card padding |
| xl | 24px | Section padding, modal body padding |
| 2xl | 32px | Layout gaps between major sections |
| 3xl | 48px | Page-level top/bottom margins |

Exception: 12px form input padding-x inherited from existing Bootstrap component styles -- not a grid spacing token; no new elements may use this value.

Exceptions: Header height is 52px (`--header-height`). Sidebar width is 220px (`--sidebar-width-expanded`). Touch targets for newly-created `<button>` elements (a11y fixes) must be at minimum 24x24px CSS (WCAG 2.5.8 minimum) but should target 32x32px where layout permits.

Source: `styles/globals.css` custom properties, existing component padding/margin patterns

---

## Typography

| Role | Size | Weight | Line Height | Font Family |
|------|------|--------|-------------|-------------|
| Body | 14px (`--font-size-sm`) | 400 (regular) | 1.6 | DM Sans (`--font-sans`) |
| Label | 12px (`--font-size-xs`) | 600 (semibold) | 1.4 | DM Sans (`--font-sans`) |
| Heading | 22px (h3 strong) / 28px (h1) | 600 (semibold) | 1.2 | Space Grotesk (`--font-serif`) |

Declared scale: 4 sizes -- 12px, 14px, 22px, 28px. 2 weights -- 400 (regular), 600 (semibold).

Implementation note (not part of the declared scale): Existing component CSS contains additional sizes (10px, 12.5px, 13px, 13.5px, 16px, 18px, 20px, 24px) inherited from the original codebase. The a11y fixes in this phase must not introduce any of these or any other sizes not in the declared scale above.

A11y constraint: When replacing `<span onClick>` or `<div onClick>` with `<button>`, the resulting button must inherit the same font-size and font-family as the original element. Do not introduce new font sizes.

Source: `styles/globals.css` custom properties lines 66-74, h1/h3 declarations lines 129-141

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#f5f2ee` (`--color-warm-bg`) | Page background, content area |
| Secondary (30%) | `#ffffff` (`--color-warm-surface`) | Cards, modals, form surfaces, table rows |
| Accent (10%) | `#b31b1b` (`--wcm-red`) | Primary CTA buttons, active links, date picker selection, text-button elements |
| Chrome | `#1a2133` (`--color-chrome`) | Sidebar background, header background, dark dropdown buttons |
| Destructive | `#dc2626` (`--color-danger`) | Error messages, destructive action warnings |
| Success | `#16a34a` (`--color-success`) | Accepted state badges, positive confirmation |

Accent reserved for: primary action buttons (`.btn-primary.primary`, `.wcm-primary-lg`), link text (`a` elements), date picker selected days, text-button elements (`.text-btn`, `.text-button`). Do NOT use accent for newly-created a11y buttons -- those should inherit their parent's color context.

Source: `styles/globals.css` `:root` custom properties lines 2-50

---

## A11y Fix Visual Contract

When fixing the 58 eslint-plugin-jsx-a11y violations, follow these rules to preserve visual consistency:

### Element Replacement Rules

| Original Pattern | Replacement | Visual Rule |
|-----------------|-------------|-------------|
| `<span onClick={fn}>` | `<button type="button" onClick={fn}>` | `background: none; border: none; padding: 0; font: inherit; color: inherit; cursor: pointer;` -- must be visually identical to the original span |
| `<div onClick={fn}>` | `<button type="button" onClick={fn}>` | Same as above. If the div had `display: block`, add `display: block; width: 100%;` to the button |
| `<a onClick={fn}>` (no href) | `<button type="button" onClick={fn}>` | Inherit link styling: `color: var(--wcm-red); text-decoration: none; cursor: pointer; background: none; border: none; padding: 0;` |
| `<label>` without `htmlFor` | `<label htmlFor="matching-id">` | No visual change. Add `id` attribute to the associated input/control if missing |

### Keyboard Interaction Rules

All newly-interactive `<button>` elements receive keyboard support automatically (Enter and Space activate buttons natively). No additional `onKeyDown` handlers needed for `<button>`.

If an element CANNOT be changed to `<button>` (e.g., a `<tr>` with click handler), add:
- `role="button"` or appropriate role
- `tabIndex={0}`
- `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); } }}`

### aria-label Requirements

When a button's visible text is ambiguous (e.g., a lone `x` close button), add `aria-label` with descriptive text:
- Close/dismiss: `aria-label="Remove"` or `aria-label="Close"`
- Expand/collapse: `aria-label="Expand section"` / `aria-label="Collapse section"`
- Navigation: `aria-label="Go to [destination]"`

---

## Copywriting Contract

This phase has no new user-facing features, but a11y fixes may add `aria-label` attributes. Use these conventions:

| Element | Copy |
|---------|------|
| aria-label for remove/delete chips | "Remove [item name]" |
| aria-label for close buttons | "Close" |
| aria-label for expand/collapse | "Expand [section name]" / "Collapse [section name]" |
| aria-label for sort controls | "Sort by [column name]" |
| aria-label for dropdown toggles | "[Action name] options" |
| Skeleton loading alt text | Not applicable -- CSS-only, no screen reader content needed |
| Test failure console output | Not user-facing -- no copywriting contract |

Empty state copy, error state copy, and destructive confirmations: No new instances in this phase. Existing copy unchanged.

Source: CONTEXT.md D-01 through D-18 -- no new UI surfaces

---

## Skeleton Loading Verification Contract

CSS-based skeletons must pass visual inspection under React 18 StrictMode (`reactStrictMode: true` already enabled in `next.config.js`).

| Component | CSS File | Skeleton Classes | Expected Behavior |
|-----------|----------|-----------------|-------------------|
| Report | `Report/Report.module.css` | `.skeletonCard`, `.skTitle`, `.skAuthors`, `.skMeta` | 3 shimmer cards, no doubled elements, smooth animation |
| TabAddPublication | `TabAddPublication/TabAddPublication.module.css` | `.skeletonCard`, `.spinner` | Shimmer cards + spinner, no animation glitches |
| CuratePublications | `CuratePublications/CuratePublications.module.css` | `.skeletonCard` variants | Shimmer cards render once, no flicker |
| CurateIndividual | `CurateIndividual/CurateIndividual.module.css` | `.skeletonCard` variants | Profile skeleton + publication list skeleton |

Pass criteria: Each skeleton renders exactly once (no doubling from StrictMode), shimmer animation plays smoothly, skeleton disappears when data loads.

Source: RESEARCH.md "Skeleton Loading Verification" section, CONTEXT.md D-01/D-02/D-03

---

## Component Test Visual Assertions

RTL tests validate rendered output, not visual appearance. However, tests should assert these visual indicators exist:

| Component | Key Visual Assertion |
|-----------|---------------------|
| ProxyBadge | Renders text "Proxy" inside a Bootstrap Badge element |
| ScopeLabel | Renders scope items as comma-separated text; shows "+N more" for overflow; shows "N proxy/proxies" count |
| ScopeFilterCheckbox | Renders a checkbox with label text; checked state reflects prop |
| CurationScopeSection | Renders "Person type(s)" and "Organizational unit(s)" labels with Autocomplete inputs |
| ProxyAssignmentsSection | Renders "Proxy assignments" heading with search input and person chips |
| GrantProxyModal | Renders modal with "Grant Proxy" title, search input, and submit button |

Source: RESEARCH.md "Code Examples" section, component source files listed in CONTEXT.md canonical_refs

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Not applicable | none | No shadcn initialized; Bootstrap + MUI used directly |

No third-party component registries. All components are either Bootstrap (`react-bootstrap`), MUI (`@mui/material`), or custom CSS Modules.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
