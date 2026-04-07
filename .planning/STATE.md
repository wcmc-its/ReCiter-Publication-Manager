---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Feature Port to Next.js 14
status: executing
stopped_at: Completed 11-03-PLAN.md
last_updated: "2026-04-07T03:31:25.388Z"
last_activity: 2026-04-07
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 13
  completed_plans: 12
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** Curators and administrators can reliably log in, navigate without broken UI, and have fine-grained control over who curates publications for which groups of people.
**Current focus:** Phase 11 — polish-and-testing

## Current Position

Phase: 11 (polish-and-testing) — EXECUTING
Plan: 2 of 5
Status: Ready to execute
Last activity: 2026-04-07

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
- [Phase 09]: Reused viewProfileBtn CSS class for Grant Proxy button, derived canGrantProxy from caps.canCurate.all || caps.canManageUsers (D-07)

- [Phase 10]: checkCurationScope.ts centralizes scope enforcement for all 4 curation API routes (commit a14a1cb)
- [Phase 10]: Bypass cascade: Superuser/Curator_All → Curator_Self → Proxy → Scoped → 403
- [Phase 10]: GoldStandard audit source tag (&source=publication-manager) deferred — one-line gap

- [Ad-hoc]: Replaced npm-force-resolutions with npm native overrides; regenerated package-lock.json inside node:20-alpine to fix CodeBuild (f46b644)
- [Ad-hoc]: Proxy users can now curate for delegated targets — scope bypass applied correctly (926b054)
- [Ad-hoc]: Refresh call now includes useGoldStandard=AS_EVIDENCE parameter (d4de67c)
- [Ad-hoc]: Immutable parent updates + child re-sync so cards disappear on assert in Suggested tab (064a91f)
- [Phase 11]: Used eslint-disable for MUI Autocomplete li and Publication card onMouseDown -- framework-mandated non-interactive elements
- [Phase 11]: Replaced legacy Tabs.js ul/li/a Bootstrap tab pattern with div/button role=tab for strict a11y compliance
- [Phase 11]: Removed autoFocus from Login.js per jsx-a11y/no-autofocus strict rule

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-07T03:31:25.385Z
Stopped at: Completed 11-03-PLAN.md
Resume file: None
