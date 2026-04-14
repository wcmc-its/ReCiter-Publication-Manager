# Phase 15: Auth and Middleware - Research

**Researched:** 2026-04-14
**Domain:** next-auth v3 JWT callbacks, Edge middleware route enforcement, Sequelize JOINs for permission resolution
**Confidence:** HIGH

## Summary

Phase 15 connects the permission tables created in Phase 14 to the auth pipeline and middleware. The work breaks into two logical halves: (1) enrich the login flow so the JWT contains resolved permissions and permission resources, and (2) rewrite the middleware to enforce routes using permission keys instead of role label checks. The goal is zero visible behavior change -- every route that works today must work identically after this phase.

The existing auth flow is well-understood: `findUserPermissions()` runs a raw SQL JOIN across `admin_users -> admin_users_roles -> admin_roles` and returns `[{personIdentifier, roleLabel, roleID}]` as a JSON string. The JWT callback stores this in `token.userRoles`, the session callback copies the entire token into `session.data`, and every client component reads `session.data.userRoles` by parsing the JSON string. The middleware decodes the JWT with `jwt-decode` (no signature verification) and checks role labels with hardcoded if/else chains spanning 100+ lines.

Phase 15 must add a second query (or extend the existing one) that JOINs through the new `admin_role_permissions` and `admin_permissions` tables to resolve permission keys, then fetch matching `admin_permission_resources`. These two new data sets get added to the JWT as `permissions` (string array) and `permissionResources` (object array). The middleware switches from role-label checks to permission-key checks. The existing `userRoles` field stays in the JWT for backward compatibility -- Phase 16 and 18 will eventually remove it.

**Primary recommendation:** Add a new `findUserPermissionsEnriched()` function alongside the existing `findUserPermissions()` to avoid breaking the existing flow. Wire it into the JWT callback so both `userRoles` (legacy) and `permissions`/`permissionResources` (new) coexist in the token. Rewrite middleware to use permission keys with a route-to-permission lookup map, keeping the self-only curator and baseline fallback logic.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | findUserPermissions() resolves permissions from DB via role->permission JOINs at login time | New SQL query joining admin_users_roles -> admin_role_permissions -> admin_permissions; can be a new function `findUserPermissionsEnriched()` to avoid breaking existing callers |
| AUTH-02 | findUserPermissions() fetches permission_resources for the user's resolved permissions | Second query or subquery joining admin_permission_resources on the resolved permissionIDs |
| AUTH-03 | JWT token contains permissions (string array) and permissionResources (object array) | Add to JWT callback in [...nextauth].jsx after existing `token.userRoles` assignment |
| AUTH-04 | Session passes permissions and permissionResources to client-side components | Session callback already copies entire token to `session.data`; new fields automatically available as `session.data.permissions` and `session.data.permissionResources` |
| MW-01 | Middleware checks permission set from JWT instead of deriving capabilities via getCapabilities() | Replace 100+ lines of role-label if/else in middleware.ts with permission-key checks using `hasPermission()` from permissionUtils.ts |
| MW-02 | Route-to-permission mapping defined as a simple lookup object in middleware code | Define `ROUTE_PERMISSIONS` map: { '/manageusers': 'canManageUsers', '/configuration': 'canConfigure', ... } |
| MW-03 | Baseline fallback grants canSearch + canReport when permission set is empty | When parsed permissions array is empty, inject `['canSearch', 'canReport']` before checking routes |
| MW-04 | Curation scope logic (self/scoped/proxy) remains unchanged in middleware | Keep the Curator_Self redirect logic but detect it via role array (still in JWT as `userRoles`) not permission set |
| MW-05 | Landing page redirect uses permission set instead of capability model | Use `getLandingPageFromPermissions()` from permissionUtils.ts for redirect decisions |
</phase_requirements>

## Standard Stack

### Core (already in project -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 3.29.10 | Authentication framework, JWT callbacks | Already in use; v3 API with `callbacks.jwt` and `callbacks.session` [VERIFIED: node_modules/next-auth/package.json] |
| sequelize | 6.37.8 | ORM for permission resolution queries | Already in use; all DB queries go through Sequelize [VERIFIED: node_modules/sequelize/package.json] |
| jwt-decode | 3.1.2 | JWT decoding in Edge middleware | Already used in middleware.ts; decodes without verification [VERIFIED: node_modules/jwt-decode/package.json] |
| jest | ^29.7.0 | Test runner for integration tests | Already configured [VERIFIED: jest.config.js] |
| ts-jest | ^29.4.9 | TypeScript transformer for Jest | Already configured [VERIFIED: jest.config.js] |

### Supporting (from Phase 14 -- already created)
| Library/File | Purpose | When to Use |
|-------------|---------|-------------|
| src/utils/permissionUtils.ts | `hasPermission()`, `getPermissionsFromRaw()`, `getLandingPageFromPermissions()` | Middleware route enforcement and landing page redirect |
| src/db/models/AdminPermission.ts | Sequelize model for admin_permissions | Permission resolution queries |
| src/db/models/AdminRolePermission.ts | Sequelize model for admin_role_permissions | Role-to-permission JOINs |
| src/db/models/AdminPermissionResource.ts | Sequelize model for admin_permission_resources | UI resource resolution |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jwt-decode (no verification) | next-auth/jwt `getToken()` (verified) | getToken() verifies signature using NEXTAUTH_SECRET but requires async and cookie access; jwt-decode is already working and verification happens at the session layer. Switching is a security improvement but outside this phase's scope. |
| Raw SQL for permission query | Sequelize eager loading (include) | Raw SQL gives precise control and avoids N+1; Sequelize includes work but are harder to debug for complex JOINs. Raw SQL matches the existing findUserPermissions pattern. |
| New function findUserPermissionsEnriched() | Modify existing findUserPermissions() in place | New function is safer -- existing callers (grantDefaultRolesToAdminUser, etc.) depend on the current return format. A new function avoids regressions. |

**Installation:**
No `npm install` needed for new packages. All dependencies are already present.

## Architecture Patterns

### Current Auth Data Flow (before Phase 15)
```
Login (SAML/local)
  -> findUserPermissions(email, personIdentifier)
     -> SQL: admin_users JOIN admin_users_roles JOIN admin_roles
     -> Returns JSON string: [{ personIdentifier, roleLabel, roleID }]
  -> JWT callback: token.userRoles = jsonString
  -> Session callback: session.data = token (copies everything)
  -> Client: JSON.parse(session.data.userRoles) -> role objects

Middleware:
  -> jwt_decode(cookie) -> decodedTokenJson
  -> JSON.parse(JSON.stringify(decodedTokenJson)) -> allUserRoles
  -> JSON.parse(allUserRoles.userRoles) -> role array
  -> Check role.roleLabel against hardcoded strings
```

### Target Auth Data Flow (after Phase 15)
```
Login (SAML/local)
  -> findUserPermissions(email, personIdentifier)     [UNCHANGED - legacy]
     -> Returns: [{ personIdentifier, roleLabel, roleID }]
  -> findUserPermissionsEnriched(email, personIdentifier)  [NEW]
     -> SQL: admin_users JOIN admin_users_roles JOIN admin_role_permissions JOIN admin_permissions
     -> Returns: { permissions: string[], permissionResources: object[] }
  -> JWT callback:
     -> token.userRoles = jsonString               [UNCHANGED - backward compat]
     -> token.permissions = JSON.stringify(permissions)   [NEW]
     -> token.permissionResources = JSON.stringify(permissionResources)  [NEW]
  -> Session callback: session.data = token         [UNCHANGED - auto-copies new fields]
  -> Client: session.data.permissions, session.data.permissionResources  [NEW - Phase 16 uses these]

Middleware:
  -> jwt_decode(cookie) -> decodedTokenJson          [UNCHANGED]
  -> Parse permissions from token                     [NEW]
  -> Apply baseline fallback if empty                 [NEW]
  -> Check permission keys via ROUTE_PERMISSIONS map  [NEW]
  -> Self-only curator redirect via userRoles check   [UNCHANGED logic, uses roles]
```

### Pattern 1: Permission Resolution Query (Raw SQL)
**What:** A new controller function that resolves permission keys and resources from the user's roles.
**When to use:** Called once during login, results stored in JWT.
**Example:**
```typescript
// Source: Derived from existing findUserPermissions pattern in controllers/db/userroles.controller.ts
// [VERIFIED: codebase pattern analysis]

export const findUserPermissionsEnriched = async (
  attrTypes: string[],
  attrValues: string[]
): Promise<{ permissions: string[]; permissionResources: any[] }> => {
  // Validate inputs (same pattern as findUserPermissions)
  if (!Array.isArray(attrTypes) || !Array.isArray(attrValues)) {
    throw new Error('Both attrTypes and attrValues must be arrays');
  }
  
  const replacements: Record<string, any> = {};
  attrTypes.forEach((field, index) => {
    if (field === 'personIdentifier') replacements.personIdentifier = attrValues[index] ?? '';
    if (field === 'email') replacements.email = attrValues[index] ?? '';
  });

  // Query 1: Resolve permission keys from user's roles
  const permissionRows = await sequelize.query(`
    SELECT DISTINCT p.permissionKey
    FROM admin_users au
    INNER JOIN admin_users_roles aur ON au.userID = aur.userID
    INNER JOIN admin_role_permissions arp ON aur.roleID = arp.roleID
    INNER JOIN admin_permissions p ON arp.permissionID = p.permissionID
    WHERE (au.personIdentifier = :personIdentifier AND au.email = :email)
       OR (au.email = :email
           AND au.email IS NOT NULL AND au.email <> ''
           AND au.email IN (
             SELECT email FROM admin_users
             WHERE email IS NOT NULL AND email <> ''
             GROUP BY email HAVING COUNT(*) = 1
           ))
  `, { replacements, raw: true, nest: true });

  const permissions = permissionRows.map((r: any) => r.permissionKey);

  // Query 2: Fetch resources for those permissions
  let permissionResources = [];
  if (permissions.length > 0) {
    permissionResources = await sequelize.query(`
      SELECT pr.resourceType, pr.resourceKey, pr.displayOrder,
             pr.icon, pr.label, pr.route, p.permissionKey
      FROM admin_permission_resources pr
      INNER JOIN admin_permissions p ON pr.permissionID = p.permissionID
      WHERE p.permissionKey IN (:permissions)
      ORDER BY pr.displayOrder ASC
    `, { replacements: { permissions }, raw: true, nest: true });
  }

  return { permissions, permissionResources };
};
```

### Pattern 2: JWT Callback Extension
**What:** Add permissions and permissionResources to the JWT token alongside existing userRoles.
**When to use:** In the `callbacks.jwt` function in `[...nextauth].jsx`.
**Example:**
```javascript
// Source: Existing JWT callback in src/pages/api/auth/[...nextauth].jsx lines 268-292
// [VERIFIED: codebase]

async jwt(token, apiResponse) {
  if(apiResponse) {
    // ... existing code for username, email, databaseUser, userRoles ...
    
    if(apiResponse.userRoles) {
      token.userRoles = apiResponse.userRoles  // KEEP for backward compat
    }
    // NEW: Add permission data
    if(apiResponse.permissions) {
      token.permissions = JSON.stringify(apiResponse.permissions)
    }
    if(apiResponse.permissionResources) {
      token.permissionResources = JSON.stringify(apiResponse.permissionResources)
    }
  }
  return token
}
```

### Pattern 3: Middleware Route-Permission Map
**What:** A simple object mapping route prefixes to required permission keys.
**When to use:** In middleware.ts for route enforcement.
**Example:**
```typescript
// Source: Derived from existing middleware matcher and requirements MW-02
// [VERIFIED: middleware.ts matcher config line 8]

const ROUTE_PERMISSIONS: Record<string, string> = {
  '/manageusers': 'canManageUsers',
  '/configuration': 'canConfigure',
  '/curate': 'canCurate',
  '/report': 'canReport',
  '/search': 'canSearch',
  '/notifications': 'canManageNotifications',
  '/manageprofile': 'canManageProfile',
};
```

### Pattern 4: Baseline Fallback (MW-03)
**What:** When a user has roles but no resolved permissions (edge case during migration or empty role-permission mapping), grant baseline access to search and report.
**When to use:** In middleware after parsing permissions from JWT.
**Example:**
```typescript
// Source: Requirements MW-03 and existing behavior analysis
// The current system implicitly grants search/report access to all authenticated users.
// The middleware only BLOCKS access to restricted routes -- it does not block /search or /report
// for any authenticated user with roles.

let permissions = getPermissionsFromRaw(decodedToken.permissions);
if (permissions.length === 0) {
  // Baseline: every authenticated user can search and report
  permissions = ['canSearch', 'canReport'];
}
```

### Anti-Patterns to Avoid
- **Removing userRoles from JWT:** Phase 16 components still read `session.data.userRoles` for role-label checks (e.g., allowedRoleNames arrays in SideNavbar). Keep `userRoles` in the token until Phase 18 cleanup.
- **Using Sequelize eager loading in Edge middleware:** Edge middleware runs in a limited runtime. All DB queries must happen at login time (JWT callback), never in middleware.
- **Modifying findUserPermissions() in place:** The existing function is called by `grantDefaultRolesToAdminUser()` which expects the current return format. Create a new function instead.
- **JWT token size explosion:** Stringify permissions and resources as compact JSON. The 7 permission keys add ~100 bytes. The 7 resource objects add ~500 bytes. Well within JWT size limits (~4KB safe for cookies). [ASSUMED: JWT cookie size limit around 4KB]
- **Breaking the double-parse pattern in middleware:** The current middleware does `JSON.stringify(decodedTokenJson)` then `JSON.parse(allUserRoles)` then `JSON.parse(userRoles.userRoles)`. This triple-encoding is fragile. The new permissions field should use a cleaner pattern but must not break the existing userRoles parsing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission membership check | Custom indexOf/includes | `hasPermission()` from permissionUtils.ts | Already built and tested in Phase 14; handles null/undefined defensively |
| JWT permission string parsing | Inline JSON.parse with try/catch | `getPermissionsFromRaw()` from permissionUtils.ts | Already built and tested; handles all edge cases |
| Landing page determination | New if/else chain | `getLandingPageFromPermissions()` from permissionUtils.ts | Already built and tested; correctly handles Curator_Self + Reporter_All edge case |
| Route-to-permission enforcement | Nested if/else chains (the current pattern) | Simple ROUTE_PERMISSIONS lookup map | The current 100+ line if/else in middleware.ts is the exact thing being replaced |

**Key insight:** The Phase 14 utilities were designed specifically for Phase 15 consumption. Use them as-is.

## Common Pitfalls

### Pitfall 1: Middleware Still Needs Role Labels for Self-Only Detection
**What goes wrong:** The middleware is rewritten to use only permission keys, but the self-only curator redirect logic requires knowing the user's actual role labels (Curator_Self vs. broader curate roles).
**Why it happens:** The permission set for Curator_Self is just `['canCurate']`. The permission set for Curator_Scoped is `['canCurate', 'canSearch']`. But the *redirect* behavior differs: Curator_Self accessing `/search` gets redirected to `/curate/:id`, while Curator_Scoped accessing `/search` is allowed through. Permissions alone cannot distinguish these.
**How to avoid:** The middleware must continue reading `userRoles` from the JWT for self-only detection and curation scope logic (MW-04). The permission checks handle the "does the user have access to this route type" question; the role checks handle the "where specifically should a self-curator be redirected" question. These are two different concerns.
**Warning signs:** Curator_Self can suddenly access /search without redirect; or Curator_Scoped gets incorrectly redirected to their own curate page.

### Pitfall 2: Token Fields Are Stored as JSON Strings, Not Objects
**What goes wrong:** The JWT `permissions` field is stored as a string array `["canCurate","canSearch"]` but the middleware tries to use it directly as an array.
**Why it happens:** In next-auth v3, the JWT callback stores the entire token as a flat JSON object. Complex types (arrays, nested objects) must be serialized to strings. The existing `userRoles` field is stored as `JSON.stringify(roleArray)` and parsed with `JSON.parse()` on the consumer side.
**How to avoid:** Store as `token.permissions = JSON.stringify(permissionArray)` in the JWT callback. Parse with `getPermissionsFromRaw(decodedToken.permissions)` in middleware and `JSON.parse(session.data.permissions)` in client components. [VERIFIED: existing pattern in [...nextauth].jsx line 288 and middleware.ts line 27]
**Warning signs:** `permissions.includes is not a function` errors -- means you're calling array methods on a string.

### Pitfall 3: The WHERE Clause Must Match Existing findUserPermissions Exactly
**What goes wrong:** The new permission resolution query uses a simpler WHERE clause and returns different users or misses some matches.
**Why it happens:** The existing `findUserPermissions` has a complex WHERE clause with two conditions ORed together: (1) exact match on both personIdentifier AND email, or (2) email-only match when the email is unique in admin_users. This handles cases where the same email maps to exactly one admin user.
**How to avoid:** Copy the exact same WHERE clause from the existing `findUserPermissions()` into the new enriched function. Both must find the same user. [VERIFIED: userroles.controller.ts lines 38-52]
**Warning signs:** Some users get different permissions than expected, especially users matched by email-only.

### Pitfall 4: apiResponse Shape Differs Between SAML and Direct Login
**What goes wrong:** The JWT callback receives different `apiResponse` shapes from the SAML flow vs. the direct login flow, and the new permissions data is missing in one path.
**Why it happens:** The direct login path calls `findUserPermissions` in the `authorize()` method and attaches `apiResponse.userRoles`. The SAML path calls `findOrcreateAdminUser` which internally calls `findUserPermissions` and attaches it to `createdAdminUser.userRoles`. Both paths must also call `findUserPermissionsEnriched` and attach the results.
**How to avoid:** Trace both auth paths carefully. The direct login flow (`credentials.authorize`) and the SAML flow (`saml.authorize`) both end by returning an apiResponse object. Add `permissions` and `permissionResources` to the apiResponse in BOTH paths. There are actually 3 SAML code paths (email-only, email+CWID, CWID-only) that all go through `findOrcreateAdminUser()`, so the enrichment is best done in `findOrcreateAdminUser()` or in a shared location called from both auth paths. [VERIFIED: [...nextauth].jsx lines 137-254]
**Warning signs:** SAML users get permissions but direct login users don't (or vice versa).

### Pitfall 5: Middleware Edge Runtime Cannot Import Node.js Modules
**What goes wrong:** The rewritten middleware imports Sequelize models or the db connection, causing "Module not found" or "Dynamic code evaluation not allowed" errors.
**Why it happens:** Next.js middleware runs in the Edge Runtime which has a restricted API. It cannot use Node.js modules like `fs`, `net`, or any module that depends on them (including Sequelize).
**How to avoid:** The middleware must ONLY read data from the JWT token. All database queries must happen at login time in the JWT callback (which runs in Node.js). The middleware receives pre-computed permission data from the token -- it never queries the database. `permissionUtils.ts` is safe for Edge because it has no Node.js imports. [VERIFIED: permissionUtils.ts has zero imports -- pure functions only]
**Warning signs:** Build errors about Edge Runtime incompatibility; "Dynamic server usage" warnings.

### Pitfall 6: Double-Serialization of JWT Fields
**What goes wrong:** The permissions field gets double-JSON-encoded, producing `"[\"canCurate\",\"canSearch\"]"` instead of `["canCurate","canSearch"]` in the decoded token.
**Why it happens:** If `findUserPermissionsEnriched` returns `{permissions: ['canCurate']}` and the JWT callback does `token.permissions = JSON.stringify(apiResponse.permissions)`, the token stores a JSON string. When the middleware does `jwt_decode()`, it gets the string back. If middleware then does `JSON.parse(JSON.parse(decodedToken.permissions))` -- one parse too many.
**How to avoid:** Be explicit about serialization layers. The JWT callback should `JSON.stringify()` once. The middleware/client should `JSON.parse()` once. Use `getPermissionsFromRaw()` which handles the single-parse safely. Document the serialization contract clearly.
**Warning signs:** Parsing errors, or getting a string instead of an array.

## Code Examples

### Example 1: findUserPermissionsEnriched (Permission Resolution)
```typescript
// Source: Pattern from controllers/db/userroles.controller.ts lines 4-66 [VERIFIED: codebase]
// Extended with JOINs through Phase 14 tables

import sequelize from "../../src/db/db";

export const findUserPermissionsEnriched = async (
  attrTypes: string[],
  attrValues: string[]
): Promise<{ permissions: string[]; permissionResources: any[] }> => {
  if (!Array.isArray(attrTypes) || !Array.isArray(attrValues)) {
    throw new Error('Both attrTypes and attrValues must be arrays');
  }
  if (attrTypes.length !== attrValues.length) {
    throw new Error('attrTypes and attrValues must be the same length');
  }

  const allowedFields = ['email', 'personIdentifier'];
  const replacements: Record<string, any> = {};

  attrTypes.forEach((field, index) => {
    const value = attrValues[index] ?? '';
    if (!allowedFields.includes(field)) return;
    if (field === 'personIdentifier') replacements.personIdentifier = value;
    if (field === 'email') replacements.email = value;
  });

  // Same WHERE clause as findUserPermissions -- exact match on both fields,
  // OR email-only match when email is unique in admin_users
  const whereClause = `
    (au.personIdentifier = :personIdentifier AND au.email = :email)
    OR
    (au.email = :email
     AND au.email IS NOT NULL AND au.email <> ''
     AND au.email IN (
       SELECT email FROM admin_users
       WHERE email IS NOT NULL AND email <> ''
       GROUP BY email HAVING COUNT(*) = 1
     ))
  `;

  // Resolve distinct permission keys via role->permission JOINs
  const permRows: any[] = await sequelize.query(
    `SELECT DISTINCT p.permissionKey
     FROM admin_users au
     INNER JOIN admin_users_roles aur ON au.userID = aur.userID
     INNER JOIN admin_role_permissions arp ON aur.roleID = arp.roleID
     INNER JOIN admin_permissions p ON arp.permissionID = p.permissionID
     WHERE ${whereClause}`,
    { replacements, raw: true, nest: true }
  );

  const permissions: string[] = permRows.map((r: any) => r.permissionKey);

  // Fetch resources for the resolved permissions
  let permissionResources: any[] = [];
  if (permissions.length > 0) {
    permissionResources = await sequelize.query(
      `SELECT pr.resourceType, pr.resourceKey, pr.displayOrder,
              pr.icon, pr.label, pr.route, p.permissionKey
       FROM admin_permission_resources pr
       INNER JOIN admin_permissions p ON pr.permissionID = p.permissionID
       WHERE p.permissionKey IN (:permKeys)
       ORDER BY pr.displayOrder ASC`,
      { replacements: { permKeys: permissions }, raw: true, nest: true }
    );
  }

  return { permissions, permissionResources };
};
```

### Example 2: JWT Callback Extension
```javascript
// Source: Existing callback in src/pages/api/auth/[...nextauth].jsx lines 268-293
// [VERIFIED: codebase]

async jwt(token, apiResponse) {
  if(apiResponse) {
    if(apiResponse.statusMessage) {
      token.username = apiResponse.statusMessage.username
    }
    if(apiResponse.databaseUser || apiResponse.personIdentifier) {
      token.email = apiResponse.email || ""
      token.username = apiResponse.databaseUser?.personIdentifier 
        || apiResponse.personIdentifier || apiResponse.email
      token.databaseUser = apiResponse.databaseUser
    }
    if(apiResponse.userRoles) {
      token.userRoles = apiResponse.userRoles  // KEEP -- backward compat
    }
    // NEW: Phase 15 additions
    if(apiResponse.permissions) {
      token.permissions = JSON.stringify(apiResponse.permissions)
    }
    if(apiResponse.permissionResources) {
      token.permissionResources = JSON.stringify(apiResponse.permissionResources)
    }
  }
  return token
}
```

### Example 3: Middleware Rewrite (Simplified)
```typescript
// Source: Derived from existing middleware.ts [VERIFIED: codebase] and MW-01 through MW-05

import { NextRequest, NextResponse } from 'next/server'
import jwt_decode from "jwt-decode"
import { getPermissionsFromRaw, hasPermission, getLandingPageFromPermissions } from './utils/permissionUtils'

const ROUTE_PERMISSIONS: Record<string, string> = {
  '/manageusers': 'canManageUsers',
  '/configuration': 'canConfigure',
  '/curate': 'canCurate',
  '/report': 'canReport',
  '/search': 'canSearch',
  '/notifications': 'canManageNotifications',
  '/manageprofile': 'canManageProfile',
}

export async function middleware(request: NextRequest) {
  const pathName = request.nextUrl.pathname;
  
  if (pathName?.includes('.git')) {
    return new NextResponse(null, { status: 403 })
  }

  const sessionCookie = request.cookies.get('next-auth.session-token')
    || request.cookies.get('__Secure-next-auth.session-token');

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const decoded: any = jwt_decode(sessionCookie);
  
  // Parse permissions from JWT (MW-01)
  let permissions = getPermissionsFromRaw(decoded.permissions);
  
  // Baseline fallback (MW-03): if no permissions, grant search + report
  if (permissions.length === 0) {
    permissions = ['canSearch', 'canReport'];
  }

  // Parse roles for self-only detection (MW-04)
  const userRoles = decoded.userRoles ? JSON.parse(decoded.userRoles) : [];
  const personIdentifier = userRoles?.[0]?.personIdentifier || null;

  // Route permission check (MW-02)
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find(
    route => pathName.startsWith(route)
  );

  if (matchedRoute) {
    const requiredPermission = ROUTE_PERMISSIONS[matchedRoute];
    
    if (!hasPermission(permissions, requiredPermission)) {
      // User lacks permission -- redirect to landing page (MW-05)
      const landing = getLandingPageFromPermissions(permissions, userRoles);
      return redirectToLandingPage(request, landing);
    }
  }

  // Self-only curator scope enforcement (MW-04)
  // This uses ROLES not permissions -- a Curator_Self accessing someone else's
  // curate page must be redirected to their own page
  if (pathName.startsWith('/curate') && personIdentifier) {
    const isSelfOnly = userRoles.some((r: any) => r.roleLabel === 'Curator_Self')
      && !userRoles.some((r: any) => ['Superuser', 'Curator_All', 'Curator_Scoped',
        'Curator_Department', 'Curator_Department_Delegate'].includes(r.roleLabel));
    
    if (isSelfOnly && pathName !== '/curate/' + personIdentifier) {
      return redirectToLandingPage(request, '/curate/' + personIdentifier);
    }
  }

  // Self-only redirect for non-curate routes they shouldn't access
  // (e.g., Curator_Self trying /search when they only have canCurate)
  // Already handled by the route permission check above

  return NextResponse.next();
}
```

### Example 4: Integration into SAML Auth Flow
```javascript
// Source: Existing findOrcreateAdminUser in [...nextauth].jsx lines 26-58
// [VERIFIED: codebase]

// The cleanest place to add the enriched permission call is alongside
// the existing findUserPermissions call in findOrcreateAdminUser():

const findOrcreateAdminUser = async(cwid, samlEmail, samlFirstName, samlLastName) => {
  const createdAdminUser = await findOrCreateAdminUsers(cwid, samlEmail, samlFirstName, samlLastName)
  if(createdAdminUser) {
    await grantDefaultRolesToAdminUser(createdAdminUser);
    await sleep(50);
    
    if(samlEmail || cwid) {
      // Existing: role data for backward compatibility
      let userRoles = await findUserPermissions([EMAIL, PERSONIDENTIFIER], [samlEmail, cwid])
      createdAdminUser.userRoles = userRoles;
      
      // NEW: permission data from Phase 14 tables
      const enriched = await findUserPermissionsEnriched(
        [EMAIL, PERSONIDENTIFIER], [samlEmail, cwid]
      );
      createdAdminUser.permissions = enriched.permissions;
      createdAdminUser.permissionResources = enriched.permissionResources;
    }
    // ... rest of existing code ...
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded role-label checks in middleware | Permission-key checks via ROUTE_PERMISSIONS map | This phase (v1.3) | Middleware drops from ~130 lines of if/else to ~40 lines |
| JWT contains only userRoles (role array) | JWT contains userRoles + permissions + permissionResources | This phase (v1.3) | Client components can start using permission data (Phase 16) |
| middleware derives access from role combinations | middleware uses `hasPermission()` against resolved permission set | This phase (v1.3) | Adding a new permission/route requires only a DB row + one map entry |

**Deprecated/outdated:**
- The current 100+ line if/else middleware pattern: Being replaced by permission-based lookup
- `allowedPermissions` object in constants.js: Still used by components in Phase 15 (will be removed in Phase 18)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JWT cookie size limit is ~4KB, and adding permissions (~100 bytes) + resources (~500 bytes) stays well within limits | Architecture Patterns / Anti-Patterns | LOW -- even worst case (all 7 permissions + 7 resources) is under 1KB. If wrong, compress or use a session store. |
| A2 | next-auth v3 JWT callback fires only on sign-in (not every request), so the DB queries run once per login | Architecture Patterns | MEDIUM -- if the callback fires on every request, it would add latency. Verified by next-auth v3 docs: jwt callback fires on sign-in and on useSession/getSession when token is refreshed, but the `apiResponse` param is only present on sign-in. The `if(apiResponse)` guard prevents DB queries on subsequent calls. [VERIFIED: [...nextauth].jsx line 269 shows apiResponse guard] |
| A3 | jwt-decode v3 returns parsed JSON objects from the JWT payload, so JSON.stringify'd fields come back as strings not objects | Pitfall 2 | LOW -- standard JWT behavior; the payload is a JSON object, so string-valued fields stay as strings |
| A4 | The Sequelize raw query with `IN (:permKeys)` replacement correctly handles arrays in Sequelize v6 | Code Examples | LOW -- Sequelize v6 auto-expands arrays in named replacements for IN clauses [ASSUMED] |

## Open Questions

1. **Should findUserPermissionsEnriched live in userroles.controller.ts or a new file?**
   - What we know: The existing `findUserPermissions` lives in `controllers/db/userroles.controller.ts`. The new function uses the same patterns and imports.
   - What's unclear: Whether adding to the existing file or creating a new `permissions.controller.ts` is preferred.
   - Recommendation: Add to the existing `userroles.controller.ts` since it already handles user permission resolution. A separate file would be cleaner but introduces a new import path for a closely related function.

2. **Should the direct login path also call findUserPermissionsEnriched?**
   - What we know: There are two auth paths. The SAML path goes through `findOrcreateAdminUser()`. The direct login path (lines 137-154) calls `findUserPermissions` directly.
   - What's unclear: Whether to duplicate the enrichment call in both paths or refactor to share.
   - Recommendation: Both paths must call `findUserPermissionsEnriched`. The simplest approach is to add the call in both the `direct_login.authorize()` and `findOrcreateAdminUser()` functions. A shared wrapper could be introduced but adds complexity.

3. **Should the middleware use `getToken()` from next-auth/jwt instead of jwt-decode?**
   - What we know: `getToken()` is available in next-auth v3 and verifies the JWT signature. The current middleware uses `jwt-decode` which does not verify.
   - What's unclear: Whether switching to `getToken()` is in scope for this phase.
   - Recommendation: Out of scope for Phase 15. The current `jwt-decode` approach works and the phase goal is to change the permission model, not the token verification method. A future phase could upgrade to `getToken()` for security hardening.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server-side auth callbacks | Yes | 22.22.1 | -- |
| MySQL | Permission resolution queries | Remote only | -- | Mock in tests |
| next-auth | JWT/session callbacks | Yes | 3.29.10 | -- |
| jwt-decode | Middleware JWT parsing | Yes | 3.1.2 | -- |
| Jest | Unit/integration tests | Yes | ^29.7.0 | -- |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- MySQL database access for integration testing: Use mock-based unit tests for the controller function; end-to-end testing requires deployment to dev environment.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.4.9 |
| Config file | `jest.config.js` (node env) |
| Quick run command | `npx jest --config jest.config.js --no-cache` |
| Full suite command | `npx jest --config jest.config.js --no-cache` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | findUserPermissionsEnriched resolves permission keys via JOINs | unit (mock DB) | `npx jest --config jest.config.js __tests__/permissionsEnriched.test.ts -t "resolves permissions"` | Wave 0 |
| AUTH-02 | findUserPermissionsEnriched fetches permission resources | unit (mock DB) | `npx jest --config jest.config.js __tests__/permissionsEnriched.test.ts -t "fetches resources"` | Wave 0 |
| AUTH-03 | JWT contains permissions and permissionResources after login | unit (mock callback) | `npx jest --config jest.config.js __tests__/authCallbacks.test.ts -t "JWT contains permissions"` | Wave 0 |
| AUTH-04 | Session exposes permissions to client | unit (mock callback) | `npx jest --config jest.config.js __tests__/authCallbacks.test.ts -t "session passes permissions"` | Wave 0 |
| MW-01 | Middleware uses permission set for route checks | unit | `npx jest --config jest.config.js __tests__/middleware.test.ts -t "permission check"` | Wave 0 |
| MW-02 | ROUTE_PERMISSIONS map covers all 7 routes | unit | `npx jest --config jest.config.js __tests__/middleware.test.ts -t "route map"` | Wave 0 |
| MW-03 | Baseline fallback grants canSearch + canReport | unit | `npx jest --config jest.config.js __tests__/middleware.test.ts -t "baseline"` | Wave 0 |
| MW-04 | Self-only curator redirect unchanged | unit | `npx jest --config jest.config.js __tests__/middleware.test.ts -t "self-only"` | Wave 0 |
| MW-05 | Landing page uses getLandingPageFromPermissions | unit | `npx jest --config jest.config.js __tests__/middleware.test.ts -t "landing page"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --config jest.config.js --no-cache`
- **Per wave merge:** Full suite + manual verification on dev server
- **Phase gate:** All tests pass + Superuser, Curator_Self, Reporter_All can log in and navigate correctly on dev

### Wave 0 Gaps
- [ ] `__tests__/permissionsEnriched.test.ts` -- covers AUTH-01, AUTH-02 (mock sequelize.query, verify SQL and return shape)
- [ ] `__tests__/middleware.test.ts` -- covers MW-01 through MW-05 (mock NextRequest, verify redirect behavior)
- [ ] Optional: `__tests__/authCallbacks.test.ts` -- covers AUTH-03, AUTH-04 (mock next-auth callback chain)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (modifying auth pipeline) | next-auth v3 handles authentication; this phase only adds data to the existing JWT flow |
| V3 Session Management | Yes (JWT token contents) | JWT signed by next-auth with NEXTAUTH_SECRET; token contents are trusted because signing prevents tampering |
| V4 Access Control | Yes (middleware enforcement) | Permission-based route enforcement replaces role-based checks; baseline fallback preserves existing access |
| V5 Input Validation | Yes (SQL query parameters) | Use Sequelize named replacements (:paramName) -- never string interpolation. WHERE clause copied from existing verified function. |
| V6 Cryptography | No | No new crypto operations |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JWT token tampering (adding fake permissions) | Tampering | JWT is signed by next-auth using NEXTAUTH_SECRET. jwt-decode does not verify signatures, but token is set by the server via httpOnly cookie -- client cannot modify it. Verification happens server-side in next-auth session validation. |
| SQL injection in permission query | Tampering | Sequelize named replacements parameterize all user input. The WHERE clause uses `:personIdentifier` and `:email` replacements, never string concatenation. [VERIFIED: existing pattern in userroles.controller.ts] |
| Privilege escalation via empty permission baseline | Elevation of Privilege | MW-03 baseline grants only canSearch + canReport (read-only access). Sensitive routes (manageusers, configuration) are NOT in the baseline. This matches current behavior where all authenticated users can search/report. |
| Self-only curator accessing other users' pages | Elevation of Privilege | MW-04 preserves the existing role-based redirect logic that checks roleLabel for Curator_Self. Permission set alone cannot distinguish Curator_Self from Curator_Scoped (both have canCurate). |

## Sources

### Primary (HIGH confidence)
- `src/pages/api/auth/[...nextauth].jsx` -- Complete current auth flow: JWT callback, session callback, both auth providers [VERIFIED: codebase, 331 lines]
- `src/middleware.ts` -- Complete current middleware: jwt-decode, role-label checks, all redirect logic [VERIFIED: codebase, 138 lines]
- `controllers/db/userroles.controller.ts` -- Current findUserPermissions: SQL query, WHERE clause, return format [VERIFIED: codebase, 66 lines]
- `src/utils/permissionUtils.ts` -- Phase 14 helpers: hasPermission, getPermissionsFromRaw, getLandingPageFromPermissions [VERIFIED: codebase, 105 lines]
- `src/db/models/init-models.ts` -- Association wiring for Phase 14 models, confirms AdminRolePermission/AdminPermission/AdminPermissionResource are registered [VERIFIED: codebase, 343 lines]
- `src/db/migrations/add-permission-tables.sql` -- Seed data: 7 permissions, 18 role-permission mappings, 7 nav resources [VERIFIED: codebase, 151 lines]
- `src/components/elements/Navbar/SideNavbar.tsx` -- Client-side session consumption: `JSON.parse(session.data.userRoles)` for role-based filtering [VERIFIED: codebase, line 290]
- `.planning/REQUIREMENTS.md` -- AUTH-01 through MW-05 requirement definitions [VERIFIED: codebase]
- `__tests__/permissionUtils.test.ts` -- Existing tests for Phase 14 utilities [VERIFIED: codebase, 143 lines]

### Secondary (MEDIUM confidence)
- next-auth v3 JWT callback behavior: `apiResponse` param is only non-null on initial sign-in; subsequent calls only get `token` [VERIFIED: code guard on line 269 of [...nextauth].jsx confirms `if(apiResponse)` pattern]

### Tertiary (LOW confidence)
- JWT cookie size limits (~4KB) [ASSUMED -- standard browser cookie limit]
- Sequelize v6 auto-expanding arrays in IN clause replacements [ASSUMED -- standard Sequelize behavior]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, versions verified from node_modules
- Architecture: HIGH -- both current auth flow and target flow are fully mapped from codebase analysis; Phase 14 provides the exact utilities needed
- Pitfalls: HIGH -- six specific pitfalls identified from codebase analysis, including the critical self-only detection issue and double-serialization trap

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable domain; next-auth v3 is pinned, no changes expected)
