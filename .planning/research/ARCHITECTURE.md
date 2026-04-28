# Architecture: v1.0 Feature Port to Next.js 14

**Domain:** Feature port -- v1.0 capabilities (auth model, scoped roles, proxy curation) into NextJS14 branch
**Researched:** 2026-03-18
**Confidence:** HIGH -- based on direct diff analysis of both branches

## Executive Summary

The port involves moving 6 feature groups from dev_v2 (Next.js 12, React 16, next-auth v3) into dev_Upd_NextJS14SNode18 (Next.js 14, React 18, next-auth v4). Both branches use Pages Router with the same controllers/ and src/db/ directory structure, so most backend logic ports with minimal change. The primary adaptation challenge is the **next-auth v3 to v4 breaking API change**, which fundamentally alters how JWT tokens are created, read, and consumed in middleware, API routes, and components.

The NextJS14 branch already has a working auth pipeline (SAML via cookie-bridge + local login), admin settings via Redux, and a redesigned UI with a blue header. It does NOT have: the capability model, scoped roles, proxy system, skeleton components, or any test infrastructure.

## Architecture Differences Between Branches

### Auth Pipeline (Critical -- Affects Everything)

| Aspect | dev_v2 (v1.0) | NextJS14 (target) | Port Impact |
|--------|---------------|---------------------|-------------|
| next-auth version | v3 (`next-auth/providers`, `next-auth/client`) | v4 (`next-auth/providers/credentials`, `next-auth/react`) | **Breaking** |
| JWT creation | `callbacks.jwt(token, apiResponse)` -- 2 positional args | `callbacks.jwt({ token, user })` -- destructured object | **Rewrite** |
| Session creation | `callbacks.session(session, token)` -- 2 positional args | `callbacks.session({ session, token })` -- destructured object | **Rewrite** |
| JWT reading (middleware) | `jose.decodeJwt(cookie)` -- direct decode, no verification | `getToken({ req, secret: NEXTAUTH_SECRET })` -- verified | **Rewrite** |
| JWT reading (API routes) | `getToken({ req, secret: tokenSecret })` | `getToken({ req, secret: NEXTAUTH_SECRET })` | Minor adapt |
| Session in pages (SSR) | `getSession(ctx)` from `next-auth/client` | `getServerSession(ctx.req, ctx.res, authOptions)` from `next-auth/next` | Adapt |
| Session in components | `useSession()` from `next-auth/client` returns `[session, loading]` | `useSession()` from `next-auth/react` returns `{ data: session, status }` | Import + API change |
| App wrapper | `<Provider session={...}>` from `next-auth/client` | `<SessionProvider session={...}>` from `next-auth/react` | Already done on NextJS14 |
| Token secret env var | `NEXT_PUBLIC_RECITER_TOKEN_SECRET` | `NEXTAUTH_SECRET` | Config alignment needed |
| userRoles format in JWT | JSON string of `{ roles: [...], scopeData, proxyPersonIds }` (composite) | JSON string of flat roles array (simple) | **Adapt parser** |
| SAML flow | Inline assertion via saml2-js in authorize() | Cookie-bridge: saml-acs -> encrypted cookie -> authorize() reads cookie | **Preserve v4 flow** |

### Auth Flow Architecture

**v1.0 (dev_v2) -- Inline Assertion:**
```
[IdP] --SAML POST--> [/api/saml/assert.js]
                           |
                      saml2-js post_assert()
                           |
                      Extract email/cwid
                           |
                      findAdminUser() / findOrCreateSamlUser()
                           |
                      findUserPermissions() -- returns { roles, scopeData, proxyPersonIds }
                           |
                      Return user to NextAuth
                           |
                      JWT callback stores token.userRoles, token.scopeData, token.proxyPersonIds
```

**NextJS14 (target) -- Cookie Bridge:**
```
[IdP] --SAML POST--> [/api/auth/saml-acs.js]
                           |
                      validateSAML() via saml2-js
                           |
                      encrypt(JSON.stringify(samlUser))
                           |
                      Set saml_bridge cookie (HttpOnly, 60s TTL)
                           |
                      Redirect to /auth/finalize
                           |
                      [...nextauth].jsx authorize('saml') reads saml_bridge cookie
                           |
                      decrypt(bridgeCookie) --> { email, cwid, firstName, lastName }
                           |
                      findOrcreateAdminUser() from samlUtils.js
                           |-- calls findUserPermissions() [WILL RETURN NEW FORMAT]
                           |-- sets adminUser.userRoles = result
                           |
                      Return user to NextAuth
                           |
                      JWT callback parses composite userRoles into separate claims
```

**Port strategy:** Do NOT replace the cookie-bridge flow. Instead, modify `findUserPermissions()` to return the enriched format, and update the JWT callback to parse the composite `{ roles, scopeData, proxyPersonIds }` structure. The samlUtils.js `findOrcreateAdminUser()` function passes `findUserPermissions()` result through as `userRoles` -- this pass-through behavior doesn't need to change, just the downstream parsing.

### Session Data Shape

**v1.0 (dev_v2) session shape:**
```typescript
session.data = {
  username: string,            // personIdentifier
  userRoles: string,           // JSON string of roles array (extracted from composite)
  scopeData: string,           // JSON string of { personTypes, orgUnits }
  proxyPersonIds: string,      // JSON string of proxy person IDs
  databaseUser: object,        // admin_users record
}
session.adminSettings = [...]  // loaded in session callback (blocking)
```

**NextJS14 session shape (current):**
```typescript
session.data = {
  username: string,            // personIdentifier
  userRoles: string,           // JSON string of roles array
  databaseUser: object | null, // admin_users record
  email: string,
  name: string,
  picture: string | undefined,
}
session.user = token.user      // full user object
// adminSettings loaded via Redux in AdminSettingsDataLoader (non-blocking)
```

**NextJS14 session shape (after port):**
```typescript
session.data = {
  // Existing v4 fields preserved
  username: string,
  userRoles: string,           // JSON string of roles array (extracted from composite)
  databaseUser: object | null,
  email: string,
  name: string,
  picture: string | undefined,
  // NEW: v1.0 additions
  scopeData: string,           // JSON string of { personTypes, orgUnits } | null
  proxyPersonIds: string,      // JSON string of string[] | null
}
// adminSettings stays in Redux (better pattern)
```

### Middleware Architecture

**dev_v2 (v1.0):** Clean capability-based routing (~150 lines):
- `getCapabilities(roles)` derives capabilities from roles
- `getLandingPage(caps)` determines redirect target
- Handles Curator_Scoped, Curator_Self, Curator_All, Reporter_All, Superuser
- Uses `jose.decodeJwt(cookie)` (unverified)

**NextJS14 (current):** Brittle role-count-based routing (~140 lines):
- Nested if/else with `userRoles.length == 1 && isReporterAll` style checks
- Does NOT handle Curator_Scoped
- Uses `getToken({ req, secret })` (verified) -- better than jose

**Port strategy:** Replace the NextJS14 middleware body with the v1.0 capability-based logic, but use `getToken()` from next-auth/jwt (the v4 pattern) instead of `jose.decodeJwt`. The returned token shape is compatible once `scopeData` is in the JWT.

### Admin Settings Loading

**v1.0:** Loaded in `session` callback (synchronous, blocking, every session refresh).

**NextJS14:** Loaded via `AdminSettingsDataLoader` React component using Redux dispatch. Non-blocking, cached.

**Port decision:** Keep the NextJS14 Redux-based approach. Do NOT port the v1.0 session-callback loading. Components that access admin settings will use `useSelector` (which the NextJS14 branch already does).

## Component Boundaries

### What Creates (New Files -- 22 files)

| File | Purpose | Complexity | Dependencies |
|------|---------|------------|--------------|
| `src/db/models/AdminUsersPersonType.ts` | Sequelize model for scoped person types | Low | None -- pure model |
| `src/db/models/AdminUsersProxy.ts` | Sequelize model for proxy assignments | Low | None -- pure model |
| `src/utils/scopeResolver.ts` | `isPersonInScope()`, `isProxyFor()` | Low | None -- pure functions |
| `src/pages/api/db/admin/proxy/index.ts` | CRUD for proxy assignments | Medium | AdminUsersProxy model |
| `src/pages/api/db/admin/proxy/grant.ts` | Contextual proxy grant from curation page | Low | AdminUsersProxy model |
| `src/pages/api/db/admin/proxy/search-persons.ts` | Person search for proxy picker | Low | Person model |
| `src/pages/api/db/admin/proxy/search-users.ts` | User search for proxy viewer | Low | AdminUser, AdminUsersProxy models |
| `src/pages/api/db/admin/users/persontypes/index.ts` | List distinct person types | Low | PersonPersonType model |
| `src/pages/api/db/person/scopecheck.ts` | Server-side scope check endpoint | Low | scopeResolver, Person model |
| `src/components/elements/AddUser/CurationScopeSection.tsx` | Scope config in Manage Users form | Medium | MUI Autocomplete |
| `src/components/elements/AddUser/CurationScopeSection.module.css` | Styles | Low | None |
| `src/components/elements/AddUser/ProxyAssignmentsSection.tsx` | Proxy management in Manage Users form | Medium | Proxy APIs |
| `src/components/elements/AddUser/ProxyAssignmentsSection.module.css` | Styles | Low | None |
| `src/components/elements/CurateIndividual/GrantProxyModal.tsx` | In-context proxy grant from curation page | Medium | Proxy grant API |
| `src/components/elements/Navbar/ScopeLabel.tsx` | Scope indicator in sidebar nav | Low | Session data |
| `src/components/elements/Search/ProxyBadge.tsx` | Badge showing proxy status in search results | Low | Session data |
| `src/components/elements/Search/ScopeFilterCheckbox.tsx` | Checkbox to filter search by scope | Low | Session data |
| `src/components/elements/Common/SkeletonCard.tsx` | Loading skeleton for cards | Low | None |
| `src/components/elements/Common/SkeletonForm.tsx` | Loading skeleton for forms | Low | None |
| `src/components/elements/Common/SkeletonProfile.tsx` | Loading skeleton for profiles | Low | None |
| `src/components/elements/Common/SkeletonTable.tsx` | Loading skeleton for tables | Low | None |
| `src/components/elements/Common/Skeleton.module.css` | Skeleton animation styles | Low | None |

**Port complexity:** All new files are either copy-paste (pure logic files, Sequelize models) or require only minor React 18 adaptation (useSession import path). No architectural changes needed.

### What Modifies (Existing NextJS14 Files -- 14 files)

| File | Changes Required | Complexity | Risk |
|------|-----------------|------------|------|
| `src/utils/constants.js` | Add `Curator_Scoped` to `allowedPermissions`, add `ROLE_CAPABILITIES`, `getCapabilities()`, `getLandingPage()` | Medium | **High** -- used everywhere |
| `controllers/db/userroles.controller.ts` | Add `getScopeDataForUser()`, `getProxyDataForUser()`, change return format to `{ roles, scopeData, proxyPersonIds }` | Medium | **High** -- auth pipeline |
| `src/pages/api/auth/[...nextauth].jsx` | Adapt JWT callback to parse composite `findUserPermissions` response, store `scopeData` and `proxyPersonIds` in token; adapt session callback to pass them through | Medium | **Critical** -- auth pipeline |
| `src/middleware.ts` | Replace role-count logic with capability-based routing | Medium | **Critical** -- breaks routing if wrong |
| `src/pages/index.js` | Add `Curator_Scoped` handling to redirect logic, use `getCapabilities()` | Low | Medium |
| `src/db/models/init-models.ts` | Register `AdminUsersPersonType` and `AdminUsersProxy`, add associations | Low | Low |
| `controllers/db/manage-users/user.controller.ts` | Add personType/proxy includes in user queries, handle scope data in addEditUser | Medium | Medium |
| `src/pages/api/reciter/save/userfeedback/[uid].ts` | Add scope enforcement + proxy bypass block | Medium | Medium |
| `src/pages/api/reciter/update/goldstandard.ts` | Add scope enforcement + proxy bypass block | Medium | Medium |
| `controllers/db/person.controller.ts` | Add `getPersonWithTypes()`, add `proxyPersonIds` filter support, add `includeScopeData` query | Medium | Medium |
| `src/components/elements/Search/Search.js` | Add ProxyBadge, ScopeFilterCheckbox, scope-aware search params | Medium | Medium |
| `src/components/elements/AddUser/AddUser.tsx` | Add CurationScopeSection and ProxyAssignmentsSection | Medium | Medium |
| `src/utils/samlUtils.js` | Ensure pass-through of enriched findUserPermissions response works | Low | Medium |
| `package.json` | Add jest, @testing-library/react v14+, @testing-library/jest-dom | Low | Low |

### What Does NOT Need Modification

These files are functionally equivalent between branches:

- `src/db/db.ts` -- Same Sequelize connection
- `controllers/userfeedback.controller.ts` -- Same (pure HTTP proxy to ReCiter API)
- `controllers/goldstandard.controller.ts` -- Same
- `controllers/authentication.controller.ts` -- Same
- `controllers/pubmed.controller.ts` -- Same
- `controllers/featuregenerator.controller.ts` -- Same
- `controllers/db/admin.settings.controller.ts` -- Same (admin settings via Redux on NextJS14)
- `config/local.js` -- Same structure (endpoints from env vars)
- All `src/pages/api/reciter/` routes EXCEPT userfeedback/save and goldstandard -- No scope enforcement needed
- `src/pages/_app.tsx` -- Keep NextJS14 version (SessionProvider, ThemeProvider, AdminSettingsDataLoader)

## Data Flow Diagrams

### Complete Auth Flow (After Port)

```
Login (SAML or Local)
  |
  v
[...nextauth].jsx authorize()
  |-- Local: authenticate(credentials) -> findOrCreateAdminUsers() -> findUserPermissions()
  |-- SAML: read saml_bridge cookie -> decrypt -> findOrcreateAdminUser() -> findUserPermissions()
  |
  |  findUserPermissions() returns JSON.stringify({ roles, scopeData, proxyPersonIds })
  |
  v
JWT callback ({ token, user })  [next-auth v4 signature]
  |-- Parse user.userRoles:
  |     try { parsed = JSON.parse(user.userRoles) }
  |     if (parsed.roles):
  |       token.userRoles = JSON.stringify(parsed.roles)
  |       token.scopeData = JSON.stringify(parsed.scopeData)        // NEW
  |       token.proxyPersonIds = JSON.stringify(parsed.proxyPersonIds) // NEW
  |     else:
  |       token.userRoles = user.userRoles  // legacy format fallback
  |
  v
Session callback ({ session, token })
  |-- session.data = token
  |-- session.user.username = token.username
  |-- session.user.databaseUser = token.databaseUser
  |-- session.user.userRoles = token.userRoles
  |
  v
Middleware (every protected route request)
  |-- const token = await getToken({ req, secret: NEXTAUTH_SECRET })
  |-- const roles = JSON.parse(token.userRoles)
  |-- const caps = getCapabilities(roles)
  |-- Route-level check: canCurate / canSearch / canReport / canManageUsers / canConfigure
  |-- Scoped curators: canCurate.scoped -> ALLOW route, defer person-level check to API
  |
  v
API Routes (data-modifying endpoints only)
  |-- const token = await getToken({ req, secret: NEXTAUTH_SECRET })
  |-- Parse token.userRoles, token.scopeData, token.proxyPersonIds
  |-- Check: isProxyFor() first, then isPersonInScope() if not proxy
  |
  v
React Components (client-side rendering)
  |-- const { data: session } = useSession()  [next-auth/react]
  |-- Parse session.data.userRoles -> getCapabilities() for conditional rendering
  |-- Parse session.data.proxyPersonIds -> ProxyBadge, GrantProxyModal
  |-- Parse session.data.scopeData -> ScopeLabel, ScopeFilterCheckbox
```

### Scope Enforcement Flow (in API Routes)

```
Scoped curator clicks Accept/Reject on article for person [uid]
  |
  Frontend: POST /api/reciter/save/userfeedback/[uid]
  |
  API Route handler:
    1. Verify authorization header (existing check)
    2. const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    3. const roles = JSON.parse(token.userRoles)
    4. const caps = getCapabilities(roles)
    5. if (caps.canCurate.scoped && !caps.canCurate.all):
       a. const proxyIds = token.proxyPersonIds ? JSON.parse(token.proxyPersonIds) : []
       b. if (isProxyFor(proxyIds, uid)):
          -> ALLOW (skip scope check -- proxy grants full curation rights)
       c. else:
          -> const scopeData = token.scopeData ? JSON.parse(token.scopeData) : null
          -> const personData = await getPersonWithTypes(uid)
          -> if (!personData): return 404
          -> if (!isPersonInScope(scopeData, personData.orgUnit, personData.personTypes)):
             return 403 "Person not in curation scope"
    6. Proceed with saveUserFeedback(req, uid)
```

### Search with Scope + Proxy

```
Scoped curator loads /search
  |
  Frontend reads from session:
    - session.data.scopeData -> { personTypes: [...], orgUnits: [...] }
    - session.data.proxyPersonIds -> [...]
  |
  Frontend builds search request:
    POST /api/db/person
    body: {
      filters: { personTypes, orgUnits, proxyPersonIds },
      includeScopeData: true,
      limit, offset
    }
  |
  person.controller.ts builds query:
    WHERE: (orgUnit IN scope AND personType IN scope) OR (personIdentifier IN proxyIds)
    INCLUDE: PersonPersonTypes (for client-side scope labeling)
  |
  Frontend renders results:
    - ProxyBadge on proxy persons (different visual treatment)
    - ScopeFilterCheckbox to toggle between "my scope" and "my scope + proxies"
    - Dropdown actions include proxy grant option for users with canManageUsers
```

## Patterns to Follow

### Pattern 1: Capability-Based Auth

**What:** Derive capabilities from roles, check capabilities not roles.

**Why:** The NextJS14 branch's role-count middleware (`userRoles.length == 1 && isReporterAll`) is brittle and doesn't handle Curator_Scoped at all. The capability model handles any role combination cleanly.

**Adaptation for v4:**
```typescript
// NextJS14 middleware: use getToken (verified) instead of jose.decodeJwt (unverified)
import { getToken } from "next-auth/jwt";
import { getCapabilities, getLandingPage } from './utils/constants';

const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
const userRoles = JSON.parse(token.userRoles);
const caps = getCapabilities(userRoles);

// Then use caps exactly as v1.0 did:
if (pathName.startsWith('/curate')) {
    if (caps.canCurate.all) return res;
    if (caps.canCurate.scoped) return res; // defer to API
    if (caps.canCurate.self) { /* check own page */ }
    return redirectToLandingPage(request, getLandingPage(caps));
}
```

### Pattern 2: JWT Callback Enrichment (v3 -> v4)

```typescript
// v1.0 (next-auth v3) -- positional args
async jwt(token, apiResponse) {
    if (apiResponse) {
        const parsed = JSON.parse(apiResponse.userRoles);
        token.userRoles = JSON.stringify(parsed.roles);
        if (parsed.scopeData) token.scopeData = JSON.stringify(parsed.scopeData);
        if (parsed.proxyPersonIds?.length > 0) token.proxyPersonIds = JSON.stringify(parsed.proxyPersonIds);
    }
    return token;
}

// NextJS14 (next-auth v4) -- destructured named args
async jwt({ token, user }) {
    if (user) {
        // Existing v4 fields (preserve these)
        token.user = user;
        token.username = user.databaseUser?.personIdentifier || user.personIdentifier || user.email;
        token.email = user.email || '';
        token.databaseUser = user.databaseUser || null;
        token.name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || token.username;

        // PORT: Parse composite findUserPermissions response
        try {
            const parsed = JSON.parse(user.userRoles);
            if (parsed.roles) {
                token.userRoles = JSON.stringify(parsed.roles);
                if (parsed.scopeData) token.scopeData = JSON.stringify(parsed.scopeData);
                if (parsed.proxyPersonIds?.length > 0) token.proxyPersonIds = JSON.stringify(parsed.proxyPersonIds);
            } else {
                // Legacy format (flat roles array) -- store as-is
                token.userRoles = user.userRoles;
            }
        } catch (e) {
            token.userRoles = user.userRoles;
        }
    }
    return token;
}
```

### Pattern 3: useSession Adaptation

```typescript
// v1.0 (NEVER use on NextJS14)
import { useSession } from "next-auth/client";
const [session, loading] = useSession();

// NextJS14 (ALWAYS use this)
import { useSession } from "next-auth/react";
const { data: session, status } = useSession();
const loading = status === "loading";
```

### Pattern 4: Scope Enforcement Block (Standard for API Routes)

```typescript
// Standard scope enforcement block -- add to userfeedback/save and goldstandard/update
import { getToken } from 'next-auth/jwt';
import { getCapabilities } from '../../../../../utils/constants';
import { isPersonInScope, isProxyFor } from '../../../../../utils/scopeResolver';
import { getPersonWithTypes } from '../../../../../../controllers/db/person.controller';

// Inside handler, after authorization header check:
const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
if (token && token.userRoles) {
    const roles = JSON.parse(token.userRoles as string);
    const caps = getCapabilities(roles);

    if (caps.canCurate.scoped && !caps.canCurate.all) {
        const proxyPersonIds = token.proxyPersonIds
            ? JSON.parse(token.proxyPersonIds as string) : [];
        if (!isProxyFor(proxyPersonIds, uid as string)) {
            const scopeData = token.scopeData
                ? JSON.parse(token.scopeData as string) : null;
            if (scopeData) {
                const personData = await getPersonWithTypes(uid as string);
                if (!personData) return res.status(404).json({ statusCode: 404, message: 'Person not found' });
                if (!isPersonInScope(scopeData, personData.primaryOrganizationalUnit, personData.personTypes)) {
                    return res.status(403).json({ statusCode: 403, message: 'Person not in curation scope' });
                }
            }
        }
    }
}
```

**Key difference from v1.0:** Use `process.env.NEXTAUTH_SECRET` instead of `reciterConfig.tokenSecret` in `getToken()`.

### Pattern 5: getServerSideProps Session Access (v3 -> v4)

```typescript
// v1.0 (next-auth v3) -- NEVER use on NextJS14
import { getSession } from "next-auth/client";
const session = await getSession(ctx);

// NextJS14 (next-auth v4) -- ALWAYS use this
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
const session = await getServerSession(ctx.req, ctx.res, authOptions);
```

### Pattern 6: Port-Safe File Classification

Before touching any file, classify it:

**Framework-free (ports as-is / copy-paste):**
- Sequelize models (AdminUsersPersonType.ts, AdminUsersProxy.ts)
- Pure functions (scopeResolver.ts)
- SQL queries in controllers (getScopeDataForUser, getProxyDataForUser, getPersonWithTypes)
- Type definitions
- CSS modules

**Framework-coupled (needs adaptation):**
- Files importing `next-auth/client` -> change to `next-auth/react`
- Files using `jose.decodeJwt` -> change to `getToken`
- Files using `getSession(ctx)` -> change to `getServerSession(ctx.req, ctx.res, authOptions)`
- Files using `useSession()` -> change destructured return

## Anti-Patterns to Avoid

### Anti-Pattern 1: Copying v1.0's [...nextauth].jsx Over v4's

**What:** Replacing the NextJS14 nextauth config with the v1.0 version.

**Why bad:** Completely different API surface (v3 vs v4), different SAML flow (inline vs cookie-bridge), different provider imports. The file is structurally incompatible.

**Instead:** Graft the v1.0 enrichment logic (scopeData/proxyPersonIds parsing) into the existing v4 JWT and session callbacks. Leave the SAML cookie-bridge flow, provider configuration, and session strategy untouched.

### Anti-Pattern 2: Installing jose

**What:** Adding `jose` package to NextJS14 branch because v1.0 middleware uses it.

**Why bad:** The NextJS14 branch correctly uses `getToken()` from `next-auth/jwt` which verifies JWT signatures. `jose.decodeJwt` does NOT verify -- it's less secure.

**Instead:** Use `getToken({ req, secret: process.env.NEXTAUTH_SECRET })` everywhere.

### Anti-Pattern 3: Porting Session-Callback Admin Settings Loading

**What:** Putting `fetchUpdatedAdminSettings()` back into the session callback.

**Why bad:** Blocks every session refresh with a DB query. The NextJS14 Redux pattern (`AdminSettingsDataLoader`) is better -- loads once, cached.

**Instead:** Keep the NextJS14 approach. Any v1.0 component that accessed `session.adminSettings` should use `useSelector(state => state.updatedAdminSettings)` instead.

### Anti-Pattern 4: Mixing Token Secret Variables

**What:** Using `reciterConfig.tokenSecret` in some getToken calls and `NEXTAUTH_SECRET` in others.

**Why bad:** If these env vars point to different values, some getToken calls will fail to verify the JWT. next-auth v4 uses `NEXTAUTH_SECRET` consistently.

**Instead:** Use `process.env.NEXTAUTH_SECRET` everywhere for getToken calls. Verify that both env vars resolve to the same secret on the deployment, or consolidate to one.

### Anti-Pattern 5: Using next-auth/client Imports

**What:** `import { useSession } from "next-auth/client"` or `import { Provider } from "next-auth/client"`.

**Why bad:** next-auth v4 moved these to `next-auth/react`. The v3 paths do not exist.

**Instead:** All session/auth imports must come from `next-auth/react` (components) or `next-auth/jwt` (API routes/middleware) or `next-auth/next` (SSR).

## Suggested Build Order

Build order follows dependency chains. Each phase produces artifacts required by subsequent phases.

### Phase 1: Foundation Layer (Pure Backend + Utilities)

**Rationale:** All other features depend on the capability model and data models.

1. **Constants + Capability Model** -- Add `Curator_Scoped` to `allowedPermissions`, add `ROLE_CAPABILITIES`, `getCapabilities()`, `getLandingPage()` to `src/utils/constants.js`
2. **Scope Resolver** -- Copy `src/utils/scopeResolver.ts` verbatim (pure functions, zero framework coupling)
3. **DB Models** -- Copy `AdminUsersPersonType.ts` and `AdminUsersProxy.ts`, register in `init-models.ts` with associations
4. **UserRoles Controller** -- Add `getScopeDataForUser()`, `getProxyDataForUser()`, change `findUserPermissions()` return format

**Dependencies:** None
**Risk:** Low -- pure functions and data models, testable in isolation
**Validation:** Unit tests for getCapabilities, scopeResolver

### Phase 2: Auth Pipeline Adaptation (Critical Path)

**Rationale:** The JWT/session callbacks must handle the new composite data format before anything else can consume it.

1. **NextAuth JWT Callback** -- Parse `{ roles, scopeData, proxyPersonIds }` from findUserPermissions, store as separate JWT claims
2. **NextAuth Session Callback** -- Pass scopeData and proxyPersonIds through to session.data
3. **Middleware Replacement** -- Replace role-count logic with capability-based routing (getToken + getCapabilities)
4. **Index Page Redirect** -- Use getCapabilities for Curator_Scoped landing page logic
5. **samlUtils.js** -- Verify pass-through works with enriched findUserPermissions response

**Dependencies:** Phase 1 (constants, scopeResolver)
**Risk:** **High** -- breakage here breaks ALL authentication
**Validation:** Manual login test (local + SAML), verify role-based redirects, inspect JWT claims in browser devtools

### Phase 3: API Scope Enforcement

**Rationale:** Once auth pipeline correctly stores scope/proxy data in JWT, enforce at API level.

1. **Person Controller** -- Add `getPersonWithTypes()` function
2. **Userfeedback Save** -- Add scope enforcement + proxy bypass block
3. **Goldstandard Update** -- Same pattern
4. **Person Search** -- Add `includeScopeData` mode, proxy person ID filtering

**Dependencies:** Phase 2 (JWT must contain scopeData + proxyPersonIds)
**Risk:** Medium -- isolated to specific endpoints, doesn't break other users
**Validation:** Test accept/reject as scoped curator, test proxy bypass, test out-of-scope denial

### Phase 4: Admin UI for Scoped Roles

**Rationale:** Superusers need to assign scoped roles and proxy relationships.

1. **Person Types API** -- Port `/api/db/admin/users/persontypes/`
2. **Proxy CRUD APIs** -- Port all 4 files under `/api/db/admin/proxy/`
3. **Scope Check API** -- Port `/api/db/person/scopecheck.ts`
4. **Manage Users Controller** -- Add personType/proxy includes in user queries
5. **CurationScopeSection Component** -- Adapt for React 18
6. **ProxyAssignmentsSection Component** -- Adapt for React 18

**Dependencies:** Phase 1 (DB models), Phase 3 (API enforcement in place)
**Risk:** Medium -- UI adaptation for React 18 may need minor changes
**Validation:** Create scoped user in Manage Users, verify scope assignments persist

### Phase 5: Search + Curation UI

**Rationale:** End-user-facing UI for scoped curators and proxy users.

1. **ProxyBadge** (~20 lines)
2. **ScopeFilterCheckbox** (~24 lines)
3. **ScopeLabel** (~67 lines)
4. **Search Page Integration** -- Add scope/proxy filters to requests, render badges
5. **GrantProxyModal** (~225 lines, most complex UI component)

**Dependencies:** Phase 4 (proxy APIs must exist for GrantProxyModal)
**Risk:** Medium -- React 18 rendering of session-dependent components
**Validation:** Load search as scoped curator, verify badges, test proxy grant flow

### Phase 6: Skeleton Loading + Polish

**Rationale:** Non-blocking polish. Can parallelize with Phase 5.

1. **Skeleton Components** -- Port 4 components + CSS (pure presentational)
2. **Integration** -- Replace bare loaders with skeletons where appropriate

**Dependencies:** None
**Risk:** Low
**Validation:** Visual check of loading states

### Phase 7: Test Infrastructure

**Rationale:** Validates the entire port. Install test deps compatible with React 18 / Next.js 14.

1. **Install Dependencies** -- `jest`, `@testing-library/react` v14+, `@testing-library/jest-dom` v6+
2. **Jest Config** -- `jest.config.js` for Next.js 14
3. **Port Pure Logic Tests** -- scopeResolver, constants-scoped, proxy (minimal adaptation)
4. **Port API Tests** -- goldstandard, userfeedback (mock updates for getToken v4)
5. **Adapt Component Tests** -- React 18 createRoot changes

**Dependencies:** All phases complete
**Risk:** Medium -- @testing-library/react v14 has API changes from v12
**Validation:** `npm test` passes

## Critical Integration Points Summary

| Integration Point | Phase | Risk | What Can Go Wrong |
|-------------------|-------|------|-------------------|
| findUserPermissions return format change | 1 | HIGH | Breaks all logins if consumers not updated simultaneously |
| JWT callback parsing composite response | 2 | CRITICAL | Missing scopeData/proxyPersonIds in token = scope enforcement fails silently |
| Middleware getToken vs jose.decodeJwt | 2 | CRITICAL | Wrong secret = no token decoded = all routes broken |
| samlUtils.js pass-through | 2 | MEDIUM | SAML login may fail if userRoles format not handled |
| NEXTAUTH_SECRET alignment | 2 | HIGH | If different from NEXT_PUBLIC_RECITER_TOKEN_SECRET, some flows break |
| Scope enforcement in API routes | 3 | MEDIUM | Wrong token parsing = false denials or bypasses |
| Person controller scope query | 3 | MEDIUM | SQL join issues could return wrong results |
| React 18 component adaptation | 4-5 | LOW | Minor import/hook changes |

## Sources

- Direct codebase comparison of `origin/dev_v2` and `origin/dev_Upd_NextJS14SNode18`
- [NextAuth.js v3 to v4 Upgrade Guide](https://next-auth.js.org/getting-started/upgrade-v4)
- [Next.js Middleware documentation](https://nextjs.org/docs/pages/building-your-application/routing/middleware)
- Confidence: HIGH -- all findings based on actual code inspection of both branches
