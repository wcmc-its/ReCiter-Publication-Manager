# Technology Stack: v1.1 Feature Port Migration

**Project:** RPM v1.1 -- Port v1.0 features to Next.js 14 / React 18 codebase
**Researched:** 2026-03-18
**Mode:** Migration adaptation (not greenfield selection)

## Branch Version Comparison

The port moves v1.0 code from `dev_v2` to a new branch based on `origin/dev_Upd_NextJS14SNode18`. Here are the exact version differences that affect porting.

| Technology | dev_v2 (source) | NextJS14 (target) | Breaking? |
|------------|----------------|-------------------|-----------|
| Next.js | 12.2.5 | 14.2.35 | Middleware API: minor (both use Pages Router) |
| React | 16.14.0 | 18.2.0 | YES: useSession return type, StrictMode double-mount |
| Node.js | 14.16.0 | 18.x | No (Sequelize, controllers unaffected) |
| next-auth | 3.29.10 | 4.24.13 | **YES: Major** -- imports, callbacks, session, middleware |
| Sequelize | 6.9.0 | 6.37.0 | No (backward compatible minor/patch) |
| Redux | 4.1.1 | 4.1.1 | No |
| react-bootstrap | 2.0.3 | 2.10.10 | No (same major) |
| Bootstrap | 5.1.3 | 5.1.3 | No |
| MUI | 5.0.6 | 5.16.0 | No (same major) |
| jose | 4.14.4 | **not installed** | Replaced by next-auth/jwt getToken |
| axios | installed | **not installed** | Uses fetch directly |
| TypeScript | 4.9.5 | 4.9.5 | No |

## Breaking Change #1: next-auth v3 to v4 (CRITICAL)

This is the most impactful change. Every file that imports from next-auth needs adaptation.

### 1.1 Import Path Changes

```typescript
// v3 (dev_v2) -- all files use this
import { useSession, getSession, signIn, signOut } from "next-auth/client"
import { Provider } from "next-auth/client"

// v4 (NextJS14 branch) -- must use this
import { useSession, getSession, signIn, signOut } from "next-auth/react"
import { SessionProvider } from "next-auth/react"
import { getToken } from "next-auth/jwt"        // for middleware
import { getServerSession } from "next-auth/next" // for getServerSideProps
```

**Files affected on dev_v2 (all need import change when porting):**
- `src/pages/_app.tsx` -- `Provider` to `SessionProvider`
- `src/pages/index.js` -- `getSession` import path
- `src/pages/curate/[id].js` -- `getSession`, `useSession`
- `src/pages/search/index.js` -- `getSession`
- `src/pages/report/index.js` -- `getSession`
- `src/pages/manageusers/index.tsx` -- `getSession`
- `src/pages/configuration/index.tsx` -- `getSession`
- `src/components/elements/CurateIndividual/CurateIndividual.tsx` -- `useSession`
- `src/components/elements/CurateIndividual/ReciterTabs.tsx` -- `useSession`
- `src/components/elements/CurateIndividual/ReciterTabContent.tsx` -- `useSession`
- `src/components/elements/Search/Search.js` -- `useSession`
- `src/components/elements/Search/FilterReview.tsx` -- `useSession`
- `src/components/elements/Profile/Profile.tsx` -- `useSession`
- `src/components/elements/Navbar/SideNavbar.tsx` -- `useSession`
- `src/components/elements/Navbar/NestedListItem.tsx` -- `useSession`
- `src/components/elements/Report/Report.tsx` -- `useSession`
- `src/components/elements/Header/Header.tsx` -- `signOut`, `useSession`
- `src/components/elements/Login/Login.js` -- `signIn`, `getSession`
- `src/components/layouts/AppLayout.jsx` -- `useSession`
- Plus 8+ additional files

**Confidence:** HIGH. Verified by examining actual imports on both branches.

### 1.2 useSession Return Type Change

This is the most pervasive breaking change. Every component using `useSession` must be adapted.

```typescript
// v3 (dev_v2) -- array destructuring
const [session, loading] = useSession();

// v4 (NextJS14 branch) -- object destructuring
const { data: session, status } = useSession();
const loading = status === "loading";
```

The NextJS14 branch already has this pattern applied to all existing components. When porting v1.0 components that use `useSession`, use the v4 pattern.

**Session data access is UNCHANGED.** Both branches access session data the same way:
```typescript
// Same on both branches:
session.data.userRoles      // JSON string of roles array
session.data.username        // personIdentifier
session.data.databaseUser    // admin_users record
session.data.proxyPersonIds  // JSON string of proxy person IDs (v1.0 addition)
```

The `session.data` nesting is a custom structure from the JWT/session callbacks. It is NOT the standard next-auth session shape -- it is RPM-specific and survives the migration because both branches store the same custom fields in the JWT token.

**Confidence:** HIGH. Verified by grep across both branches -- `session.data.userRoles` appears identically on both.

### 1.3 Callback Signature Changes (JWT and Session)

The [...nextauth] configuration has already been rewritten on the NextJS14 branch. The v1.0 port must adapt its JWT callback additions to the v4 signature.

```typescript
// v3 (dev_v2) -- positional arguments
callbacks: {
    async jwt(token, apiResponse) {
        if (apiResponse) {
            token.userRoles = apiResponse.userRoles;
            // v1.0 additions: parse { roles, scopeData, proxyPersonIds }
            const parsed = JSON.parse(apiResponse.userRoles);
            if (parsed.roles) {
                token.userRoles = JSON.stringify(parsed.roles);
                token.scopeData = JSON.stringify(parsed.scopeData);
                token.proxyPersonIds = JSON.stringify(parsed.proxyPersonIds);
            }
        }
        return token;
    },
    async session(session, token) {
        session.data = token;
        if (token.proxyPersonIds) {
            session.data.proxyPersonIds = token.proxyPersonIds;
        }
        session.adminSettings = await fetchUpdatedAdminSettings();
        return session;
    },
}

// v4 (NextJS14 branch) -- named parameter objects
callbacks: {
    async jwt({ token, user }) {
        if (user) {
            token.userRoles = user.userRoles || [];
            // PORT: Add scopeData + proxyPersonIds parsing here
        }
        return token;
    },
    async session({ session, token }) {
        session.data = token;
        session.user = token.user;
        // PORT: Add proxyPersonIds passthrough here
        return session;
    },
}
```

**Key adaptation:** In v3, the second argument to `jwt()` is `apiResponse` (the full return from `authorize()`). In v4, the second property is `user` (same data, but accessed as `{ token, user }` destructured). The v1.0 `userRoles` parsing logic must be placed inside `if (user)` block, using `user.userRoles` instead of `apiResponse.userRoles`.

**Confidence:** HIGH. Both callback implementations examined in full.

### 1.4 Session Strategy Configuration

```typescript
// v3 (dev_v2)
session: {
    jwt: true,
    maxAge: 7200,
}

// v4 (NextJS14 branch)
session: {
    strategy: 'jwt',
    // maxAge not set on NextJS14 branch -- default is 30 days
}
```

When porting, the `maxAge: 7200` (2 hours) from v1.0 should be carried forward if desired.

### 1.5 SessionProvider Changes

```typescript
// v3 (dev_v2) _app.tsx
import { Provider } from "next-auth/client"
<Provider session={pageProps.session}>

// v4 (NextJS14 branch) _app.tsx
import { SessionProvider } from "next-auth/react"
<SessionProvider session={session}>
```

The NextJS14 branch already wraps with `SessionProvider`. No action needed -- just ensure new v1.0 components do not import from `next-auth/client`.

### 1.6 SAML Flow Architecture Change

The SAML authentication flow is **architecturally different** between branches. This affects how the `findUserPermissions` enrichment (with scopeData and proxyPersonIds) must be wired.

**v3 (dev_v2):** SAML response is passed directly to the `authorize()` callback. The callback processes the SAML assertion inline using `saml2-js` `post_assert()`, resolves the user, and returns with roles.

**v4 (NextJS14 branch):** Uses a **cookie-bridge pattern**:
1. `/api/auth/saml-acs.js` -- receives SAML POST, validates via `saml2-js`, encrypts user data, sets `saml_bridge` cookie
2. `/auth/finalize.js` -- client-side page calls `signIn('saml')` which triggers the `authorize()` callback
3. `authorize()` reads the encrypted `saml_bridge` cookie, decrypts it, and returns the user
4. Uses `findOrcreateAdminUser()` from `src/utils/samlUtils.ts` (which calls `grantDefaultRolesToAdminUser()` and `findUserPermissions()`)

**Port implication:** The v1.0 enriched `findUserPermissions` (which returns `{ roles, scopeData, proxyPersonIds }`) must be integrated into the NextJS14 branch's `samlUtils.ts` flow, not the old inline SAML assertion flow. The `samlUtils.ts` on the NextJS14 branch already calls `findUserPermissions()` -- the v1.0 version's enhanced return structure just needs to replace the simple one.

**Confidence:** HIGH. Both SAML flows examined in full.

### 1.7 Middleware: jose vs getToken

```typescript
// v3 (dev_v2) middleware.ts -- manual JWT decode
import * as jose from "jose";
let decodedTokenJson = jose.decodeJwt(request.cookies.get('next-auth.session-token'));
// Parses userRoles, scopeData from decoded JWT
// Uses getCapabilities() for route-level checks

// v4 (NextJS14 branch) middleware.ts -- next-auth getToken
import { getToken } from "next-auth/jwt";
let decodedTokenJson = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
// Parses userRoles from token
// Uses role-count based checks (no capability model)
```

**Port implication:** The v1.0 capability-based middleware must be adapted to use `getToken` instead of `jose.decodeJwt`. The token shape is the same (both are JWT payloads with `userRoles`, `scopeData`, `proxyPersonIds`), so the `getCapabilities()` logic ports directly. The only change is how the token is obtained.

**Also note:** The NextJS14 branch checks for TWO cookie names (`next-auth.session-token` OR `__Secure-next-auth.session-token`), because next-auth v4 uses the `__Secure-` prefix in production. The `getToken()` helper handles this automatically, so the ported middleware does not need to check both manually.

```typescript
// Ported middleware pattern for NextJS14 branch:
import { getToken } from "next-auth/jwt";
import { getCapabilities, getLandingPage } from './utils/constants';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  const userRoles = typeof token.userRoles === 'string'
    ? JSON.parse(token.userRoles)
    : (token.userRoles || []);

  const caps = getCapabilities(userRoles);
  // ... rest of capability-based routing (unchanged from v1.0)
}
```

**Confidence:** HIGH. Both middleware implementations examined. `getToken` from next-auth/jwt is the standard v4 approach.

### 1.8 Secret Configuration

```typescript
// v3 (dev_v2) -- uses tokenSecret from config
tokenSecret: process.env.NEXT_PUBLIC_RECITER_TOKEN_SECRET

// v4 (NextJS14 branch) -- uses NEXTAUTH_SECRET env var
secret: process.env.NEXTAUTH_SECRET
```

The NextJS14 branch already uses `NEXTAUTH_SECRET`. The v1.0 code that references `reciterConfig.tokenSecret` (e.g., for JWT verification) should use `process.env.NEXTAUTH_SECRET` instead.

## Breaking Change #2: React 16 to 18

### 2.1 StrictMode Double-Mount in Development

React 18 with `reactStrictMode: true` (set in both branches' `next.config.js`) will mount, unmount, and remount every component in development. This affects:

- **useEffect cleanup:** Any v1.0 useEffect that does not return a cleanup function will not cause bugs, but effects that set up subscriptions or timers without cleanup will fire twice in dev.
- **Fetch-on-mount patterns:** Components like `CurateIndividual` that fetch data in useEffect will make duplicate requests in dev mode. This is cosmetic (production is unaffected) but can cause confusion during testing.

**Port implication:** Review v1.0 useEffect hooks in ported components. If any set up intervals, subscriptions, or one-time side effects, ensure proper cleanup is returned. This is a best practice anyway, not strictly a bug.

### 2.2 Automatic Batching

React 18 batches state updates inside Promises, setTimeout, and native event handlers (React 16 only batched inside React event handlers). This is almost always beneficial. The only risk is code that relies on a re-render between two sequential `setState` calls -- which is an anti-pattern anyway.

**Port implication:** No action needed. If anything, this improves performance.

### 2.3 Testing Library Compatibility

The dev_v2 branch uses:
- `jest@27.5.1`
- `@testing-library/react@12.1.5` (React 16 compatible)

Neither branch currently has test infrastructure configured (no jest.config, no test files in tree). The v1.0 Jest setup from dev_v2 will NOT work on NextJS14 because `@testing-library/react@12.x` does not support React 18.

For React 18 + Next.js 14, use:
- `jest@29.7.0`
- `@testing-library/react@16.0.0`
- `@testing-library/jest-dom@6.4.5`
- `jest-environment-jsdom@29.7.0`

**Confidence:** HIGH. Verified via npm compatibility matrix and Next.js docs.

## What Ports Unchanged (No Adaptation Needed)

These v1.0 artifacts port directly with zero or trivial changes:

| Component | Why It Ports Clean |
|-----------|-------------------|
| Sequelize models (AdminUsersPersonType, AdminUsersProxy) | Pure Sequelize -- no React, no next-auth. Same Sequelize version range. |
| `src/utils/scopeResolver.ts` | Pure TypeScript logic. No framework imports. |
| `src/utils/constants.js` (ROLE_CAPABILITIES, getCapabilities, getLandingPage) | Pure JavaScript objects and functions. No framework imports. |
| Database migration SQL | SQL is SQL. Same MySQL instance. |
| Controller functions (goldstandard, userfeedback) | Server-side fetch calls to ReCiter API. No React or next-auth dependencies. |
| `config/local.js` additions | Endpoint URLs. Note: NextJS14 branch uses `RECITER_API_BASE_URL` concatenation instead of individual env vars -- adapt accordingly. |
| `init-models.ts` registration of new models | Just adding `AdminUsersPersonType` and `AdminUsersProxy` to the init function. |

## What Needs Adaptation (Partial Rewrite)

### Middleware (src/middleware.ts)

**Source:** v1.0's capability-based middleware (150 lines, uses `jose.decodeJwt` + `getCapabilities`)
**Target adaptation:**
1. Replace `jose.decodeJwt` with `getToken` from `next-auth/jwt`
2. Add try-catch error handling pattern from NextJS14 branch (redirects to `/error` with error code)
3. Keep the `getCapabilities()` + `getLandingPage()` logic unchanged
4. Remove direct cookie name check (getToken handles `__Secure-` prefix)

### [...nextauth] configuration

**Source:** v1.0's enhanced JWT callback with `{ roles, scopeData, proxyPersonIds }` parsing
**Target adaptation:**
1. Use v4 callback signatures: `async jwt({ token, user })` and `async session({ session, token })`
2. The `authorize()` functions are completely different between branches (SAML cookie-bridge vs inline assertion). Port the enrichment logic, not the authorize function.
3. The NextJS14 branch loads adminSettings via Redux in `_app.tsx` (`AdminSettingsDataLoader` component) instead of in the session callback. Do NOT add `fetchUpdatedAdminSettings()` back to the session callback.

### Session callback difference

**v1.0 (dev_v2):** Loads `adminSettings` in the session callback (server-side, on every session refresh). This was a known performance concern.
**NextJS14 branch:** Loads `adminSettings` via Redux dispatch in `_app.tsx` `AdminSettingsDataLoader` component (client-side, once per mount). This is the better pattern -- keep it.

### Page-level components with useSession

Every v1.0 component using `useSession` needs the destructuring change:
```typescript
// v1.0 pattern
const [session, loading] = useSession();

// NextJS14 pattern (already used everywhere on target branch)
const { data: session, status } = useSession();
const loading = status === "loading";
```

### curate/[id].js scope and proxy checks

The v1.0 curate page adds client-side scope validation:
```typescript
// v1.0 -- uses useSession + useRouter for scope checking
const [session] = useSession();  // CHANGE to v4 pattern
const caps = getCapabilities(userRoles);
const proxyPersonIds = session?.data?.proxyPersonIds
    ? JSON.parse(session.data.proxyPersonIds) : [];
if (isProxyFor(proxyPersonIds, personId)) return;
```

The `getCapabilities` and `isProxyFor` logic is pure JS and ports unchanged. Only the `useSession` call and import need updating.

### API route auth checks

API routes on v1.0 use `reciterConfig.backendApiKey` for authorization header checks. The NextJS14 branch uses the same pattern. The v1.0 additions to API routes (scope enforcement via `scopeResolver`, proxy bypass via `isProxyFor`) port directly -- they are server-side Node.js code that does not touch next-auth or React.

## Config/Environment Differences

### API Endpoint Configuration

The NextJS14 branch consolidated API endpoints to use a single `RECITER_API_BASE_URL` env var with path concatenation, rather than individual endpoint env vars.

```javascript
// dev_v2 config/local.js
identityByUid: process.env.RECITER_IDENITY_BY_UID,
featureGeneratorEndpoint: process.env.RECITER_FEATURE_GENERATOR_ENDPOINT,

// NextJS14 config/local.js
identityByUid: process.env.RECITER_API_BASE_URL + '/reciter/find/identity/by/uid',
featureGeneratorEndpoint: process.env.RECITER_API_BASE_URL + '/reciter/feature-generator/by/uid',
```

**Port implication:** If v1.0 code references `reciterConfig.reciter.xxx`, the config keys are the same -- just the values come from different env vars. No code change needed in controllers; only ensure the K8s deployment has `RECITER_API_BASE_URL` set.

### Score Threshold Difference

```javascript
// dev_v2: totalStandardizedArticleScore: 3
// NextJS14: totalStandardizedArticleScore: 30
```

This is a business logic difference, not a migration issue. The NextJS14 branch was configured for a different scoring scale. Document but do not change during port.

### Analysis Refresh Flag

```javascript
// dev_v2: analysisRefreshFlag: "false"
// NextJS14: analysisRefreshFlag: "TRUE"
```

Same -- business logic difference. Keep NextJS14 branch's value.

### ASMS Integration

The NextJS14 branch adds ASMS (user tracking) configuration:
```javascript
asms: {
    asmsApiBaseUrl: process.env.ASMS_API_BASE_URL,
    userTrackingAPI: process.env.ASMS_API_BASE_URL + '/api/v2/track/module',
    userTrackingAPIAuthorization: process.env.ASMS_USER_TRACKING_API_AUTHORIZATON
}
```

The v1.0 code does not use ASMS. No conflict.

## Next.js 14 Specific Changes

### next.config.js

```javascript
// dev_v2
images: { domains: ['directory.weill.cornell.edu'] }

// NextJS14
images: {
    remotePatterns: [
        { protocol: 'https', hostname: 'directory.weill.cornell.edu', pathname: '/**' }
    ]
}
```

The `domains` config was deprecated in Next.js 14 in favor of `remotePatterns`. The NextJS14 branch already uses the new syntax. No action needed when porting -- just don't copy the old `domains` config.

### Middleware Matcher

Both branches use the same matcher pattern. The NextJS14 branch adds `/manageprofile/:path*` which was also added in v1.0. No conflict.

## Recommended New Dependencies for v1.1

### CASL (from v1.0 research) -- React Version Update

```bash
# v1.0 used @casl/react@4.0.0 (React 16 compatible)
# v1.1 should use @casl/react@5.x (React 18 compatible)
npm install @casl/ability@^6.8.0 @casl/react@^5.0.0
```

On v1.0, `@casl/react@4.0.0` was required because it supported React 16. On the NextJS14 branch with React 18, `@casl/react@5.x` is the correct choice (it requires React 17+).

**Confidence:** MEDIUM. The v1.0 research verified CASL compatibility with React 16. For React 18, v5 is the natural choice but should be verified at install time.

### Testing Infrastructure

```bash
npm install -D jest@29.7.0 @testing-library/react@16.0.0 @testing-library/jest-dom@6.4.5 jest-environment-jsdom@29.7.0 @types/jest ts-node
```

**Confidence:** HIGH. These versions are documented for Next.js 14 + React 18.

### Database Migrations

```bash
npm install -D sequelize-cli@^6.6.2
```

Same as v1.0 -- Sequelize version unchanged.

## Migration Checklist Summary

### Must Change (will not compile/run if skipped)

| Pattern | From (v3/React 16) | To (v4/React 18) | Files |
|---------|---------------------|-------------------|-------|
| Import path | `next-auth/client` | `next-auth/react` | ~30 files |
| useSession | `const [session, loading] = useSession()` | `const { data: session, status } = useSession()` | ~20 components |
| SessionProvider | `Provider` from `next-auth/client` | `SessionProvider` from `next-auth/react` | `_app.tsx` |
| JWT callback | `async jwt(token, user)` | `async jwt({ token, user })` | `[...nextauth]` |
| Session callback | `async session(session, token)` | `async session({ session, token })` | `[...nextauth]` |
| Session config | `jwt: true` | `strategy: 'jwt'` | `[...nextauth]` |
| Middleware JWT | `jose.decodeJwt(cookie)` | `getToken({ req, secret })` | `middleware.ts` |
| Secret | `reciterConfig.tokenSecret` | `process.env.NEXTAUTH_SECRET` | Any JWT verification |

### Should Change (works without but is wrong)

| Pattern | Issue | Fix |
|---------|-------|-----|
| useEffect without cleanup | Double-fires in React 18 StrictMode dev | Add cleanup functions |
| `@casl/react@4.0.0` | Works on React 18 but v5 is designed for it | Use `@casl/react@^5.0.0` |
| Jest 27 + @testing-library/react 12 | Incompatible with React 18 | Upgrade to Jest 29 + RTL 16 |

### Do Not Change (ports as-is)

| Component | Reason |
|-----------|--------|
| Sequelize models | No framework coupling |
| scopeResolver.ts | Pure TypeScript |
| getCapabilities() / getLandingPage() | Pure JavaScript |
| API controllers | Server-side fetch, no next-auth |
| Redux actions/reducers | Framework-agnostic |
| config/local.js structure | Same keys, different env var sourcing |
| SQL migration scripts | Database-level |

## Sources

- [NextAuth.js v3 to v4 Upgrade Guide](https://next-auth.js.org/getting-started/upgrade-v4)
- [React 18 Upgrade Guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)
- [Next.js Middleware Upgrade Guide](https://nextjs.org/docs/messages/middleware-upgrade-guide)
- [Next.js Testing with Jest](https://nextjs.org/docs/pages/guides/testing/jest)
- [Migrating from React 16 to React 18 Challenges](https://paulserban.eu/blog/post/migrating-from-react-16-to-react-18-challenges-and-solutions/)
- Codebase examination: `origin/dev_v2` and `origin/dev_Upd_NextJS14SNode18` branches compared directly via `git show` and `git grep`
