---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Feature Port to Next.js 14
status: verifying
stopped_at: Completed 08-02-PLAN.md
last_updated: "2026-03-27T12:12:07.022Z"
last_activity: 2026-03-27
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** Curators and administrators can reliably log in, navigate without broken UI, and have fine-grained control over who curates publications for which groups of people.
**Current focus:** Phase 08 — auth-pipeline

## Current Position

Phase: 08 (auth-pipeline) — EXECUTING
Plan: 2 of 2
Status: Phase complete — ready for verification
Last activity: 2026-03-27

## Accumulated Context

### Decisions

- [v1.2] Standalone SP had wrong percentile logic; fixed to match canonical peer-based version
- [v1.2] SP must be SOURCE'd and CALL'd on EACH database separately (MySQL SPs are database-scoped)
- [v1.1] Paused at Phase 7 complete. Phases 8-11 remain.
- [Phase 08]: Restored simple (attrValue, attrType) signature for findUserPermissions, fixing broken array-param mismatch on feature branch
- [Phase 08]: JWT callback stores roles-only in token.userRoles, scope/proxy as separate claims (D-01), ensuring existing consumers read roles-only array unchanged (D-03)
- [Phase 08]: Use getToken() from next-auth/jwt for verified JWT in Edge middleware instead of jose.decodeJwt (D-09)
- [Phase 08]: Curator_Scoped gets NextResponse.next() on /curate; person-level scope enforcement deferred to API layer (Phase 10)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-27T12:12:07.019Z
Stopped at: Completed 08-02-PLAN.md
Resume file: None
