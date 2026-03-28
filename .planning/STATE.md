---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Feature Port to Next.js 14
status: executing
stopped_at: Completed 09-03-PLAN.md
last_updated: "2026-03-28T05:07:52.716Z"
last_activity: 2026-03-28
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 2
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** Curators and administrators can reliably log in, navigate without broken UI, and have fine-grained control over who curates publications for which groups of people.
**Current focus:** Phase 09 — scoped-roles-and-proxy-ui

## Current Position

Phase: 09 (scoped-roles-and-proxy-ui) — EXECUTING
Plan: 3 of 4
Status: Ready to execute
Last activity: 2026-03-28

## Accumulated Context

### Decisions

- [v1.2] Standalone SP had wrong percentile logic; fixed to match canonical peer-based version
- [v1.2] SP must be SOURCE'd and CALL'd on EACH database separately (MySQL SPs are database-scoped)
- [v1.1] Paused at Phase 7 complete. Phases 8-11 remain.
- [Phase 08]: Restored simple (attrValue, attrType) signature for findUserPermissions, fixing broken array-param mismatch on feature branch
- [Phase 08]: JWT callback stores roles-only in token.userRoles, scope/proxy as separate claims (D-01), ensuring existing consumers read roles-only array unchanged (D-03)
- [Phase 08]: Use getToken() from next-auth/jwt for verified JWT in Edge middleware instead of jose.decodeJwt (D-09)
- [Phase 08]: Curator_Scoped gets NextResponse.next() on /curate; person-level scope enforcement deferred to API layer (Phase 10)

- [Phase 09]: parseJsonColumn helper for robust MySQL/MariaDB JSON column parsing (typeof check before JSON.parse)
- [Phase 09]: scopePersonTypes uses left JOIN when proxyPersonIds present so proxy persons bypass person type filter
- [Phase 09]: listAllUsers uses unique alias (listRoles/listRole) for role label JOIN to avoid Sequelize association conflicts
- [Phase 09]: ProxyBadge rendered inline via proxyPersonIds prop pass-through to Name component
- [Phase 09]: Scope filter re-trigger uses useEffect with skipInit ref to avoid double initial load
- [Phase 09]: Session type (next-auth.d.ts) extended with scopeData and proxyPersonIds fields

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-28T05:07:52.714Z
Stopped at: Completed 09-03-PLAN.md
Resume file: None
