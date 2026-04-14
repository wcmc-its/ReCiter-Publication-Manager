# Phase 16: Data-Driven UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 16-data-driven-ui
**Areas discussed:** Icon strategy, Mixed visibility rules, Deleted features scope, Role-check cleanup breadth

---

## Icon Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Switch to MUI icons | Use MUI icon names from DB directly via icon registry. Cleaner, scalable, no PNG maintenance. | :heavy_check_mark: |
| Keep PNG images via registry | Map DB icon keys to existing PNG imports. Preserves current visual look. | |
| You decide | Claude picks best approach. | |

**User's choice:** Switch to MUI icons
**Notes:** DB seed already stores MUI icon names (Search, LocalLibrary, Assessment, NotificationsActive, AccountCircle, Group, Settings). Small icon registry maps strings to MUI components.

---

## Mixed Visibility Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Permission gates, state disables | No permission = hidden. Has permission but state not ready = visible but disabled/grayed. | :heavy_check_mark: |
| Both must pass to show | Nav item hidden unless BOTH permission AND state conditions met. | |
| You decide | Claude picks best UX pattern. | |

**User's choice:** Permission gates, state disables
**Notes:** Clean separation of concerns. Permission controls show/hide, application state controls enabled/disabled.

---

## Deleted Features Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Skip UI-04 and UI-05 for now | These features belong to v1.1 proxy/scope system which is paused. Focus on core 3 requirements. | :heavy_check_mark: |
| Recreate with permissions now | Rebuild checkCurationScope.ts and Grant Proxy button using new permission model. | |
| Stub only | Create files with permission-based signatures but minimal implementation. | |

**User's choice:** Skip UI-04 and UI-05 for now
**Notes:** GrantProxyModal.tsx, checkCurationScope.ts, ScopeLabel.tsx, ProxyBadge.tsx, scopeResolver.ts all deleted in Phase 14 commit. Will be rebuilt with permission model when v1.1 proxy work resumes.

---

## Role-Check Cleanup Breadth

| Option | Description | Selected |
|--------|-------------|----------|
| All role checks in UI components | Convert all 14 files from role-based to permission-based checks. Clean sweep. | :heavy_check_mark: |
| Requirements only (SideNavbar + ReciterTabs) | Strictly UI-01/02/03. Other files keep allowedRoleNames. | |
| Requirements + NestedListItem | SideNavbar, ReciterTabs, and NestedListItem only. | |

**User's choice:** All role checks in UI components
**Notes:** Full sweep across all 14 files. Phase 18 (Cleanup) then only needs to remove dead constants, not fix remaining UI checks.

---

## Claude's Discretion

- Icon registry file structure and typing approach
- Whether to create a shared `usePermissions()` hook
- Curate Publications route dynamic segment handling for Curator_Self
- Error/fallback behavior for malformed permissionResources
- allowedPermissions constant handling (update vs defer to Phase 18)

## Deferred Ideas

- UI-04 (Grant Proxy button) -- rebuild when v1.1 resumes
- UI-05 (checkCurationScope) -- rebuild when v1.1 resumes
- Per-tab permission resources -- future granularity
- Dynamic icon loading -- not needed for 7 static icons
