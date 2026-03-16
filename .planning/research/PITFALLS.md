# Domain Pitfalls

**Domain:** Scholarly publication management curation tool (RPM) with scoped permission extensions, SAML auth debugging, UI/UX audit, loading animation replacement
**Researched:** 2026-03-16

## Critical Pitfalls

Mistakes that cause rewrites, security holes, or major operational issues.

### Pitfall 1: Middleware Role Logic Becomes Combinatorial Explosion

**What goes wrong:** The existing `middleware.ts` already contains ~100 lines of deeply nested `if/else` branches that enumerate every possible combination of roles and `userRoles.length`. Adding scoped curation roles (person type, org unit, or both) multiplies the combinatorial space. With 4 existing roles and N scoped variants, the middleware becomes unmaintainable and produces silent authorization failures for untested role combinations.

**Why it happens:** The current pattern checks `userRoles.length == 1`, `userRoles.length == 2`, `userRoles.length == 3` explicitly. Each new role type added to the system requires updating every branch. The code was written for a small, fixed set of roles and does not scale.

**Consequences:** Users with valid permissions get redirected to `/noaccess` or wrong pages. This is already happening (the paa2013 bug: user has all 4 roles but gets redirected to `/noaccess`). Adding scoped roles without refactoring the middleware will make this class of bug systematic rather than isolated.

**Prevention:**
1. Refactor middleware to use a capability-based check ("can this user access this route?") instead of enumerating role combinations. Define a route-to-required-capabilities map and check the user's role set against it.
2. Extract the authorization logic into a pure function that can be unit tested with every role combination.
3. Write exhaustive test cases for the role matrix before adding new roles.

**Detection:** Users reporting "access denied" when they should have access. QA testing with users who have multi-role assignments. The paa2013 bug is the current warning sign.

**Phase relevance:** Must be addressed in the bug fix phase before scoped roles are added. The scoped roles phase should build on a refactored middleware, not extend the existing combinatorial pattern.

**Confidence:** HIGH. Directly observed in codebase: `src/middleware.ts` lines 36-101.

---

### Pitfall 2: JWT Token Bloat and Stale Scoped Permissions

**What goes wrong:** The current auth flow stores the complete `userRoles` array (with personIdentifier and roleLabel for every assigned role) as a JSON string inside the JWT token. Adding scoped roles means the JWT payload grows to include person types, org units, and their combinations for each user. JWT tokens have practical size limits (~4KB for cookies), and large tokens can break HTTP header limits or cause silent authentication failures.

**Why it happens:** The `[...nextauth].jsx` jwt callback stores `apiResponse.userRoles` directly into the token. The current `findUserPermissions` query returns rows with `personIdentifier` and `roleLabel`. Adding scoped permissions (person type + org unit per scoped role) to this same structure inflates the token size proportionally to the number of scopes assigned to a user.

**Consequences:**
- JWT cookies exceed browser cookie size limits (typically 4KB), causing silent auth failures.
- The middleware `jose.decodeJwt()` call succeeds but the double `JSON.parse` on `decodedTokenJson.userRoles` fails on malformed or truncated data.
- Scoped permissions are stale for the entire JWT session lifetime (currently 7200 seconds / 2 hours). If an admin changes a user's scoped roles, the user must log out and back in before the change takes effect.

**Prevention:**
1. Store only the user's `userID` (or a minimal role summary) in the JWT. Fetch full scoped permissions from the database on each API request or use a short-lived server-side cache.
2. If scoped permissions must be in the JWT, normalize the structure: store role IDs and scope IDs as compact arrays rather than repeated objects.
3. For permission updates, implement a session refresh mechanism. In next-auth v3, this can be done by forcing session refetch via the `refetchInterval` option on the client `<Provider>`, or by adding a version counter that triggers re-authentication when permissions change.

**Detection:** Auth failures in EKS logs after scoped roles are assigned. JWT decode errors in middleware console logs. Users reporting they still see old permissions after an admin change.

**Phase relevance:** Must be designed into the scoped roles architecture from the start. Retrofitting after scoped roles are shipped in the JWT is a rewrite.

**Confidence:** HIGH. Observed in codebase: `[...nextauth].jsx` line 124-125, `middleware.ts` lines 18-25, session maxAge 7200 at line 132.

**Sources:**
- [JWT Authorization Best Practices and Common Mistakes](https://www.permit.io/blog/how-to-use-jwts-for-authorization-best-practices-and-common-mistakes)
- [NextAuth JWT Session Refresh Discussion #4229](https://github.com/nextauthjs/next-auth/discussions/4229)

---

### Pitfall 3: Dual Auth Path Divergence (SAML vs Local)

**What goes wrong:** The SAML and local (credentials) auth paths in `[...nextauth].jsx` follow different code paths that produce subtly different session structures. The SAML path calls `findAdminUser` (no auto-create), while the local path calls `findOrCreateAdminUsers` (auto-creates with status=0). When scoped roles are added, the authorization logic must work identically in both paths, but divergent session structures cause one path to work and the other to fail.

**Why it happens:** The SAML authorize function (lines 38-98) looks up users by email first, then by CWID. The local authorize function (lines 19-31) looks up by CWID only. The SAML path has a fallback that returns `{ cwid, has_access: false }` if no user is found, while the local path returns `null`. These differences accumulate silently until a new feature exposes them. Additionally, the SAML path has the expression `adminUser.personIdentifier` on lines 78 and 88 that evaluates but discards the result (missing assignment).

**Consequences:** Scoped roles work for local dev testing but fail in production SAML, or vice versa. The divergence is invisible during development because developers use `LOGIN_PROVIDER=LOCAL` while EKS uses `LOGIN_PROVIDER=SAML`. Bugs surface only after deployment.

**Prevention:**
1. Unify the post-authentication logic into a single function that both auth paths call. After SAML/local credentials are validated, both paths should call the same `resolveUserSession(identifier, identifierType)` function that handles user lookup, role fetching, and session construction.
2. Add integration tests that exercise both auth paths with identical role configurations and verify identical session structures.
3. Fix the dangling `adminUser.personIdentifier` expressions in the SAML path.

**Detection:** Bugs that reproduce on EKS but not locally (or vice versa). Different session structures visible in `console.log` output between the two paths.

**Phase relevance:** Auth bug fix phase (the paa2013 issue). This must be unified before scoped roles are layered on.

**Confidence:** HIGH. Directly observed in `src/pages/api/auth/[...nextauth].jsx`.

---

### Pitfall 4: Scoped Roles Without Server-Side Enforcement

**What goes wrong:** The curate page fetches publications via the ReCiter API using only the `personIdentifier` from the URL parameter (`/curate/[id]`). If scoped curation roles are only enforced in the middleware (client-side routing), a user can directly call the API endpoints (`/api/reciter/getPublications/[uid]`, `/api/reciter/userfeedback/save/[uid]`) to curate any person's publications, bypassing the scope restrictions entirely.

**Prevention:**
1. Enforce scoped permissions at the API route level, not just in middleware routing. Every API endpoint that performs a curation action must verify that the authenticated user's scoped roles authorize the action on the target person.
2. Create a reusable `checkCurationScope(userId, targetPersonId)` function that queries the person's type and org unit, then checks against the user's scoped role assignments.
3. The middleware continues to handle route-level UX (hiding pages the user should not visit), but the API routes are the security boundary.

**Detection:** Security review discovering that API endpoints accept any personIdentifier without scope validation. Penetration testing showing that a scoped curator can curate publications outside their scope by calling the API directly.

**Phase relevance:** Scoped roles implementation phase. This must be part of the initial design, not added as a hardening pass.

**Confidence:** HIGH. Observed: API routes in `src/pages/api/` check only `req.headers.authorization` against `backendApiKey`, not per-user scoped permissions.

---

### Pitfall 5: Database Schema Changes Without Migration Infrastructure

**What goes wrong:** The codebase uses `Sequelize.sync()` patterns and hand-written SQL queries (see `userroles.controller.ts`) without a formal migration system. Adding new tables for scoped roles (e.g., `admin_users_scoped_roles`, `admin_scoped_person_types`, `admin_scoped_org_units`) to the production database without migrations risks data loss if `sync({ force: true })` or `sync({ alter: true })` is accidentally invoked, and makes rollback impossible.

**Why it happens:** The existing codebase has no `migrations/` directory and no `SequelizeMeta` tracking table. Models are defined but there is no migration workflow. New developers or automated deployments may call sync methods that destructively modify the schema.

**Consequences:** Production data loss. Inconsistent schema between dev and production. No rollback path if a schema change causes issues. The existing `admin_users_roles` table (with its destroy-and-recreate pattern in `user.controller.ts` lines 117-155) already demonstrates fragile schema management.

**Prevention:**
1. Initialize Sequelize CLI migrations before adding any new tables. Create a baseline migration that captures the current schema state.
2. Create forward and rollback migrations for every new scoped-role table.
3. Never use `sequelize.sync()` in production; rely exclusively on migrations.
4. Add the migration step to the CodeBuild pipeline (`k8-buildspec.yml`) so migrations run automatically during deployment.

**Detection:** Differences between local dev schema and production schema. Missing tables after deployment. `SequelizeMeta` table absent from production database.

**Phase relevance:** Must be established before the scoped roles phase. The bug fix phase is the right time to introduce migration infrastructure with a no-op baseline migration.

**Confidence:** HIGH. Observed: no `migrations/` directory in codebase; raw SQL in `userroles.controller.ts`; destructive delete/recreate pattern in `user.controller.ts`.

**Sources:**
- [Sequelize Migrations Documentation](https://sequelize.org/docs/v6/other-topics/migrations/)
- [Navigating Database Migrations with Confidence in Production](https://jazimabbas.medium.com/navigating-database-migrations-with-confidence-a-step-by-step-guide-using-sequelize-85bbdb7fc97a)

---

## Moderate Pitfalls

### Pitfall 6: Double JSON.parse Token Deserialization Fragility

**What goes wrong:** The middleware deserializes the JWT token through an unusual double-parse chain: `jose.decodeJwt()` returns a JSON object, then `JSON.stringify(decodedTokenJson)` converts the entire token back to a string, then `JSON.parse(allUserRoles)` parses it again, then `JSON.parse(userRoles.userRoles)` parses the nested userRoles string. This fragile chain breaks silently if the data shape changes (e.g., if scoped role data is added as nested objects).

**Prevention:**
1. Refactor the middleware to parse the JWT token once: `const tokenData = jose.decodeJwt(cookie); const userRoles = JSON.parse(tokenData.userRoles);`
2. Add TypeScript type definitions for the expected JWT payload shape.
3. Add error handling around the parse chain so failures produce clear error messages instead of silent redirects.

**Phase relevance:** Bug fix phase. This is likely related to the paa2013 redirect issue.

**Confidence:** HIGH. Directly observed: `middleware.ts` lines 18-25.

---

### Pitfall 7: Loading Animation Replacement Misses Hidden Instances

**What goes wrong:** The project has two distinct loading patterns: (1) the `Loader` component (React Bootstrap `Spinner`, red border variant, 5rem) used in 18+ component files, and (2) the legacy `appLoader` CSS class that references `main-loader.gif` used in `Identity.js`, `TabAddPublication.tsx`, and `App.js`. Replacing only one pattern leaves inconsistent loading UX across the app. Replacing the GIF without updating all CSS references creates broken image states.

**Prevention:**
1. Audit all loading patterns before making changes. The current inventory:
   - `Loader` component: 18 files import it
   - `appStyles.appLoader` CSS class: 3 files use it (Identity.js, TabAddPublication.tsx, App.js)
   - Direct GIF reference: `public/images/main-loader.gif`
2. Replace both patterns simultaneously. Convert all `appLoader` usages to use the `Loader` component (or a new unified component).
3. After replacement, delete `main-loader.gif` and the `.appLoader` CSS class to prevent future developers from accidentally using the old pattern.

**Detection:** Visual inconsistency: some pages show the new loading animation while others show the old red circle GIF. Search for `appLoader` and `Loader` across the codebase.

**Phase relevance:** UI/UX audit phase. Should be a discrete task with a checklist of all instances.

**Confidence:** HIGH. Directly observed: `Loader.tsx`, `App.module.css`, grep results showing 18+ files using Loader and 3 files using appLoader.

---

### Pitfall 8: UI/UX Audit Scope Creep into Refactoring

**What goes wrong:** A UI/UX audit identifies issues like inconsistent spacing, accessibility violations, broken responsive layouts, and deprecated component usage. Without strict scope boundaries, "fixing" these issues turns into a refactoring effort that touches Redux actions, API routes, and component architecture. This delays the scoped roles feature and introduces regressions in working functionality.

**Why it happens:** Legacy React 16 apps often have tightly coupled UI and business logic. Fixing a "simple" alignment issue in the curation page may require understanding the Redux state that controls the component's rendering. The AddUser component (lines 84-108) demonstrates this: the form submission logic, routing, and Redux dispatch are interleaved with the form rendering.

**Prevention:**
1. Categorize audit findings into three buckets: (a) visual-only fixes (CSS, spacing, colors), (b) behavioral fixes (broken interactions, missing feedback), (c) architectural issues (component restructuring, state management). Only implement (a) and (b) in the audit phase; document (c) for future work.
2. Set a hard rule: audit fixes must not change API contracts, Redux action shapes, or Sequelize model definitions.
3. Timebox the audit implementation to prevent it from consuming the entire milestone.

**Detection:** Audit fix PRs that modify files in `controllers/`, `redux/actions/`, or `db/models/`. Audit tasks taking more than 2x estimated time.

**Phase relevance:** UI/UX audit phase. Define scope gates before starting.

**Confidence:** MEDIUM. Based on codebase observation (tight coupling in AddUser, ManageUsers) and general UI audit experience.

**Sources:**
- [How to Redesign a Legacy UI Without Losing Users](https://xbsoftware.com/blog/legacy-app-ui-redesign-mistakes/)

---

### Pitfall 9: Scoped Role Assignment UI Does Not Reflect Data Model Complexity

**What goes wrong:** The existing AddUser form uses MUI `Autocomplete` with `freeSolo` for role and department selection. Extending this for scoped roles (person type + org unit combinations) creates a confusing UI where admins cannot understand what combination of scopes a user has. A flat list of checkboxes or autocomplete tags does not communicate that person type and org unit can be combined to create AND conditions (e.g., "curate alumni IN cardiology").

**Why it happens:** The existing UI pattern (tag-based multi-select) works for flat lists (roles, departments) but breaks down for two-dimensional scoping (type x unit). Developers often reuse the existing UI pattern without redesigning for the new data model.

**Prevention:**
1. Design the scoped role assignment UI as a separate component, not an extension of the existing role/department autocomplete.
2. Use a table or matrix visualization: rows for person types, columns for org units, cells for assigned/unassigned.
3. Show a human-readable summary of the effective permissions: "This user can curate publications for: affiliates in Cardiology, all alumni."
4. Get stakeholder sign-off on the UI mockup before implementing.

**Detection:** Admin users confused about what scoped roles they have assigned. Support requests asking "what can this curator see?"

**Phase relevance:** Scoped roles implementation phase. Design the UI before writing code.

**Confidence:** MEDIUM. Based on analysis of the existing AddUser form pattern and the combinatorial nature of person type + org unit scoping.

---

### Pitfall 10: SAML Certificate and Environment Drift Between Dev and Production

**What goes wrong:** The SAML configuration reads certificates from the filesystem at startup (`fs.readFileSync` in `config/saml.ts`). The CodeBuild pipeline pulls certificates from S3 during the pre-build step. If dev and production use different IdP certificates, different entity IDs, or different assertion endpoints, SAML authentication can silently fail in one environment. Clock skew between the EKS pod and the IdP can also invalidate SAML assertions.

**Why it happens:** SAML configuration has many moving parts: SP cert/key pair, IdP cert, entity ID, assertion endpoint, SSO URLs. These are set via environment variables and S3 artifacts. A certificate renewal in one environment that is not propagated to the other causes auth failures that are difficult to diagnose because the error handling in the SAML authorize function (line 96-98) catches all errors and returns `null`, losing the error details.

**Prevention:**
1. Add explicit SAML error logging before the catch block. Return the error message to the client in a development-friendly format (but not in production).
2. Create a SAML diagnostic endpoint (protected, Superuser only) that reports: certificate expiry dates, clock skew between server and IdP, entity ID configuration, assertion endpoint.
3. Document the certificate renewal process and set calendar reminders for expiry.
4. Ensure the `force_authn: true` setting does not cause login loops when combined with certain IdP configurations.

**Detection:** SAML logins failing in production but not locally (because local uses `LOGIN_PROVIDER=LOCAL`). Certificate expiry warnings in IdP admin console.

**Phase relevance:** Auth bug fix phase. The paa2013 issue may be related to SAML session construction.

**Confidence:** MEDIUM. SAML config observed in `config/saml.ts`; error swallowing observed in `[...nextauth].jsx` line 96-98.

**Sources:**
- [SAML Debugging Handbook 2026](https://www.scalekit.com/blog/saml-debugging-handbook-2026-how-to-diagnose-log-and-resolve-sso-failures)
- [Diagnosing SAML Assertion Failures](https://workos.com/blog/saml-assertion-failures-debugging-guide)

---

### Pitfall 11: The "Curate Publications" Button on Search Page Exposes Wrong Actions

**What goes wrong:** The Search page currently shows a "Curate publications" action that should not be available there (identified bug). Simply hiding the button without understanding why it appears risks re-introducing it in future changes. The root cause is likely that the search results dropdown (`dropdownItemsSuper` in `constants.js`) is not contextually scoped: the same dropdown items render regardless of which page the user is on.

**Prevention:**
1. Trace the dropdown rendering from the Search component to understand which action items it displays and why.
2. Fix at the data level (the action list should be page-aware), not just with a CSS `display:none` or conditional render on the button. The search results component should receive an explicit list of allowed actions for its context.
3. When scoped roles are added, dropdown actions must also respect scope: a scoped curator should see "Curate publications" only for people within their scope.

**Detection:** Dropdown actions appearing on pages where they should not. Actions that should be filtered by scoped roles still appearing for all curators.

**Phase relevance:** Bug fix phase (the explicit bug), then revisited in scoped roles phase (scope-aware action filtering).

**Confidence:** HIGH. Bug is identified in PROJECT.md. Root cause analysis based on `constants.js` dropdown definitions and Search component structure.

---

## Minor Pitfalls

### Pitfall 12: AddUser Form Navigation Goes to Wrong Route After Save

**What goes wrong:** The AddUser component (line 99, 106) redirects to `/admin/manage/users` after creating or updating a user. But the actual Manage Users page is at `/manageusers`. This means after saving a user edit, the app navigates to a 404 page. This existing bug will be compounded if the scoped roles form extends the AddUser component.

**Prevention:** Fix the redirect path to `/manageusers` before extending the form for scoped roles.

**Detection:** Users hitting 404 after saving user changes.

**Phase relevance:** Bug fix phase. Trivial fix but critical to UX.

**Confidence:** HIGH. Directly observed: `AddUser.tsx` lines 99, 106.

---

### Pitfall 13: Client-Side Filtering Masks Server-Side Pagination Bugs

**What goes wrong:** The ManageUsers component fetches paginated data from the server but then applies client-side filtering on top (`filter()` function, lines 98-131). When search text does not match, it falls back to showing `allUsers` (which is the current page, not all users). This creates confusing behavior where filtering appears to "reset" rather than show "no results." When the user list grows with scoped role information, this pattern will cause performance issues and incorrect filter results.

**Prevention:** Move all filtering to the server side. The `listAllUsers` controller already supports `searchTextInput`; use it consistently instead of duplicating filtering on the client.

**Phase relevance:** UI/UX audit phase.

**Confidence:** HIGH. Directly observed: `ManageUsers.tsx` lines 98-131, dual client/server filtering.

---

### Pitfall 14: Admin Settings Loaded on Every Session Refresh

**What goes wrong:** The `[...nextauth].jsx` session callback calls `fetchUpdatedAdminSettings()` on every session refresh (line 110), querying the database each time. The commented-out guard (`if(session || !session.adminSettings)`) would always evaluate to true anyway (since `session` is always truthy in the callback). As more settings are added for scoped roles configuration, this becomes a performance bottleneck.

**Prevention:** Add proper caching for admin settings (in-memory with TTL, or check a version hash before re-fetching). The session callback fires frequently; it should not make database queries on every invocation.

**Phase relevance:** Performance concern. Should be noted during scoped roles phase but can be deferred to a performance pass.

**Confidence:** HIGH. Directly observed: `[...nextauth].jsx` lines 109-110.

---

### Pitfall 15: `freeSolo` Autocomplete Allows Invalid Role/Department Values

**What goes wrong:** The AddUser form uses MUI `Autocomplete` with `freeSolo={true}` for both roles and departments (lines 271-291 of AddUser.tsx). This allows admins to type arbitrary text that does not correspond to any existing role or department. When the form submits, these invalid values are sent to the controller, which looks up role/department IDs by label. Invalid labels silently produce empty arrays, creating users with no roles or departments despite the admin thinking they assigned them.

**Prevention:** Remove `freeSolo` from the role and department autocomplete components. Roles and departments should only be selectable from the existing options, not free-text.

**Detection:** Users created without roles despite the admin selecting values. Empty `selectedRoleIds` or `departmentIds` arrays in the create payload.

**Phase relevance:** Bug fix or UI/UX audit phase.

**Confidence:** HIGH. Directly observed: `AddUser.tsx` lines 246-263, 270-291.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auth bug fixes (paa2013) | Double JSON.parse chain in middleware fails for certain JWT structures | Refactor to single-parse with error handling; trace the exact JWT payload for paa2013 |
| Auth bug fixes (paa2013) | SAML vs Local auth paths produce different session data shapes | Unify post-auth logic into shared function; test both paths |
| Loading animation replacement | Two distinct loading patterns (component + CSS GIF) exist; replacing only one creates inconsistency | Inventory all 21+ locations; replace both patterns atomically |
| UI/UX audit | Audit findings tempt full component rewrites that delay the milestone | Strict scope: visual and behavioral fixes only; document architectural issues for later |
| UI/UX audit | Client-side filtering in ManageUsers masks real pagination/search bugs | Move filtering server-side during audit |
| Scoped roles: database | No migration infrastructure exists; schema changes risk data loss | Establish Sequelize CLI migrations before adding tables |
| Scoped roles: JWT | Scoped permissions inflate JWT token past cookie size limits | Store minimal data in JWT; fetch full permissions server-side |
| Scoped roles: middleware | Adding scoped role checks to the existing combinatorial middleware creates unmaintainable code | Refactor middleware to capability-based check before adding scoped roles |
| Scoped roles: API enforcement | Scope restrictions in middleware only; API endpoints remain unprotected | Enforce scoped permissions at every curation API endpoint |
| Scoped roles: UI | Flat autocomplete UI cannot communicate two-dimensional scope (type x unit) | Design a purpose-built scope assignment component |
| Scoped roles: session | Permission changes require re-login under current JWT session model | Implement session refresh mechanism or shorter TTL for scoped permission data |

## Sources

- Codebase analysis: `src/middleware.ts`, `src/pages/api/auth/[...nextauth].jsx`, `controllers/db/userroles.controller.ts`, `controllers/db/admin.users.controller.ts`, `controllers/db/manage-users/user.controller.ts`, `config/saml.ts`, `src/components/elements/AddUser/AddUser.tsx`, `src/components/elements/Manage/ManageUsers.tsx`, `src/components/elements/Common/Loader.tsx`, `src/components/elements/App/App.module.css`
- [JWT Authorization Best Practices and Common Mistakes](https://www.permit.io/blog/how-to-use-jwts-for-authorization-best-practices-and-common-mistakes)
- [NextAuth JWT Session Refresh Discussion #4229](https://github.com/nextauthjs/next-auth/discussions/4229)
- [SAML Debugging Handbook 2026](https://www.scalekit.com/blog/saml-debugging-handbook-2026-how-to-diagnose-log-and-resolve-sso-failures)
- [Diagnosing SAML Assertion Failures](https://workos.com/blog/saml-assertion-failures-debugging-guide)
- [Sequelize Migrations Documentation](https://sequelize.org/docs/v6/other-topics/migrations/)
- [How to Redesign a Legacy UI Without Losing Users](https://xbsoftware.com/blog/legacy-app-ui-redesign-mistakes/)
- [Next.js Middleware Practical Guide: Edge Runtime Limitations](https://eastondev.com/blog/en/posts/dev/20251225-nextjs-middleware-guide/)
- [NextAuth Callbacks Documentation](https://next-auth.js.org/configuration/callbacks)
