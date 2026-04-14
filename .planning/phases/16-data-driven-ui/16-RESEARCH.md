# Phase 16: Data-Driven UI - Research

**Researched:** 2026-04-14
**Domain:** React UI permission gating, MUI icon rendering, data-driven navigation
**Confidence:** HIGH

## Summary

Phase 16 replaces hardcoded role-checking patterns across 13 source files (plus 1 type definition) with data-driven permission checks using `permissionUtils.ts` helpers and `permissionResources` session data. The Phase 14 database schema and Phase 15 auth pipeline already deliver `permissions` (string array) and `permissionResources` (object array) to the client session. This phase consumes that data.

The work decomposes into three categories: (1) SideNavbar conversion from hardcoded `menuItems` array with PNG icons to data-driven rendering from `permissionResources` with MUI icons, (2) ReciterTabs conversion from `allowedRoleNames` arrays to a single `hasPermission('canCurate')` check, and (3) a full sweep of 10+ additional files that parse `session.data.userRoles` and compare against `allowedPermissions` role labels, converting them to use `getPermissionsFromRaw()` + `hasPermission()`.

**Primary recommendation:** Execute in two waves -- Wave 1 handles the SideNavbar/NestedListItem icon registry and data-driven nav (highest risk, most structural change), Wave 2 handles the remaining file sweep (mechanical conversion pattern, lower risk per file but broader surface area).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Switch from PNG image imports to MUI icons. Create an icon registry (`src/utils/iconRegistry.ts`) that maps DB icon strings (e.g., `Search`, `LocalLibrary`, `Assessment`) to MUI icon components.
- **D-02:** Remove old PNG icon imports from SideNavbar (`facultyIcon`, `chartIcon`, `checkMarkIcon`, etc.) and their active variants.
- **D-03:** The 7 icon names in the DB seed (`Search`, `LocalLibrary`, `Assessment`, `NotificationsActive`, `AccountCircle`, `Group`, `Settings`) are the canonical set.
- **D-04:** SideNavbar reads `permissionResources` from session, filters by `resourceType === 'nav'`, sorts by `displayOrder`, and renders each item dynamically.
- **D-05:** The `MenuItem` type and `allowedRoleNames` property are replaced.
- **D-06:** NestedListItem follows the same pattern -- receives data-driven items, not hardcoded role arrays.
- **D-07:** Permission controls visibility (show/hide). Application state controls enabled/disabled.
- **D-08:** Manage Notifications visibility combines permission check (`canManageNotifications`) AND admin settings check (`isVisibleNotification`) AND email requirement.
- **D-09:** ReciterTabs stops using `allowedRoleNames`. Tab visibility determined by `hasPermission(permissions, 'canCurate')`.
- **D-10:** No new `permissionResources` entries needed for tabs at this phase.
- **D-11:** All UI components that reference `allowedRoleNames` or parse `session.data.userRoles` for visibility decisions are converted.
- **D-12:** Files in scope: SideNavbar.tsx, NestedListItem.tsx, ReciterTabs.tsx, CurateIndividual.tsx, Search.js, FilterReview.tsx, Profile.tsx, Notifications.tsx, ManageProfile.tsx, Login.js, App.js, index.js, constants.js.
- **D-13:** Conversion pattern: replace `JSON.parse(session.data.userRoles)` + `role.roleLabel` matching with `getPermissionsFromRaw(session.data.permissions)` + `hasPermission()` calls.
- **D-14:** UI-04 (Grant Proxy button) is deferred -- GrantProxyModal was deleted in Phase 14.
- **D-15:** UI-05 (checkCurationScope permission conversion) is deferred -- file was deleted in Phase 14.

### Claude's Discretion
- Exact structure of the icon registry file (default export vs named, typing approach)
- How to handle the Curate Publications route dynamic segment (`/curate` needs a personIdentifier appended for Curator_Self users)
- Whether to create a shared `usePermissions()` hook or keep inline `getPermissionsFromRaw()` calls in each component
- Error/fallback behavior when permissionResources is empty or malformed
- Whether `allowedPermissions` in constants.js gets updated or removed (may overlap with Phase 18 cleanup)

### Deferred Ideas (OUT OF SCOPE)
- UI-04 (Grant Proxy button) -- rebuild with permission model when v1.1 proxy work resumes
- UI-05 (checkCurationScope permission conversion) -- rebuild when v1.1 resumes
- Per-tab permission resources -- finer-grained tab resources can be seeded in Phase 17 if needed
- Dynamic icon loading -- not needed with a static registry of 7 icons
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | SideNavbar renders menu items from permissionResources data (not hardcoded array) | D-04: Filter permissionResources by `resourceType === 'nav'`, sort by `displayOrder`. Icon registry maps DB strings to MUI components. See Architecture Pattern 1 and Code Examples. |
| UI-02 | Nav item icons, labels, routes, and ordering all come from database | D-01/D-03: 7 canonical icon names verified present in @mui/icons-material 5.0.5. Seed data in `add-permission-tables.sql` provides all fields. See Standard Stack and Icon Registry pattern. |
| UI-03 | ReciterTabs no longer uses allowedRoleNames arrays for tab visibility | D-09/D-10: Single `hasPermission(permissions, 'canCurate')` check gates entire tab set. All 5 tabs share same permission. See Architecture Pattern 2. |
| UI-04 | CurateIndividual uses permission set for canGrantProxy check | **DEFERRED** per D-14. GrantProxyModal deleted in Phase 14. |
| UI-05 | checkCurationScope.ts reads permissions from JWT | **DEFERRED** per D-15. File deleted in Phase 14. |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mui/icons-material | 5.0.5 | Icon components for nav items | Already installed; replaces PNG imports [VERIFIED: node require check] |
| @mui/material | 5.0.6 | MUI components (ListItem, etc.) | Already used throughout SideNavbar [VERIFIED: package.json] |
| next-auth | 3.29.10 | Session/JWT carrying permissions + permissionResources | Already provides session.data with permission claims [VERIFIED: package.json] |
| react | 16.14.0 | UI framework | Existing stack [VERIFIED: package.json] |

### Supporting (already in codebase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| permissionUtils.ts | N/A (project util) | `hasPermission()`, `getPermissionsFromRaw()`, `getLandingPageFromPermissions()` | Every permission check in UI components [VERIFIED: codebase read] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Icon registry (static map) | Dynamic `import()` per icon | Over-engineering for 7 icons. Static map is simpler, has zero runtime cost, and avoids code-splitting complexity with MUI's barrel exports |
| Inline `getPermissionsFromRaw()` in each component | Shared `usePermissions()` hook | Hook is cleaner but adds indirection. Recommendation: create the hook (see Architecture Patterns). Low cost, high readability benefit across 12+ files |

**Installation:** No new packages required. All dependencies already installed.

## Architecture Patterns

### Recommended File Changes

```
src/
  utils/
    iconRegistry.ts          # NEW: Maps DB icon strings to MUI components
    permissionUtils.ts       # EXISTING: No changes needed
    constants.js             # MODIFY: May mark allowedPermissions as @deprecated
  hooks/
    usePermissions.ts        # NEW (recommended): Convenience hook
  components/elements/
    Navbar/
      SideNavbar.tsx         # MAJOR REWRITE: Data-driven from permissionResources
      NestedListItem.tsx     # MAJOR REWRITE: Data-driven (or simplified/removed)
      MenuListItem.tsx       # MODIFY: Accept MUI icon component instead of PNG
    CurateIndividual/
      ReciterTabs.tsx        # MODIFY: Replace allowedRoleNames with hasPermission
      CurateIndividual.tsx   # MODIFY: Remove allowedPermissions import (unused)
    Search/
      Search.js              # MODIFY: Replace role-label cascade with permission checks
      FilterReview.tsx       # MODIFY: Replace role-label cascade with permission checks
    Profile/
      Profile.tsx            # MODIFY: Replace role check for email visibility
    Notifications/
      Notifications.tsx      # MODIFY: Replace role check for view access
    ManageProfile/
      ManageProfile.tsx      # MODIFY: Replace role check for view access
    Login/
      Login.js               # MODIFY: Replace role-based redirect with permission-based
    App/
      App.js                 # MODIFY: Replace role check for Curator_Self fetch guard
  pages/
    index.js                 # MODIFY: Replace role-based SSR redirect with permission-based
    search/index.js          # MODIFY: Replace SSR userRoles check with permissions check
types/
  menu.d.ts                  # MODIFY: Remove allowedRoleNames, add icon field
```

### Pattern 1: Icon Registry (D-01, D-03)

**What:** A static map from DB icon string names to MUI React icon components.
**When to use:** SideNavbar and MenuListItem need to resolve a string like `"Search"` from the DB to an actual `<SearchIcon />` component.

```typescript
// src/utils/iconRegistry.ts
// Source: D-01, D-03 from CONTEXT.md; MUI icons verified via node require
import SearchIcon from '@mui/icons-material/Search'
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary'
import AssessmentIcon from '@mui/icons-material/Assessment'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import GroupIcon from '@mui/icons-material/Group'
import SettingsIcon from '@mui/icons-material/Settings'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import { SvgIconComponent } from '@mui/icons-material'

const iconRegistry: Record<string, SvgIconComponent> = {
  Search: SearchIcon,
  LocalLibrary: LocalLibraryIcon,
  Assessment: AssessmentIcon,
  NotificationsActive: NotificationsActiveIcon,
  AccountCircle: AccountCircleIcon,
  Group: GroupIcon,
  Settings: SettingsIcon,
}

/** Resolve a DB icon string to an MUI icon component. Falls back to HelpOutlineIcon. */
export function getIcon(name: string | null | undefined): SvgIconComponent {
  if (!name) return HelpOutlineIcon
  return iconRegistry[name] || HelpOutlineIcon
}

export default iconRegistry
```

[VERIFIED: All 7 MUI icon names resolve correctly in @mui/icons-material 5.0.5]

### Pattern 2: Data-Driven Nav Rendering (D-04, D-07)

**What:** SideNavbar reads `permissionResources` from session, filters for nav items, sorts by displayOrder, and renders dynamically.
**When to use:** Replacing the hardcoded `menuItems` array.

```typescript
// Conceptual pattern for SideNavbar.tsx
// Source: D-04, D-07 from CONTEXT.md; session shape from [...nextauth].jsx

// Parse permissionResources from session (JSON-stringified in JWT)
const rawResources = session?.data?.permissionResources
let navItems = []
try {
  const allResources = typeof rawResources === 'string' 
    ? JSON.parse(rawResources) 
    : (rawResources || [])
  navItems = allResources
    .filter(r => r.resourceType === 'nav')
    .sort((a, b) => a.displayOrder - b.displayOrder)
} catch {
  navItems = []
}

// Special cases per D-07 and D-08:
// - Curate Publications: disabled when no identity selected (Object.keys(filters).length === 0)
// - Curate Publications route for Curator_Self: append personIdentifier
// - Manage Notifications: additional isVisibleNotification AND email checks
// - Manage Profile route: append personIdentifier
```

### Pattern 3: usePermissions Hook (Claude's Discretion)

**What:** A convenience hook that parses permissions once and memoizes the result.
**Recommendation:** Create this hook. It eliminates repeated `getPermissionsFromRaw(session.data.permissions)` calls and provides a clean API.

```typescript
// src/hooks/usePermissions.ts
import { useMemo } from 'react'
import { useSession } from 'next-auth/client'
import { getPermissionsFromRaw, hasPermission } from '../utils/permissionUtils'

export function usePermissions() {
  const [session] = useSession()
  
  const permissions = useMemo(
    () => getPermissionsFromRaw(session?.data?.permissions),
    [session?.data?.permissions]
  )

  const permissionResources = useMemo(() => {
    try {
      const raw = session?.data?.permissionResources
      return typeof raw === 'string' ? JSON.parse(raw) : (raw || [])
    } catch {
      return []
    }
  }, [session?.data?.permissionResources])

  const check = (key: string) => hasPermission(permissions, key)

  return { permissions, permissionResources, hasPermission: check, session }
}
```

### Pattern 4: Role-to-Permission Conversion (D-13)

**What:** The mechanical replacement pattern for all 12+ files.
**Before (current):**
```typescript
let userPermissions = JSON.parse(session.data.userRoles);
if (userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser)) { ... }
if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) { ... }
```

**After (target):**
```typescript
const permissions = getPermissionsFromRaw(session.data.permissions)
if (hasPermission(permissions, 'canManageUsers')) { ... }  // was Superuser check
if (hasPermission(permissions, 'canCurate')) { ... }       // was Curator_Self/All check
```

**Critical mapping (role-label checks to permission-key checks):**

| Old Role Check | New Permission Check | Notes |
|---------------|---------------------|-------|
| `Superuser` | `canManageUsers` or `canConfigure` | Context-dependent: use the specific capability being checked |
| `Curator_All` | `canCurate` + `canSearch` | Curator_All has both permissions per seed data |
| `Curator_Self` | `canCurate` (+ self-only detection via roles) | Self-only still needs role check for scope |
| `Reporter_All` | `canReport` + `canSearch` | Reporter_All has both per seed data |
| `Department_user` | `canManageNotifications` or `canManageProfile` | Context-dependent |

### Pattern 5: Updated MenuItem Type (D-05)

**What:** Replace the `allowedRoleNames` property with data from permissionResources.
```typescript
// types/menu.d.ts (updated)
export type MenuItem = {
  title: string
  to?: Url
  nestedMenu?: Array<MenuItem>
  id?: number
  icon?: string          // MUI icon name from DB (new)
  disabled?: boolean
  permissionKey?: string // Permission key from DB (new, replaces allowedRoleNames)
}
```

### Anti-Patterns to Avoid

- **Mixing old and new patterns:** Do NOT keep `allowedRoleNames` checks alongside `hasPermission()` in the same file. Convert completely per file.
- **Hardcoding permission keys in multiple places:** Use the DB-provided `permissionResources` for nav items. Only use explicit `hasPermission(p, 'canXxx')` for non-nav visibility checks (e.g., email visibility in Profile.tsx).
- **Checking roles when permissions suffice:** The only case where roles are still needed is self-only Curator_Self detection (to distinguish from Curator_All who also has canCurate). This already lives in middleware.ts; UI components should rely on permissions.
- **Forgetting JSON.parse for session data:** `session.data.permissions` and `session.data.permissionResources` are JSON-stringified in the JWT callback. Always parse before use. The `usePermissions()` hook handles this centrally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission checking | Custom role-matching logic | `hasPermission()` from permissionUtils.ts | Already tested (18 test cases), handles null/undefined, isomorphic |
| Permission parsing | Manual JSON.parse with try/catch | `getPermissionsFromRaw()` from permissionUtils.ts | Handles all edge cases (null, empty, invalid JSON) |
| Landing page resolution | Inline role-label cascade | `getLandingPageFromPermissions()` from permissionUtils.ts | Handles Curator_Self priority, baseline fallback |
| Icon resolution | Switch/case or if/else chains | `getIcon()` from iconRegistry.ts (new) | Central registry, fallback icon, type-safe |

**Key insight:** The permissionUtils.ts helpers already exist and are tested. This phase is about USING them everywhere, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: Curator_Self Route Appending
**What goes wrong:** The Curate Publications nav item has route `/curate` in the DB, but Curator_Self users need `/curate/{personIdentifier}` appended.
**Why it happens:** The DB stores a generic route, but user-specific routing requires runtime data.
**How to avoid:** When rendering the nav, check if the route is `/curate` and the user is self-only (has canCurate but no canSearch -- or check roles for Curator_Self). Append `session.data.username` (which is personIdentifier per the JWT callback).
**Warning signs:** Curator_Self users clicking Curate nav item and getting a 404 or redirect loop.

### Pitfall 2: FilterReview.tsx and Search.js Role Cascades
**What goes wrong:** These files have 150+ lines of nested if/else cascades checking every role combination. A naive conversion might replicate this complexity.
**Why it happens:** The old pattern checked role labels (Superuser vs Curator_All vs Curator_Self vs Reporter_All and every combination). With permissions, the logic simplifies dramatically.
**How to avoid:** Map the BEHAVIOR being gated, not the role combination. Example: "Show Curate Publications button" = `hasPermission(p, 'canCurate')`. "Show Create Reports button" = `hasPermission(p, 'canReport')`. The 150-line cascade collapses to 2-3 permission checks.
**Warning signs:** If the converted code is still longer than 20 lines for dropdown logic, it's over-thinking it.

### Pitfall 3: Manage Notifications Triple-Check (D-08)
**What goes wrong:** Notifications nav item disappears for users who should see it, or appears for users who should not.
**Why it happens:** D-08 requires THREE conditions: (1) `hasPermission(p, 'canManageNotifications')`, (2) admin settings `isVisibleNotification` is true, (3) `session.data.email` exists. Missing any condition breaks the feature.
**How to avoid:** Check all three conditions explicitly when filtering nav items with the `nav_notifications` resourceKey.
**Warning signs:** Notification nav item visible to users without the permission, or invisible to Superusers who have it.

### Pitfall 4: Profile.tsx Email Visibility
**What goes wrong:** Emails section in Profile modal hidden for users who should see it.
**Why it happens:** Current code checks `allowedPermissions.Superuser || allowedPermissions.Curator_Self` but the `||` is evaluated as string concatenation, not as an OR condition. The check is actually buggy today -- it only checks for Superuser.
**How to avoid:** Convert to `hasPermission(p, 'canCurate') || hasPermission(p, 'canManageUsers')` (or whatever permission the behavior should map to). Verify with the user if the intent is "curators see emails" or "only admins see emails."
**Warning signs:** The existing behavior was broken. Confirm intended behavior during implementation.

### Pitfall 5: SSR Pages (index.js, search/index.js) Use getServerSideProps
**What goes wrong:** Server-side code in `getServerSideProps` does not have access to `permissionUtils.ts` the same way client components do.
**Why it happens:** These files run in Node.js at request time, not in the browser.
**How to avoid:** `permissionUtils.ts` is isomorphic (documented in its header comment). It can be imported and used directly in `getServerSideProps`. The session object from `getSession(ctx)` has `session.data.permissions` available.
**Warning signs:** Import errors or "window is not defined" in SSR context (should not happen with permissionUtils.ts since it has no browser-only imports).

### Pitfall 6: MenuListItem Icon Prop Change
**What goes wrong:** MenuListItem currently accepts `imgUrl` and `imgUrlActive` as PNG imports and renders them via `<Image>`.
**Why it happens:** The component was designed for static image assets.
**How to avoid:** Update MenuListItem to accept a MUI icon component (or icon name string) and render it via `<IconComponent />` instead of `<Image>`. The active state is handled via MUI's existing CSS (orange background already changes icon color via `MuiListItemIcon-root` styling in StyledList).
**Warning signs:** If PNG `<Image>` rendering is still in MenuListItem after conversion, the icon swap is incomplete.

## Code Examples

### Example 1: SideNavbar Data-Driven Rendering

```typescript
// Source: Codebase analysis of SideNavbar.tsx + D-04/D-07/D-08
// Illustrative pattern -- not copy-paste ready

import { getIcon } from '../../../utils/iconRegistry'
import { getPermissionsFromRaw, hasPermission } from '../../../utils/permissionUtils'

// Inside SideNavbar component:
const permissions = getPermissionsFromRaw(session?.data?.permissions)

// Parse permissionResources from session
let navItems = []
try {
  const raw = session?.data?.permissionResources
  const allResources = typeof raw === 'string' ? JSON.parse(raw) : (raw || [])
  navItems = allResources
    .filter(r => r.resourceType === 'nav')
    .sort((a, b) => a.displayOrder - b.displayOrder)
} catch {
  navItems = []
}

// Render with special-case handling
navItems.map((item, index) => {
  // D-07: Permission controls visibility
  if (!hasPermission(permissions, item.permissionKey)) return null

  // D-08: Manage Notifications has extra visibility conditions
  if (item.resourceKey === 'nav_notifications') {
    if (!isVisibleNotification || !session.data.email) return null
  }

  // Route adjustment for user-specific pages
  let route = item.route
  if (item.resourceKey === 'nav_curate') {
    // Curate needs personIdentifier for self-only users
    route = (Object.keys(filters).length > 0) ? `/curate/${filters.personIdentifier || ''}` : item.route
  }
  if (item.resourceKey === 'nav_notifications' || item.resourceKey === 'nav_profile') {
    route = `${item.route}/${session.data.username}`
  }

  // D-07: Application state controls disabled
  const disabled = item.resourceKey === 'nav_curate' && Object.keys(filters).length === 0

  const IconComponent = getIcon(item.icon)

  return (
    <MenuListItem
      title={item.label}
      key={item.resourceKey}
      id={index}
      to={route}
      icon={IconComponent}
      disabled={disabled}
    />
  )
})
```

### Example 2: ReciterTabs Permission Check

```typescript
// Source: D-09 from CONTEXT.md
// Replace allowedRoleNames check with single permission check

import { getPermissionsFromRaw, hasPermission } from '../../../utils/permissionUtils'

// In ReciterTabs:
const permissions = getPermissionsFromRaw(session?.data?.permissions)
const canCurate = hasPermission(permissions, 'canCurate')

// Tab rendering -- no per-tab role check needed
// Remove allowedRoleNames from tabsData entirely
const tabsData = [
  { name: 'Suggested', value: 'NULL' },
  { name: 'Accepted', value: 'ACCEPTED' },
  { name: 'Rejected', value: 'REJECTED' },
  { name: addnewtabName, value: 'addNewRecord' },
  { name: pubMedTabName, value: 'AddPub' },
]

// Gate the entire tab set
if (!canCurate) return null  // or a "no permission" message
```

### Example 3: Simplified FilterReview Dropdown Logic

```typescript
// Source: Codebase analysis of FilterReview.tsx role cascade
// The 150-line cascade simplifies to permission checks

const permissions = getPermissionsFromRaw(session?.data?.permissions)
const canCurate = hasPermission(permissions, 'canCurate')
const canReport = hasPermission(permissions, 'canReport')

// Dropdown behavior:
// - Can curate AND report: SplitDropdown with "Curate Publications" + "Create Reports"
// - Can curate only: Single "Curate Publications" button
// - Can report only: Single "Create Report" button
// - Neither: null (shouldn't reach this page)
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (via next/jest) |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern permissionUtils` |
| Full suite command | `npx jest` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | SideNavbar renders from permissionResources | manual-only | N/A (requires browser session) | N/A |
| UI-02 | Nav icons/labels/routes/ordering from DB | unit | `npx jest --testPathPattern iconRegistry` | Wave 0 |
| UI-03 | ReciterTabs uses hasPermission not allowedRoleNames | manual-only | N/A (requires browser session) | N/A |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern permissionUtils`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green + Playwright visual verification of nav and tabs

### Wave 0 Gaps
- [ ] `__tests__/iconRegistry.test.ts` -- covers UI-02 (icon resolution, fallback behavior)
- [ ] Playwright test: Curator_Self nav items (manual verification via Playwright MCP)
- [ ] Playwright test: Superuser nav items (manual verification via Playwright MCP)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Already handled by next-auth (Phase 15) |
| V3 Session Management | no | JWT session unchanged |
| V4 Access Control | yes | `hasPermission()` from permissionUtils.ts -- client-side gating complements server-side middleware enforcement (Phase 15) |
| V5 Input Validation | yes | JSON.parse of session data uses `getPermissionsFromRaw()` which handles invalid input defensively |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-side permission bypass | Elevation of Privilege | UI gating is supplementary. Server-side middleware (Phase 15) + API route auth headers are the enforcement layer. Client-side checks are UX, not security. |
| Tampered permissionResources in JWT | Tampering | JWT is signed by next-auth with `NEXT_PUBLIC_RECITER_TOKEN_SECRET`. Client cannot modify claims. |
| Missing permission fallback showing unauthorized content | Information Disclosure | `getPermissionsFromRaw()` returns empty array on any error. `hasPermission()` returns false for empty array. Default-deny behavior. |

[VERIFIED: permissionUtils.ts defensive behavior confirmed via existing test suite]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Profile.tsx email visibility should map to `canCurate` permission (currently buggy -- checks Superuser OR Curator_Self but the OR operator evaluates wrong) | Pitfall 4 | Emails shown to wrong users or hidden from right users. Low severity -- Profile modal is already behind auth. |
| A2 | FilterReview.tsx and Search.js role cascades can collapse to 2-3 permission checks without losing behavior | Pitfall 2 | If some role combination produced unique behavior not captured by permissions, it would be lost. Verified against seed data: all role combinations map cleanly to permission sets. |
| A3 | `SvgIconComponent` type from `@mui/icons-material` is the correct type for MUI 5 icon components | Pattern 1 | Type error at compile time. Easily fixable -- fallback to `React.ComponentType<SvgIconProps>`. |

## Open Questions

1. **Profile.tsx email visibility intent**
   - What we know: Current code has a bug where the OR check evaluates as string concatenation. Only Superuser actually passes.
   - What's unclear: Should curators (canCurate) also see emails, or only admins (canManageUsers)?
   - Recommendation: Convert to `hasPermission(p, 'canCurate')` to match apparent original intent (both Superuser and Curator_Self were listed). Flag for review during implementation.

2. **NestedListItem future usage**
   - What we know: NestedListItem handles expandable sub-menus. Current code has it commented out in the SideNavbar menuItems array.
   - What's unclear: Whether to keep the component or simplify since no nested menus are in the current seed data.
   - Recommendation: Keep and convert it (per D-06) for forward compatibility. It costs little to maintain.

3. **constants.js allowedPermissions removal**
   - What we know: `allowedPermissions` is used in 10+ files. Phase 18 (Cleanup) is planned for removing old code.
   - What's unclear: Whether to remove the import or just stop using it in this phase.
   - Recommendation: Remove imports of `allowedPermissions` from converted files. Leave the export in constants.js for now (Phase 18 will clean it up). Add a `@deprecated` JSDoc comment.

## Sources

### Primary (HIGH confidence)
- Codebase read: `src/components/elements/Navbar/SideNavbar.tsx` -- current hardcoded nav items (7 items, PNG icons, allowedRoleNames)
- Codebase read: `src/components/elements/Navbar/NestedListItem.tsx` -- current role-check pattern
- Codebase read: `src/components/elements/CurateIndividual/ReciterTabs.tsx` -- 5 tabs with allowedRoleNames
- Codebase read: `src/utils/permissionUtils.ts` -- hasPermission(), getPermissionsFromRaw(), getLandingPageFromPermissions()
- Codebase read: `src/db/models/AdminPermissionResource.ts` -- Sequelize model (permissionID, resourceType, resourceKey, displayOrder, icon, label, route)
- Codebase read: `src/db/migrations/add-permission-tables.sql` -- 7 nav resource seed rows with icon names
- Codebase read: `src/pages/api/auth/[...nextauth].jsx` -- JWT callback stringifying permissions and permissionResources
- Codebase read: `src/middleware.ts` -- ROUTE_PERMISSIONS map (Phase 15) for reference
- Codebase read: `types/menu.d.ts` -- current MenuItem type with allowedRoleNames
- Codebase read: All 12 files listed in D-12 scope
- Node.js verification: All 7 MUI icon names resolve in @mui/icons-material 5.0.5
- Codebase grep: 12 source files + 1 type file confirmed matching D-12 file list

### Secondary (MEDIUM confidence)
- `__tests__/permissionUtils.test.ts` -- 18 existing tests validating permission utility behavior
- `jest.config.js` -- Jest test infrastructure via next/jest

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all verified in node_modules
- Architecture: HIGH -- patterns derive directly from locked CONTEXT.md decisions and verified codebase state
- Pitfalls: HIGH -- identified through direct code reading of all 13 files in scope

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable -- no external dependencies changing)
