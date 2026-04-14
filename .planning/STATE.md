---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Feature Port to Next.js 14
status: executing
stopped_at: Phase 15 UI-SPEC approved
last_updated: "2026-04-14T19:07:29.338Z"
last_activity: 2026-04-14
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-14)

**Core value:** Curators and administrators can reliably log in, navigate without broken UI, and have fine-grained control over who curates publications for which groups of people.
**Current focus:** Phase 15 — auth-and-middleware

## Current Position

Phase: 15
Plan: Not started
Status: Executing Phase 15
Last activity: 2026-04-14

```
v1.3 Data-Driven RBAC
[████................] 20% (1/5 phases)

Phase 14: Permission Tables and Models  ✓
Phase 15: Auth and Middleware  <-- next
Phase 16: Data-Driven UI
Phase 17: Admin CRUD
Phase 18: Cleanup
```

## Accumulated Context

### Decisions

- [v1.2] Standalone SP had wrong percentile logic; fixed to match canonical peer-based version
- [v1.2] SP must be SOURCE'd and CALL'd on EACH database separately (MySQL SPs are database-scoped)
- [v1.1] Archived at 92% complete (Phase 11 executing). Core feature port functional.
- [v1.1/Phase 08]: Restored simple (attrValue, attrType) signature for findUserPermissions
- [v1.1/Phase 08]: JWT callback stores roles-only in token.userRoles, scope/proxy as separate claims
- [v1.1/Phase 08]: Use getToken() from next-auth/jwt for verified JWT in Edge middleware
- [v1.1/Phase 09]: scopeResolver, AdminUsersPersonType, AdminUsersProxy models ported
- [v1.1/Phase 10]: checkCurationScope.ts centralizes scope enforcement for all curation API routes
- [v1.3] Design spec approved: docs/superpowers/specs/2026-04-14-data-driven-rbac-design.md
- [v1.3] Implementation plan written: docs/superpowers/plans/2026-04-14-data-driven-rbac.md
- [v1.3] Roadmap created: 5 phases (14-18), 33 requirements mapped

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-14T17:31:18.158Z
Stopped at: Phase 15 UI-SPEC approved
Resume file: .planning/phases/15-auth-and-middleware/15-UI-SPEC.md
