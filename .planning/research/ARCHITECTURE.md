# Architecture Patterns: Scoped Curation Roles

**Domain:** Granular permission system extension for scholarly publication management
**Researched:** 2026-03-16
**Confidence:** HIGH (based on direct codebase analysis and established RBAC patterns)

## Current Architecture (As-Is)

The existing RBAC system has four components that participate in authorization decisions. Understanding them precisely is critical because the scoped roles extension must integrate with each one.

### Current Component Map

```
[SAML IdP / Login Form]
        |
        v
[NextAuth Callback] -----> [userroles.controller] -----> [MySQL]
   (jwt callback)           (findUserPermissions)         admin_users
        |                                                 admin_users_roles
        v                                                 admin_roles
[JWT Token]
   { userRoles: "[{personIdentifier, roleLabel}, ...]" }
        |
        +--------> [Edge Middleware]     Route-level gating
        |           (src/middleware.ts)   Reads JWT, redirects by role
        |
        +--------> [SideNavbar]          Menu-level gating
        |           allowedRoleNames     Filters menu items by role
        |
        +--------> [Page SSR]            Page-level gating
        |           getServerSideProps   Redirects on missing role
        |
        +--------> [API Routes]          API-level gating
                    Authorization header  Validates backendApiKey (NOT role-aware)
```

### Current Data Model

```
admin_users (userID PK, personIdentifier, email, status, ...)
    |
    +--< admin_users_roles (id PK, userID FK, roleID FK)
    |        |
    |        +--- admin_roles (roleID PK, roleLabel)
    |             Values: Superuser, Curator_All, Reporter_All, Curator_Self
    |
    +--< admin_users_departments (id PK, userID FK, departmentID FK)
             |
             +--- admin_departments (departmentID PK, departmentLabel, ...)
```

**Key observation:** `admin_users_departments` exists but is NOT used in any authorization decision today. Departments are assigned to users in the Manage Users UI but never checked in middleware, page SSR, or API routes. This is a cosmetic/organizational field only.

### Current Auth Flow (Step by Step)

1. User authenticates via SAML assertion or credential form
2. `[...nextauth].jsx` calls `findUserPermissions(email/cwid)` which runs a raw SQL JOIN across `admin_users`, `admin_users_roles`, and `admin_roles`
3. Result is an array: `[{personIdentifier: "abc123", roleLabel: "Curator_All"}, ...]`
4. This array is serialized as a JSON string into the JWT token under `userRoles`
5. Edge middleware (`src/middleware.ts`) decodes the JWT, parses `userRoles`, and performs boolean checks: `isCuratorSelf`, `isSuperUser`, `isCuratorAll`, `isReporterAll`
6. Middleware redirects users to appropriate pages based on these boolean flags
7. Pages use `getServerSideProps` with `getSession()` to read the same `userRoles` and conditionally redirect
8. The `SideNavbar` reads `session.data.userRoles` client-side and filters menu items by `allowedRoleNames`
9. API routes do NOT check roles; they only validate the shared `backendApiKey` header

### Critical Constraints

- **JWT is the only auth transport**: Scoped role data must fit in the JWT token or be fetched separately. The JWT currently contains the full serialized role array.
- **Edge middleware cannot call the database**: Next.js 12 edge middleware runs in a V8 isolate; it cannot use Sequelize or make DB calls. All decisions must come from the JWT payload.
- **next-auth v3 session callback runs server-side**: The `session` callback can make DB calls but runs on every `getSession()` invocation.
- **No API-level role enforcement**: Today, any authenticated user with the `backendApiKey` can call any API endpoint. Scoped roles will need API-level enforcement for curation endpoints.

---

## Recommended Architecture (To-Be)

### Design Principle: Scope as a Qualifier, Not a Replacement

The scoped curation role system should NOT replace the existing four roles. Instead, it adds an optional scope qualifier to the `Curator_All` concept, creating a fifth implicit behavior: "Curator for a defined subset of people."

A user with scoped curation assignments but without `Curator_All` operates as a **Curator_Scoped**: they can curate publications for people matching their assigned person types and/or organizational units, but not everyone.

### New Database Schema

```
admin_users_scoped_roles (new table)
  +-----------------------+
  | id          INT PK AI |
  | userID      INT FK    |  --> admin_users.userID
  | personType  VARCHAR   |  --> matches person_person_type.personType (nullable)
  | orgUnit     VARCHAR   |  --> matches person.primaryOrganizationalUnit (nullable)
  | createTimestamp  DATETIME |
  | modifyTimestamp  DATETIME |
  +-----------------------+

  Constraints:
  - At least one of personType or orgUnit must be non-null (CHECK constraint)
  - Composite unique index on (userID, personType, orgUnit) to prevent duplicates
  - Foreign key on userID to admin_users
```

**Why a single table instead of two join tables:** The PROJECT.md specifies three scoping modes: person type only, org unit only, or both combined. A single table with nullable columns cleanly represents all three. Two separate join tables (`admin_users_person_types` and `admin_users_org_units`) would make the "both combined" case ambiguous: does having both mean AND (only people matching both) or OR (people matching either)? A single row per scope assignment is unambiguous.

**Why VARCHAR for personType/orgUnit instead of FK to a lookup table:** The `person_person_type.personType` and `person.primaryOrganizationalUnit` columns are VARCHAR strings, not FK references. The source data (ReCiterDB ETL) populates these as free-text values. Creating a normalized lookup table would require ETL changes. Using VARCHAR with a dropdown populated from `SELECT DISTINCT` keeps the schema aligned with the existing data model.

### Extended Component Map

```
[SAML IdP / Login Form]
        |
        v
[NextAuth Callback] --> [userroles.controller] --> [MySQL]
   (jwt callback)       (findUserPermissions)      admin_users
        |                  EXTENDED to also         admin_users_roles
        v                  fetch scoped roles       admin_roles
[JWT Token]                                         admin_users_scoped_roles (NEW)
   { userRoles: "[...]",
     scopedRoles: "[{personType, orgUnit}, ...]"  <-- NEW
   }
        |
        +--------> [Edge Middleware]       Route-level gating
        |           EXTENDED: treat        Users with scopedRoles get
        |           scopedRoles like       Curator_All-level routing
        |           Curator_All for        (access to /search, /curate)
        |           navigation purposes
        |
        +--------> [SideNavbar]            Menu-level gating
        |           EXTENDED: show         Scoped curators see Find People
        |           curator menus for      and Curate Publications
        |           scoped users
        |
        +--------> [Page SSR]             Page-level gating
        |           EXTENDED: allow        Scoped curators can access /search
        |           scoped curators        and /curate/:id (if id is in scope)
        |
        +--------> [API Routes]           API-level gating (NEW)
        |           NEW: /api/db/person    Filter search results to scoped
        |           EXTENDED: scope-aware  person types / org units
        |
        +--------> [Scope Resolver]       Authorization logic (NEW)
                    NEW utility module     Centralizes "can user X curate
                    shared by all layers   person Y?" decisions
```

### Component Boundaries

| Component | Responsibility | Communicates With | Changes Required |
|-----------|---------------|-------------------|------------------|
| **Sequelize Model: AdminUsersScopedRole** | ORM for `admin_users_scoped_roles` table | DB via Sequelize, init-models.ts | New file |
| **userroles.controller.ts** | Fetches roles + scoped roles at login | NextAuth callback, MySQL | Extend query to JOIN scoped roles |
| **NextAuth JWT callback** | Embeds scoped roles in JWT token | userroles.controller, JWT | Add `scopedRoles` to token |
| **Scope Resolver (new utility)** | Answers "can this user curate this person?" | Middleware, pages, API routes, navbar | New file: `src/utils/scopeResolver.ts` |
| **Edge Middleware** | Route-level redirects | JWT, scope resolver (lightweight version) | Extend role checks |
| **SideNavbar** | Menu visibility | Session (JWT), scope resolver | Extend `allowedRoleNames` logic |
| **Person API** | Search/filter people | Scope resolver, Sequelize | Add scope-based WHERE clauses |
| **Manage Users page/API** | CRUD scoped role assignments | AdminUsersScopedRole model | Extend form, extend API |
| **Curate page SSR** | Validate user can curate target person | Scope resolver, Person model | Add scope check in getServerSideProps |

### Data Flow: Login and Token Creation

```
1. User authenticates (SAML or credentials)
        |
2. [...nextauth].jsx authorize() calls findUserPermissions()
        |
3. findUserPermissions() runs EXTENDED query:
   - Original: JOIN admin_users + admin_users_roles + admin_roles
   - New: also LEFT JOIN admin_users_scoped_roles
   - Returns: { roles: [{roleLabel}], scopedRoles: [{personType, orgUnit}] }
        |
4. jwt callback stores both in token:
   token.userRoles = JSON.stringify(roles)
   token.scopedRoles = JSON.stringify(scopedRoles)  // NEW
        |
5. JWT is signed and set as cookie
```

### Data Flow: Middleware Route Check

```
1. Request arrives at protected route
        |
2. Edge middleware decodes JWT
        |
3. Parse userRoles (existing) + scopedRoles (new)
        |
4. Compute effective role:
   - isCuratorAll = has Curator_All role
   - isCuratorScoped = scopedRoles.length > 0 AND does NOT have Curator_All
   - isEffectiveCurator = isCuratorAll || isCuratorScoped
        |
5. Use isEffectiveCurator in place of isCuratorAll for route decisions
   (scoped curators can access /search and /curate/:id)
        |
6. NOTE: Middleware CANNOT validate whether a specific /curate/:id is
   in scope (would require DB call). This is deferred to page SSR.
```

### Data Flow: Person Search with Scope Filtering

```
1. Scoped curator visits /search
        |
2. getServerSideProps reads session, extracts scopedRoles
        |
3. Client loads search page, makes API call: POST /api/db/person
        |
4. API route extracts user identity from session
        |
5. Scope Resolver computes allowed filter:
   - If Superuser or Curator_All: no filter (see all)
   - If scoped: build WHERE clause from scopedRoles
     - personType IN (assigned types) via JOIN to person_person_type
     - AND/OR primaryOrganizationalUnit IN (assigned org units)
        |
6. person.controller.ts applies scope filter to Sequelize query
        |
7. Results returned: only people this curator is allowed to curate
```

### Data Flow: Curation Authorization Check

```
1. User navigates to /curate/abc123
        |
2. Page getServerSideProps calls getSession()
        |
3. Scope Resolver checks:
   a. Is user Superuser or Curator_All? --> ALLOW
   b. Is user Curator_Self and abc123 is their own ID? --> ALLOW
   c. Is user scoped curator?
      - Query person_person_type for abc123's types
      - Query person for abc123's primaryOrganizationalUnit
      - Check if ANY scoped role assignment matches:
        * If assignment has personType only: person must have that type
        * If assignment has orgUnit only: person must be in that org unit
        * If assignment has both: person must match BOTH
      - Any matching assignment --> ALLOW
   d. Otherwise --> REDIRECT to appropriate page
```

### Data Flow: Managing Scoped Role Assignments

```
1. Superuser visits /manageusers, selects a user to edit
        |
2. AddUser form EXTENDED with new section:
   "Scoped Curation Assignments"
   - Dropdown: Person Type (populated from SELECT DISTINCT personType
     FROM person_person_type)
   - Dropdown: Org Unit (populated from SELECT DISTINCT
     primaryOrganizationalUnit FROM person)
   - [Add Assignment] button creates a row in the UI list
   - Each row shows: [personType] + [orgUnit] with [Remove] button
        |
3. On save, createOrUpdateAdminUser() EXTENDED:
   - Within the same transaction that handles roles/departments:
   - DELETE FROM admin_users_scoped_roles WHERE userID = :id
   - INSERT new scoped role assignments
        |
4. Two new API endpoints:
   - GET /api/db/admin/personTypes  --> SELECT DISTINCT personType
   - GET /api/db/admin/orgUnits     --> SELECT DISTINCT primaryOrganizationalUnit
   (These feed the dropdown options in the Manage Users form)
```

---

## The Scope Resolver: Central Authorization Module

This is the most important new component. It prevents authorization logic from being duplicated across middleware, pages, API routes, and components.

### Interface

```typescript
// src/utils/scopeResolver.ts

interface ScopedRole {
  personType: string | null;
  orgUnit: string | null;
}

interface UserAuthContext {
  userRoles: Array<{ personIdentifier: string; roleLabel: string }>;
  scopedRoles: ScopedRole[];
}

// Lightweight check (no DB call): can this user access curator features at all?
function isEffectiveCurator(auth: UserAuthContext): boolean

// Lightweight check: does this user have any scoped restrictions?
function isScopedCurator(auth: UserAuthContext): boolean

// Full check (requires DB): can this user curate a specific person?
// Used in page SSR and API routes (NOT in edge middleware)
async function canCuratePerson(
  auth: UserAuthContext,
  targetPersonIdentifier: string
): Promise<boolean>

// Query builder: returns Sequelize WHERE conditions to filter
// person search results to only in-scope people
function buildScopeFilter(
  auth: UserAuthContext
): object  // Sequelize where clause
```

### Why a Centralized Resolver

The existing codebase has authorization logic duplicated in four places: `middleware.ts`, `index.js` (SSR), `SideNavbar.tsx`, and individual page SSR functions. Each implements its own version of "check roles." The scoped role logic is more complex (requires understanding person type + org unit combinations), so centralizing it prevents divergent implementations.

The resolver has two tiers:
1. **Lightweight (JWT-only)**: `isEffectiveCurator()` and `isScopedCurator()` work from the JWT payload alone. Safe for edge middleware and client-side navbar.
2. **Full (DB-required)**: `canCuratePerson()` and `buildScopeFilter()` query `person` and `person_person_type` tables. Used in SSR and API routes.

---

## Patterns to Follow

### Pattern 1: Additive Role Enhancement

**What:** Scoped roles are additive. Having a scoped role never reduces access compared to base roles. A user with both `Curator_All` and scoped assignments still has full curator access; the scoped assignments are redundant but harmless.

**When:** Evaluating any authorization decision.

**Rule:**
```
effectiveAccess = baseRoleAccess UNION scopedRoleAccess
```

### Pattern 2: Scope Assignment as Data, Not as a New Role Type

**What:** Do NOT add new entries to `admin_roles` (e.g., "Curator_Affiliates" or "Curator_Medicine"). Instead, use the separate `admin_users_scoped_roles` table with data-driven scope values.

**Why:** Person types and org units change over time as the institution evolves. Hardcoding them as role labels would require code changes and migrations for each new type/unit. Keeping scopes as data means the system adapts by adding rows.

### Pattern 3: Transaction-Wrapped Assignments

**What:** The existing `createOrUpdateAdminUser` already uses `sequelize.transaction()` for atomic role + department assignment. Scoped role changes must join this same transaction.

**When:** Creating or updating user assignments in Manage Users.

### Pattern 4: Filter at Query Time, Not at Display Time

**What:** When a scoped curator searches for people, filter results in the SQL query (server-side), not by fetching all results and filtering in JavaScript.

**Why:** The `person` table can have thousands of rows. Client-side filtering wastes bandwidth and leaks data about people the curator should not see.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Scope in the Role Label

**What:** Adding roles like "Curator_affiliate" or "Curator_Medicine" to `admin_roles`.

**Why bad:** Every new person type or org unit would require a new role, a new migration, and updates to every authorization check. The combinatorics (type x org unit) make this untenable.

**Instead:** Use the `admin_users_scoped_roles` data table with nullable personType/orgUnit columns.

### Anti-Pattern 2: Client-Side-Only Scope Enforcement

**What:** Checking scopes only in the SideNavbar or React components while leaving API routes unprotected.

**Why bad:** A user could bypass the UI and call `/api/reciter/userfeedback/save/[uid]` to curate someone outside their scope.

**Instead:** Enforce scope checks in API routes that modify curation data (gold standard, user feedback).

### Anti-Pattern 3: Querying Scoped Roles on Every Request

**What:** Making a database call on every API request to re-fetch the user's scoped role assignments.

**Why bad:** Adds latency to every request. The existing system caches roles in the JWT for the session duration.

**Instead:** Embed scoped roles in the JWT at login time (same pattern as base roles). Accept that changes to scoped assignments require re-login to take effect, matching the existing behavior for base role changes.

### Anti-Pattern 4: Splitting the Middleware with Complex Per-Person Logic

**What:** Trying to validate whether `/curate/abc123` is in scope within edge middleware by somehow encoding all in-scope person identifiers.

**Why bad:** Edge middleware cannot call the database. Encoding all in-scope person IDs in the JWT would bloat the token (could be thousands of people). The middleware would become unmaintainably complex.

**Instead:** Middleware only checks "is this user any kind of curator?" for route access. Page-level SSR (`getServerSideProps`) performs the per-person scope check with a DB query.

---

## Suggested Build Order

Build order matters because later components depend on earlier ones.

### Phase 1: Database Schema + Sequelize Model

**Dependencies:** None (foundation for everything else)

Build:
1. SQL migration: CREATE TABLE `admin_users_scoped_roles`
2. New Sequelize model: `AdminUsersScopedRole.ts`
3. Update `init-models.ts` with new model and associations
4. Add relationship: `AdminUser.hasMany(AdminUsersScopedRole)`

**Validates:** Schema design, association patterns

### Phase 2: Scope Resolver Utility

**Dependencies:** Phase 1 (needs model for `canCuratePerson` DB queries)

Build:
1. `src/utils/scopeResolver.ts` with all four functions
2. Unit tests for each function (mock Sequelize calls)
3. Test edge cases: no scoped roles, type-only, org-only, both, overlapping

**Validates:** Authorization logic correctness before integrating anywhere

### Phase 3: Auth Flow Extension (Login + JWT)

**Dependencies:** Phase 1 (needs model), Phase 2 (uses resolver types)

Build:
1. Extend `findUserPermissions()` in `userroles.controller.ts` to LEFT JOIN scoped roles
2. Extend JWT callback in `[...nextauth].jsx` to embed `scopedRoles`
3. Test: login with scoped user, verify JWT contains scoped roles

**Validates:** Token contains correct data

### Phase 4: Middleware + Navigation Extension

**Dependencies:** Phase 3 (needs JWT with scopedRoles)

Build:
1. Extend `middleware.ts`: parse `scopedRoles`, compute `isEffectiveCurator`
2. Extend `SideNavbar.tsx`: show curator menus for scoped users
3. Extend `constants.js`: add "Curator_Scoped" to display/permission checks if needed
4. Test: scoped user sees correct menu items, can navigate to /search and /curate

**Validates:** Navigation works for scoped users

### Phase 5: Person Search Filtering

**Dependencies:** Phase 2 (scope resolver), Phase 3 (JWT with scopes)

Build:
1. Extend `/api/db/person` to accept user context
2. Use `buildScopeFilter()` to add WHERE clauses for scoped curators
3. Scoped curators see only in-scope people in search results
4. Test: scoped curator searches, sees only matching people

**Validates:** Data access is properly restricted

### Phase 6: Curation Authorization

**Dependencies:** Phase 2, Phase 3, Phase 5

Build:
1. Extend `/curate/[id].tsx` SSR: call `canCuratePerson()` before rendering
2. Extend curation API routes (goldstandard, userfeedback): validate scope
3. Test: scoped curator can curate in-scope person, gets redirected for out-of-scope

**Validates:** End-to-end curation workflow is scope-aware

### Phase 7: Manage Users UI Extension

**Dependencies:** Phase 1 (model), Phase 3 (understands scoped data)

Build:
1. New API endpoints: GET person types, GET org units (for dropdowns)
2. Extend `createOrUpdateAdminUser()`: handle scoped role CRUD in transaction
3. Extend AddUser form: scoped role assignment section
4. Test: superuser creates scoped user, assignments persist

**Validates:** Administrative workflow is complete

### Build Order Dependency Graph

```
Phase 1 (Schema)
    |
    +---> Phase 2 (Resolver)
    |         |
    |         +---> Phase 5 (Search Filter)
    |         |         |
    |         +---> Phase 6 (Curation Auth)
    |         |
    +---> Phase 3 (Auth Flow)
              |
              +---> Phase 4 (Middleware + Nav)
              |
              +---> Phase 5 (also needs JWT)
              |
              +---> Phase 6 (also needs JWT)

Phase 7 (Manage Users) depends on Phase 1 only for the model,
but logically should come after Phase 4 so the admin can test
the scoped user experience immediately after assigning roles.
```

---

## Scalability Considerations

| Concern | Current (4 roles) | With scoped roles | If scope assignments grow large |
|---------|-------------------|-------------------|-------------------------------|
| JWT size | ~500 bytes for roles | +200-500 bytes for scoped roles (typically 1-5 assignments) | If a user has 20+ scope assignments, JWT could grow to 2-3KB. Still within cookie limits (4KB). |
| Login query | 1 JOIN query | 1 query with additional LEFT JOIN | Negligible impact; scoped roles table will have at most hundreds of rows total. |
| Person search | Single query, no scope filter | Added WHERE clause with IN/JOIN | Indexed columns (personType, primaryOrganizationalUnit) keep this fast. |
| Middleware | Parse + 4 boolean checks | Parse + 5 boolean checks | No scaling concern; runs in memory from JWT. |
| Per-person auth check | Not done (binary curator check) | 1-2 queries per curate page load | Acceptable; runs in SSR, cacheable via React Query. |

---

## Sources

- Direct codebase analysis of `src/middleware.ts`, `src/pages/api/auth/[...nextauth].jsx`, `controllers/db/userroles.controller.ts`, `controllers/db/manage-users/user.controller.ts`, `controllers/db/admin.users.controller.ts`, `src/db/models/*.ts`, `src/utils/constants.js`, `src/components/elements/Navbar/SideNavbar.tsx`, `src/pages/index.js`, `src/pages/search/index.js`, `controllers/db/person.controller.ts`
- Next.js 12 edge middleware limitations: documented in Next.js 12 release notes (edge runtime does not support Node.js APIs like database drivers) [HIGH confidence]
- next-auth v3 JWT session pattern: documented behavior where JWT callback runs on sign-in and session callback runs on every getSession() call [HIGH confidence]
- Sequelize v6 transaction and association patterns: consistent with existing codebase usage [HIGH confidence]
