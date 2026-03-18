---
phase: 01-search-result-filtering
plan: 01
subsystem: auth
tags: [jwt, capability-model, saml, next-auth, edge-middleware, rbac]

# Dependency graph
requires: []
provides:
  - "Isomorphic getCapabilities(roles) utility for deriving route-level capabilities from JWT roles"
  - "getLandingPage(caps) utility for determining correct redirect destination"
  - "ROLE_CAPABILITIES mapping (Superuser, Curator_All, Curator_Self, Reporter_All)"
  - "Capability-based Edge middleware (zero role-count comparisons)"
  - "SAML auto-create with status=1 for users without admin_users rows"
  - "Unified NextAuth JWT callback for both SAML and local auth"
  - "[AUTH] prefix logging throughout auth flow"
affects: [02-search-result-filtering, phase-2-ui-ux-audit, phase-3-scoped-roles]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capability-based permission model: getCapabilities(roles) returns {canCurate, canReport, canSearch, canManageUsers, canConfigure}"
    - "canCurate uses scope metadata: {all: boolean, self: boolean, personIdentifier: string} for future Phase 3 scoped roles"
    - "Baseline access: any authenticated user gets canReport + canSearch even with no explicit roles"
    - "Capabilities derived at check time from JWT roles, never stored in JWT"

key-files:
  created: []
  modified:
    - "src/utils/constants.js"
    - "src/middleware.ts"
    - "src/pages/api/auth/[...nextauth].jsx"
    - "src/pages/index.js"
    - "src/components/elements/Navbar/SideNavbar.tsx"
    - "controllers/db/admin.users.controller.ts"
    - "types/menu.d.ts"

key-decisions:
  - "Baseline access grants canReport + canSearch to all authenticated users even with zero roles"
  - "findOnePerson only accepts uid (not email), so SAML auto-create uses CWID-only for person table matching"
  - "Notifications menu hidden via capabilityKey=canNotifications (always false) until notification feature is ready"

patterns-established:
  - "Capability model pattern: getCapabilities(roles) as single source of truth for Edge middleware, Node API routes, and React components"
  - "Auth logging pattern: all auth events use [AUTH] prefix for easy grep/CloudWatch filtering"
  - "Menu visibility pattern: capabilityKey on MenuItem type replaces allowedRoleNames array"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 1 Plan 01: Capability-Based Auth Model Summary

**Isomorphic getCapabilities(roles) utility replacing 100+ lines of brittle role-count middleware with capability-based routing, plus SAML auto-create and unified auth logging**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T22:32:59Z
- **Completed:** 2026-03-16T22:37:38Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Replaced brittle role-count middleware (userRoles.length == 1, 2, 3 checks) with capability-based routing that handles any role combination
- Created isomorphic getCapabilities(roles) and getLandingPage(caps) utilities shared across Edge middleware, server-side props, and React components
- Added SAML auto-create (findOrCreateSamlUser) that creates admin_users with status=1 for new SAML users, enabling baseline access without manual provisioning
- Added [AUTH] prefix logging throughout auth flow (15 log points in NextAuth, 6 redirect logs in middleware)
- Reduced index.js redirect logic from ~100 duplicated lines to ~20 lines
- SideNavbar menu filtering now uses capability keys instead of role-label matching

## Task Commits

Each task was committed atomically:

1. **Task 1: Create capability model and refactor auth flow** - `039ad88` (feat)
2. **Task 2: Refactor middleware, index.js, and SideNavbar to use capability model** - `ef29d93` (feat)

## Files Created/Modified
- `src/utils/constants.js` - Added ROLE_CAPABILITIES mapping, getCapabilities(), getLandingPage()
- `src/middleware.ts` - Complete rewrite: capability-based routing replacing role-count comparisons
- `src/pages/api/auth/[...nextauth].jsx` - SAML auto-create, unified JWT callback, [AUTH] logging
- `src/pages/index.js` - Simplified redirect using getCapabilities() + getLandingPage()
- `src/components/elements/Navbar/SideNavbar.tsx` - capabilityKey-based menu filtering
- `controllers/db/admin.users.controller.ts` - Added findOrCreateSamlUser (status=1)
- `types/menu.d.ts` - Added capabilityKey field to MenuItem type

## Decisions Made
- findOnePerson only accepts uid parameter (not email), so SAML auto-create skips email-based person lookup and uses CWID-only matching. If a future need arises to match by email, findOnePerson would need an email overload.
- Notifications menu item kept in SideNavbar but hidden via capabilityKey='canNotifications' (always returns false) until notification functionality is implemented.
- Baseline access (canReport + canSearch) granted even with empty roles array, aligning with CONTEXT.md decision for SAML auto-created users.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Capability model is in place and ready for consumption by Plan 02 (search page fixes, profile modal, skeleton loading)
- canCurate scope metadata ({all, self, personIdentifier}) prepares for Phase 3 scoped roles without requiring schema changes
- All auth logging in place for debugging production issues

## Self-Check: PASSED

All 8 files verified present. Both task commits (039ad88, ef29d93) verified in git log.

---
*Phase: 01-search-result-filtering*
*Completed: 2026-03-16*
