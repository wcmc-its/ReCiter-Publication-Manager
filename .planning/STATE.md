---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Feature Port to Next.js 14
status: planning
stopped_at: Phase 7 context gathered
last_updated: "2026-03-18T16:34:55.491Z"
last_activity: 2026-03-18 — Roadmap created for v1.1 milestone (22 requirements, 5 phases)
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Curators and administrators can reliably log in, navigate without broken UI, and have fine-grained control over who curates publications for which groups of people.
**Current focus:** Phase 7 — Foundation (models, utilities, constants, DDL)

## Current Position

Phase: 7 of 11 (Foundation)
Plan: --
Status: Ready to plan Phase 7
Last activity: 2026-03-18 — Roadmap created for v1.1 milestone (22 requirements, 5 phases)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v1.0 baseline):**
- Total plans completed: 17
- Average duration: ~45 min
- Total execution time: ~12.5 hours

**v1.1 plans:** TBD (estimated 10-15 based on v1.0 velocity)

## Accumulated Context

### Decisions

- Port to NextJS14 branch from origin/dev_Upd_NextJS14SNode18 (new working branch)
- next-auth v4 callback signatures are breaking changes — do NOT copy v1.0 [...nextauth].jsx verbatim
- SAML cookie-bridge flow must be enriched, not replaced
- AdminSettings now loads via Redux in _app.tsx (not session); components must adapt
- Sequelize models need SWC-safe modelName property (new constraint vs v1.0)
- DB-01 DDL must go to ReCiterDB repo AND both dev and prod databases

### Blockers/Concerns

- Phase 9: NextJS14 has a completely redesigned MUI UI — v1.0 components may need style adaptation beyond framework changes. Investigate component integration before coding.
- Phase 8: SAML cookie-bridge flow differs enough from v1.0 inline assertion flow that manual SAML testing is essential.

## Session Continuity

Last session: 2026-03-18T16:34:55.489Z
Stopped at: Phase 7 context gathered
Resume file: .planning/phases/07-foundation/07-CONTEXT.md
