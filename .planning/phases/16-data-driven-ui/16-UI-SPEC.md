---
phase: 16
slug: data-driven-ui
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-14
---

# Phase 16 — UI Design Contract

> Visual and interaction contract for the data-driven UI phase. This phase replaces hardcoded role arrays and PNG icons with permission-based rendering and MUI icons. No new pages or layouts are introduced. The contract specifies what must be preserved and what changes.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (existing Bootstrap + MUI) |
| Preset | not applicable |
| Component library | @mui/material 5.0.6 + react-bootstrap 2.0.3 |
| Icon library | @mui/icons-material 5.0.5 (replacing PNG imports) |
| Font | Open Sans (body/headings), Helvetica Neue (nav items) |

**Source:** Codebase scan -- `package.json`, `SideNavbar.tsx`, `Header.module.css`, `CurateIndividual.module.css`.

---

## Spacing Scale

Declared values (preserving existing MUI/Bootstrap spacing):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline icon-to-text gaps |
| sm | 8px | Compact list item internal padding |
| md | 16px | Default element spacing, list item padding |
| lg | 24px | Section padding, drawer padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: MUI theme spacing applies (`theme.spacing(N)` = N * 8px). Drawer header uses `theme.mixins.toolbar` for height. Nav drawer collapsed width uses `calc(theme.spacing(7) + 1px)` = 57px at base, `calc(theme.spacing(9) + 1px)` = 73px at `sm` breakpoint.

**Source:** `SideNavbar.tsx` lines 38-67, `Navbar.module.css`.

---

## Typography

| Role | Size | Weight | Line Height | Font Family |
|------|------|--------|-------------|-------------|
| Body | 14px | 400 (regular) | 1.5 | Open Sans, sans-serif, Arial |
| Nav item label | 14px | 400 (regular) | 1.43 (MUI default) | Helvetica Neue |
| Sidebar control label | 12px | 300 (light) | 1.0 | inherit |
| Tab label | 14px | 600 (semibold, active) / 400 (inactive) | 1.5 | Open Sans, sans-serif, Arial |

**Note:** This phase does not introduce new typography. Nav item labels remain 14px per the existing `StyledList` definition (line 131-135 of `SideNavbar.tsx`). The MUI icon transition does not change font sizes or weights.

**Source:** `SideNavbar.tsx` StyledList, `Navbar.module.css`, `CurateIndividual.module.css`.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` | Page background, content area |
| Secondary (30%) | `#f5f5f5` | Sidebar background, filter panels, profile cards |
| Accent (10%) | `#e87722` | Active nav item background, notification highlights |
| Brand header | `#cf4520` | Top navigation bar only (unchanged by this phase) |
| Accent hover | `#bd5d16` | Active nav item hover state |
| Hover | `#eeeeee` | Nav item hover background |
| Disabled text | `#aaaaaa` | Disabled nav item labels |
| Border | `#cccccc` | Nav item bottom borders |
| Icon default | `#222222` | MUI icon default color (inherits from text) |
| Icon active | `#ffffff` | MUI icon color when nav item is selected (white on orange) |

Accent reserved for: Active/selected sidebar nav items only. The `#e87722` orange is used exclusively for the `Mui-selected` state on `ListItem` components within the sidebar `StyledList`. It is NOT used for CTAs, buttons, or links outside the sidebar.

**MUI Icon Color Contract:** Icons inherit color from their parent `ListItemIcon`. The existing `StyledList` CSS handles this:
- Default state: icon color `#222222` (dark text, inherited)
- Selected state: icon color `#ffffff` (white, via `.Mui-selected .MuiListItemIcon-root`)
- Hover state: icon color `#222222` (dark text, explicit)

No per-icon color overrides. All 7 MUI icons use the same inherited color behavior. This replaces the old pattern of separate PNG files for active/inactive states.

**Source:** `SideNavbar.tsx` StyledList (lines 96-141), `Header.module.css`, `Navbar.module.css`.

---

## Icon Registry Contract

The PNG-to-MUI icon transition is the primary visual change in this phase. The mapping is exact:

| DB Icon String | MUI Component | Replaces | Nav Item |
|----------------|---------------|----------|----------|
| `Search` | `SearchIcon` | `facultyIcon` + `facultyIconActive` PNGs | Find People |
| `LocalLibrary` | `LocalLibraryIcon` | `SettingsIconTools` + `settingsIconActive` PNGs | Curate Publications |
| `Assessment` | `AssessmentIcon` | `chartIcon` + `chartIconActive` PNGs | Create Reports |
| `NotificationsActive` | `NotificationsActiveIcon` | `chartIcon` + `chartIconActive` PNGs (reused) | Manage Notifications |
| `AccountCircle` | `AccountCircleIcon` | `chartIcon` + `chartIconActive` PNGs (reused) | Manage Profile |
| `Group` | `GroupIcon` | `facultyIcon` + `facultyIconActive` PNGs (reused) | Manage Users |
| `Settings` | `SettingsIcon` | `SettingsIconGare` + `SettingsGareIconActive` PNGs | Configuration |

**Icon sizing:** MUI icons render at 24px by default. The current PNG icons are rendered at 15x15px via `next/image`. MUI `ListItemIcon` should use `fontSize="small"` (20px) to approximate the existing visual density, OR leave at default (24px) which is more touch-friendly and aligns with MUI list item conventions. Decision: use MUI default 24px -- the `ListItemIcon` min-width is already set to 30px in `StyledList`, providing adequate space.

**Fallback icon:** When `permissionResources` contains an icon string not in the registry, render `HelpOutlineIcon` as a visible signal that a mapping is missing. This is a development aid, not a user-facing feature.

**Source:** CONTEXT.md D-01, D-02, D-03; `add-permission-tables.sql` seed data (lines 133-150); RESEARCH.md Pattern 1.

---

## Nav Rendering Contract

### Data Source

Nav items come from `session.data.permissionResources` (JSON string in JWT), filtered and sorted as:

```
filter: resourceType === 'nav'
sort: displayOrder ASC (1-7)
```

### Display Order (from DB seed)

| Order | resourceKey | Label | Route | Permission |
|-------|-------------|-------|-------|------------|
| 1 | nav_search | Find People | /search | canSearch |
| 2 | nav_curate | Curate Publications | /curate | canCurate |
| 3 | nav_report | Create Reports | /report | canReport |
| 4 | nav_notifications | Manage Notifications | /notifications | canManageNotifications |
| 5 | nav_profile | Manage Profile | /manageprofile | canManageProfile |
| 6 | nav_users | Manage Users | /manageusers | canManageUsers |
| 7 | nav_config | Configuration | /configuration | canConfigure |

### Visibility Rules (D-07)

| Condition | Effect |
|-----------|--------|
| User lacks the nav item's permission | Item is **hidden** (not rendered) |
| User has permission but state not ready | Item is **visible but disabled** (grayed text, no link) |
| User has permission and state is ready | Item is **visible and active** (clickable link) |

### Special Cases

| Nav Item | Special Rule | Source |
|----------|-------------|--------|
| Curate Publications | Disabled when `Object.keys(filters).length === 0` (no identity selected). For Curator_Self users, route becomes `/curate/{personIdentifier}`. | D-07, Pitfall 1 |
| Manage Notifications | Hidden unless ALL THREE conditions pass: (1) `hasPermission(p, 'canManageNotifications')`, (2) admin settings `isVisibleNotification === true`, (3) `session.data.email` exists. Route becomes `/notifications/{username}`. | D-08, Pitfall 3 |
| Manage Profile | Route becomes `/manageprofile/{username}`. | Existing code line 197 |

### Visual Preservation

The following visual properties must remain unchanged after the conversion:

| Property | Current Value | Must Preserve |
|----------|---------------|---------------|
| Drawer width (open) | 240px | Yes |
| Drawer width (closed) | `calc(theme.spacing(7) + 1px)` base, `calc(theme.spacing(9) + 1px)` sm+ | Yes |
| Drawer top offset | 60px (below header) | Yes |
| Drawer background | `#f5f5f5` | Yes |
| Item border-bottom | `1px solid #ccc` | Yes |
| Selected item background | `#e87722` | Yes |
| Selected item text/icon color | `#ffffff` | Yes |
| Hover background | `#eeeeee` | Yes |
| Item font size | 14px | Yes |
| Item font family | Helvetica Neue | Yes |
| Compact mode toggle | ChevronLeft/Right icons + "compact mode" text | Yes |
| `ListItemIcon` min-width | 30px | Yes |

**Source:** CONTEXT.md D-04 through D-08, `SideNavbar.tsx`, `Navbar.module.css`.

---

## ReciterTabs Contract

### Before (current)
Each tab in `tabsData` has an `allowedRoleNames` array. Rendering iterates over tabs, parses `session.data.userRoles`, filters roles against `allowedRoleNames`, and renders the tab only if matches exist.

### After (target)
A single `hasPermission(permissions, 'canCurate')` check gates the entire tab set. All 5 tabs share the `canCurate` permission. The `allowedRoleNames` property is removed from `tabsData`.

### Visual Preservation

| Property | Must Preserve |
|----------|---------------|
| 5 tabs: Suggested, Accepted, Rejected, Add New record, PubMed | Yes |
| Tab active styling (existing CSS module classes) | Yes |
| Badge counts on Suggested/Accepted/Rejected | Yes |
| Tab switching behavior and `onSelect` logic | Yes |
| PubMed tab italic styling when active | Yes |

The only change is the gating mechanism. No visual, layout, or interaction changes to the tabs themselves.

**Source:** CONTEXT.md D-09, D-10; `ReciterTabs.tsx`.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Not applicable -- this phase has no new CTAs. Existing labels are preserved from DB seed data. |
| Empty state (no permissionResources) | Sidebar renders zero nav items. No error message displayed. This is a graceful degradation -- the page content is still accessible via direct URL. |
| Error state (malformed permissionResources) | `getPermissionsFromRaw()` returns empty array. `usePermissions()` hook catches JSON.parse errors silently. Result: same as empty state (zero nav items). No user-facing error message. |
| Fallback icon tooltip | None. The `HelpOutlineIcon` fallback renders without tooltip. It signals a missing icon mapping to developers, not end users. |

### Nav Item Labels (from DB seed -- not hardcoded)

| resourceKey | Label (from DB) | Matches Current Hardcoded Label |
|-------------|-----------------|--------------------------------|
| nav_search | Find People | Yes (line 157) |
| nav_curate | Curate Publications | Yes (line 167) |
| nav_report | Create Reports | Yes (line 175) |
| nav_notifications | Manage Notifications | Yes (line 183) |
| nav_profile | Manage Profile | Yes (line 193) |
| nav_users | Manage Users | Yes (line 201) |
| nav_config | Configuration | Yes (line 209) |

All 7 labels match exactly. No copywriting changes.

**Source:** `add-permission-tables.sql` seed data, `SideNavbar.tsx` menuItems array.

---

## Component Conversion Inventory

Files in scope for role-to-permission conversion (D-11, D-12):

| File | Change Type | What Changes |
|------|-------------|-------------|
| `src/components/elements/Navbar/SideNavbar.tsx` | Major rewrite | Data-driven nav from permissionResources, MUI icons, remove PNG imports |
| `src/components/elements/Navbar/NestedListItem.tsx` | Major rewrite | Data-driven items, remove role arrays |
| `src/components/elements/Navbar/MenuListItem.tsx` | Modify | Accept MUI icon component prop instead of `imgUrl`/`imgUrlActive` PNGs |
| `src/components/elements/CurateIndividual/ReciterTabs.tsx` | Modify | Replace `allowedRoleNames` with `hasPermission('canCurate')` |
| `src/components/elements/CurateIndividual/CurateIndividual.tsx` | Modify | Remove `allowedPermissions` import |
| `src/components/elements/Search/Search.js` | Modify | Replace role-label cascade with permission checks |
| `src/components/elements/Search/FilterReview.tsx` | Modify | Replace 150-line role cascade with 2-3 permission checks |
| `src/components/elements/Profile/Profile.tsx` | Modify | Replace role check for email visibility |
| `src/components/elements/Notifications/Notifications.tsx` | Modify | Replace role check for view access |
| `src/components/elements/ManageProfile/ManageProfile.tsx` | Modify | Replace role check for view access |
| `src/pages/login/Login.js` | Modify | Replace role-based redirect with permission-based |
| `src/components/elements/App/App.js` | Modify | Replace role check for Curator_Self fetch guard |
| `src/pages/index.js` | Modify | Replace role-based SSR redirect with permission-based |
| `types/menu.d.ts` | Modify | Remove `allowedRoleNames`, `imgUrl`, `imgUrlActive`; add `icon`, `permissionKey` |

### New Files

| File | Purpose |
|------|---------|
| `src/utils/iconRegistry.ts` | Static map: DB icon strings to MUI icon components (7 entries + fallback) |
| `src/hooks/usePermissions.ts` | Convenience hook: parses permissions/permissionResources from session, memoizes, exposes `hasPermission()` |

**Source:** CONTEXT.md D-11, D-12; RESEARCH.md Architecture Patterns.

---

## Updated MenuItem Type Contract

```typescript
// types/menu.d.ts -- target state after Phase 16
export type MenuItem = {
  title: string
  to?: Url
  nestedMenu?: Array<MenuItem>
  id?: number
  icon?: string          // MUI icon name from DB (replaces imgUrl/imgUrlActive)
  disabled?: boolean
  permissionKey?: string // Permission key from DB (replaces allowedRoleNames)
}
```

Properties removed: `imgUrl`, `imgUrlActive`, `allowedRoleNames`, `isRequired`.

**Source:** CONTEXT.md D-05; RESEARCH.md Pattern 5.

---

## Interaction Contracts

### Sidebar Toggle (preserved)
- Click chevron icon or "compact mode" text to collapse sidebar
- Collapsed: icons only, text hidden via `display: none` on `MuiListItemText-root`
- Expanded: icons + text labels at 240px width
- Transition uses MUI theme `transitions.easing.sharp`

### Nav Item Click (preserved, data source changes)
- Click enabled item: navigate to route via `next/link`
- Click disabled item: no navigation (pointer-events: none)
- Active route detection: `router.pathname` matching against item route

### Tab Switch (preserved)
- Click tab header to switch active tab
- Tab content updates below
- PubMed tab triggers label style change ("Adding New record from" italic)
- Disabled "addNewRecord" tab is hidden via CSS (`display: none`)

### No New Interactions
This phase introduces no new clickable elements, modals, tooltips, or animations. All interactions are preservation of existing behavior with a different data source.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Not applicable | None | No shadcn, no third-party registries |

This project uses Bootstrap + MUI, not shadcn. No registry vetting required.

---

## Accessibility Preservation

The MUI icon transition improves accessibility over the current PNG approach:

| Aspect | Before (PNG) | After (MUI Icon) |
|--------|-------------|-------------------|
| Icon alt text | `alt={title}` on `<Image>` | MUI icons are decorative (paired with text label). Use `aria-hidden="true"` on icon, label provides accessible name. |
| Icon scaling | Fixed 15x15px bitmap | SVG, scales with zoom |
| High contrast | PNG may not adapt | MUI icons inherit `color` CSS, adapt to high-contrast mode |
| Screen reader | Reads img alt text (redundant with label) | Icon hidden from SR, label read once (cleaner) |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
