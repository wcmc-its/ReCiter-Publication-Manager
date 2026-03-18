# Feature Porting Assessment: v1.0 to Next.js 14 / React 18

**Domain:** Porting 7 v1.0 feature areas from dev_v2 (Next.js 12, React 16, next-auth v3) to dev_Upd_NextJS14SNode18 (Next.js 14, React 18, next-auth v4)
**Researched:** 2026-03-18
**Confidence:** HIGH -- based on direct code comparison of both branches

## Context

This is NOT a feature discovery exercise. All features are defined and validated in v1.0 (dev_v2). This document maps what needs porting, what changes, and why, for each of the 7 feature systems.

## Porting Verdicts Summary

| # | Feature Area | Verdict | Effort | Blocking Dependencies |
|---|-------------|---------|--------|----------------------|
| 1 | Capability-based auth model | **ADAPT** | MEDIUM | next-auth v4 API changes |
| 2 | SAML auto-create | **REWRITE** | MEDIUM | NextJS14 has entirely different SAML flow |
| 3 | Skeleton loading components | **COPY** | LOW | None |
| 4 | Scoped curation roles | **ADAPT** | MEDIUM | Feature 1 (capability model), Feature 2 (SAML auto-create) |
| 5 | Curation proxy | **ADAPT** | MEDIUM | Feature 1 (capability model), Feature 4 (scope) |
| 6 | Proxy API enforcement | **ADAPT** | LOW | Feature 1 (capability model), Feature 5 (proxy model) |
| 7 | Jest test infrastructure | **REWRITE** | MEDIUM | Versions change for React 18 compat |

---

## Feature 1: Capability-Based Auth Model

**Verdict: ADAPT -- logic ports, but 5 integration points need v4 API changes**

### What It Is (on dev_v2)

A centralized authorization system that replaces the brittle role-count middleware. Key files:
- `src/utils/constants.js` -- `ROLE_CAPABILITIES` map, `getCapabilities()`, `getLandingPage()`
- `src/middleware.ts` -- Edge middleware using capability checks instead of role-count if/else
- `src/pages/index.js` -- Landing page redirect using `getCapabilities()`
- `src/components/elements/Navbar/SideNavbar.tsx` -- Menu filtering via capabilities

### What Can Copy As-Is

**`getCapabilities()` and `getLandingPage()` functions** -- These are pure JavaScript functions with no framework dependencies. They take a roles array and return a capabilities object. Zero changes needed.

**`ROLE_CAPABILITIES` map** -- Pure data structure. Copy verbatim, including the `Curator_Scoped` entry.

**`allowedPermissions` enum** -- Needs one addition (`Curator_Scoped`) to the NextJS14 branch version, which currently has only the original 4 roles.

### What Needs Adaptation

**1. Middleware JWT access (BREAKING CHANGE)**

v1.0 (dev_v2) uses `jose.decodeJwt()` with raw cookie parsing:
```typescript
// v1.0: jose-based, reads raw cookie
import * as jose from "jose";
let decodedTokenJson = jose.decodeJwt(request.cookies.get('next-auth.session-token'));
```

NextJS14 branch uses `getToken()` from next-auth/jwt:
```typescript
// NextJS14: next-auth v4 getToken
import { getToken } from "next-auth/jwt";
let decodedTokenJson = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
```

**Impact:** The v1.0 middleware is ~60 lines of clean capability-based routing. The NextJS14 middleware is ~100 lines of nested role-count if/else (the exact pattern v1.0 replaced). The capability routing logic ports cleanly but must use `getToken()` instead of `jose.decodeJwt()`. The good news: NextJS14 middleware already uses `getToken()`, so the pattern is established.

**Adaptation:** Replace the entire NextJS14 middleware body with v1.0's capability-based routing, keeping the `getToken()` call.

**2. Session data shape in JWT**

v1.0 JWT callbacks store roles and scope as separate stringified fields:
```typescript
// v1.0 jwt callback (next-auth v3 signature)
async jwt(token, apiResponse) {
    token.userRoles = JSON.stringify(parsed.roles);
    token.scopeData = JSON.stringify(parsed.scopeData);
    token.proxyPersonIds = JSON.stringify(parsed.proxyPersonIds);
}
```

NextJS14 JWT callback has v4 destructured signature:
```typescript
// NextJS14 jwt callback (next-auth v4 signature)
async jwt({ token, user }) {
    token.userRoles = user.userRoles || [];  // stored as array, not stringified
}
```

**Impact:** The v1.0 JWT callback stores `userRoles` as a JSON string, while NextJS14 stores it as a direct value. All downstream consumers (middleware, API routes, components) that parse these values must match the storage format.

**Adaptation:** Merge v1.0's JWT callback logic (scopeData, proxyPersonIds extraction) into NextJS14's `async jwt({ token, user })` signature. Store `scopeData` and `proxyPersonIds` alongside existing fields. Decide on stringify vs. direct storage and be consistent throughout.

**3. Session callback signature**

v1.0 (next-auth v3): `async session(session, token, apiResponse)`
NextJS14 (next-auth v4): `async session({ session, token })`

**Impact:** v1.0 passes proxyPersonIds from token to session. Must adapt to v4 destructured signature. Also, v1.0 calls `fetchUpdatedAdminSettings()` in the session callback -- NextJS14 moved this to Redux in `_app.tsx` (better pattern, do NOT port the session callback approach).

**4. Client-side session access**

v1.0: `import { useSession } from 'next-auth/client'` -- returns `[session, loading]`
NextJS14: `import { useSession } from 'next-auth/react'` -- returns `{ data: session, status }`

**Impact:** Every v1.0 component that reads session data (SideNavbar for scope display, search page for scope filtering) uses the v3 array destructuring pattern. The NextJS14 branch already uses the v4 object pattern throughout, so this is about adapting the v1.0 additions (scope display, proxy data access) to the v4 pattern, not changing existing code.

**5. Server-side session access**

v1.0: `import { getSession } from 'next-auth/client'` in `getServerSideProps`
NextJS14: `import { getServerSession } from 'next-auth/next'` with `authOptions`

**Impact:** v1.0's `index.js` uses `getSession(ctx)` + `getCapabilities()`. NextJS14's `index.js` uses `getServerSession(ctx.req, ctx.res, authOptions)` + manual role checks. Port means replacing the manual role checks with `getCapabilities()` inside the existing `getServerSession` pattern.

### Porting Order

This is the **foundation** for all other features. Port first.

### Estimated Work

- Copy `getCapabilities()`, `getLandingPage()`, `ROLE_CAPABILITIES` to constants.js -- trivial
- Rewrite NextJS14 middleware from role-count to capability-based -- medium (test thoroughly)
- Adapt JWT callback to include scopeData/proxyPersonIds -- low
- Adapt session callback for proxyPersonIds pass-through -- low
- Update index.js to use getCapabilities with getServerSession -- low
- Update SideNavbar to use capabilities instead of role name checks -- medium

**Total: 1-2 days**

---

## Feature 2: SAML Auto-Create for New Users

**Verdict: REWRITE -- NextJS14 has a fundamentally different SAML architecture**

### What It Is (on dev_v2)

When a user authenticates via SAML but has no `admin_users` record, the system auto-creates one with `status: 1` (active) and baseline access (canReport + canSearch via capability model). Key file: `controllers/db/admin.users.controller.ts` (`findOrCreateSamlUser`).

### Why Rewrite (Not Adapt)

The two branches have **completely different SAML flows**:

| Aspect | v1.0 (dev_v2) | NextJS14 |
|--------|---------------|----------|
| SAML library | saml2-js (Clever/saml2) | Custom cookie-based bridge |
| SAML assertion | `sp.post_assert()` inline in authorize | Separate `/api/auth/saml-acs.js` endpoint |
| User matching | Email-first, then CWID fallback, then auto-create | Uses `findOrcreateAdminUser()` from samlUtils.js (always creates) |
| Auto-create | `findOrCreateSamlUser()` with `status: 1` | `findOrcreateAdminUser()` creates with whatever status is set |
| Role assignment | No auto-role (baseline via capabilities) | `grantDefaultRolesToAdminUser()` assigns roles from admin_settings config |
| Session bridge | Direct -- authorize returns user object | Encrypted cookie bridge (`saml_bridge` cookie) |

**Critical difference:** NextJS14 already auto-creates users via `findOrcreateAdminUser()` in `samlUtils.js`, AND grants default roles from admin_settings configuration. The v1.0 auto-create (`findOrCreateSamlUser`) creates with `status: 1` and NO roles (relying on capability model's baseline). These are different approaches that serve the same goal.

### What Needs to Happen

The NextJS14 SAML flow already handles auto-creation. The porting task is verification, not code copying:

1. **Ensure `status: 1` on auto-create** -- Verify that `findOrCreateAdminUsers()` on NextJS14 sets `status: 1` for new SAML users. The v1.0 `findOrCreateAdminUsers` (local auth) sets `status: 0`; the v1.0 `findOrCreateSamlUser` sets `status: 1`. The NextJS14 function must be verified.

2. **Ensure baseline access without roles** -- v1.0's capability model grants canReport + canSearch to any authenticated user, even with zero roles. This depends on Feature 1 (capability model) being ported first. Once capabilities are ported, baseline access works automatically.

3. **Do NOT port the saml2-js flow** -- NextJS14 has replaced saml2-js with a custom SAML bridge architecture. The v1.0 SAML authorize function cannot be copied.

4. **Verify `findUserPermissions` return format** -- The NextJS14 `findUserPermissions` returns `JSON.stringify(userRolesList)` (flat array). After Feature 1 port, it must return the enriched `{ roles, scopeData, proxyPersonIds }` format. The v1.0 version of this function is a superset -- port it wholesale.

### Files to Check/Modify (NextJS14 branch)

- `controllers/db/admin.users.controller.ts` -- Check status default on auto-create
- `src/utils/samlUtils.js` -- Check `findOrcreateAdminUser()` and `grantDefaultRolesToAdminUser()`
- `src/pages/api/auth/[...nextauth].jsx` -- Ensure JWT callback stores roles in capability-compatible format

### Porting Order

After Feature 1 (capability model). Baseline access depends on capabilities.

### Estimated Work

- Audit existing NextJS14 auto-create flow -- low
- Ensure status=1 default and baseline access -- low
- Port enriched `findUserPermissions` (overlaps with Feature 1) -- low
- Test SAML login for new users -- medium (requires SAML IdP access on EKS)

**Total: 0.5-1 day (mostly testing, little code)**

---

## Feature 3: Skeleton Loading Components

**Verdict: COPY -- pure CSS + React, no framework dependencies**

### What It Is (on dev_v2)

Four skeleton placeholder components that replace the legacy red circle Loader:
- `SkeletonTable.tsx` -- shimmer table rows
- `SkeletonCard.tsx` -- shimmer article cards
- `SkeletonProfile.tsx` -- shimmer person profile
- `SkeletonForm.tsx` -- shimmer form fields
- `Skeleton.module.css` -- CSS-only shimmer animations

### Why Copy As-Is

These components use:
- CSS Modules (both branches support this)
- Basic React functional components with no hooks
- No external library dependencies
- No next-auth, no session data, no Redux

The NextJS14 branch currently uses a Bootstrap Spinner Loader (`<Spinner animation="border" variant="danger" style={{ height: '5rem', width: '5rem'}}/>`) -- the exact "red circle" pattern that v1.0 replaced.

### What to Copy

1. Copy all 5 files from `src/components/elements/Common/Skeleton*` to the same path on NextJS14
2. Find all `<Loader />` references on NextJS14 and replace with the appropriate skeleton variant

### React 18 Compatibility

These are stateless functional components. No lifecycle methods, no class components, no deprecated patterns. They work on React 16, 17, and 18 without changes. No Suspense integration needed -- they are direct render replacements, not Suspense fallbacks.

### Porting Order

Independent of all other features. Can be done first, last, or in parallel.

### Estimated Work

- Copy 5 files -- trivial
- Find and replace Loader usage on NextJS14 -- low (grep for `<Loader` and `from.*Loader`)

**Total: 0.5 day**

---

## Feature 4: Scoped Curation Roles

**Verdict: ADAPT -- models copy, auth pipeline needs v4 adaptation**

### What It Is (on dev_v2)

Curator_Scoped role that restricts curation to specific person types and/or organizational units. Components:

**Backend (mostly portable):**
- `src/db/models/AdminUsersPersonType.ts` -- Sequelize model for person type scope
- `src/db/models/init-models.ts` -- Model registration with associations
- `controllers/db/userroles.controller.ts` -- `getScopeDataForUser()`, enriched `findUserPermissions()`
- `controllers/db/manage-users/user.controller.ts` -- User list includes personType data
- `src/utils/scopeResolver.ts` -- Pure utility: `isPersonInScope()`, `isProxyFor()`
- `src/pages/api/db/admin/users/persontypes/index.ts` -- API for distinct person types
- `controllers/db/person.controller.ts` -- `getPersonWithTypes()` for scope enforcement

**Frontend (needs React 18 / next-auth v4 adaptation):**
- `src/components/elements/AddUser/CurationScopeSection.tsx` -- Scope assignment UI in Manage Users
- `src/components/elements/AddUser/CurationScopeSection.module.css`
- `src/components/elements/Search/ScopeFilterCheckbox.tsx` -- "Show only my scope" filter
- `src/components/elements/Navbar/ScopeLabel.tsx` -- Scope display in sidebar

### What Can Copy As-Is

| File | Why Portable |
|------|-------------|
| `AdminUsersPersonType.ts` (model) | Pure Sequelize 6.x. No framework deps. |
| `scopeResolver.ts` | Pure TypeScript utility. No imports except its own types. |
| `CurationScopeSection.tsx` | Uses `react-bootstrap` Form + MUI Autocomplete. Both available on NextJS14. No session access. |
| `CurationScopeSection.module.css` | Pure CSS Module. |
| `ScopeFilterCheckbox.tsx` | Uses `react-bootstrap` Form.Check. No session access. |
| `ScopeLabel.tsx` | Uses MUI Tooltip only. Props-driven, no session access. |
| `persontypes/index.ts` (API route) | Standard API route with reciterConfig auth check. |

### What Needs Adaptation

**1. `init-models.ts` -- Add AdminUsersPersonType registration**

The NextJS14 branch's init-models.ts does not have AdminUsersPersonType. Need to add:
- Import statement
- `initModel()` call
- `belongsTo`/`hasMany` association declarations
- Export in the models object

This is mechanical -- follow the existing pattern for AdminUsersRole/AdminUsersDepartment.

**2. `userroles.controller.ts` -- Merge scope query into NextJS14's simpler version**

v1.0 version adds `getScopeDataForUser()` and restructures `findUserPermissions()` to return `{ roles, scopeData, proxyPersonIds }` instead of a flat roles array.

NextJS14 version returns a flat `JSON.stringify(userRolesList)`.

**Adaptation:** Port the v1.0 version wholesale. The v1.0 version is a superset of the NextJS14 version -- same core queries plus scope/proxy additions. The only change: ensure the downstream JWT callback (Feature 1) correctly handles the new return format.

**3. `user.controller.ts` -- Merge scope includes into user list query**

v1.0's `listAllUsers` includes `AdminUsersPersonType` and `AdminUsersProxy` in the Sequelize query via eager loading. NextJS14's version does not have these includes. Add them following the v1.0 pattern.

**4. JWT token -- scopeData storage**

v1.0 stores `token.scopeData = JSON.stringify(parsed.scopeData)` in the JWT callback. This must be added to the NextJS14 JWT callback (handled as part of Feature 1 adaptation).

**5. Middleware -- Curator_Scoped routing**

v1.0 middleware has a special case: scoped curators can access `/curate/*` but person-level scope enforcement happens in the API layer. This routing logic is part of the capability-based middleware (Feature 1).

**6. Client-side scopeData access in SideNavbar**

v1.0 reads `session?.data?.scopeData` using the v3 `[session, loading]` pattern. NextJS14 SideNavbar already uses the v4 `{ data: session, status }` pattern. The v1.0 additions to SideNavbar (capability-based menu filtering, ScopeLabel display) must use the v4 destructuring.

### Database Migration Required

The `admin_users_person_types` table must exist on the NextJS14 database. Recommended: SQL migration script run alongside deployment, not Sequelize sync.

### Porting Order

After Feature 1 (capability model) and Feature 2 (SAML auto-create). Depends on the capability model for Curator_Scoped routing and JWT structure.

### Estimated Work

- Copy model, scopeResolver, UI components -- low
- Adapt init-models.ts -- low
- Port userroles.controller.ts -- medium (merge carefully)
- Port user.controller.ts includes -- low
- Adapt JWT/session for scopeData -- low (part of Feature 1)
- Database migration -- low
- Test scope enforcement end-to-end -- medium

**Total: 1.5-2 days**

---

## Feature 5: Curation Proxy

**Verdict: ADAPT -- models copy, 4 new API routes need minor adaptation**

### What It Is (on dev_v2)

Allows assigning specific users as proxies for specific people, bypassing scope restrictions. Components:

**Backend:**
- `src/db/models/AdminUsersProxy.ts` -- Sequelize model
- 4 API routes under `src/pages/api/db/admin/proxy/`:
  - `grant.ts` -- Replace all proxy assignments for a given person (transactional)
  - `index.ts` -- List proxies by personIdentifier (GET) or by userID (POST)
  - `search-persons.ts` -- Search person table for proxy assignment
  - `search-users.ts` -- Search admin_users for proxy assignment
- `controllers/db/userroles.controller.ts` -- `getProxyDataForUser()` returning proxy person IDs

**Frontend:**
- `src/components/elements/AddUser/ProxyAssignmentsSection.tsx` -- Proxy management in user edit form
- `src/components/elements/AddUser/ProxyAssignmentsSection.module.css`
- `src/components/elements/CurateIndividual/GrantProxyModal.tsx` -- In-context proxy grant modal
- `src/components/elements/Search/ProxyBadge.tsx` -- PROXY badge on search results

### What Can Copy As-Is

| File | Why Portable |
|------|-------------|
| `AdminUsersProxy.ts` (model) | Pure Sequelize 6.x. No framework deps. |
| `ProxyBadge.tsx` | Uses react-bootstrap Badge only. Trivial stateless component. |
| All 4 proxy API routes | Standard API routes using Sequelize models + reciterConfig auth. No next-auth dependency. |
| `ProxyAssignmentsSection.tsx` | Uses MUI Autocomplete + CircularProgress. Props-driven, no session access. |
| `ProxyAssignmentsSection.module.css` | Pure CSS Module. |

### What Needs Adaptation

**1. `init-models.ts` -- Add AdminUsersProxy registration**

Same mechanical addition as Feature 4. Import, initModel, associations, export.

**2. `GrantProxyModal.tsx` -- react-bootstrap v2 check**

v1.0 uses react-bootstrap v1 (Modal, Button, Spinner). NextJS14 uses react-bootstrap v2. The core API for Modal, Button, and Spinner is compatible between v1 and v2. Likely no changes needed, but test to confirm.

**3. `GrantProxyModal.tsx` -- Loader import**

v1.0's GrantProxyModal imports `Loader` from `../Common/Loader`. If Feature 3 (skeletons) replaces Loader, update this import -- or keep the existing Spinner inline (the modal uses it for the saving state, not page-level loading).

**4. Person controller proxyPersonIds in search query**

v1.0's `person.controller.ts` has logic to merge proxy person IDs into search results with OR logic: `(scope conditions) OR (personIdentifier IN proxyPersonIds)`. This controller logic needs to be ported to the NextJS14 person controller, which has a different query structure for the search endpoint.

**5. JWT token -- proxyPersonIds storage**

v1.0 stores `token.proxyPersonIds = JSON.stringify(parsed.proxyPersonIds)`. Handled as part of Feature 1 JWT callback adaptation.

**6. Client-side proxyPersonIds access**

Components that check proxy status read `session?.data?.proxyPersonIds`. Must adapt to NextJS14 session structure (v4 pattern).

### Database Migration Required

The `admin_users_proxy` table must exist. Same approach as Feature 4: SQL migration script.

### Porting Order

After Feature 1 (capability model) and Feature 4 (scoped roles). The proxy system extends the scope system -- `isProxyFor()` check wraps the scope check.

### Estimated Work

- Copy model, API routes, UI components -- low
- Adapt init-models.ts -- low
- Test react-bootstrap v2 compatibility of GrantProxyModal -- low
- Port person controller proxy query logic -- medium
- Adapt JWT/session for proxyPersonIds -- low (part of Feature 1)
- Database migration -- low

**Total: 1-1.5 days**

---

## Feature 6: Proxy API Enforcement

**Verdict: ADAPT -- small diffs on 2 API routes**

### What It Is (on dev_v2)

The `save/userfeedback/[uid].ts` and `update/goldstandard.ts` API routes check whether a Curator_Scoped user is allowed to curate a given person. The check flow is:

1. Parse JWT to get roles, scopeData, proxyPersonIds
2. If `canCurate.scoped && !canCurate.all`:
   a. Check `isProxyFor(proxyPersonIds, targetUid)` -- if true, skip scope check
   b. If not proxy, check `isPersonInScope(scopeData, personOrgUnit, personTypes)`
   c. If not in scope, return 403

### What the Diff Looks Like

The v1.0 endpoints add ~25 lines of enforcement code at the top of each handler, between the auth check and the actual API call. The NextJS14 endpoints are the "plain" versions without this enforcement.

### What Needs Adaptation

**1. `getToken()` secret reference**

v1.0 uses: `const token = await getToken({ req, secret: reciterConfig.tokenSecret })`
NextJS14 should use: `const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })`

One-line change per endpoint.

**2. Token field parsing**

v1.0 parses stringified values: `JSON.parse(token.userRoles as string)`, `JSON.parse(token.proxyPersonIds as string)`, `JSON.parse(token.scopeData as string)`

If the JWT callback stores these as direct objects (not strings) in the NextJS14 adaptation, the parsing calls should handle the format consistently. Use a helper that handles both cases or standardize on one format.

**3. Imports**

v1.0 adds these imports to each endpoint:
```typescript
import { getToken } from 'next-auth/jwt'
import { getCapabilities } from '../../../../../utils/constants'
import { isPersonInScope, isProxyFor } from '../../../../../utils/scopeResolver'
import { getPersonWithTypes } from '../../../../../../controllers/db/person.controller'
```

These imports work on NextJS14 once Features 1, 4, and 5 are ported.

### Porting Order

Last among the auth-related features. Requires Features 1, 4, and 5 to be ported first.

### Estimated Work

- Add enforcement blocks to 2 API routes -- low
- Adjust getToken secret reference -- trivial
- Adjust token field parsing for v4 format -- low
- Test with scoped user, proxy user, and Curator_All -- medium

**Total: 0.5 day**

---

## Feature 7: Jest Test Infrastructure

**Verdict: REWRITE -- version changes required for React 18 compatibility**

### What It Is (on dev_v2)

Test infrastructure with 9 test files:
- `jest.config.js` -- Uses `next/jest` to create Jest config
- `jest.setup.js` -- Imports `@testing-library/jest-dom`
- `__tests__/utils/constants-scoped.test.ts` -- Capability model tests (13 test cases)
- `__tests__/utils/scopeResolver.test.ts` -- Scope resolver tests
- `__tests__/utils/proxy.test.ts` -- Proxy tests (5 test cases)
- `__tests__/api/reciter/save/userfeedback/uid.test.ts` -- API endpoint proxy enforcement tests (3 test cases)
- `__tests__/api/reciter/update/goldstandard.test.ts` -- API endpoint tests
- `__tests__/components/*.test.tsx` -- Component tests (Pagination, Publication, Search, Tabs)

v1.0 versions (chosen for React 16):
- `jest: 27.5.1`
- `jest-environment-jsdom: 27.5.1`
- `@testing-library/react: 12.1.5`
- `@testing-library/jest-dom: 5.17.0`

### Why Rewrite

**React 18 requires newer test library versions.** The v1.0 versions were specifically constrained by React 16:

| Library | v1.0 (React 16) | Needed for React 18 | Breaking Changes |
|---------|-----------------|---------------------|------------------|
| `@testing-library/react` | 12.1.5 | 14.x or 15.x | v14+ uses `createRoot` (React 18). v12 uses deprecated `ReactDOM.render()` which logs warnings. |
| `jest` | 27.5.1 | 29.x | Next.js 14's `next/jest` expects jest 29. Timer APIs changed. |
| `jest-environment-jsdom` | 27.5.1 | 29.x | Must match jest major version. |
| `@testing-library/jest-dom` | 5.17.0 | 6.x | v6 changes import path; auto-extends expect differently. |

**NextJS14 branch has NO test infrastructure.** No jest.config.js, no test files, no test dependencies. Everything must be set up fresh.

### What Can Copy As-Is

**Pure utility tests** -- These test files have NO React rendering:
- `constants-scoped.test.ts` -- Tests `getCapabilities()` and `getLandingPage()`, pure functions
- `scopeResolver.test.ts` -- Tests `isPersonInScope()`, pure function
- `proxy.test.ts` -- Tests `isProxyFor()`, pure function

These 3 files can copy verbatim. The only mock needed is `react-toastify` (because constants.js imports it), which works identically.

### What Needs Adaptation

**API endpoint tests** -- The mock structure is the same but details change:
- Mock `next-auth/jwt` (`getToken`) -- same mock pattern, different `secret` parameter
- Mock paths for controllers/config may differ (verify import paths)
- `node-mocks-http` for creating mock req/res -- works the same

**Component tests** -- `@testing-library/react` v14+ has breaking changes:
- `render()` no longer returns `wrapper` option
- `cleanup` is automatic in v14+
- `act()` usage may change with React 18 concurrent features
- Snapshot assertions may differ between React 16 and 18 HTML output

### Setup Required

```bash
# Install test deps for NextJS14 / React 18
npm install -D jest@29 jest-environment-jsdom@29 @testing-library/react@15 @testing-library/jest-dom@6 @testing-library/user-event@14 node-mocks-http
```

`jest.config.js` can be copied from v1.0 -- `next/jest` from Next.js 14 creates a compatible config:
```javascript
const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })
const customJestConfig = {
  setupFilesAfterSetup: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  moduleDirectories: ['node_modules', '<rootDir>/'],
}
module.exports = createJestConfig(customJestConfig)
```

### Porting Order

After all other features are ported. Tests validate the ported code.

### Estimated Work

- Set up jest.config.js, jest.setup.js, install deps -- low
- Copy 3 pure utility test files -- trivial
- Adapt 2 API endpoint test files -- low
- Adapt 4 component test files for RTL v14+ -- medium
- Verify all tests pass -- medium

**Total: 1-1.5 days**

---

## Feature Dependencies

```
[1. Capability Auth Model]
    (foundation -- port first)
        |
        +---> [2. SAML Auto-Create]
        |         (baseline access depends on capabilities)
        |
        +---> [3. Skeleton Components]
        |         (independent -- can be done in parallel with anything)
        |
        +---> [4. Scoped Curation Roles]
        |         (depends on capability model for Curator_Scoped)
        |         (depends on SAML auto-create for new user baseline)
        |              |
        |              +---> [5. Curation Proxy]
        |                        (extends scope system)
        |                             |
        |                             +---> [6. Proxy API Enforcement]
        |                                       (depends on 1, 4, 5)
        |
        +---> [7. Jest Test Infrastructure]
                  (validates all features -- port last)
```

## Recommended Porting Order

| Phase | Features | Rationale | Est. Days |
|-------|----------|-----------|-----------|
| **Phase 1** | 1 (Capability Auth) + 3 (Skeletons) | Foundation + quick win. Capability model unblocks everything. Skeletons are independent, visually verifiable. | 1.5-2.5 |
| **Phase 2** | 2 (SAML Auto-Create) + 4 (Scoped Roles) | Extend auth pipeline. SAML is mostly verification. Scoped roles are the core new feature. | 2-3 |
| **Phase 3** | 5 (Proxy) + 6 (Proxy Enforcement) | Build on scope system. Proxy extends scope with bypass mechanism. | 1.5-2 |
| **Phase 4** | 7 (Test Infrastructure) | Validate everything works. Write tests against the ported code. | 1-1.5 |

**Total estimated effort: 6-9 days** (including testing)

## Breaking Changes Checklist

| Change | Affected Features | Mitigation |
|--------|-------------------|------------|
| `next-auth/client` -> `next-auth/react` | 1, 4, 5 (components reading session) | Search-and-replace import path in new code |
| `useSession()` returns `{ data, status }` not `[session, loading]` | 1 (SideNavbar), 4 (ScopeFilterCheckbox display) | Destructure correctly in each component |
| `getSession(ctx)` -> `getServerSession(ctx.req, ctx.res, authOptions)` | 1 (index.js) | Use NextJS14's existing pattern |
| JWT callback `(token, user)` -> `({ token, user })` | 1, 4, 5 (JWT callback with scope/proxy data) | Use v4 destructured signature |
| Session callback `(session, token)` -> `({ session, token })` | 1 (proxy pass-through) | Use v4 destructured signature |
| `jose.decodeJwt()` -> `getToken()` in middleware | 1 (middleware) | NextJS14 already uses getToken |
| `session: { jwt: true }` -> `session: { strategy: 'jwt' }` | 1 (nextauth config) | Already done on NextJS14 |
| `reciterConfig.tokenSecret` -> `process.env.NEXTAUTH_SECRET` | 6 (API route getToken calls) | Use NextJS14's existing env var pattern |
| react-bootstrap v1 -> v2 | 5 (GrantProxyModal) | Test; likely no API changes for Modal/Button/Spinner |
| `@testing-library/react` 12 -> 15 | 7 (component tests) | Rewrite render patterns |
| `jest` 27 -> 29 | 7 (all tests) | Update config, check timer APIs |
| Admin settings in session vs Redux | All features | NextJS14 loads adminSettings via Redux in _app.tsx; do NOT port the v1.0 session callback approach |
| `findUserPermissions` return format | 1, 4, 5 | Port v1.0's enriched format `{ roles, scopeData, proxyPersonIds }` to replace NextJS14's flat array |

## What NOT to Port (Anti-Features)

| Item | Why Not |
|------|---------|
| `@casl/ability` / `@casl/react` | v1.0 STACK.md recommended CASL but it was never implemented. `getCapabilities()` + `isPersonInScope()` works well. Do not add new complexity during a port. |
| `eslint-plugin-jsx-a11y` strict mode setup | v1.0-specific audit tooling. Reassess for NextJS14 separately. |
| `sequelize-cli` migrations | v1.0 research recommended this but it was never implemented. Use SQL scripts for the 2 new tables. |
| `@axe-core/react` | v1.0-specific audit tooling. Not relevant to porting. |
| v1.0 SAML flow (saml2-js inline) | NextJS14 has architecturally different SAML (cookie bridge). Do not regress. |
| v1.0 `fetchUpdatedAdminSettings()` in session callback | NextJS14 loads via Redux in _app.tsx. Better pattern. |
| v1.0 `findOrCreateAdminUsers(uid)` single-arg version | NextJS14 has `findOrCreateAdminUsers(uid, email, firstName, lastName)`. More complete. |
| v1.0 double-stringify JWT pattern | When porting, use cleaner approach (direct storage in JWT) rather than re-introducing `JSON.stringify` -> `JSON.parse` chains. |

## Complexity Summary

| Complexity | Count | Examples |
|------------|-------|---------|
| TRIVIAL (copy as-is) | 10 | Sequelize models, scopeResolver, ROLE_CAPABILITIES, getCapabilities, ProxyBadge, ScopeLabel, skeleton components, pure utility tests |
| LOW (minor adaptation) | 8 | init-models registration, API route scope checks, proxy CRUD APIs, persontypes API, CSS modules |
| MEDIUM (pattern adaptation) | 8 | Middleware rewrite, JWT callbacks, SideNavbar capability integration, person controller proxy query, component test updates |
| HIGH (significant rewrite) | 2 | SAML auto-create verification/integration, Jest version upgrade |

**Effort split:** ~35% ports unchanged, ~50% needs pattern adaptation (mostly mechanical v3-to-v4 changes), ~15% needs architectural understanding (auth callback structure, SAML flow differences).

## Sources

- Direct code comparison of `dev_v2` and `origin/dev_Upd_NextJS14SNode18` branches
- [NextAuth.js v3 to v4 Upgrade Guide](https://next-auth.js.org/getting-started/upgrade-v4)
- [React Testing Library releases](https://github.com/testing-library/react-testing-library/releases)
- npm registry -- package version peer dependency verification

---
*Feature porting assessment for: ReCiter-Publication-Manager v1.0 -> Next.js 14*
*Researched: 2026-03-18*
