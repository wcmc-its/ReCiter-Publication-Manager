---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in-progress
stopped_at: Completed 03-02-PLAN.md
last_updated: "2026-03-17T16:03:00Z"
last_activity: "2026-03-17 -- Completed Plan 03-02 (auth pipeline & API scope enforcement)"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 11
  completed_plans: 8
  percent: 73
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** Curators and administrators can reliably log in, navigate without broken UI, and have fine-grained control over who curates publications for which groups of people.
**Current focus:** Phase 3 in progress -- Scoped Curation Roles. Plan 02 complete (auth pipeline & API scope enforcement).

## Current Position

Phase: 3 of 4 (Scoped Curation Roles) -- IN PROGRESS
Plan: 2 of 5 in current phase (03-02 complete)
Status: Executing Phase 3
Last activity: 2026-03-17 -- Completed Plan 03-02 (auth pipeline & API scope enforcement)

Progress: [███████░░░] 73%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 7min
- Total execution time: ~1.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 10min | 5min |
| 02 | 4 | 45min | 11min |
| 03 | 2 | 10min | 5min |

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 4min | 3 tasks | 5 files |
| Phase 01 P02 | 6min | 3 tasks | 12 files |
| Phase 02 P01 | 13min | 2 tasks | 8 files |
| Phase 02 P02 | multi-session | 3 tasks (1 checkpoint) | 5 files |
| Phase 02 P03 | 14min | 3 tasks | 20 files |
| Phase 02 P04 | 5min | 2 tasks | 4 files |
| Phase 03 P01 | 4min | 2 tasks | 6 files |
| Phase 03 P02 | 6min | 2 tasks | 8 files |

**Recent Trend:**
- Last 5 plans: multi-session, 14min, 5min, 4min, 6min
- Trend: Foundation/data-model plans fastest; audit plans slowest

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Auth fix is Phase 1 blocker; all other work depends on it
- [Roadmap]: UI bugs grouped with auth fix at coarse granularity (shared "fix what's broken" boundary)
- [Roadmap]: UI/UX audit (Phase 2) precedes scoped roles (Phase 3) so new UI follows audit patterns
- [01-01]: Baseline access grants canReport + canSearch to all authenticated users even with zero roles
- [01-01]: SAML auto-create uses CWID-only for person table matching (findOnePerson only accepts uid)
- [01-01]: Notifications menu hidden via capabilityKey=canNotifications (always false) until feature is ready
- [01-02]: SplitDropdown replaced with plain Button after Curate Publications removal (single action = no dropdown needed)
- [01-02]: canViewPII from getCapabilities replaces broken roleAccess OR logic for PII gating
- [01-02]: Purpose-built skeleton components (Table/Card/Profile/Form) rather than generic parameterized skeleton
- [01-02]: Loader.tsx preserved for modal contexts where skeleton would be inappropriate
- [02-01]: eslint-plugin-jsx-a11y@6.10.2 installed with strict mode and Button/Image/Link component mappings
- [02-01]: Resolutions field fixed from caret ranges to exact versions for npm 10 compatibility
- [02-01]: Individual Curation has 35 of 64 total a11y violations -- highest priority view for fixes
- [02-01]: Custom Tabs.js is single largest a11y debt (12+ violations, needs react-bootstrap replacement)
- [02-01]: Group Curation needs self-contained entry point (not Search page round-trip) per redesign analysis
- [02-02]: User approved all 10 Critical findings for fixing in Plan 03 (no items deprioritized)
- [02-02]: Notifications view audited despite being currently hidden -- findings apply when feature is enabled
- [02-02]: PATTERNS.md is authoritative design reference for all future UI work (Phase 3+)
- [02-02]: react-bootstrap for layout/forms/interaction; @mui/icons-material for icons only; CSS Modules for component-specific styling
- [02-03]: Jest 27.5.1 + @testing-library/react 12.1.5 for React 16 compatibility; next/jest for SWC transforms
- [02-03]: --legacy-peer-deps required for test dep install (React 16 + MUI 5 peer conflict)
- [02-03]: AdminSettings isVisible checkbox rendered unconditionally (was hidden when false, preventing toggle-on)
- [02-03]: Semantic <button> preferred over role="button"+tabIndex for onClick handlers (cleaner, less error-prone)
- [02-04]: Search.test.tsx requires applyMiddleware(thunk) due to thunk-based Redux actions dispatched on mount
- [02-04]: Mock config/local path is ../../config/local from __tests__/components/ (not ../../../config/local)
- [Phase 02]: Search.test.tsx requires applyMiddleware(thunk) due to thunk-based Redux actions dispatched on mount
- [Phase 02]: Mock config/local path is ../../config/local from __tests__/components/ (not ../../../config/local)
- [03-01]: scopeResolver.ts is a pure function (no DB access) usable in Edge middleware, Node API, and React
- [03-01]: Null dimension means no restriction on that axis (not empty array)
- [03-01]: AdminUsersPersonType uses STRING(128) for personType to match existing person_person_type patterns
- [03-02]: findUserPermissions returns { roles, scopeData } instead of flat roles array -- JWT callback handles with fallback parsing
- [03-02]: Scope data stored as JSON string in JWT token (token.scopeData) alongside existing token.userRoles
- [03-02]: Middleware defers person-level scope check to API layer for /curate/* routes (route allows, API enforces)
- [03-02]: getPersonWithTypes uses Sequelize models rather than raw SQL for consistency with person.controller patterns

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: Verify SAML certificate expiry before writing auth fix code; the /noaccess issue could be a certificate rotation problem
- [Research]: Confirm MySQL version supports CHECK constraints (8.0.16+ required) before Phase 3 schema work
- [02-01]: @axe-core/react deferred per user decision -- eslint-plugin-jsx-a11y provides static analysis coverage

## Session Continuity

Last session: 2026-03-17T16:03:00Z
Stopped at: Completed 03-02-PLAN.md
Resume file: .planning/phases/03-scoped-curation-roles/03-03-PLAN.md
