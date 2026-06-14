# Publication Manager — Visual Style Guide

The design source of truth for the ReCiter Publication Manager UI, describing the **"calm" redesign** as it actually ships on `/curate/[cwid]` and `/authorships`. A new contributor should be able to build `/search` (Find People) and `/report` from this document without reading the curate source.

**Authoritative token source:** `styles/globals.css` `:root`. Where a value below is a CSS custom property (`--name`), that file wins. Where a value is a bare hex with no token, it is a component-level hardcode (the curator / authorship CSS Modules) that is the de-facto design language but *not* yet tokenized — see [Known drift](#known-drift--reconcile-before-next-ui-work) before relying on it.

This guide is **descriptive of what ships today, not aspirational.** All numbers below were verified against `styles/globals.css`, `src/pages/_document.tsx`, `src/pages/_app.tsx`, and the shipped `*.module.css` files.

---

## Tech stack & styling architecture

| Layer | Choice |
|-------|--------|
| Framework | Next.js (Pages Router), React 16, Redux + redux-thunk. package.json pins **Next ^12.2.5** (node_modules currently resolves 14.x). |
| Styling | Global CSS + design tokens (`styles/globals.css`) + per-component CSS Modules. **No Tailwind, no shadcn.** |
| Component libraries | **MUI 5** for complex inputs (Autocomplete, TextField, Popper, Paper, Tooltip, `styled`) · **react-bootstrap** for structural UI (Modal, Badge, Form.Check, Spinner, Dropdown) |
| Icons | Inline SVG (custom `NavIcon` wrappers). `react-icons` is installed but not the preferred pattern. |
| MUI theme | `src/pages/_app.tsx` — `palette.primary` = WCM red (`#b31b1b` / `#8c1515` / `#f5e6e6`), `shape.borderRadius` = **6**, `typography.fontFamily` = **Inter** stack (matches `--font-sans`). |

Styling lives in three places, in priority order: (1) `globals.css` tokens + element/Bootstrap overrides, (2) the MUI theme in `_app.tsx`, (3) component `*.module.css` and inline `sx`/`style`. New work should prefer tokens; reach for a hardcode only to match an existing un-tokenized calm pattern.

> **Library-leakage warning.** react-bootstrap `.btn-primary` and MUI defaults both surface **WCM red** unless overridden. New buttons must be re-skinned to the system — see [Buttons](#buttons) and [Known drift](#known-drift--reconcile-before-next-ui-work). The `/report` export buttons already do this (an `.exportBtn` class forcing navy `#1a2133`).

---

## Typography

### Fonts — Inter, loaded via Google Fonts `<link>`

**Inter is the single typeface** for both body and display. It is loaded with a plain Google Fonts `<link>` in `src/pages/_document.tsx`:

```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap
```

This is **not** `next/font`: package.json pins Next ^12 while node_modules resolves 14.x, so a `<link>` is used because it survives either resolution. Do not migrate to `next/font` without re-pinning Next.

| Token | Value | Reality |
|-------|-------|---------|
| `--font-sans` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` | Body, UI, inputs, headings. |
| `--font-display` | `'Inter', sans-serif` | Display headings (`h1`, `h3 strong`, person name). |
| `--font-serif` | `var(--font-display)` | **Legacy alias** of `--font-display`, kept so old references resolve. Not a serif — it is Inter. |

> **The Bootstrap reboot trap.** `bootstrap/dist/css/bootstrap.min.css` is imported in `_app.tsx` *after* `globals.css`, so its reboot would otherwise reset `body` to the Bootstrap default. `globals.css` defends against this two ways: it sets `--bs-body-font-family: var(--font-sans)` **and** `body { font-family: var(--font-sans) !important }`. Keep both — dropping either lets Bootstrap's font win on body text. (Verified: `getComputedStyle(body).fontFamily` resolves to Inter.)

### Type roles in practice

| Role | Size | Weight | Line height | Notes |
|------|------|--------|-------------|-------|
| Body / UI / inputs | 13px | 400 | 1.6 | `--font-sans` |
| Label | 11px | 600 | 1.4 | |
| Section title | 11px | 600 | 1.0 | UPPERCASE, letter-spacing **0.1em**, color `#8a94a6`, **no gray fill** |
| `h1` (page) | 28px | 500 | — | `--font-display`, letter-spacing −0.02em, color `#1a2133`, `padding-bottom: 10px` |
| `h3` (results-count line) | 14px | 600 | — | `--font-sans`, color `#1a2133` |
| `h3 strong` (the number) | 22px | 600 | — | `--font-display`, color `#c0392b`, `margin-right: 4px` |
| Person name (curate) | 20px | 600 | — | `--font-display`, color `--gray-900` |
| Article title (card) | 14px | 600 | 1.45 | color `#1a2133` |

**Weight policy:** for new work use only **400** (default) and **600** (emphasis). Inherited exceptions in existing code: **500** (the `h1` rule, navbar selected item, some MUI/feedback-value text) and **700** (legacy `UsersTable` headers — new headers use 11px / 600 / uppercase). Do not introduce new 500/700 usages.

The `--font-size-*` token scale (`xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 24`) exists but is **largely bypassed**; real components use literal `11 / 13 / 14 / 22 / 26 / 28px`. See [Known drift](#known-drift--reconcile-before-next-ui-work).

---

## Color

### Warm content surfaces (tokens — the calm foundation)

| Token | Hex | Use |
|-------|-----|-----|
| `--color-warm-bg` | `#f5f2ee` | Page background (`body`, set `!important`) |
| `--color-warm-surface` | `#ffffff` | Cards, forms |
| `--color-warm-border` | `#e8e2d9` | Card borders, section dividers |

Additional warm values used pervasively in the curator/authorship CSS (not yet tokenized):

| Role | Hex | Where |
|------|-----|-------|
| Muted fill | `#eeeae4` | `.form-control` bg, light tokens, photo placeholder, inactive surfaces |
| Border (input) | `#ddd7ce` | `.form-control` border, MUI fieldset, card-action outlines |
| Border (input, focus/hover) | `#bbb5aa` | `.form-control:focus`, hover outlines |
| Subtle surface | `#faf8f5` | Controls bar, form footer, button hover bg |
| Hairline divider | `#f0ece5` | Keyword-chip hover bg, faint internal rules |

### Ink & text (curator hardcodes — the de-facto text scale)

| Role | Hex | Use |
|------|-----|-----|
| Ink | `#1a2133` | Headings, body emphasis, CTAs, dark chrome, dark tokens, sidebar |
| Body muted | `#5a6478` | Field labels, secondary text, authors line |
| Hint / placeholder | `#8a94a6` | Field hints, input placeholders, section-title rule, meta dots |

### One navy — chrome (tokens, authoritative)

There is **one navy across the app**, `#1a2133`. (This resolves the old "two navies" drift — `--color-chrome` was previously `#1e2d3d`.)

| Token | Hex | Use |
|-------|-----|-----|
| `--color-chrome` | `#1a2133` | Sidebar/header, CTAs, dark tokens, ink |
| `--color-chrome-hover` | `#252d42` | Chrome hover |
| `--color-chrome-border` | `#2a3350` | Chrome borders |
| `--color-chrome-text` | `#a0aec0` | Chrome muted text |
| `--color-chrome-text-bright` | `#e2e8f0` | Chrome bright text |

### Accent blue (tokens, authoritative)

| Token | Hex / value | Use |
|-------|-------------|-----|
| `--color-accent` | `#2563a8` | **Content links**, input focus ring, selected/target author, ProxyBadge, focused-card border |
| `--color-accent-soft` | `rgba(37,99,168,0.1)` | `box-shadow: 0 0 0 3px …` focus rings, soft hover backgrounds |

### Brand / primary (tokens)

| Token | Hex | Use |
|-------|-----|-----|
| `--wcm-red` / `--color-primary` | `#b31b1b` | **Brand chrome only** — favicon, date-picker selection, legacy `.btn-primary.primary`/`.btn-danger`/`.wcm-primary-lg`. Reserved for true brand; **not** the content-link or CTA color. |
| `--wcm-red-dark` / `--color-primary-dark` | `#8c1515` | Hover/active of the above |
| `--wcm-red-light` / `--color-primary-light` | `#f5e6e6` | Tinted hover backgrounds, selected date span |

### Semantic soft tints (the calm decision palette)

The calm system uses **soft tint at rest → solid fill on hover/commit**. Used by the decision buttons, status chips, and tab counts.

| State | Rest bg | Rest text | Solid (hover/commit) |
|-------|---------|-----------|----------------------|
| Success / Accept | `#dcfce7` | `#166534` | `#16a34a` (token `--color-success`) |
| Danger / Reject | `#fee2e2` | `#991b1b` | `#dc2626` (token `--color-danger`) |
| Warning | `#fef3c7` | `#92400e` | — |

Token semantics also exist: `--color-success #16a34a` / `--color-success-light #dcfce7`; `--color-danger #dc2626` / `--color-danger-light #fef2f2`; `--color-warning #f59e0b` / `--color-warning-light #fef3c7`.

### Badge colors (tokens)

| | Background | Text |
|---|---|---|
| Blue | `--color-badge-blue-bg #eff6ff` | `--color-badge-blue-text #1d4ed8` |
| Yellow | `--color-badge-yellow-bg #fefce8` | `--color-badge-yellow-text #a16207` |
| Red | `--color-badge-red-bg #fef2f2` | `--color-badge-red-text #b91c1c` |

### Gray scale (tokens, Tailwind-derived)

`--gray-50 #f9fafb` · `100 #f3f4f6` · `200 #e5e7eb` · `300 #d1d5db` · `400 #9ca3af` · `500 #6b7280` · `600 #4b5563` · `700 #374151` · `800 #1f2937` · `900 #111827`. The grays survive mostly in legacy and Bootstrap-override contexts; new calm work prefers the warm palette and ink scale above.

### Color-role budget (60 / 30 / 10)

- **Dominant ~60%** — `#f5f2ee` warm bg / `#ffffff` surfaces.
- **Secondary ~30%** — `#1a2133` chrome / `#eeeae4` muted / `#faf8f5` subtle.
- **Accent ~10%** — `#2563a8` for links, focus rings, selected/target state, ProxyBadge.
- **Semantic** — success/danger/warning soft tints for decisions and status only.

---

## Spacing

8-point grid. All new spacing must be a multiple of 4.

| Step | Value | Use |
|------|-------|-----|
| xs | 4px | Icon gaps, inline label padding, micro-gaps |
| sm | 8px | Compact spacing, field-grid gap, controls-bar gap |
| md | 16px | Default spacing, table-cell padding, evidence column gap |
| lg | 24px | Section padding, page margins |
| xl | 32px | Article-list horizontal padding |
| 2xl | 48px | (reserved) |
| 3xl | 64px | Empty-state vertical padding |

Locked exceptions (do not "fix" to a pure multiple): **28px** horizontal padding on `formSection` / `searchFormContainer`; **20px** on `personHeader` and SideNavbar menu items; the **16px** dead-zone gap between the big Accept/Reject buttons.

---

## Radius & elevation

### Radius standard (settled)

- **6px** (`--radius-md`) for **cards and controls** — the default.
- **8px** (`--radius-lg`) allowed **only** for large outer wrapper containers (e.g. a page-level filter shell, the person-photo frame).
- **Pills** (`--radius-pill`, 999px) where intentional — multi-select tokens, dropdown trigger buttons, danger/outline buttons.
- **5px** survives on `.form-control` and the MUI input `baseSx` (a near-6 legacy value; treat as control radius).

| Token | Value | | Token | Value |
|-------|-------|--|-------|-------|
| `--radius-sm` | 4px | | `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / .05)` |
| `--radius-md` | 6px | | `--shadow-md` | `0 4px 6px -1px …, 0 2px 4px -2px …` |
| `--radius-lg` | 8px | | `--shadow-lg` | `0 10px 15px -3px …, 0 4px 6px -4px …` |
| `--radius-pill` | 999px | | `--shadow-xl` | `0 20px 25px -5px …, 0 8px 10px -6px …` |

Calm cards are intentionally **flat** — `box-shadow: none` at rest, with a `0.5px solid #e8e2d9` hairline doing the elevation work. Shadows are reserved for floating layers (dropdown menus `--shadow-lg`, modals, popovers).

---

## Layout

- `--header-height: 52px`
- `--sidebar-width-expanded: 220px`
- App shell is a full-height flex column (`#__next`, `100vh`, `overflow-y: scroll`); the content area scrolls. The dark navy sidebar is the brand chrome; there is no separate top header bar (brand lives in the sidebar, user info in the content area).

---

## Navigation model

The **group curation surface has been retired.** Previously `/curate` was a multi-person queue (People / Org / Institution / Person-Type multi-select). Now:

- **`/curate` redirects to `/search` (Find People).** `src/pages/curate/index.*` returns a `getServerSideProps` redirect (`destination: "/search"`, `permanent: false`). Curate an individual by going Find People → person → `/curate/[cwid]`, or via the Authorships review queue.
- **The sidebar "Curate" item is a context indicator, not a destination queue.** It links to `/curate` (which bounces to Find People) and **highlights while you are on `/curate/[cwid]`** via a `startsWith('/curate')` active match in the sidebar. Treat it as "you are curating someone," not "open the curation queue."

When building `/search`, this is the entry point into per-person curation — its row actions (Curate · Reports · Profile) lead to `/curate/[cwid]` and friends.

---

## Components

### Buttons

The calm button idiom is **soft tint at rest → solid fill on hover**, 6px or pill radius, compact, weights 400/600 only.

| Class / pattern | Look |
|-----------------|------|
| **Navy CTA** (Create / Update / Save / Search / Export) | `#1a2133` bg, white text, 13px/600 — the canonical primary action. On `/report`, `.exportBtn` forces this navy (overriding Bootstrap's red `.btn-primary`). |
| `.btn-warning` (secondary) | White bg, `#5a6478` text, `#ddd7ce` border, `--radius-md`, 14px; hover → `#faf8f5` bg / `#bbb5aa` border / `#1a2133` text |
| `.btn-outline-secondary` | Warm border, `#5a6478` text, **pill**, 13px; hover → `#faf8f5` / `#bbb5aa` / `#1a2133` |
| `.transparent-btn` | White, warm border, **pill**; hover → `--wcm-red-light` bg / red border + text (legacy brand hover) |
| `.btn-danger` | WCM-red bg, **pill**, 13px/600, padding `6px 20px` (legacy brand button) |
| `.btn-primary.primary`, `.wcm-primary-lg` | WCM red → `#8c1515` hover, `--radius-md` (legacy brand) |
| `.text-btn`, `.transparent-button` | WCM red, underlined, transparent — text-only action |

> When you need a primary action button, **use the navy CTA**, not raw `.btn-primary` (which is brand red). Brand-red buttons are legacy/brand-chrome only.

### Decision buttons (Accept / Reject)

The signature calm component, in the publication card.

**Pending state — large, spaced, with a Fitts's-law dead zone** (`.bigActions`):
- Two full-width buttons (`flex: 1`), `padding: 11px 24px`, 14px/500, `--radius-md`.
- **Accept** (`.btnAcceptBig`): rest `#dcfce7` bg / `#166534` text / `#b7e4c7` border → hover solid `#16a34a` bg / white text.
- **Reject** (`.btnRejectBig`): rest `#fee2e2` bg / `#991b1b` text / `#f3c4c4` border → hover solid `#dc2626` bg / white text.
- Between them sits a **16px `.deadZone`** with a faint dashed centerline (`.deadZoneLine`, `1px dashed #ddd7ce`): big targets, but a fast double-click can't accidentally flip Accept ↔ Reject.
- `:active { transform: scale(0.985) }` for a confident press.

**Decided state — compact mirrored opposite-action + Undo** (`.cardActions` / `.cardActionsActioned`):
- Small neutral-chrome buttons (white bg, `0.5px solid #ddd7ce`, `#5a6478`), hover `#faf8f5` / `#bbb5aa`.
- Colored text only: `.btnAccept #1a7a4a` · `.btnReject #c0392b` · `.btnUndo #5a6478`. A decided card shows the *opposite* action plus **Undo** — you never re-press the action you already took.

Keyboard: **A** = Accept, **R** = Reject, **E** = toggle evidence on the focused card.

### Score tile (tier-shaded)

Left-rail tile on each publication card (`.scoreTile`): 44px wide, `--radius-md`, `0.5px` border, number 17px/600 over a 9px/400 uppercase-ish label (`letter-spacing 0.05em`). Background and text are shaded by score tier:

| Tier | bg | border | number | label |
|------|----|--------|--------|-------|
| High (`.scoreTileHigh`) | `#eaf3ee` | `#cfe5da` | `#0f6e56` | `#5dcaa5` |
| Medium (`.scoreTileMedium`) | `#faf2e6` | `#ecd9bb` | `#92600a` | `#c9a25f` |
| Low (`.scoreTileLow`) | `#fbeeee` | `#ecd0d0` | `#a33030` | `#cf8f8f` |

### Feedback evidence — ranked list (replaces the old diverging bar chart)

The per-attribute feedback scores render as a **ranked list: label · value · thin bar** (`.feedbackList`, a 3-column grid `minmax(120px,max-content) 40px minmax(0,1fr)`, gap `8px 16px`, 13px).

- **Label** `.feedbackLabel` `#5a6478`; **value** `.feedbackValue` `#1a2133`/500, right-aligned; negative value `.feedbackValueNeg` `#c0392b`.
- **Bar** `.feedbackBarTrack` is a 4px `#eeeae4` rail; `.feedbackBarFill` is `#1a2133` at 0.75 opacity; negative `.feedbackBarFillNeg` is `#c0392b`.
- **Critical contract — fixed ±100 scale.** Bar width is computed against a constant `FEEDBACK_SCALE = 100` (`Publication.tsx`): `barPct = min(abs(value)/100 * 100, 100)`. Bars are **not** normalized per-card, so a bar of the same length means the same magnitude on every publication. Values beyond ±100 cap at full width. (Tooltip: a score of 100 = strong evidence *for* authorship, −100 = strong evidence *against*, near 0 = inconclusive.)

This replaced the earlier diverging bar chart — do not reintroduce per-card normalization or a centered/diverging axis.

### Article card

`.articleCard`: white, **`0.5px solid #e8e2d9`**, **6px** radius, `box-shadow: none`, flex row. Focused (`.focused`): border `#2563a8` + `box-shadow 0 0 0 3px rgba(37,99,168,0.15)`. A 3px left **status strip** marks decided cards: accepted `#1D9E75`, rejected `#c0392b`. Highlighted/target author in the authors line: `#2563a8`/600.

### Keyword chips (subtle, weight-tiered)

Inferred-keyword chips (`.kwTag`): **transparent** background at rest, 6px radius, `padding 2px 7px`, 13px, `#2e3647`; hover fills `#f0ece5` / `#1a2133`. Tiered by salience: `.kwHigh` 600/`#1a2133`, `.kwMedium` 500, `.kwLow` `opacity 0.85` (→ 1 on hover). Quiet by design — no boxed fill at rest.

### Form controls (`.form-control`)

Warm style: bg `#eeeae4`, border `1px solid #ddd7ce`, radius **5px**, 13px, text `#1a2133`, padding `8px 12px`, `font-family: var(--font-sans)`. Focus → white bg, `#bbb5aa` border, **no box-shadow**. Placeholder `#8a94a6`.

> Two focus treatments coexist by design: Bootstrap `.form-control` focuses to the warm `#bbb5aa` border (no ring); MUI inputs (via `baseSx`) focus to the **accent-blue** ring `#2563a8` + `rgba(37,99,168,0.1)` glow. Match whichever library the control uses.

### MUI Autocomplete — mandatory `baseSx`

Every new MUI Autocomplete/TextField uses this pattern (from `AddUser.tsx`) so inputs match:

```ts
const baseSx = {
  '& .MuiOutlinedInput-root': {
    padding: '4px 8px',
    background: '#fff',
    borderRadius: '5px',
    fontSize: '13px',
    fontFamily: 'inherit',
    '& fieldset': { borderColor: '#ddd7ce', top: 0, '& legend': { display: 'none' } },
    '&:hover fieldset': { borderColor: '#ddd7ce' },
    '&.Mui-focused fieldset': {
      borderColor: '#2563a8', borderWidth: '1px',
      boxShadow: '0 0 0 3px rgba(37,99,168,0.1)',
    },
  },
};
```

### Tokens / pills (multi-select chips)

| Type | Background | Text | Border | Use |
|------|-----------|------|--------|-----|
| Dark token | `#1a2133` | `#fff` | none | Role pills, selected users |
| Light token | `#eeeae4` | `#5a6478` | `1px solid #ddd7ce` | Department / scope / proxy-person pills |

Both: pill radius, 13px/400, padding `4px 8px 4px 12px`, 16px circular-hover close button.

### Dropdowns

Trigger is a **pill button**: `#e8e4dc`/`#f3f1ed` bg, `#b0aca4`/`#d6d0c4` border, `#2c2a27` text, 14px, padding `6px 12px 6px 14px`. Open state darkens to `#e8e4dc`/`#b0aca4` and the chevron rotates 180° (0.15s). Menu: `--radius-lg`, `--shadow-lg`, `1px solid --color-warm-border`, `12px 0` padding (item padding lives on the items).

### Modals (react-bootstrap)

`z-index: 2055` (backdrop + dialog), `.modal.fade` transition disabled. Curator modals (e.g. GrantProxyModal) are centered, size `lg`, header 13px/600/`#1a2133`, footer navy "Save Changes" + transparent "Discard Changes".

### Toasts (react-toastify)

The accept/reject confirmation is an **undo toast** (`.undoToast`): a verb in semantic color — accepted `#166534`, rejected `#991b1b`, both 600 — followed by an Undo button (`.undoToastBtn`, navy `#1a2133` / white, hover `#2a3450`) on a navy chrome. Standard copy elsewhere: success "… Changes take effect on the user's next login."; error "Failed to … Please try again." Full copy deck lives in the UI-SPEC "Copywriting Contract."

### Links

`globals.css` styles content `<a>` as **accent blue** (`var(--color-accent)` `#2563a8`) → `--color-accent-dark`/hover treatment. WCM red is reserved for **true brand chrome only** (favicon, date-picker, legacy brand buttons), not content links. Curator hyperlinks (person names, breadcrumbs, row actions) are accent blue and now match the global `<a>`.

### Date pickers

`react-dates` (DateRangePicker) and `react-datepicker` (year picker) are themed to WCM red as brand chrome: selected day `#b31b1b`, selected/hovered span `#f5e6e6` bg / `#8c1515` text, `--radius-md` inputs. (On `/report`, the DatePicker "Clear" affordance is moving to `--color-accent` to stay on the content palette.)

---

## Known drift — reconcile before / during next UI work

These are the genuinely-open inconsistencies remaining after the calm reconciliation. None are blocking, but each is a trap for new work. (The old "no webfont loaded," "two navies," and "accent untokenized" items are **resolved** and intentionally omitted.)

1. **Ink-tone drift — in progress.** `#2c2a27` (near-black) appears in the shared dropdown/filter CSS (`.search-summary-buttons .btn-primary`, `.dropdown .btn-white`, and Report's `ChecboxSelect` `.ddItem`/`.ptLabel`/`.posLabel`) vs the `#1a2133` ink elsewhere. Being collapsed to `#1a2133` in this reconciliation pass.
2. **Three+ reds — keep straight, don't consolidate blindly.** `--wcm-red #b31b1b` (brand chrome), `--color-danger #dc2626` (semantic danger / Reject-on-commit), `#c0392b` (heading number `h3 strong`, destructive text, required asterisks, negative feedback bars, rejected status strip), `--color-badge-red-text #b91c1c` (badge text). Each has a distinct job; document which is which rather than merging.
3. **Type-scale tokens bypassed.** `--font-size-*` (12/14/16/18/20/24) is mostly unused; components use literal `11/13/14/22/26/28px`. Reconcile the token scale with the real set or stop publishing the unused tokens.
4. **Library leakage.** react-bootstrap `.btn-primary` and MUI defaults default to **WCM red**. Any new primary button must be overridden to the system (navy CTA), the way `/report`'s `.exportBtn` is. Audit new buttons for un-skinned brand red.
5. **Two control radii.** `.form-control` and the MUI `baseSx` ship at **5px** while the standard is 6px. Harmless, but unify when touching those files.

---

## Sources & how to extend

- **Tokens (authoritative):** `styles/globals.css` `:root` + element/Bootstrap overrides.
- **Webfont load:** `src/pages/_document.tsx` (Google Fonts `<link>` for Inter).
- **MUI theme:** `src/pages/_app.tsx` (`createTheme`).
- **Calm components:** `src/components/elements/Publication/Publication.module.css` (article card, score tile, feedback bars, decision buttons), `src/components/elements/CurateIndividual/CurateIndividual.module.css` (keyword chips, undo toast, tabs), `src/components/elements/Authorships/` (review queue), `src/components/elements/Navbar/SideNavbar.tsx` (chrome + Curate indicator).
- **Design contract:** `.planning/phases/09-scoped-roles-and-proxy-ui/09-UI-SPEC.md` (copywriting deck, conditional-render logic, per-component specs).

To add a value: define a `--token` in `globals.css` first, then reference it. Only hardcode to match an existing un-tokenized calm pattern, and prefer fixing the drift above over adding a new one. Verify visual changes with Playwright MCP (`browser_snapshot`) rather than screenshots.
