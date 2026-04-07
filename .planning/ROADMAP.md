# Roadmap: ReCiter-Publication-Manager

## Milestones

- ✅ **v1.0 Bug Fixes, UI/UX Audit, Scoped Curation & Proxy** — Phases 1-6 (shipped 2026-03-18)
- ⏸️ **v1.1 Feature Port to Next.js 14** — Phases 7-11 (paused at Phase 7)
- ✅ **v1.2 Bibliometric Bug Fix** — Phases 12-13 (shipped 2026-03-27)

## Phases

<details>
<summary>✅ v1.0 Bug Fixes, UI/UX Audit, Scoped Curation & Proxy (Phases 1-6) — SHIPPED 2026-03-18</summary>

- [x] Phase 1: Auth Fix and Bug Remediation (2/2 plans) — completed 2026-03-16
- [x] Phase 2: UI/UX Audit (4/4 plans) — completed 2026-03-17
- [x] Phase 3: Scoped Curation Roles (5/5 plans) — completed 2026-03-17
- [x] Phase 4: Curation Proxy (4/4 plans) — completed 2026-03-17
- [x] Phase 5: Phase 3 Independent Verification (1/1 plan) — completed 2026-03-18
- [x] Phase 6: Proxy API Scope Enforcement (1/1 plan) — completed 2026-03-18

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### ⏸️ v1.1 Feature Port to Next.js 14 (Phases 7-11) — PAUSED at Phase 7

**Milestone Goal:** All v1.0 features (capability auth, scoped curation roles, curation proxy, skeleton loading) work on the Next.js 14 / React 18 codebase running on reciter-dev.

- [x] **Phase 7: Foundation** - Sequelize models, scopeResolver, constants, and database DDL ported to NextJS14 branch (completed 2026-03-19)
- [ ] **Phase 8: Auth Pipeline** - findUserPermissions enriched, JWT/session callbacks updated, capability middleware live, SAML auto-create wired in
- [x] **Phase 9: Scoped Roles and Proxy UI** - All eight admin UI and curation UI components for scoped roles and proxy delegation ported and rendering correctly (completed 2026-03-28)
- [x] **Phase 10: API Scope Enforcement** - userfeedback and goldstandard endpoints enforce scope with proxy bypass on NextJS14 branch (completed 2026-04-06)
- [ ] **Phase 11: Polish and Testing** - Skeleton loading adapted for React 18, 58 a11y violations fixed, Jest 29 + RTL 16 infrastructure live with passing scope/proxy unit tests

<details>
<summary>v1.1 Phase Details</summary>

#### Phase 7: Foundation
**Goal**: The data layer — models, utilities, constants, and DDL — exists on the NextJS14 branch so all subsequent phases have something to import
**Depends on**: Nothing (first v1.1 phase; working branch created from origin/dev_Upd_NextJS14SNode18)
**Requirements**: PORT-01, PORT-02, PORT-03, DB-01
**Plans:** 2/2 plans complete
- [x] 07-01-PLAN.md — Branch creation, AdminUser model extension, scopeResolver copy
- [x] 07-02-PLAN.md — Constants capability model merge, DDL migration, build validation

#### Phase 8: Auth Pipeline
**Goal**: A user who logs in (SAML or local) receives a JWT that includes scopeData and proxyPersonIds, and the middleware routes them correctly based on derived capabilities
**Depends on**: Phase 7
**Requirements**: PORT-04, PORT-05, PORT-06, PORT-07
**Plans:** 2 plans
- [x] 08-01-PLAN.md — findUserPermissions enrichment, samlUtils composite format fix, JWT/session callback grafting
- [x] 08-02-PLAN.md — Capability-based middleware replacement, index page redirect cleanup, test SQL script

#### Phase 9: Scoped Roles and Proxy UI
**Goal**: Superusers can assign scoped curation roles and proxy relationships via the admin UI, and scoped curators see their scope reflected in the search page sidebar and curation enforcement
**Depends on**: Phase 8
**Requirements**: PORT-08, PORT-09, PORT-10, PORT-11, PORT-12, PORT-13, PORT-14, PORT-15
**Plans:** 4 plans

Plans:
- [x] 09-01-PLAN.md — Proxy API endpoints, controller modifications, person scope filtering
- [x] 09-02-PLAN.md — CurationScopeSection, ProxyAssignmentsSection, AddUser integration, UsersTable update
- [x] 09-03-PLAN.md — ScopeLabel, ProxyBadge, ScopeFilterCheckbox, SideNavbar and Search page integration
- [x] 09-04-PLAN.md — GrantProxyModal creation and CurateIndividual page integration

*Completed: 2026-03-28*

#### Phase 10: API Scope Enforcement
**Goal**: The userfeedback and goldstandard API endpoints on the NextJS14 branch reject out-of-scope curation attempts at the server side, while proxy holders are allowed through
**Depends on**: Phase 9
**Requirements**: PORT-16, PORT-17
**Plans**: N/A (implemented directly, commit `a14a1cb`)

*Completed: 2026-04-06 (retroactive — code shipped before planning artifacts)*

#### Phase 11: Polish and Testing
**Goal**: The NextJS14 branch has skeleton loading components that work under React 18 StrictMode, 58 a11y violations are resolved, and a Jest 29 + RTL 16 test suite with passing scope/proxy unit tests provides a regression safety net
**Depends on**: Phase 10
**Requirements**: PORT-18, A11Y-01, PORT-19, PORT-20
**Plans:** 5 plans

Plans:
- [x] 11-01-PLAN.md — Jest dual-config infrastructure (jest.config.js + jest.config.dom.js) + RTL scope/proxy component tests
- [x] 11-02-PLAN.md — eslint-plugin-jsx-a11y strict mode config + fix 22 label-has-associated-control violations
- [x] 11-03-PLAN.md — Fix 36 click-events/static-element/anchor/noninteractive a11y violations + final audit
- [x] 11-04-PLAN.md — GoldStandard audit source tag (one-line deferred gap from Phase 10)
- [ ] 11-05-PLAN.md — Final verification: skeleton loading, test suite, a11y audit, human sign-off

</details>

<details>
<summary>✅ v1.2 Bibliometric Bug Fix (Phases 12-13) — SHIPPED 2026-03-27</summary>

- [x] Phase 12: Fix Stored Procedure and Sync Code (2/2 plans) — completed 2026-03-26
- [x] Phase 13: Deploy and Verify (2/2 plans) — completed 2026-03-27

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Auth Fix and Bug Remediation | v1.0 | 2/2 | Complete | 2026-03-16 |
| 2. UI/UX Audit | v1.0 | 4/4 | Complete | 2026-03-17 |
| 3. Scoped Curation Roles | v1.0 | 5/5 | Complete | 2026-03-17 |
| 4. Curation Proxy | v1.0 | 4/4 | Complete | 2026-03-17 |
| 5. Phase 3 Independent Verification | v1.0 | 1/1 | Complete | 2026-03-18 |
| 6. Proxy API Scope Enforcement | v1.0 | 1/1 | Complete | 2026-03-18 |
| 7. Foundation | v1.1 | 2/2 | Complete | 2026-03-19 |
| 8. Auth Pipeline | v1.1 | 2/2 | Complete | 2026-03-27 |
| 9. Scoped Roles and Proxy UI | v1.1 | 4/4 | Complete | 2026-03-28 |
| 10. API Scope Enforcement | v1.1 | N/A | Complete | 2026-04-06 |
| 11. Polish and Testing | v1.1 | 4/5 | In Progress|  |
| 12. Fix SP and Sync Code | v1.2 | 2/2 | Complete | 2026-03-26 |
| 13. Deploy and Verify | v1.2 | 2/2 | Complete | 2026-03-27 |
