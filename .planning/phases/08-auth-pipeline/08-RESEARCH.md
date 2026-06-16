# Phase 8: Auth Pipeline - Research

**Researched:** 2026-03-27
**Domain:** next-auth v4 JWT/session callbacks, Edge middleware, Sequelize JSON column queries, SAML cookie-bridge integration
**Confidence:** HIGH

## Summary

Phase 8 ports the capability-based auth model from dev_v2 (v1.0) into the NextJS14 branch. The core work is: (1) enrich `findUserPermissions()` to return scope and proxy data from JSON columns on `admin_users`, (2) parse the composite response in the JWT callback to store `scopeData` and `proxyPersonIds` as separate JWT claims, (3) pass those claims through the session callback so client components can access them, (4) wholesale replace the brittle role-count middleware with clean capability-based routing, and (5) update the index page to use `getCapabilities()`/`getLandingPage()` for redirect logic.

A critical finding is that the current feature branch has a **function signature mismatch** in `userroles.controller.ts` -- the function was refactored to expect array arguments but all callers still pass single strings. Phase 8 will rewrite this function anyway (to add scope/proxy enrichment), so the correct approach is to restore the simple `(attrValue: string, attrType: string)` signature that matches the callers and add the enrichment logic.

The NextJS14 branch already uses next-auth v4 patterns (destructured callback args, `getToken()` from `next-auth/jwt`, `SessionProvider` from `next-auth/react`, cookie-bridge SAML flow). The port grafts v1.0's enrichment logic into the existing v4 structure. The SAML cookie-bridge flow is preserved entirely.

**Primary recommendation:** Rewrite `findUserPermissions()` to query JSON columns directly, graft composite parsing into the existing v4 JWT callback, and replace the middleware body wholesale with the v1.0 capability pattern using `getToken()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** JWT callback unpacks the composite `findUserPermissions` response into separate token fields: `token.userRoles` (roles array only), `token.scopeData`, `token.proxyPersonIds`
- **D-02:** Session callback maps token fields to `session.data.userRoles` (roles array), `session.data.scopeData`, `session.data.proxyPersonIds`
- **D-03:** Existing consumers (SideNavbar, index page, components) continue reading `session.data.userRoles` as a roles-only array -- zero breakage
- **D-04:** Phase 9 components will be the first to read `session.data.scopeData` and `session.data.proxyPersonIds`
- **D-05:** `findUserPermissions()` always queries scope and proxy data for every user, regardless of role or origin (SAML auto-create, local login, existing user)
- **D-06:** For users without scope/proxy assignments, returns `scopeData: null`, `proxyPersonIds: []` -- no special-casing
- **D-07:** Phase 7 stored scope/proxy in JSON columns on `admin_users` (`scope_person_types`, `scope_org_units`, `proxy_person_ids`), NOT junction tables -- queries read JSON columns directly
- **D-08:** Wholesale replace the current brittle role-count-based middleware body with v1.0 capability-based logic (`getCapabilities()` + `getLandingPage()`)
- **D-09:** Use `getToken()` from `next-auth/jwt` (cryptographically verified, v4 pattern) -- do NOT use `jose.decodeJwt` (unverified, v1.0 pattern)
- **D-10:** Middleware reads `token.scopeData` for Curator_Scoped routing decisions
- **D-11:** `getCapabilities()` and `getLandingPage()` are already in `src/utils/constants.js` from Phase 7
- **D-12:** `findOrcreateAdminUser()` in `samlUtils.js` passes the `findUserPermissions` result through unchanged -- the JWT callback handles parsing
- **D-13:** No special scope/proxy handling for auto-created users -- they naturally get `scopeData: null`, `proxyPersonIds: []`
- **D-14:** Preserve the NextJS14 cookie-bridge SAML flow entirely -- do NOT replace with v1.0 inline assertion pattern
- **D-15:** SQL scripts to insert test users with various role+scope+proxy combinations into dev DB
- **D-16:** Verify by logging in as each test user (local auth), inspecting `/api/auth/session` endpoint for correct JWT shape
- **D-17:** Navigate to protected routes to verify middleware redirects each role combo correctly
- **D-18:** No unit tests in Phase 8 scope -- E2E verification via session inspection and route testing

### Claude's Discretion
- Error handling approach when JSON column parsing fails (graceful degradation vs hard error)
- Exact query structure for reading JSON columns from `admin_users`
- Logging verbosity in the enriched `findUserPermissions`
- Order of operations in the JWT callback when parsing the composite response

### Deferred Ideas (OUT OF SCOPE)
- UI for assigning Curator_Scoped roles and scope boundaries -- Phase 9
- Proxy assignment picker UI -- Phase 9
- Proxy-aware curation page filtering -- Phase 10
- Admin settings for default scope on auto-create -- future enhancement
- Rate limiting on auth endpoints -- out of scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PORT-04 | findUserPermissions enriched with scopeData + proxyPersonIds | Rewrite controller to query JSON columns on `admin_users`, return composite `{ roles, scopeData, proxyPersonIds }` format. Fix function signature mismatch (see Pitfall 1). |
| PORT-05 | next-auth v4 JWT/session callbacks adapted | Graft composite parsing into existing v4 JWT callback (`{ token, user }` destructured), add `scopeData` and `proxyPersonIds` to session callback. Preserve all existing v4 fields. |
| PORT-06 | Capability-based middleware using getToken | Replace role-count middleware body wholesale. Use `getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })` + `getCapabilities()` + `getLandingPage()`. Port from v1.0 but use v4 API. |
| PORT-07 | SAML auto-create works with enriched permissions | `findOrcreateAdminUser()` passes `findUserPermissions` result through as `userRoles`. JWT callback handles parsing. No changes needed to SAML flow itself. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 4.24.13 | Auth framework (JWT, session, callbacks) | Already installed on branch, v4 API used throughout |
| next | 14.2.35 | Framework (middleware, pages router) | Already installed on branch |
| sequelize | 6.37.0 | ORM for MySQL queries (JSON columns) | Already installed, all DB access goes through it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next-auth/jwt | (bundled) | `getToken()` for middleware JWT verification | Middleware and API route token reading |
| next-auth/react | (bundled) | `useSession()` for client components | Component-level session access (existing pattern) |
| next-auth/next | (bundled) | `getServerSession()` for SSR | Index page `getServerSideProps` (existing pattern) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `getToken()` | `jose.decodeJwt()` | jose does NOT verify signatures -- less secure. Decision D-09 locks this. |
| JSON columns | Junction tables | User decided JSON columns in Phase 7 (D-07). Simpler queries, no JOINs for scope data. |
| Session callback loading | Redux loader | Admin settings stay in Redux (existing NextJS14 pattern). Do NOT port v1.0 session callback loading. |

## Architecture Patterns

### Files Modified in Phase 8
```
controllers/
  db/
    userroles.controller.ts        # REWRITE: enrich findUserPermissions with scope/proxy from JSON columns
src/
  middleware.ts                    # REWRITE: replace role-count body with capability-based routing
  pages/
    api/
      auth/
        [...nextauth].jsx          # MODIFY: JWT + session callbacks to parse composite response
    index.js                       # MODIFY: use getCapabilities()/getLandingPage() for redirects
  utils/
    samlUtils.js                   # VERIFY: pass-through behavior works with new response format
    constants.js                   # NO CHANGE: already has getCapabilities/getLandingPage from Phase 7
scripts/
  sql/
    test-users-phase8.sql          # CREATE: SQL to insert test users with scope/proxy data
```

### Pattern 1: findUserPermissions Enrichment
**What:** Rewrite `findUserPermissions()` to return `{ roles, scopeData, proxyPersonIds }` composite format, reading scope/proxy from JSON columns on `admin_users`.
**When to use:** Every login (local or SAML).
**Example:**
```typescript
// Source: v1.0 dev_v2 userroles.controller.ts, adapted for JSON columns
export const findUserPermissions = async (attrValue: string, attrType: string) => {
    let userRolesList = [];
    try {
        if (attrType === "email") {
            userRolesList = await sequelize.query(
                "SELECT DISTINCT au.personIdentifier, roleLabel, aur.roleID " +
                "FROM admin_users au " +
                "INNER JOIN admin_users_roles aur ON au.userID = aur.userID " +
                "INNER JOIN admin_roles ar ON aur.roleID = ar.roleID " +
                "WHERE au.email = :email",
                { replacements: { email: attrValue }, nest: true, raw: true }
            );
        } else {
            userRolesList = await sequelize.query(
                "SELECT DISTINCT au.personIdentifier, roleLabel, aur.roleID " +
                "FROM admin_users au " +
                "INNER JOIN admin_users_roles aur ON au.userID = aur.userID " +
                "INNER JOIN admin_roles ar ON aur.roleID = ar.roleID " +
                "WHERE au.personIdentifier = :personIdentifier",
                { replacements: { personIdentifier: attrValue }, nest: true, raw: true }
            );
        }

        // Retrieve scope and proxy data from JSON columns (D-05: always query, D-07: JSON columns)
        let scopeData = null;
        let proxyPersonIds = [];

        const scopeQuery = attrType === "email"
            ? "SELECT scope_person_types, scope_org_units, proxy_person_ids FROM admin_users WHERE email = :value LIMIT 1"
            : "SELECT scope_person_types, scope_org_units, proxy_person_ids FROM admin_users WHERE personIdentifier = :value LIMIT 1";

        const scopeResult: any = await sequelize.query(scopeQuery, {
            replacements: { value: attrValue },
            raw: true,
        });

        if (scopeResult[0]?.[0]) {
            const row = scopeResult[0][0];
            // JSON columns: MariaDB returns parsed objects, MySQL may return strings
            const personTypes = typeof row.scope_person_types === 'string'
                ? JSON.parse(row.scope_person_types)
                : row.scope_person_types;
            const orgUnits = typeof row.scope_org_units === 'string'
                ? JSON.parse(row.scope_org_units)
                : row.scope_org_units;
            const proxyIds = typeof row.proxy_person_ids === 'string'
                ? JSON.parse(row.proxy_person_ids)
                : row.proxy_person_ids;

            if (personTypes || orgUnits) {
                scopeData = { personTypes: personTypes || null, orgUnits: orgUnits || null };
            }
            proxyPersonIds = proxyIds || [];
        }

        // D-06: null scopeData and empty proxyPersonIds for users without assignments
        return JSON.stringify({ roles: userRolesList, scopeData, proxyPersonIds });
    } catch (e) {
        console.error('[AUTH] findUserPermissions error:', e);
        return JSON.stringify({ roles: [], scopeData: null, proxyPersonIds: [] });
    }
};
```

### Pattern 2: JWT Callback Composite Parsing (v4 Pattern)
**What:** Parse the composite `findUserPermissions` response in the JWT callback to separate `userRoles`, `scopeData`, and `proxyPersonIds` into individual token claims.
**When to use:** Every login (JWT creation).
**Example:**
```typescript
// Source: v1.0 dev_v2 [...nextauth].jsx jwt callback, adapted for v4 destructured args
async jwt({ token, user }) {
    if (user) {
        // Preserve existing v4 fields
        token.user = user;
        token.username = user.databaseUser?.personIdentifier || user.personIdentifier || user.email;
        token.email = user.email || '';
        token.databaseUser = user.databaseUser || null;
        token.name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || token.username;
        token.picture = user.image || user.databaseUser?.profilePicture;

        // PORT: Parse composite findUserPermissions response (D-01)
        if (user.userRoles) {
            try {
                const parsed = JSON.parse(user.userRoles);
                if (parsed.roles) {
                    // New composite format: { roles, scopeData, proxyPersonIds }
                    token.userRoles = JSON.stringify(parsed.roles);
                    token.scopeData = parsed.scopeData ? JSON.stringify(parsed.scopeData) : null;
                    token.proxyPersonIds = (parsed.proxyPersonIds && parsed.proxyPersonIds.length > 0)
                        ? JSON.stringify(parsed.proxyPersonIds) : null;
                } else {
                    // Legacy format (flat roles array) -- store as-is
                    token.userRoles = user.userRoles;
                    token.scopeData = null;
                    token.proxyPersonIds = null;
                }
            } catch (e) {
                // If not valid JSON, store as-is (fallback)
                token.userRoles = user.userRoles;
                token.scopeData = null;
                token.proxyPersonIds = null;
            }
        } else {
            token.userRoles = '[]';
            token.scopeData = null;
            token.proxyPersonIds = null;
        }
    }
    return token;
}
```

### Pattern 3: Session Callback Pass-Through (v4 Pattern)
**What:** Map new token fields to session.data so client components can access scope/proxy data.
**When to use:** Every session refresh.
**Example:**
```typescript
// Source: existing NextJS14 session callback, extended with scope/proxy fields
async session({ session, token }) {
    session.data = token;
    session.user.username = token.username;
    session.user.databaseUser = token.databaseUser;
    session.user.userRoles = token.userRoles;
    session.user = token.user;
    // D-02: pass through scope and proxy data
    // (Already included via session.data = token, but explicit for clarity)
    return session;
}
```

### Pattern 4: Capability-Based Middleware (v4 API)
**What:** Replace the entire middleware body with clean capability-based routing using `getToken()` + `getCapabilities()`.
**When to use:** Every protected route request.
**Example:**
```typescript
// Source: v1.0 dev_v2 middleware.ts, adapted to use getToken (v4) instead of jose.decodeJwt
import { NextRequest, NextResponse } from 'next/server';
import { getCapabilities, getLandingPage } from './utils/constants';
import { getToken } from "next-auth/jwt";

export const config = {
  matcher: ['/manageusers/:path*', '/curate/:path*', '/report', '/search',
            '/configuration', '/notifications/:path*', '/manageprofile/:path*'],
}

export async function middleware(request: NextRequest) {
  try {
    const res = NextResponse.next();
    const pathName = request.nextUrl.pathname;

    if (pathName?.includes('.git')) {
      return new NextResponse(null, { status: 403 });
    }

    const isAuthRoute = pathName.startsWith('/api/auth') ||
                       pathName.startsWith('/api/saml') ||
                       pathName.startsWith('/auth/finalize');
    if (isAuthRoute) return NextResponse.next();

    // Use getToken (verified) instead of jose.decodeJwt (unverified) -- D-09
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Parse roles from token
    let userRoles = [];
    try {
      if (token.userRoles) {
        userRoles = JSON.parse(token.userRoles as string);
      }
    } catch (e) {
      return redirectToLandingPage(request, '/error');
    }

    // Derive capabilities from roles
    const caps = getCapabilities(userRoles);
    const personIdentifier = caps.canCurate.personIdentifier;

    // Route-level checks (clean, deterministic -- D-08)
    if (pathName.startsWith('/curate')) {
      if (caps.canCurate.all) return res;
      if (caps.canCurate.scoped) return res; // person-level check deferred to API
      if (caps.canCurate.self) {
        const expectedPath = '/curate/' + personIdentifier;
        if (pathName === expectedPath) return res;
        return redirectToLandingPage(request, expectedPath);
      }
      return redirectToLandingPage(request, getLandingPage(caps));
    }
    // ... (similar blocks for /search, /report, /manageusers, /configuration, /notifications, /manageprofile)
  } catch (error) {
    console.error("[MIDDLEWARE]", error);
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = '/error';
    return NextResponse.redirect(errorUrl);
  }
}
```

### Anti-Patterns to Avoid
- **Copying v1.0's [...nextauth].jsx over the v4 version:** The v1.0 file uses next-auth v3 positional args (`jwt(token, apiResponse)`), v3 SAML inline assertion, and v3 imports (`next-auth/providers`). Replacing the v4 file would break everything. Graft the enrichment logic only.
- **Installing jose for middleware:** The v1.0 middleware uses `jose.decodeJwt()` which does NOT verify JWT signatures. The v4 `getToken()` is better and already used on the branch.
- **Porting session-callback admin settings loading:** v1.0 loads admin settings in the session callback (blocking). NextJS14 uses Redux `AdminSettingsDataLoader` (non-blocking). Keep the v4 pattern.
- **Mixing NEXTAUTH_SECRET and NEXT_PUBLIC_RECITER_TOKEN_SECRET:** Use `process.env.NEXTAUTH_SECRET` consistently for all `getToken()` calls. These may resolve to different values on some deployments.
- **Adding import from `next-auth/client`:** v4 moved everything to `next-auth/react`. The v3 import paths do not exist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT verification in middleware | Manual cookie parsing + jose.decodeJwt | `getToken({ req, secret })` from next-auth/jwt | Handles both cookie names (`next-auth.session-token` and `__Secure-next-auth.session-token`), verifies signatures, handles encryption |
| Role-to-capability mapping | Inline if/else chains checking role strings | `getCapabilities(roles)` from constants.js | Already written, tested, handles all role combos including Curator_Scoped |
| Landing page determination | Multiple redirect conditions per role combo | `getLandingPage(caps)` from constants.js | Already written, deterministic, handles all capability combos |
| JSON column parsing | Manual string checks and JSON.parse everywhere | Centralize in `findUserPermissions()` | Parse once at the source, all consumers get clean objects |

**Key insight:** The v1.0 capability model (`getCapabilities` + `getLandingPage`) already exists on the branch from Phase 7. The middleware rewrite is primarily a deletion of ~100 lines of brittle role-count logic and replacement with ~50 lines of clean capability checks.

## Common Pitfalls

### Pitfall 1: findUserPermissions Signature Mismatch (CRITICAL)
**What goes wrong:** The current feature branch has `findUserPermissions(attrTypes: string[], attrValues: string[])` with `Array.isArray()` checks, but ALL callers pass single strings: `findUserPermissions(cwid, "cwid")`. This would throw at runtime.
**Why it happens:** The controller was refactored (commits `bf2a31d` through `dbc0ace`) on the feature branch to expect arrays, but the callers in `[...nextauth].jsx` and `samlUtils.js` were never updated.
**How to avoid:** Phase 8 rewrites this function anyway. Use the simple `(attrValue: string, attrType: string)` signature that matches all callers (and matches v1.0's pattern). Do NOT try to fix the array-based signature -- just replace the function body entirely.
**Warning signs:** Login fails with "Both attrTypes and attrValues must be arrays" error.

### Pitfall 2: JSON Column Return Types Vary Between MySQL and MariaDB
**What goes wrong:** MySQL's JSON column returns parsed JavaScript objects from Sequelize `raw: true` queries. MariaDB (which maps JSON to LONGTEXT with CHECK) may return raw strings.
**Why it happens:** The dev database uses MariaDB (per DDL migration notes). The Sequelize `DataTypes.JSON` column handles serialization/deserialization in model operations, but `raw: true` queries bypass the model.
**How to avoid:** Always check `typeof` before parsing: `typeof value === 'string' ? JSON.parse(value) : value`. This handles both MySQL and MariaDB.
**Warning signs:** `JSON.parse` called on an already-parsed object throws "Unexpected token o" or similar.

### Pitfall 3: Session Token Shape Expectations
**What goes wrong:** `session.data = token` makes ALL token fields available, but components may expect specific field names. If `scopeData` or `proxyPersonIds` is missing from the token (e.g., old JWT from before the port), components get `undefined`.
**Why it happens:** Existing JWTs in user browsers won't have the new fields until users log out and back in.
**How to avoid:** Always use fallback defaults when reading: `token.scopeData || null`, `token.proxyPersonIds || '[]'`. The JWT callback already handles missing fields with null defaults.
**Warning signs:** `JSON.parse(undefined)` throws in middleware or components after deployment before users re-login.

### Pitfall 4: Middleware Error Swallowing
**What goes wrong:** If `getToken()` returns null (no valid session), the middleware silently passes through or throws, depending on code path.
**Why it happens:** The current middleware has an else branch that creates a `loginUrl` but for some paths doesn't actually redirect.
**How to avoid:** Explicit null check on `getToken()` result. If null, redirect to `/login`. The v1.0 middleware has this right.
**Warning signs:** Unauthenticated users can access protected routes.

### Pitfall 5: samlUtils.js findUserPermissions Call Convention
**What goes wrong:** `samlUtils.js` calls `findUserPermissions()` in two places: (1) in `findOrcreateAdminUser()` to get user roles, and (2) in `grantDefaultRolesToAdminUser()` to check existing roles before granting defaults. The second call at line 92 does `JSON.parse(await findUserPermissions(...))` expecting a flat roles array.
**Why it happens:** After the enrichment, `findUserPermissions` returns `{ roles, scopeData, proxyPersonIds }` instead of a flat roles array. The `JSON.parse` at line 92 would get the composite object, and subsequent `.some(role => role.roleLabel === ...)` checks would fail because the array is now inside `.roles`.
**How to avoid:** Update `grantDefaultRolesToAdminUser()` to handle the new composite format: parse the result, extract `.roles`, then check `.some()` on that array.
**Warning signs:** SAML auto-create grants incorrect default roles or fails silently during role deduplication.

### Pitfall 6: `__Secure-` Cookie Prefix in Production
**What goes wrong:** In production (HTTPS), next-auth uses `__Secure-next-auth.session-token` as the cookie name. Direct cookie checks must handle both names.
**Why it happens:** The current middleware already checks both cookie names (line 28). The v1.0 middleware only checks the non-secure name.
**How to avoid:** Use `getToken()` which handles both cookie names automatically. Do NOT manually read cookies. This is another reason D-09 (use `getToken()`) is correct.
**Warning signs:** Middleware works in dev (HTTP, non-secure cookies) but fails in production (HTTPS, secure cookies).

## Code Examples

### Complete findUserPermissions Rewrite

```typescript
// Source: adapted from v1.0 dev_v2 + Phase 7 JSON column decisions
import sequelize from "../../src/db/db";

export const findUserPermissions = async (attrValue: string, attrType: string) => {
    let userRolesList = [];
    try {
        // Query roles (same pattern as base branch, pre-refactor)
        const rolesQuery = attrType === "email"
            ? "SELECT DISTINCT au.personIdentifier, roleLabel, aur.roleID FROM admin_users au " +
              "INNER JOIN admin_users_roles aur ON au.userID = aur.userID " +
              "INNER JOIN admin_roles ar ON aur.roleID = ar.roleID WHERE au.email = :value"
            : "SELECT DISTINCT au.personIdentifier, roleLabel, aur.roleID FROM admin_users au " +
              "INNER JOIN admin_users_roles aur ON au.userID = aur.userID " +
              "INNER JOIN admin_roles ar ON aur.roleID = ar.roleID WHERE au.personIdentifier = :value";

        userRolesList = await sequelize.query(rolesQuery, {
            replacements: { value: attrValue },
            nest: true,
            raw: true
        });

        // D-05: Always query scope + proxy for every user
        // D-07: Read from JSON columns on admin_users directly
        let scopeData = null;
        let proxyPersonIds: string[] = [];

        const scopeQuery = attrType === "email"
            ? "SELECT scope_person_types, scope_org_units, proxy_person_ids FROM admin_users WHERE email = :value LIMIT 1"
            : "SELECT scope_person_types, scope_org_units, proxy_person_ids FROM admin_users WHERE personIdentifier = :value LIMIT 1";

        const scopeResult: any = await sequelize.query(scopeQuery, {
            replacements: { value: attrValue },
            raw: true,
        });

        if (scopeResult[0]?.[0]) {
            const row = scopeResult[0][0];
            // Handle both MySQL (parsed) and MariaDB (string) JSON returns
            const parseJson = (val: any) => {
                if (val === null || val === undefined) return null;
                if (typeof val === 'string') {
                    try { return JSON.parse(val); }
                    catch { return null; }
                }
                return val;
            };
            const personTypes = parseJson(row.scope_person_types);
            const orgUnits = parseJson(row.scope_org_units);
            const proxyIds = parseJson(row.proxy_person_ids);

            if (personTypes || orgUnits) {
                scopeData = { personTypes: personTypes || null, orgUnits: orgUnits || null };
            }
            proxyPersonIds = proxyIds || [];
        }

        // D-06: null scopeData and empty proxyPersonIds for users without assignments
        return JSON.stringify({ roles: userRolesList, scopeData, proxyPersonIds });
    } catch (e) {
        console.error('[AUTH] findUserPermissions error:', e);
        // Safe fallback so login still works even if scope/proxy queries fail
        return JSON.stringify({ roles: [], scopeData: null, proxyPersonIds: [] });
    }
};
```

### samlUtils.js grantDefaultRolesToAdminUser Fix

```typescript
// Line 92 in samlUtils.js -- must handle composite format
// BEFORE (broken with enriched format):
existingAdminUserRoles = JSON.parse(await findUserPermissions(adminUser.personIdentifier, "cwid"))
// existingAdminUserRoles would be { roles: [...], scopeData, proxyPersonIds }
// Then .some(role => role.roleLabel === ...) would fail

// AFTER (handles composite format):
const permissionsResult = JSON.parse(await findUserPermissions(adminUser.personIdentifier, "cwid"));
existingAdminUserRoles = permissionsResult.roles || permissionsResult;
// Now .some(role => role.roleLabel === ...) works on the roles array
```

### Index Page with getCapabilities

```typescript
// Source: v1.0 dev_v2 index.js, adapted for v4 getServerSession
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
import { getCapabilities, getLandingPage } from "../utils/constants";

export async function getServerSideProps(ctx) {
    try {
        const session = await getServerSession(ctx.req, ctx.res, authOptions);

        if (!session || !session.data) {
            if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
                return { redirect: { destination: "/login", permanent: false } };
            }
            return { redirect: { destination: "/api/auth/saml-login?callbackUrl=/search", permanent: false } };
        }

        // Check inactive user
        if (session.data.databaseUser?.status == 0) {
            return { redirect: { destination: "/noaccess", permanent: false } };
        }

        // Use capability model instead of role-label checks (D-08 pattern)
        let userRoles = [];
        try {
            if (session.data.userRoles) {
                userRoles = JSON.parse(session.data.userRoles);
            }
        } catch (e) {
            userRoles = [];
        }

        const caps = getCapabilities(userRoles);
        const landing = getLandingPage(caps);

        return { redirect: { destination: landing, permanent: false } };
    } catch (error) {
        console.error("[INDEX:getServerSideProps]", error);
        if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
            return { redirect: { destination: "/login", permanent: false } };
        }
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Role-count middleware (`userRoles.length == 1 && isReporterAll`) | Capability-based routing (`getCapabilities()` + `getLandingPage()`) | v1.0 (dev_v2) | Handles Curator_Scoped, eliminates nested if/else, deterministic |
| `jose.decodeJwt()` (unverified) | `getToken()` from next-auth/jwt (verified) | next-auth v4 | JWT signatures are actually verified |
| Junction tables for scope/proxy | JSON columns on admin_users | Phase 7 decision | No extra JOINs, simpler queries, matches small data volume |
| Flat roles array from findUserPermissions | Composite `{ roles, scopeData, proxyPersonIds }` | v1.0 (dev_v2) | Single query point for all auth data |
| v3 callback signatures (`jwt(token, user)`) | v4 callback signatures (`jwt({ token, user })`) | next-auth v4 | Destructured args, more explicit |

**Deprecated/outdated:**
- `next-auth/client`: Removed in v4, replaced by `next-auth/react`
- `next-auth/providers`: Replaced by individual provider imports (`next-auth/providers/credentials`)
- `jose.decodeJwt` in middleware: Replaced by `getToken` which verifies signatures

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual E2E (per D-18) |
| Config file | N/A -- no automated test framework in Phase 8 |
| Quick run command | `npm run build` (compile check) |
| Full suite command | `npm run build && npx tsx scripts/test-phase7-imports.mjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORT-04 | findUserPermissions returns composite format | manual | Login as test user, inspect `/api/auth/session` | N/A |
| PORT-05 | JWT contains scopeData + proxyPersonIds | manual | Login, inspect session endpoint for new fields | N/A |
| PORT-06 | Middleware routes by capability | manual | Navigate to protected routes as various role combos | N/A |
| PORT-07 | SAML auto-create works with enriched data | manual | SAML login, verify session shape | N/A |

### Sampling Rate
- **Per task commit:** `npm run build` (SWC compile check)
- **Per wave merge:** Build + login test with 3+ role combos via `/api/auth/session`
- **Phase gate:** All role combos tested, all middleware redirects verified

### Wave 0 Gaps
- [ ] `scripts/sql/test-users-phase8.sql` -- SQL to insert test users with various role+scope+proxy combos
- [ ] No automated test framework needed (D-18 -- E2E verification only)

## Open Questions

1. **findUserPermissions caller in samlUtils.js line 92**
   - What we know: `grantDefaultRolesToAdminUser()` calls `findUserPermissions()` and does `JSON.parse()` on the result, then uses `.some()` on the result expecting a flat array. After enrichment, this breaks.
   - What's unclear: Whether fixing this call site should be a separate task or bundled with the controller rewrite.
   - Recommendation: Bundle it -- the fix is a one-line change to extract `.roles` from the parsed result. Include it in the same task that rewrites `findUserPermissions()`.

2. **NEXTAUTH_SECRET vs NEXT_PUBLIC_RECITER_TOKEN_SECRET alignment**
   - What we know: The v4 branch uses `NEXTAUTH_SECRET` for `getToken()`. The v1.0 branch used `NEXT_PUBLIC_RECITER_TOKEN_SECRET` for `getToken()` (in reciterConfig). Both may be set in the deployment environment.
   - What's unclear: Whether both env vars resolve to the same value on reciter-dev.
   - Recommendation: Use `process.env.NEXTAUTH_SECRET` exclusively. If they differ, getToken in middleware will fail to verify tokens created with a different secret.

3. **JSON column behavior with Sequelize `raw: true`**
   - What we know: `DataTypes.JSON` columns are parsed automatically by Sequelize model queries. But `sequelize.query()` with `raw: true` bypasses model deserialization.
   - What's unclear: Exact return type from MariaDB for JSON columns via raw query.
   - Recommendation: Always use the `parseJson` helper that handles both string and object returns. Test with actual dev DB to confirm.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `feature/v1.1-port` branch -- all 5 files analyzed
- Direct code inspection of `origin/dev_v2` branch -- v1.0 source reference for port
- Direct code inspection of `origin/dev_Upd_NextJS14SNode18` at `747f4af` -- base branch reference
- Installed `next-auth@4.24.13` type definitions -- getToken API verified
- `.planning/research/ARCHITECTURE.md` -- comprehensive v3-to-v4 breaking changes, auth flow diagrams, session shape specs

### Secondary (MEDIUM confidence)
- `.planning/phases/07-foundation/07-CONTEXT.md` -- Phase 7 decisions on JSON columns vs junction tables
- `V1.1-PORT-PROPOSAL.md` -- requirements PORT-04 through PORT-07 acceptance criteria

### Tertiary (LOW confidence)
- MariaDB JSON column return type behavior via `raw: true` queries -- needs validation against actual dev database

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use on the branch
- Architecture: HIGH -- based on direct code inspection of both source (v1.0) and target (v4) branches
- Pitfalls: HIGH -- the signature mismatch (Pitfall 1) is verified by code inspection; MariaDB JSON behavior (Pitfall 2) is MEDIUM pending DB test
- Code examples: HIGH -- adapted directly from working v1.0 code with v4 API adjustments

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- no upstream library changes expected)
