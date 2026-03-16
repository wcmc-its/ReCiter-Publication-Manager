# Project Research Summary

**Project:** RPM Bug Fixes, UI/UX Audit, and Scoped Curation Roles
**Domain:** Scholarly publication management — role-based access control extension
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

ReCiter Publication Manager (RPM) is a mature, single-institution Next.js 12 / React 16 / MySQL application whose tech stack is locked for this milestone. The work is a targeted maintenance and feature milestone, not a greenfield build. Research confirmed that all three work tracks share a critical dependency ordering: the auth bug fix must come first, database migration infrastructure must be established before any schema changes, and the scoped curation role system must be built in a specific layer-by-layer sequence (schema, resolver, auth flow, middleware, search, curation enforcement, admin UI) to avoid security holes and rewrites.

The recommended architecture uses a single new `admin_users_scoped_roles` table with nullable `personType` and `orgUnit` columns, a centralized `scopeResolver.ts` utility module (not scattered conditional logic), CASL for permission modeling, and Sequelize CLI migrations for repeatable schema management. Scoped role data should be embedded in the JWT at login time using the same pattern as existing roles, keeping the edge middleware free of DB calls. The key architectural constraint is that Next.js 12 edge middleware runs in a V8 isolate that cannot touch the database, which means route-level gating stays JWT-based while per-person curation authorization must happen in page SSR and API routes.

The dominant risks are: (1) the existing middleware has a combinatorial role-checking pattern that is already causing the paa2013 /noaccess bug and adding scoped roles without refactoring it first would make that bug systematic; (2) the SAML and local auth paths diverge in session structure, so scoped roles could work in dev and fail in production; (3) API routes currently have no per-user scope enforcement at all, only a shared API key check, which means scope restrictions are trivially bypassed without server-side enforcement. All three risks have clear mitigations and must be addressed in the specific phases described below.

## Key Findings

### Recommended Stack

The stack is locked at Next.js 12.2.5, React 16.14.0, Node 14.16.0, Sequelize 6.9.0, next-auth 3.29.10, and MUI 5.0.6. Research verified which new packages are compatible with these pinned versions. No framework upgrades are in scope.

**Core technologies (existing, locked):**
- Next.js 12 + React 16: Framework; no upgrade path in this milestone
- Sequelize 6 + MySQL: ORM; extend with Sequelize CLI for migrations
- next-auth v3: Auth; debug existing flow, do not upgrade to v4/v5
- Edge middleware (jose): JWT decode; refactor pattern, no library change

**New additions confirmed compatible:**
- `@casl/ability@^6.8.0` + `@casl/react@4.0.0`: Scoped permission modeling; isomorphic (server + client); v4.0.0 specifically required for React 16 compat (v5 requires React 17+)
- `sequelize-cli@^6.6.2`: Migration infrastructure; standard companion to Sequelize 6.x
- `eslint-plugin-jsx-a11y@^6.10.2`: Lint-time accessibility; verified compatible with eslint 7.32.0
- `axe-core@^4.11.1` + `@axe-core/react@^4.11.1` (conditional): Runtime a11y audit; test React 16 compat before committing
- `saml-encoder-decoder-js@1.0.2`: Dev-only SAML debugging utility

**Critical version constraint:** Do not install `@casl/react@5`. It requires React 17+. Use v4.0.0 exactly.

Full details: `.planning/research/STACK.md`

### Expected Features

Research classified features by user expectation and dependency. The auth fix has no dependencies and blocks everything else. The scoped role DB table is the foundation for all scoping features.

**Must have (table stakes, v1):**
- Auth fix: users with valid roles must not be redirected to /noaccess (P1 blocker)
- Fix profile modal loading error ("unable to load profile")
- Fix "Curate publications" action showing on Search page
- Replace legacy red circle GIF loader (two distinct loading patterns exist; both must be replaced)
- Scoped curation role by person type
- Scoped curation role by org unit
- Combined person type + org unit scoping with AND logic
- Manage scoped roles from the existing Manage Users page (extend, not separate page)
- Role display in the user management table (currently missing entirely)
- User status toggle in the edit form (data model supports it; UI does not)

**Should have (v1.x after validation):**
- Scoped curation queue auto-filtering (pre-filter Search/Group Curation for scoped curators)
- Effective permissions preview ("this scope includes 347 people in 3 departments")
- Auth debugging panel (Superuser-only, read-only diagnostic view)
- Audit trail for role changes

**Defer (v2+):**
- Scope inheritance via org hierarchy (requires parent-child org table; flat scoping sufficient for v1)
- Delegation/proxy curation
- Bulk user import/update

**Anti-features to avoid:** per-article permission assignments, negative/deny rules, custom role creation UI, real-time collaborative curation, cascading org unit permissions inferred from string parsing.

Full details: `.planning/research/FEATURES.md`

### Architecture Approach

The architecture extends the existing four-component auth chain (NextAuth callback, JWT token, edge middleware, SideNavbar/page SSR) without replacing it. The scoped role system is additive: a user's effective access is the union of their base roles and their scoped roles, never less. The one new component that matters most is a centralized `scopeResolver.ts` utility with two tiers: a lightweight JWT-only tier for edge middleware and navbar, and a full DB-query tier for SSR and API route enforcement.

**Major components:**
1. `admin_users_scoped_roles` table: Single new table with nullable `personType` and `orgUnit` columns; one row per scope assignment; CHECK constraint ensures at least one column is non-null; VARCHAR values aligned with existing `person_person_type.personType` and `person.primaryOrganizationalUnit` strings
2. `src/utils/scopeResolver.ts`: Centralized authorization logic exposing `isEffectiveCurator()` (JWT-only), `isScopedCurator()` (JWT-only), `canCuratePerson()` (async, DB), and `buildScopeFilter()` (Sequelize WHERE clause)
3. Extended `userroles.controller.ts`: LEFT JOIN scoped roles at login; embed as `scopedRoles` in JWT alongside existing `userRoles`
4. Extended middleware: Parse `scopedRoles` from JWT; treat `scopedRoles.length > 0` as `isEffectiveCurator` for route-level access; do NOT attempt per-person validation in middleware
5. Extended person API + curation page SSR: Apply `buildScopeFilter()` to search results; call `canCuratePerson()` in `getServerSideProps` and in curation mutation API routes
6. Extended Manage Users form: New scoped assignment section with dropdowns fed by `SELECT DISTINCT` on `person_person_type` and `person`; save in same Sequelize transaction as role/department changes

**Patterns to follow:** Scope as qualifier not replacement; assignment as data not role label; transaction-wrapped writes; filter at query time not display time.

Full details: `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **Middleware combinatorial explosion** — The existing `middleware.ts` already checks `userRoles.length == 1/2/3` in deeply nested branches, which is why paa2013 (4 roles) hits /noaccess. Refactor to a capability-based check before adding any scoped role logic. Never extend the current pattern.

2. **Dual auth path divergence** — SAML and local credential paths produce different session structures and follow different user-lookup logic. There is also a dangling `adminUser.personIdentifier` expression in the SAML path. Scoped roles that work locally (LOCAL provider) will fail on EKS (SAML) unless both paths are unified into a shared post-auth function.

3. **JWT token bloat and stale permissions** — Scoped roles added to the JWT must stay compact. Store only scalar personType and orgUnit strings per assignment row. Scoped permission changes require re-login to take effect; document this for admins.

4. **No API-level scope enforcement** — Every curation API endpoint (`/api/reciter/userfeedback/save/[uid]`, `/api/reciter/goldstandard`) validates only the shared `backendApiKey`. Scope enforcement at the API route level is not optional; it is the actual security boundary.

5. **No migration infrastructure** — There is no `migrations/` directory and `user.controller.ts` uses a destroy-and-recreate pattern for role assignments. Sequelize CLI migrations must be bootstrapped before any new tables are created.

Full details: `.planning/research/PITFALLS.md`

## Implications for Roadmap

Based on research, the milestone divides into four phases. The dependency graph is clear: phases must proceed in order.

### Phase 1: Foundation Fixes and Infrastructure

**Rationale:** All other phases depend on this. The auth bug blocks testing of every feature. The migration infrastructure is required before any schema change. The middleware refactor is required before adding any new role logic. Without this phase, later phases build on a broken foundation.

**Delivers:** Working authentication for all valid users; Sequelize CLI migration baseline; refactored middleware with capability-based routing; fixed minor bugs (AddUser 404 redirect, "Curate publications" on Search page, `freeSolo` autocomplete allowing invalid values, double-JSON.parse in middleware).

**Addresses from FEATURES.md:** Auth fix (P1, unblocks everything), fix profile modal, fix "Curate publications" on Search, user status toggle.

**Avoids from PITFALLS.md:** Pitfall 1 (middleware combinatorial explosion), Pitfall 2 (JWT double-parse fragility), Pitfall 3 (SAML/local path divergence), Pitfall 5 (no migration infrastructure), Pitfall 6 (double JSON.parse), Pitfall 12 (AddUser wrong redirect).

### Phase 2: UI/UX Audit and Loading Animation

**Rationale:** The audit must happen after auth is fixed (you cannot audit what you cannot log into) and before new scoped role UI is built (new UI should follow patterns surfaced by the audit).

**Delivers:** Unified loading animation across all 21+ loader instances (both the React `Loader` component pattern and the legacy CSS GIF pattern); categorized audit findings with visual/behavioral fixes implemented and architectural issues documented for later.

**Addresses from FEATURES.md:** Replace legacy red circle loader, full UI/UX audit (both P1).

**Avoids from PITFALLS.md:** Pitfall 7 (missing hidden loader instances), Pitfall 8 (audit scope creep into refactoring).

**Scope gate:** Audit fixes must not modify API contracts, Redux action shapes, or Sequelize model definitions. Document architectural issues for future work; do not implement them here.

### Phase 3: Scoped Curation Roles (Core)

**Rationale:** This is the primary feature request. The dependency sequence within this phase follows the architecture's build order: schema first, resolver second, auth flow third, middleware fourth, search filtering fifth, curation enforcement sixth, admin UI seventh. Each step validates the next.

**Delivers:** The `admin_users_scoped_roles` table (with migrations); `scopeResolver.ts` utility; extended JWT with `scopedRoles`; search results filtered to scope; per-person curation authorization in SSR and API routes; Manage Users extended to assign and manage scoped roles; role display and scope summary badges in user table.

**Uses from STACK.md:** `@casl/ability@^6.8.0`, `@casl/react@4.0.0`, sequelize-cli (established in Phase 1), new `AdminUsersScopedRole` Sequelize model.

**Implements from ARCHITECTURE.md:** All 7 architecture phases in the suggested build order.

**Addresses from FEATURES.md:** All P1 scoped role features (person type scoping, org unit scoping, combined scoping, manage from Manage Users, role display in table).

**Avoids from PITFALLS.md:** Pitfall 4 (scope without server-side enforcement), Pitfall 9 (UI does not reflect 2D data model), Pitfall 11 (context-unaware dropdown actions).

### Phase 4: Scoped Role Enhancements (v1.x)

**Rationale:** These features add value only after Phase 3 is validated by real curators. The auto-filtering payoff depends on scope definitions being confirmed correct. The auth debugging panel is most useful after the /noaccess fix proves stable.

**Delivers:** Scoped curation queue auto-filtering in Search and Group Curation; effective permissions preview in Manage Users; Superuser-only auth debugging panel showing JWT contents and middleware routing decisions; audit log table for role changes.

**Addresses from FEATURES.md:** All P2 features (scoped queue auto-filtering, effective permissions preview, auth debugging panel, audit trail).

**Avoids from PITFALLS.md:** Pitfall 14 (admin settings loaded on every session refresh).

### Phase Ordering Rationale

- Phase 1 before Phase 3: The middleware refactor and migration infrastructure are prerequisites. The paa2013 bug proves the middleware is already broken for complex role combinations.
- Phase 2 after Phase 1: Cannot audit pages you cannot log into. Cannot establish new UI patterns before knowing what the audit will surface.
- Phase 2 before Phase 3: New scoped role UI built in Phase 3 should incorporate audit findings. Running the audit after Phase 3 would require revisiting new components.
- Phase 4 after Phase 3 with a validation gap: Scoped queue auto-filtering depends on curators confirming their scope definitions are correct. A gap between Phase 3 and Phase 4 is intentional.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 3 (Scoped Roles Core), scoped assignment UI:** The scope assignment form is two-dimensional (person type x org unit), and the existing MUI Autocomplete pattern does not communicate this. Needs a UI design mockup and stakeholder review before coding. Research the right component pattern before implementation starts.
- **Phase 3 (Scoped Roles Core), curation API enforcement:** The full list of API routes that perform curation mutations needs a dedicated audit before adding scope checks. The key endpoints are known but each route needs individual scope-check design.

Phases with well-documented patterns (skip research-phase):

- **Phase 1 (Auth fixes and middleware refactor):** Root causes identified with HIGH confidence from direct codebase analysis. Implementation is debugging and refactoring, not discovery.
- **Phase 2 (UI/UX audit):** Audit methodology is standard. The loader pattern inventory is already complete (18 Loader files, 3 CSS GIF files).
- **Phase 4 (Enhancements):** Extensions of Phase 3 patterns. No new architectural questions.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All new packages verified against existing pinned versions via npm peer dependency checks. @casl/react@4.0.0 / React 16 compatibility confirmed. |
| Features | MEDIUM-HIGH | Table stakes and v1 scope are well-defined. P2 feature scope (especially effective permissions preview UI) may need refinement based on curator feedback after Phase 3. |
| Architecture | HIGH | Based on direct codebase analysis of every relevant file. Build order derived from actual dependency relationships. |
| Pitfalls | HIGH | 11 of 15 pitfalls are HIGH confidence from direct codebase observation with specific line references. Remaining 4 are MEDIUM from structural analysis. |

**Overall confidence:** HIGH

### Gaps to Address

- **@axe-core/react React 16 compatibility:** Could not verify via npm peer deps. Test in a dev install before committing. If it fails, fall back to using `axe-core` directly in a test script.
- **SAML certificate status:** The paa2013 /noaccess issue could be a certificate rotation problem rather than a code logic bug. Before writing code, verify certificate expiry for the EKS IdP cert and confirm it matches the stored `idp.crt`.
- **Session TTL for scoped role changes:** The current JWT session is 7200 seconds (2 hours). Admins assigning new scoped roles must communicate to curators that they need to re-login. Decide whether to implement a shorter TTL for scoped-role-bearing sessions or a session invalidation mechanism before Phase 3 ships.
- **Org unit string normalization:** `person.primaryOrganizationalUnit` is a free-text string from the ReCiterDB ETL. Whitespace variations or capitalization inconsistencies could cause scope mismatches. Validate with `SELECT DISTINCT` before finalizing dropdown data source.
- **Table name consistency:** STACK.md and FEATURES.md use `admin_users_scoped_roles` while FEATURES.md's data model section uses `admin_users_scopes`. ARCHITECTURE.md settled on `admin_users_scoped_roles`. Use that name consistently in all migrations and models.
- **MySQL version and CHECK constraint support:** CHECK constraints require MySQL 8.0.16+. Verify RDS instance version during Phase 3 schema work. If MySQL 5.7, enforce the "at least one of personType/orgUnit non-null" rule at the application layer instead.

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: `src/middleware.ts`, `src/pages/api/auth/[...nextauth].jsx`, `controllers/db/userroles.controller.ts`, `controllers/db/manage-users/user.controller.ts`, `controllers/db/admin.users.controller.ts`, `src/db/models/*.ts`, `src/components/elements/AddUser/AddUser.tsx`, `src/components/elements/Manage/ManageUsers.tsx`, `config/saml.ts`
- npm registry: @casl/ability@6.8.0, @casl/react@4.0.0 peer dependency verification
- [CASL official docs](https://casl.js.org/v6/en/guide/install/)
- [CASL React integration](https://casl.js.org/v6/en/package/casl-react/)
- [Sequelize Migrations Documentation](https://sequelize.org/docs/v6/other-topics/migrations/)
- [next-auth v3 callbacks documentation](https://next-auth.js.org/configuration/callbacks)

### Secondary (MEDIUM confidence)

- [Elsevier Pure: Reporting Roles](https://helpcenter.pure.elsevier.com/en_US/reporting/reporting-roles)
- [Symplectic Elements: User Guide](https://manualzz.com/doc/4174490/symplectic-v4-elements-user-guide)
- [Oso: 10 RBAC Best Practices for 2025](https://www.osohq.com/learn/rbac-best-practices)
- [JWT Authorization Best Practices and Common Mistakes](https://www.permit.io/blog/how-to-use-jwts-for-authorization-best-practices-and-common-mistakes)
- [SAML Debugging Handbook 2026](https://www.scalelab.com/blog/saml-debugging-handbook-2026-how-to-diagnose-log-and-resolve-sso-failures)
- [Auth.js: Role-Based Access Control](https://authjs.dev/guides/role-based-access-control)
- [Admin Dashboard UI/UX Best Practices for 2025](https://medium.com/@CarlosSmith24/admin-dashboard-ui-ux-best-practices-for-2025-8bdc6090c57d)

### Tertiary (LOW confidence)

- [Diagnosing SAML Assertion Failures](https://workos.com/blog/saml-assertion-failures-debugging-guide) — certificate-specific failure modes; needs validation against actual EKS SAML config
- [NextAuth JWT Session Refresh Discussion #4229](https://github.com/nextauthjs/next-auth/discussions/4229) — session refresh approach for v3; community discussion, not official docs

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
