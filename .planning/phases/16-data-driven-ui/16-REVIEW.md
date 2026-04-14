---
phase: 16-data-driven-ui
status: issues_found
depth: standard
files_reviewed: 18
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
---

# Code Review: Phase 16 — Data-Driven UI

## Critical

### CR-001 (critical)
**File:** `src/components/elements/Notifications/Notifications.tsx`
**Line:** 76-78
**Issue:** When `router.query.userId !== session.data.username` (admin viewing another user's notification page), the `else` branch unconditionally sets `isCuratorSelf = true`. Because the render gate at line 160 is `(isCuratorSelf || isSuperUserORCuratorAll)`, any authenticated user who reaches `/notifications/[anyOtherId]` sees the full notification preferences form. The access check fails to distinguish "viewing your own page" from "viewing someone else's page". Same flaw exists in `ManageProfile.tsx` lines 51-53.
**Fix:** The `else` block should only grant access if the user has a broader role. Replace unconditional `setIsCuratorSelf(true)` with a `canManageUsers` check. Apply same fix in ManageProfile.tsx.

## Warnings

### WR-001 (warning)
**File:** `src/components/elements/Navbar/SideNavbar.tsx`
**Line:** 160
**Issue:** `useEffect(() => { ... }, [])` fires on mount when `session` from `usePermissions()` is still `undefined`. `JSON.parse(JSON.stringify(session?.adminSettings))` with `undefined` input throws `SyntaxError`, crashing SideNavbar on every page load before session resolves.
**Fix:** Guard the effect body: `if (!session?.adminSettings) return;` as the first line.

### WR-002 (warning)
**File:** `src/components/elements/ManageProfile/ManageProfile.tsx`
**Line:** 41-53
**Issue:** Identical logic flaw to CR-001. `router.query.userId !== session.data.username` branch sets `isCuratorSelf = true` unconditionally, allowing any authenticated user to see and interact with the ORCID management form for any other user's profile.
**Fix:** Same fix as CR-001 -- only set `isSuperUserORCuratorAll` if `canManageUsers` is true.

### WR-003 (warning)
**File:** `src/components/elements/Search/Search.js`
**Line:** 80
**Issue:** `JSON.parse(session.adminSettings)` has no optional chaining. All equivalent reads elsewhere use `session?.adminSettings`. If `session` is null when the `useEffect` fires, this throws `TypeError` and crashes the Search page.
**Fix:** Change to `JSON.parse(session?.adminSettings)` and add null guard at top of effect.

### WR-004 (warning)
**File:** `src/components/elements/Navbar/MenuListItem.tsx`
**Line:** 19
**Issue:** `const selected = to.includes(pathName)` -- `to` is typed as `Url` (string | UrlObject). If `to` is a `UrlObject`, `.includes()` throws `TypeError`. While current SideNavbar only constructs string routes, the type contract allows non-string values.
**Fix:** Add type guard: `const selected = typeof to === 'string' && to.includes(pathName)`.

## Info

### IR-001 (info)
**File:** `src/utils/constants.js`
**Lines:** 65-71
**Issue:** `dropdownItemsSuper` and `dropdownItemsReport` are now dead exports after Phase 16 converted Search.js and FilterReview.tsx to build dropdown items inline. No `@deprecated` JSDoc comment unlike `allowedPermissions`.
**Fix:** Add `@deprecated` JSDoc comments or remove if no remaining consumers.

### IR-002 (info)
**File:** `src/hooks/usePermissions.ts`
**Line:** 19
**Issue:** `useMemo` dependency casts `session` to `any`, bypassing TypeScript type checking. If session type changes, this silently breaks without compile error.
**Fix:** Document why `as any` is required (next-auth v3 typing limitation) or define a local interface.
