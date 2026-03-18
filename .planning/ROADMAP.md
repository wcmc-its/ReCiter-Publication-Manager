# Roadmap: ReCiter-Publication-Manager

## Milestones

- ✅ **v1.0 Bug Fixes, UI/UX Audit, Scoped Curation & Proxy** — Phases 1-6 (shipped 2026-03-18)
- 🚧 **v1.1 Feature Port to Next.js 14** — Phases 7-11 (in progress)

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

### 🚧 v1.1 Feature Port to Next.js 14 (In Progress)

**Milestone Goal:** All v1.0 features (capability auth, scoped curation roles, curation proxy, skeleton loading) work on the Next.js 14 / React 18 codebase running on reciter-dev.

- [ ] **Phase 7: Foundation** - Sequelize models, scopeResolver, constants, and database DDL ported to NextJS14 branch
- [ ] **Phase 8: Auth Pipeline** - findUserPermissions enriched, JWT/session callbacks updated, capability middleware live, SAML auto-create wired in
- [ ] **Phase 9: Scoped Roles and Proxy UI** - All eight admin UI and curation UI components for scoped roles and proxy delegation ported and rendering correctly
- [ ] **Phase 10: API Scope Enforcement** - userfeedback and goldstandard endpoints enforce scope with proxy bypass on NextJS14 branch
- [ ] **Phase 11: Polish and Testing** - Skeleton loading adapted for React 18, 31 deferred a11y violations fixed, Jest 29 + RTL 16 infrastructure live with passing scope/proxy unit tests

## Phase Details

### Phase 7: Foundation
**Goal**: The data layer — models, utilities, constants, and DDL — exists on the NextJS14 branch so all subsequent phases have something to import
**Depends on**: Nothing (first v1.1 phase; working branch created from origin/dev_Upd_NextJS14SNode18)
**Requirements**: PORT-01, PORT-02, PORT-03, DB-01
**Success Criteria** (what must be TRUE):
  1. AdminUsersPersonType and AdminUsersProxy Sequelize models are importable without SWC compilation errors
  2. isPersonInScope and isProxyFor can be imported from scopeResolver.ts and return correct boolean results for sample inputs
  3. getCapabilities, ROLE_CAPABILITIES, getLandingPage, and the Curator_Scoped constant are exported from constants and return correct values for known role combinations
  4. admin_users_person_types and admin_users_proxy tables exist in both dev and prod reciterDB databases with correct DDL, and the DDL is committed to the ReCiterDB repo
**Plans**: TBD

### Phase 8: Auth Pipeline
**Goal**: A user who logs in (SAML or local) receives a JWT that includes scopeData and proxyPersonIds, and the middleware routes them correctly based on derived capabilities
**Depends on**: Phase 7
**Requirements**: PORT-04, PORT-05, PORT-06, PORT-07
**Success Criteria** (what must be TRUE):
  1. After login, the session object includes roles, scopeData, and proxyPersonIds populated from the database
  2. A Curator_Scoped user is routed to the correct landing page by middleware without hitting a redirect loop or /noaccess
  3. A SAML user who exists in the IdP but not in admin_users is automatically created with status=1 and a default role, and can proceed to log in
  4. Middleware reads the JWT using getToken (not jose) and enforces capability-based routing for all protected routes
**Plans**: TBD

### Phase 9: Scoped Roles and Proxy UI
**Goal**: Superusers can assign scoped curation roles and proxy relationships via the admin UI, and scoped curators see their scope reflected in the search page sidebar and curation enforcement
**Depends on**: Phase 8
**Requirements**: PORT-08, PORT-09, PORT-10, PORT-11, PORT-12, PORT-13, PORT-14, PORT-15
**Success Criteria** (what must be TRUE):
  1. The Add/Edit User form in Manage Users shows the CurationScopeSection and ProxyAssignmentsSection, and submitted changes persist to the database
  2. The Search page shows a [PROXY] badge next to people the current user is a proxy for, and the "Show proxied people" filter checkbox works
  3. The sidebar displays a ScopeLabel describing the active curator's current scope restriction
  4. Navigating to a curation page for a person outside a scoped curator's scope redirects with a toast notification rather than rendering the page
  5. The GrantProxyModal on the curation page allows a curator to grant proxy access to another user, and the grant is reflected immediately in search results
**Plans**: TBD

### Phase 10: API Scope Enforcement
**Goal**: The userfeedback and goldstandard API endpoints on the NextJS14 branch reject out-of-scope curation attempts at the server side, while proxy holders are allowed through
**Depends on**: Phase 9
**Requirements**: PORT-16, PORT-17
**Success Criteria** (what must be TRUE):
  1. A scoped curator who submits feedback for a person outside their scope receives a 403 from the userfeedback save endpoint
  2. A user who holds proxy access submits feedback for the proxied person and the request succeeds (proxy bypass works)
  3. A scoped curator who submits a goldstandard update for a person outside their scope receives a 403, while a proxy holder's update succeeds
**Plans**: TBD

### Phase 11: Polish and Testing
**Goal**: The NextJS14 branch has skeleton loading components that work under React 18 StrictMode, 31 outstanding a11y violations are resolved, and a Jest 29 + RTL 16 test suite with passing scope/proxy unit tests provides a regression safety net
**Depends on**: Phase 10
**Requirements**: PORT-18, A11Y-01, PORT-19, PORT-20
**Success Criteria** (what must be TRUE):
  1. Table, Card, Profile, and Form skeleton loading components render without double-invocation artifacts under React 18 StrictMode in development
  2. Running the eslint-plugin-jsx-a11y lint check returns zero violations across all adapted components
  3. npm test runs to completion without errors using Jest 29 and @testing-library/react 16
  4. Scope resolver and proxy unit tests pass and cover the core isPersonInScope and isProxyFor logic paths
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Auth Fix and Bug Remediation | v1.0 | 2/2 | Complete | 2026-03-16 |
| 2. UI/UX Audit | v1.0 | 4/4 | Complete | 2026-03-17 |
| 3. Scoped Curation Roles | v1.0 | 5/5 | Complete | 2026-03-17 |
| 4. Curation Proxy | v1.0 | 4/4 | Complete | 2026-03-17 |
| 5. Phase 3 Independent Verification | v1.0 | 1/1 | Complete | 2026-03-18 |
| 6. Proxy API Scope Enforcement | v1.0 | 1/1 | Complete | 2026-03-18 |
| 7. Foundation | v1.1 | 0/TBD | Not started | - |
| 8. Auth Pipeline | v1.1 | 0/TBD | Not started | - |
| 9. Scoped Roles and Proxy UI | v1.1 | 0/TBD | Not started | - |
| 10. API Scope Enforcement | v1.1 | 0/TBD | Not started | - |
| 11. Polish and Testing | v1.1 | 0/TBD | Not started | - |
