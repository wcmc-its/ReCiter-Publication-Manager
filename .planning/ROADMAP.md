# Roadmap: ReCiter-Publication-Manager

## Milestones

- v1.0 Bug Fixes, UI/UX Audit, Scoped Curation & Proxy -- Phases 1-6 (shipped 2026-03-18)
- v1.1 Feature Port to Next.js 14 -- Phases 7-11 (paused at Phase 7)
- v1.2 Bibliometric Bug Fix -- Phases 12-13 (shipped 2026-03-27)
- **v1.3 Data-Driven RBAC** -- Phases 14-18 (active)

## Phases

<details>
<summary>v1.0 Bug Fixes, UI/UX Audit, Scoped Curation & Proxy (Phases 1-6) -- SHIPPED 2026-03-18</summary>

- [x] Phase 1: Auth Fix and Bug Remediation (2/2 plans) -- completed 2026-03-16
- [x] Phase 2: UI/UX Audit (4/4 plans) -- completed 2026-03-17
- [x] Phase 3: Scoped Curation Roles (5/5 plans) -- completed 2026-03-17
- [x] Phase 4: Curation Proxy (4/4 plans) -- completed 2026-03-17
- [x] Phase 5: Phase 3 Independent Verification (1/1 plan) -- completed 2026-03-18
- [x] Phase 6: Proxy API Scope Enforcement (1/1 plan) -- completed 2026-03-18

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### v1.1 Feature Port to Next.js 14 (Phases 7-11) -- PAUSED at Phase 7

**Milestone Goal:** All v1.0 features (capability auth, scoped curation roles, curation proxy, skeleton loading) work on the Next.js 14 / React 18 codebase running on reciter-dev.

- [x] **Phase 7: Foundation** - Sequelize models, scopeResolver, constants, and database DDL ported to NextJS14 branch (completed 2026-03-19)
- [ ] **Phase 8: Auth Pipeline** - findUserPermissions enriched, JWT/session callbacks updated, capability middleware live, SAML auto-create wired in
- [x] **Phase 9: Scoped Roles and Proxy UI** - All eight admin UI and curation UI components for scoped roles and proxy delegation ported and rendering correctly (completed 2026-03-28)
- [x] **Phase 10: API Scope Enforcement** - userfeedback and goldstandard endpoints enforce scope with proxy bypass on NextJS14 branch (completed 2026-04-06)
- [ ] **Phase 11: Polish and Testing** - Skeleton loading adapted for React 18, 58 a11y violations fixed, Jest 29 + RTL 16 infrastructure live with passing scope/proxy unit tests

<details>
<summary>v1.1 Phase Details</summary>

#### Phase 7: Foundation
**Goal**: The data layer -- models, utilities, constants, and DDL -- exists on the NextJS14 branch so all subsequent phases have something to import
**Depends on**: Nothing (first v1.1 phase; working branch created from origin/dev_Upd_NextJS14SNode18)
**Requirements**: PORT-01, PORT-02, PORT-03, DB-01
**Plans:** 2/2 plans complete
- [x] 07-01-PLAN.md -- Branch creation, AdminUser model extension, scopeResolver copy
- [x] 07-02-PLAN.md -- Constants capability model merge, DDL migration, build validation

#### Phase 8: Auth Pipeline
**Goal**: A user who logs in (SAML or local) receives a JWT that includes scopeData and proxyPersonIds, and the middleware routes them correctly based on derived capabilities
**Depends on**: Phase 7
**Requirements**: PORT-04, PORT-05, PORT-06, PORT-07
**Plans:** 2 plans
- [x] 08-01-PLAN.md -- findUserPermissions enrichment, samlUtils composite format fix, JWT/session callback grafting
- [x] 08-02-PLAN.md -- Capability-based middleware replacement, index page redirect cleanup, test SQL script

#### Phase 9: Scoped Roles and Proxy UI
**Goal**: Superusers can assign scoped curation roles and proxy relationships via the admin UI, and scoped curators see their scope reflected in the search page sidebar and curation enforcement
**Depends on**: Phase 8
**Requirements**: PORT-08, PORT-09, PORT-10, PORT-11, PORT-12, PORT-13, PORT-14, PORT-15
**Plans:** 4 plans

Plans:
- [x] 09-01-PLAN.md -- Proxy API endpoints, controller modifications, person scope filtering
- [x] 09-02-PLAN.md -- CurationScopeSection, ProxyAssignmentsSection, AddUser integration, UsersTable update
- [x] 09-03-PLAN.md -- ScopeLabel, ProxyBadge, ScopeFilterCheckbox, SideNavbar and Search page integration
- [x] 09-04-PLAN.md -- GrantProxyModal creation and CurateIndividual page integration

*Completed: 2026-03-28*

#### Phase 10: API Scope Enforcement
**Goal**: The userfeedback and goldstandard API endpoints on the NextJS14 branch reject out-of-scope curation attempts at the server side, while proxy holders are allowed through
**Depends on**: Phase 9
**Requirements**: PORT-16, PORT-17
**Plans**: N/A (implemented directly, commit `a14a1cb`)

*Completed: 2026-04-06 (retroactive -- code shipped before planning artifacts)*

#### Phase 11: Polish and Testing
**Goal**: The NextJS14 branch has skeleton loading components that work under React 18 StrictMode, 58 a11y violations are resolved, and a Jest 29 + RTL 16 test suite with passing scope/proxy unit tests provides a regression safety net
**Depends on**: Phase 10
**Requirements**: PORT-18, A11Y-01, PORT-19, PORT-20
**Plans:** 5 plans

Plans:
- [x] 11-01-PLAN.md -- Jest dual-config infrastructure (jest.config.js + jest.config.dom.js) + RTL scope/proxy component tests
- [x] 11-02-PLAN.md -- eslint-plugin-jsx-a11y strict mode config + fix 22 label-has-associated-control violations
- [x] 11-03-PLAN.md -- Fix 36 click-events/static-element/anchor/noninteractive a11y violations + final audit
- [x] 11-04-PLAN.md -- GoldStandard audit source tag (one-line deferred gap from Phase 10)
- [ ] 11-05-PLAN.md -- Final verification: skeleton loading, test suite, a11y audit, human sign-off

</details>

<details>
<summary>v1.2 Bibliometric Bug Fix (Phases 12-13) -- SHIPPED 2026-03-27</summary>

- [x] Phase 12: Fix Stored Procedure and Sync Code (2/2 plans) -- completed 2026-03-26
- [x] Phase 13: Deploy and Verify (2/2 plans) -- completed 2026-03-27

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

### v1.3 Data-Driven RBAC (Phases 14-18)

**Milestone Goal:** Move all role/permission definitions, role-to-permission mappings, and UI resource visibility from hardcoded application code to database tables, with full admin CRUD. Existing behavior is preserved exactly -- no user-facing changes until admin UI is added.

- [x] **Phase 14: Permission Tables and Models** - Three new DB tables created and seeded, Sequelize models registered with associations, permission helper utilities tested (completed 2026-04-14)
- [x] **Phase 15: Auth and Middleware** - Login resolves permissions from DB via JOINs, JWT carries permission set and resources, middleware enforces routes using permission set instead of getCapabilities() (completed 2026-04-14)
- [x] **Phase 16: Data-Driven UI** - SideNavbar renders from permissionResources data, component-level checks use permission set instead of role-based arrays (completed 2026-04-14)
- [ ] **Phase 17: Admin CRUD** - Superuser can manage roles, permissions, and permission resources through new tabs in the Manage Users page
- [ ] **Phase 18: Cleanup** - All deprecated capability code removed, permission-based tests replace capability tests, no remaining imports of old functions

## Phase Details

### Phase 14: Permission Tables and Models
**Goal**: The database contains permission tables with seed data that exactly matches today's 7 permissions and role mappings, and the application can read them through Sequelize models
**Depends on**: Nothing (first v1.3 phase)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05
**Success Criteria** (what must be TRUE):
  1. Running the seed SQL produces 7 rows in admin_permissions, ~17 rows in admin_role_permissions, and 7 rows in admin_permission_resources
  2. Sequelize models for all three tables load without errors on dev server startup
  3. Permission helper functions (hasPermission, getPermissionsFromRaw, getLandingPageFromPermissions) pass all unit tests
  4. The application builds and starts with no regressions -- existing behavior unchanged
**Plans:** 2 plans

Plans:
- [x] 14-01-PLAN.md -- SQL migration script (DDL + seed), three Sequelize model files, init-models.ts registration with associations
- [x] 14-02-PLAN.md -- Permission helper utilities (permissionUtils.ts) with unit tests and model smoke tests

### Phase 15: Auth and Middleware
**Goal**: A user who logs in receives a JWT containing their resolved permission keys and UI resources, and the middleware enforces route access using that permission set -- all without changing any visible behavior
**Depends on**: Phase 14
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, MW-01, MW-02, MW-03, MW-04, MW-05
**Success Criteria** (what must be TRUE):
  1. After login, the browser session contains `permissions` (string array) and `permissionResources` (object array) matching the user's roles
  2. A Superuser can access all 7 protected routes (/search, /curate, /report, /manageusers, /configuration, /notifications, /manageprofile)
  3. A Curator_Self user is redirected to /curate/:ownId when accessing /search, and cannot access /manageusers or /configuration
  4. A user with no roles still has access to /search and /report (baseline fallback)
  5. Curation scope logic (self/scoped/proxy) works identically to before -- no scope regressions
**Plans:** 2/2 plans complete

Plans:
- [x] 15-01-PLAN.md -- findUserPermissionsEnriched controller, both auth path wiring, JWT callback extension
- [x] 15-02-PLAN.md -- Middleware rewrite with ROUTE_PERMISSIONS map, permission-based enforcement, comprehensive tests

### Phase 16: Data-Driven UI
**Goal**: The navigation menu and component-level permission checks are driven by database data instead of hardcoded arrays, so that future permission changes via admin UI will immediately affect the rendered UI
**Depends on**: Phase 15
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. SideNavbar renders menu items with icons, labels, routes, and ordering that all come from the permissionResources session data
  2. A Curator_Self user sees only the nav items their permissions grant (Curate Publications) -- not Search, Report, or admin items
  3. ReciterTabs on the curation page no longer reference allowedRoleNames -- tab visibility is determined by the user's permission set
  4. The Grant Proxy button on the curation page appears only when the user has both canCurate and canManageUsers permissions
**Plans:** 2/2 plans complete

Plans:
- [x] 16-01-PLAN.md -- Icon registry, usePermissions hook, MenuItem type update, SideNavbar/MenuListItem/NestedListItem data-driven rewrite
- [x] 16-02-PLAN.md -- ReciterTabs permission gate, full sweep of 10 remaining files converting role-label checks to permission checks

### Phase 17: Admin CRUD
**Goal**: Superusers can view, create, edit, and delete roles and permissions through a tabbed interface in the Manage Users page, with safety guards preventing deletion of in-use items
**Depends on**: Phase 16
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08, ADMIN-09
**Success Criteria** (what must be TRUE):
  1. The Manage Users page shows three tabs: Users, Roles, Permissions
  2. In the Roles tab, a Superuser can see all roles with their assigned permissions displayed as chips, and can add or remove permissions from a role
  3. In the Permissions tab, a Superuser can create a new permission with key/label/description/category, edit its label/description/category (key is immutable), and manage its associated UI resources
  4. Attempting to delete a role that has assigned users shows a warning with the user count and blocks the deletion
  5. Attempting to delete a permission assigned to any role shows the affected roles and blocks the deletion
**Plans:** 1/3 plans executed

Plans:
- [x] 17-01-PLAN.md -- Roles and permissions controllers with CRUD logic, 7 API route files
- [ ] 17-02-PLAN.md -- RolesTab table with chips, RoleEditModal, DeleteBlockedModal, DeleteConfirmModal
- [ ] 17-03-PLAN.md -- ManageUsersTabs container, PermissionsTab with category grouping, PermissionEditModal with ResourceRow

### Phase 18: Cleanup
**Goal**: All deprecated capability-model code is removed from the codebase, leaving only the data-driven permission system as the single source of truth
**Depends on**: Phase 17
**Requirements**: CLN-01, CLN-02, CLN-03, CLN-04, CLN-05
**Success Criteria** (what must be TRUE):
  1. The strings "ROLE_CAPABILITIES", "getCapabilities", and "getLandingPage" (the old function) do not appear in any application source file
  2. No imports reference the removed functions -- a project-wide search for these symbols returns zero results
  3. Permission-based tests exist and pass, replacing any old capability-based tests
  4. The application builds, starts, and all existing functionality works with the old code fully removed
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
| 7. Foundation | v1.1 | 2/2 | Complete | 2026-03-19 |
| 8. Auth Pipeline | v1.1 | 2/2 | Complete | 2026-03-27 |
| 9. Scoped Roles and Proxy UI | v1.1 | 4/4 | Complete | 2026-03-28 |
| 10. API Scope Enforcement | v1.1 | N/A | Complete | 2026-04-06 |
| 11. Polish and Testing | v1.1 | 4/5 | In Progress | - |
| 12. Fix SP and Sync Code | v1.2 | 2/2 | Complete | 2026-03-26 |
| 13. Deploy and Verify | v1.2 | 2/2 | Complete | 2026-03-27 |
| 14. Permission Tables and Models | v1.3 | 2/2 | Complete | 2026-04-14 |
| 15. Auth and Middleware | v1.3 | 2/2 | Complete    | 2026-04-14 |
| 16. Data-Driven UI | v1.3 | 2/2 | Complete    | 2026-04-14 |
| 17. Admin CRUD | v1.3 | 1/3 | In Progress|  |
| 18. Cleanup | v1.3 | 0/? | Not started | - |
