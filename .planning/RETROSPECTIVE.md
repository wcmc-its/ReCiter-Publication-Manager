# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — RPM Bug Fixes, UI/UX Audit, Scoped Curation Roles, and Proxy Curation

**Shipped:** 2026-03-18
**Phases:** 6 | **Plans:** 17 | **Sessions:** ~8

### What Was Built
- Capability-based auth model replacing brittle role-count middleware with SAML auto-create
- Full UI/UX audit of all 8 views with PATTERNS.md design system and 33 a11y violations fixed
- Scoped curation roles — curators restricted by person type and/or org unit
- Many-to-many curation proxy assignments with [PROXY] badge, filter, and grant UI
- Jest test infrastructure with React 16 compatible stack
- Proxy API scope enforcement for userfeedback and goldstandard endpoints

### What Worked
- Coarse phase granularity (4 main phases + 2 gap closure) kept context focused
- Capability model (getCapabilities) proved to be a clean abstraction that simplified all downstream phases
- UI/UX audit before new UI (Phase 2 before Phase 3) meant scoped role UI followed established patterns
- Milestone audit caught real gaps (missing VERIFICATION.md, proxy API enforcement) before shipping
- Parallel plan execution where possible (04-02/04-03 ran concurrently)
- Pure function scopeResolver.ts reusable across Edge middleware, Node API, and React

### What Was Inefficient
- Phase 3 had no VERIFICATION.md despite 5/5 plans complete — gap only caught by audit
- Phases 5 and 6 were gap-closure phases that could have been prevented with verification built into Phase 3/4
- REQUIREMENTS.md coverage summary was briefly out of date (showed 21/22 after Phase 6 completed PROXY-06)
- Some audit frontmatter (status: gaps_found) not updated after gaps were resolved

### Patterns Established
- getCapabilities(roles) as single source of truth for all permission checks
- scopeResolver.ts as pure function for scope logic (no DB, no side effects)
- PATTERNS.md as authoritative design system reference
- Jest 27.5.1 + @testing-library/react 12.1.5 for React 16 test stack
- node-mocks-http for API route testing
- isProxyFor check wrapping scope block pattern for proxy-before-scope logic

### Key Lessons
1. Verification should be built into phase execution, not added retroactively as gap closure phases
2. Milestone audit is essential — it caught 2 real gaps that would have shipped broken
3. Pure utility functions (scopeResolver, getCapabilities) pay dividends across all phases
4. eslint-plugin-jsx-a11y strict mode catches issues at lint time; runtime @axe-core/react not needed for this project

### Cost Observations
- Model mix: ~70% sonnet (execution), ~20% opus (planning/verification), ~10% haiku (research)
- Sessions: ~8 sessions over 3 days
- Notable: 17 plans completed in ~2 hours total execution time (avg 8min/plan)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 6 | First milestone — established audit + gap-closure pattern |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 32+ (unit + smoke) | scopeResolver 100%, UI smoke tests | 5 new Sequelize models |

### Top Lessons (Verified Across Milestones)

1. Build verification into phase execution rather than adding it retroactively
2. Milestone audits catch real integration gaps — always run before completion
