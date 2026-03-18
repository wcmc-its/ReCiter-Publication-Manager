# Domain Pitfalls

**Domain:** Porting v1.0 features (Next.js 12 / React 16 / next-auth v3) to Next.js 14 / React 18 / next-auth v4
**Researched:** 2026-03-18
**Overall confidence:** HIGH -- based on direct code analysis of both branches plus official migration docs

---

## Critical Pitfalls

Mistakes that cause broken auth flows, data loss, or require significant rework.

### Pitfall 1: next-auth v3 vs v4 Callback Signature Mismatch

**What goes wrong:** The v1.0 JWT callback uses positional parameters `jwt(token, apiResponse)` and the session callback uses `session(session, token, apiResponse)`. The NextJS14 branch already uses v4's named parameter style `jwt({ token, user })` and `session({ session, token })`. Copying v1.0 callback logic without adapting the parameter destructuring will silently fail -- parameters will be `undefined` and scope/proxy data will never reach the JWT.

**Why it happens:** The v1.0 code packs `scopeData` and `proxyPersonIds` into the JWT via the v3-style positional `apiResponse` parameter. In v4, this data arrives as `user` inside `{ token, user }`, but **only on initial sign-in** -- subsequent calls only get `{ token }`.

**Consequences:**
- Scope data and proxy person IDs silently missing from JWT
- Middleware allows access it shouldn't (scope check data absent = no enforcement)
- Users appear to have no scope restrictions, creating a security gap
- Debugging is hard because v4 does not error on missing callback params -- it just passes `undefined`

**Prevention:**
1. Map v1.0 callback logic to v4 signatures explicitly. The v1.0 `jwt(token, apiResponse)` maps to v4 `jwt({ token, user })` where `apiResponse` = `user`
2. The v1.0 parsing block that extracts `parsed.roles`, `parsed.scopeData`, and `parsed.proxyPersonIds` must be placed inside the `if (user)` guard in the v4 callback
3. Test the JWT contents directly after login -- decode the cookie and verify all expected fields exist
4. The v1.0 pattern `token.userRoles = apiResponse.userRoles` becomes `token.userRoles = user.userRoles` inside `if (user) { ... }`

**Detection:** After login, decode the JWT cookie and check for `scopeData` and `proxyPersonIds` fields. If missing, the callback migration is wrong.

**Phase relevance:** Auth pipeline port (first phase). Must be correct before any scope/proxy features are ported.

**Confidence:** HIGH -- verified by comparing `src/pages/api/auth/[...nextauth].jsx` on both branches directly

---

### Pitfall 2: Session Data Structure Divergence Between Branches

**What goes wrong:** The v1.0 session callback loads `adminSettings` synchronously via `await fetchUpdatedAdminSettings()` and attaches it to `session.adminSettings`. The NextJS14 branch does NOT do this in the session callback -- instead it uses a Redux-based `AdminSettingsDataLoader` component in `_app.tsx` that dispatches `fetchAdminSettingsAction()` on mount. Porting v1.0 code that reads `session.adminSettings` will find undefined values.

**Why it happens:** The NextJS14 branch moved admin settings loading from the server-side session callback to a client-side Redux effect. This was likely done because:
- Loading settings on every session callback is expensive (the v1.0 CLAUDE.md lists "Admin settings loaded on every login -- no caching" as a known issue)
- The NextJS14 branch stores settings in Redux instead

**Consequences:**
- Any ported component that reads `session.adminSettings` will break
- The v1.0 scoped roles admin UI uses admin settings to determine default role assignments during auto-create
- The `grantDefaultRolesToAdminUser` function in samlUtils reads `findOneAdminSettings('userRoles')` to determine default roles -- this works but the session-level path differs

**Prevention:**
1. Do NOT port the `session.adminSettings = await fetchUpdatedAdminSettings()` pattern from v1.0
2. Any v1.0 component reading `session.adminSettings` must be adapted to read from Redux store using `useSelector`
3. The server-side `findOneAdminSettings()` calls in samlUtils are fine -- they read the DB directly, not the session
4. Audit every file ported for `session.adminSettings` references and replace with Redux selector

**Detection:** Search ported code for `session.adminSettings` or `session?.adminSettings`. Any match is a bug.

**Phase relevance:** Every phase. Admin settings consumption pattern differs and must be adapted file by file.

**Confidence:** HIGH -- direct code comparison of `_app.tsx` and `[...nextauth].jsx` on both branches

---

### Pitfall 3: SAML Flow Architecture is Completely Different

**What goes wrong:** The v1.0 SAML flow passes the raw SAML response through the CredentialsProvider authorize function, parsing it with `saml2-js` inline. The NextJS14 branch uses a completely different architecture: SAML ACS handler (`saml-acs.js`) validates the response, encrypts user data into a `saml_bridge` cookie, redirects to `/auth/finalize`, which triggers `signIn('saml')`, and the authorize function reads the encrypted cookie. Porting v1.0 auth changes without understanding this flow will break SAML completely.

**Why it happens:** The NextJS14 branch had to work around next-auth v4's CSRF protections and changed credential flow. The bridge cookie pattern was adopted after 30+ commits of SAML debugging (visible in git history: `9fa3273`, `5b24796`, `4aa619e` -- all reverts of failed approaches).

**Consequences:**
- Copy-pasting v1.0 SAML auth logic into the NextJS14 `[...nextauth].jsx` will break the cookie bridge
- The v1.0 auto-create logic (`findOrCreateSamlUser` with `status: 1`) must be adapted to work within the NextJS14 `samlUtils.findOrcreateAdminUser` function
- The NextJS14 branch uses `saml2-js` v4.0.4 (not v3.0.1 as in v1.0), with different config shape (`samlOptions` vs `saml_options`, `idpOptions` vs `saml_idp_options`)
- The NextJS14 SAML config sets `allow_unencrypted_assertion: true` while v1.0 sets it to `false` -- different security posture

**Prevention:**
1. **Do NOT touch** the SAML flow files (`saml-acs.js`, `saml-login.js`, `finalize.js`, `crypto.js`, `validate.js`). These are battle-tested after 30+ debugging commits
2. Port v1.0 auth enhancements (scope data, proxy data, capability model) into the **existing** NextJS14 `samlUtils.js` and `[...nextauth].jsx` files
3. The v1.0 `findOrCreateSamlUser` with `status: 1` logic should be merged into the existing `findOrcreateAdminUser` in samlUtils -- do not create a parallel function
4. Test SAML flow end-to-end on reciter-dev after any auth changes -- local testing uses direct_login and will not catch SAML regressions

**Detection:** SAML login fails on reciter-dev after deployment. Locally, you cannot detect this since local dev uses `direct_login` provider.

**Phase relevance:** Auth pipeline port (first phase). SAML must remain working throughout.

**Confidence:** HIGH -- git history shows 30+ SAML debugging commits, config files compared directly

---

### Pitfall 4: Middleware JWT Decoding Method Differs

**What goes wrong:** The v1.0 middleware uses `jose.decodeJwt()` (unsigned decode from the `jose` library) to read the session token. The NextJS14 branch uses `getToken()` from `next-auth/jwt` which performs proper verification. The v1.0 capability model import (`getCapabilities`, `getLandingPage`) must be ported into the NextJS14 middleware, but the JWT access pattern must use the NextJS14 `getToken()` approach, not the v1.0 `jose.decodeJwt()` approach.

**Why it happens:** next-auth v4 provides `getToken()` which properly verifies the JWT against `NEXTAUTH_SECRET`. The v1.0 `jose.decodeJwt()` is an unsigned decode that doesn't verify the token -- a weaker security posture.

**Consequences:**
- Using `jose.decodeJwt()` in the NextJS14 middleware would reintroduce a security weakness (unsigned JWT decode)
- The `getToken()` function is `async` and returns a different object shape than `jose.decodeJwt()` -- the data access paths differ
- The v1.0 middleware reads `decodedTokenJson.userRoles` directly; with `getToken()`, the path may be `token.userRoles`

**Prevention:**
1. Keep the NextJS14 `getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })` call
2. Port the `getCapabilities()` and `getLandingPage()` functions to `constants.js` (pure functions, no framework dependency)
3. Adapt the capability-based route checks to work with `getToken()` output instead of `jose.decodeJwt()` output
4. The middleware must also handle the `__Secure-next-auth.session-token` cookie name (HTTPS prefix) which the NextJS14 branch already does but v1.0 does not

**Detection:** Middleware redirect loops or 500 errors after porting. Also: token fields accessible via `jose.decodeJwt()` may be nested differently than via `getToken()`.

**Phase relevance:** Auth pipeline / middleware port (first phase).

**Confidence:** HIGH -- both `src/middleware.ts` files inspected directly

---

### Pitfall 5: SWC Minifier Mangles New Sequelize Model Names

**What goes wrong:** Next.js 14 uses SWC minification by default (`swcMinify: true` in next.config.js). In production builds, SWC shortens class names to single characters. Sequelize models rely on their class names for table mapping. Without an explicit `modelName` property, a model class `AdminUsersPersonType` becomes `a` or `b` in production, causing "table 'a' doesn't exist" errors.

**Why it happens:** The NextJS14 branch already discovered this the hard way -- commit `8d4150e` ("Added modelName to the DB Models to prevent swcminifier to shortend the modelName to single character") added `modelName` to all 31 existing models. The v1.0 models (`AdminUsersPersonType`, `AdminUsersProxy`) were created on a branch without SWC minification and do NOT have `modelName` set.

**Consequences:**
- Models work in development (`next dev` doesn't minify) but fail in production builds
- Error is cryptic: Sequelize says "Table 'a' doesn't exist" with no indication it's a minification issue
- This only surfaces on deployment to EKS, not during local development
- Both new models (AdminUsersPersonType, AdminUsersProxy) will be affected

**Prevention:**
1. When porting `AdminUsersPersonType.ts` and `AdminUsersProxy.ts`, add `modelName: 'AdminUsersPersonType'` and `modelName: 'AdminUsersProxy'` to the model options
2. Add this to the port checklist: every Sequelize model must have explicit `modelName`
3. Test with `npm run build` locally before deploying -- SWC minification runs during build

**Detection:** `npm run build` + test the production build locally. Or check model files for missing `modelName` property.

**Phase relevance:** Data model port (scope and proxy models).

**Confidence:** HIGH -- confirmed by commit `8d4150e` in the repository

---

### Pitfall 6: findUserPermissions Return Format Incompatibility

**What goes wrong:** The v1.0 `findUserPermissions` returns `JSON.stringify({ roles, scopeData, proxyPersonIds })` -- a structured object. The NextJS14 `findUserPermissions` returns `JSON.stringify(userRolesList)` -- a flat array. The NextJS14 auth pipeline (`[...nextauth].jsx` and `samlUtils.js`) expects the flat array format. The v1.0 middleware and capability model expect the structured object format. If you port the v1.0 `findUserPermissions` without updating all consumers, or port the capability model without updating `findUserPermissions`, the system breaks.

**Why it happens:** The v1.0 enhanced `findUserPermissions` was designed to carry scope and proxy data alongside roles. The NextJS14 pipeline was never updated for this because it doesn't have scope/proxy features.

**Consequences:**
- If v1.0 `findUserPermissions` is ported without updating the NextJS14 JWT callback: the callback tries to parse `{ roles, scopeData, proxyPersonIds }` as if it were a flat role array. `JSON.parse()` succeeds but downstream code expects `[{roleLabel: ...}]` and gets `{ roles: [...] }`
- Every page's `getServerSideProps` that does `JSON.parse(session.data.userRoles)` will break if `userRoles` format changes
- The middleware parses `userRoles` differently on each branch

**Prevention:**
1. Port `findUserPermissions` and the JWT callback as an atomic unit -- both must be updated together
2. The v1.0 JWT callback has explicit `parsed.roles` / `parsed.scopeData` / `parsed.proxyPersonIds` destructuring that must be adapted to v4 callback signature
3. After porting, verify that `session.data.userRoles` still contains only the roles array (as a JSON string), with `scopeData` and `proxyPersonIds` as separate top-level JWT fields
4. Audit every `getServerSideProps` that parses `session.data.userRoles` -- they all assume flat array format

**Detection:** Login crashes with JSON parse error, or middleware redirect loops.

**Phase relevance:** Auth pipeline port (first phase). Must be coordinated.

**Confidence:** HIGH -- both `controllers/db/userroles.controller.ts` implementations inspected directly

---

## Moderate Pitfalls

### Pitfall 7: useSession Hook API Differences

**What goes wrong:** v1.0 components use `import { useSession } from "next-auth/client"` which returns `[session, loading]`. NextJS14 components use `import { useSession } from "next-auth/react"` which returns `{ data: session, status }`. Any ported component using the array destructuring pattern will silently get wrong values.

**Prevention:**
1. Search all ported files for `useSession` usage
2. Replace array destructuring `const [session, loading] = useSession()` with `const { data: session, status } = useSession()`
3. Replace `loading` boolean checks with `status === "loading"` checks
4. The NextJS14 branch already uses the correct v4 pattern -- ensure ported components match

**Phase relevance:** Every phase that ports UI components.

**Confidence:** HIGH -- documented in next-auth v4 upgrade guide

---

### Pitfall 8: getSession vs getServerSession in Server-Side Props

**What goes wrong:** v1.0 uses `import { getSession } from "next-auth/client"` with `getSession(ctx)` in `getServerSideProps`. NextJS14 uses `import { getServerSession } from "next-auth/next"` with `getServerSession(ctx.req, ctx.res, authOptions)` -- note the different import path, function name, AND parameter structure. The NextJS14 pattern also requires importing `authOptions` from the auth route file.

**Prevention:**
1. All ported pages must use `getServerSession(ctx.req, ctx.res, authOptions)` pattern
2. Import `authOptions` from `../api/auth/[...nextauth]` (or appropriate relative path)
3. Do not mix `getSession` (client-side in v4) with `getServerSession` (server-side in v4) -- they have different purposes in v4
4. `getServerSession` is faster than `getSession` on the server because it avoids an extra HTTP round-trip

**Phase relevance:** Every phase that ports pages with `getServerSideProps`.

**Confidence:** HIGH -- both branches' search page `getServerSideProps` compared directly

---

### Pitfall 9: v1.0 Capability Model Assumes Curator_Scoped Role Exists

**What goes wrong:** The v1.0 `getCapabilities()` function and `ROLE_CAPABILITIES` map include `Curator_Scoped` as a role. The NextJS14 `admin_roles` table may not have this role. The `constants.js` on the NextJS14 branch does not include `Curator_Scoped` in `allowedPermissions`. Porting the capability model without ensuring the role exists in the database will cause scoped curators to get zero capabilities (unknown roles grant nothing beyond baseline).

**Prevention:**
1. Add `Curator_Scoped: "Curator_Scoped"` to `allowedPermissions` in `constants.js` on the NextJS14 branch
2. Ensure the `admin_roles` table has a row for Curator_Scoped (roleID 5, or whatever ID is next)
3. Include a database migration step in the port plan
4. The capability model's "unknown role = baseline only" fallback is safe but means scope features silently don't work if the role is missing

**Detection:** Users assigned Curator_Scoped role get baseline access (canReport + canSearch) but cannot curate. No error -- just silent permission downgrade.

**Phase relevance:** Scope roles port (after auth pipeline).

**Confidence:** HIGH -- `constants.js` on both branches compared directly

---

### Pitfall 10: React 18 Strict Mode Double-Render Breaks Side Effects

**What goes wrong:** The NextJS14 branch has `reactStrictMode: true` in `next.config.js`. React 18 strict mode intentionally double-invokes effects and renders in development to surface bugs. The v1.0 components were written for React 16 which does not have this behavior. Components with side effects in render (e.g., setting state during render, one-time API calls without proper deps) will fire twice.

**Prevention:**
1. Ensure all useEffect hooks have correct dependency arrays
2. API calls should use AbortController or similar cleanup to prevent double-fetch
3. The `GrantProxyModal` and `CurationScopeSection` components from v1.0 may have mount effects that fire twice
4. If double-render causes visible issues in dev, investigate the component rather than disabling StrictMode

**Detection:** API calls firing twice in development, duplicate state updates, console warnings about unmounted component updates.

**Phase relevance:** Every phase that ports React components.

**Confidence:** HIGH -- React 18 strict mode is well-documented behavior; NextJS14 next.config.js confirms `reactStrictMode: true`

---

### Pitfall 11: Jest Test Library Version Incompatibility

**What goes wrong:** The v1.0 test infrastructure used Jest 27.5.1 and @testing-library/react 12.1.5, compatible with React 16. The NextJS14 branch has neither Jest nor testing libraries installed. Porting the v1.0 test setup will fail because:
- @testing-library/react 12.x does NOT support React 18 (requires v13+ or v14+)
- Jest 27 needs updates for Next.js 14 compatibility (next/jest config)
- The v1.0 used `--legacy-peer-deps` to resolve conflicts, which masks incompatibilities

**Prevention:**
1. Install fresh for React 18: `@testing-library/react@^14`, `@testing-library/jest-dom@^6`, `jest@^29`, `jest-environment-jsdom@^29`
2. Use Next.js 14's built-in Jest support: `const nextJest = require('next/jest')` for config
3. Do NOT copy the v1.0 `jest.config.js` -- create a new one using the Next.js 14 pattern
4. The v1.0 test files (test logic, assertions) can be ported -- only the setup needs to be rebuilt
5. Pure utility tests (scopeResolver, isProxyFor) have no React dependency and can be ported as-is after Jest config is set up

**Detection:** `npm test` fails immediately with peer dependency or module resolution errors.

**Phase relevance:** Testing infrastructure phase. Should be set up early so each feature port includes tests.

**Confidence:** HIGH -- @testing-library/react version matrix is well-documented; NextJS14 package.json confirms no test deps

---

### Pitfall 12: Admin Settings viewAttributes JSON Parsing Inconsistency

**What goes wrong:** The NextJS14 `_app.tsx` has a commit (`11aae8e`) that says "Fix runtime crashes: guard session.adminSettings and parse viewAttributes from Redux." This indicates the NextJS14 branch had issues with `viewAttributes` being a raw JSON string vs parsed object. The v1.0 components assume `viewAttributes` is always a JSON string that needs `JSON.parse()`. If the NextJS14 Redux store already parses it, ported components will double-parse and crash.

**Prevention:**
1. Before porting any component that uses admin settings, check how the NextJS14 Redux store provides `viewAttributes` -- is it a string or already-parsed object?
2. Add defensive parsing: `typeof viewAttributes === 'string' ? JSON.parse(viewAttributes) : viewAttributes`
3. Test with actual admin settings data from the database

**Detection:** JSON parse errors on pages that display admin-configurable fields (CurationScopeSection, ManageUsers).

**Phase relevance:** Any phase porting admin-settings-dependent UI.

**Confidence:** MEDIUM -- inferred from commit messages, needs verification with running code

---

### Pitfall 13: Direct Login Authorize Function Signature Differs

**What goes wrong:** The v1.0 `direct_login` authorize function takes `credentials` and calls `findOrCreateAdminUsers(credentials.username)` with one arg. The NextJS14 version calls `findOrCreateAdminUsers(credentials.username, credentials.email, credentials.firstName, credentials.lastName)` with four args. The v1.0 also does NOT populate `credentials.email`, `credentials.firstName`, `credentials.lastName` -- it only has `credentials.username` and `credentials.password`. Porting v1.0 scope/proxy enhancements into the direct_login path must account for this parameter mismatch.

**Prevention:**
1. The NextJS14 `findOrCreateAdminUsers` controller accepts 4 params -- when porting scope changes to the direct_login path, pass the params the NextJS14 function expects
2. For the `direct_login` case, email/firstName/lastName may be null -- the function handles this
3. The v1.0 scope data comes from `findUserPermissions` which is called after user creation -- this pattern works the same regardless of how many params `findOrCreateAdminUsers` takes

**Detection:** Direct login works but scope data is missing from JWT. Or: TypeScript type errors during development.

**Phase relevance:** Auth pipeline port.

**Confidence:** HIGH -- both authorize functions compared directly

---

## Minor Pitfalls

### Pitfall 14: Cookie Name Prefix in Production (HTTPS)

**What goes wrong:** When the app runs over HTTPS (as it does on EKS), next-auth v4 uses `__Secure-next-auth.session-token` as the cookie name instead of `next-auth.session-token`. The NextJS14 middleware already handles both (`request.cookies.has('next-auth.session-token') || request.cookies.has('__Secure-next-auth.session-token')`), but any ported code that reads cookies directly must handle both names.

**Prevention:** Use `getToken()` from next-auth/jwt wherever possible instead of reading cookies directly. It handles both cookie names automatically.

**Phase relevance:** Auth pipeline port.

**Confidence:** HIGH -- visible in NextJS14 middleware source

---

### Pitfall 15: Environment Variable Name Changes

**What goes wrong:** The v1.0 uses `LOGIN_PROVIDER` while the NextJS14 branch uses `NEXT_PUBLIC_LOGIN_PROVIDER`. The v1.0 uses `ASSERT_ENDPOINT` while NextJS14 uses `ACS_URL`. The v1.0 `loginHelper.ts` constructs different SAML URLs on each branch (`/api/saml/assert` vs `/api/auth/saml-login`). Any ported code using environment variables must use the NextJS14 names.

**Prevention:**
1. Compare v1.0 loginHelper.ts with NextJS14 loginHelper.ts before porting
2. Audit all ported code for env var references
3. Note: `NEXT_PUBLIC_` prefix means the var is exposed to client-side code in Next.js -- be careful about what gets this prefix

**Detection:** Features fail silently when env var is undefined (no SAML redirect, wrong login URL).

**Phase relevance:** Auth pipeline and any feature using environment-specific config.

**Confidence:** HIGH -- both loginHelper.ts files compared

---

### Pitfall 16: init-models.ts Has Different Content on Each Branch

**What goes wrong:** The NextJS14 branch has `AdminOrcid.ts` model that doesn't exist on v1.0. The v1.0 has `AdminUsersPersonType.ts` and `AdminUsersProxy.ts` that don't exist on NextJS14. Both branches' `init-models.ts` registers their respective models. Copying v1.0's `init-models.ts` would lose AdminOrcid; copying NextJS14's would lose the scope/proxy models.

**Prevention:** Always manually merge `init-models.ts` changes. Add new model imports alongside existing ones. Never overwrite the file from either branch.

**Phase relevance:** Data model port.

**Confidence:** HIGH -- model files listed on both branches

---

### Pitfall 17: saml2-js v3 vs v4 Configuration Key Names

**What goes wrong:** The v1.0 uses `saml2-js` v3.0.1 with config keys `saml_options` and `saml_idp_options`. The NextJS14 branch uses `saml2-js` v4.0.4 with config keys `samlOptions` and `idpOptions` (camelCase). Any code referencing the old config key names will silently get `undefined`.

**Prevention:** Do not port any code that references `reciterSamlConfig.saml_options` or `reciterSamlConfig.saml_idp_options`. Always use the NextJS14 config key names. This is only relevant if SAML validation code is touched (it should not be -- see Pitfall 3).

**Phase relevance:** Only relevant if SAML validation code is touched.

**Confidence:** HIGH -- both `config/saml.ts` files compared

---

### Pitfall 18: Redux Store Shape Differences

**What goes wrong:** The v1.0 added Redux actions/reducers for scope and proxy features that the NextJS14 branch doesn't have. Porting UI components that dispatch or select these actions will fail silently (dispatching to non-existent reducers, selecting undefined state).

**Prevention:**
1. Port Redux changes (actions, reducers, methods) before porting UI components that depend on them
2. Add new action types to the NextJS14 `methods.js`
3. Add new reducers to the NextJS14 `reducers.js`
4. Verify the store shape with Redux DevTools after porting

**Detection:** Components render with empty/undefined data. No crash but no data.

**Phase relevance:** Every phase that ports stateful UI components.

**Confidence:** MEDIUM -- Redux files not fully compared, but architectural pattern is clear

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Auth pipeline (capability model + JWT) | Pitfalls 1, 3, 4, 6 -- callback signatures, SAML flow, middleware decoding, return format | Port findUserPermissions + JWT callback + middleware as atomic unit. Do NOT touch SAML flow files. Test SAML on EKS. |
| Scoped roles (data model + UI) | Pitfalls 5, 9, 12 -- SWC modelName, missing role in DB, viewAttributes parsing | Add modelName to models, insert Curator_Scoped in admin_roles, verify admin settings consumption. |
| Proxy system (data model + UI) | Pitfalls 5, 10, 18 -- SWC modelName, StrictMode double-render, Redux shape | Add modelName, test useEffect cleanup, port Redux actions before components. |
| Jest test infrastructure | Pitfall 11 -- version incompatibility | Build fresh test setup for React 18 / Next.js 14. Do NOT copy v1.0 jest.config. |
| API scope enforcement | Pitfalls 6, 8 -- findUserPermissions format, getServerSession usage | Ensure API routes parse the structured `{ roles, scopeData, proxyPersonIds }` format. Use getServerSession not getSession. |
| Skeleton loading / UI components | Pitfalls 7, 10 -- useSession API, StrictMode double-render | Verify useSession destructuring. Test loading states under React 18 strict mode. |

---

## SAML-Specific Warnings (Historical Analysis)

The NextJS14 branch's SAML integration was the single most problematic feature to stabilize. Evidence from git history:

| Commit Pattern | Count | Implication |
|---|---|---|
| "made changes for the SAML integration" | 11 | Iterative trial-and-error approach |
| "reverted back saml2-js version changes" | 3 | saml2-js v4 upgrade attempts failed repeatedly |
| "debugging SAML Issue in Dev" | 1+ | Issues only surfaced on the deployed EKS cluster |
| "Reverting the previous changes and adding log statements" | 1 | Debugging required extensive logging |
| "debugging search redirection with session null" | 12 | Post-SAML-login session was null -- redirect loop |

**Key lesson:** The SAML flow files on the NextJS14 branch (`saml-acs.js`, `saml-login.js`, `finalize.js`, `crypto.js`, `validate.js`) represent 30+ commits of hard-won stability. They should be treated as immutable during the port. All v1.0 auth enhancements must be injected into the existing NextJS14 auth pipeline (samlUtils.js and [...nextauth].jsx), not by replacing those files.

**The bridge cookie pattern** (`saml_bridge` encrypted cookie -> `/auth/finalize` -> `signIn('saml')` -> authorize reads cookie) is non-obvious but necessary. The v1.0's simpler approach (pass SAML body through CredentialsProvider) does not work with next-auth v4's CSRF protections.

---

## Integration Risk Matrix

| Integration Point | Risk | Reason |
|---|---|---|
| JWT callback (scope + proxy data) | HIGH | v3/v4 signature difference, structured vs flat format |
| Middleware (capability model) | HIGH | Different JWT decode method, new scope/proxy fields needed |
| SAML auto-create flow | HIGH | Completely different architecture between branches |
| findUserPermissions (return format) | HIGH | Flat array vs structured object, all consumers must be updated atomically |
| Sequelize models (new tables) | MEDIUM | SWC minification requires explicit modelName; init-models merge |
| Redux state (new features) | MEDIUM | Missing actions/reducers on target branch |
| UI components (ported) | LOW-MEDIUM | useSession hook API, admin settings access pattern |
| Pure utilities (scopeResolver) | LOW | Framework-independent, should port cleanly |
| Test infrastructure | LOW | Rebuild from scratch, don't port |

---

## Sources

- [NextAuth v3 to v4 Upgrade Guide](https://next-auth.js.org/getting-started/upgrade-v4) -- official migration doc
- [NextAuth v4 Callbacks Documentation](https://next-auth.js.org/configuration/callbacks) -- callback signature reference
- [getServerSession vs getSession discussion](https://github.com/nextauthjs/next-auth/discussions/8577) -- server-side session patterns
- [React 18 Upgrade Guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide) -- official React migration
- [React 16 to 18 Migration Challenges](https://paulserban.eu/blog/post/migrating-from-react-16-to-react-18-challenges-and-solutions/) -- community experience
- [Next.js Testing with Jest (Pages Router)](https://nextjs.org/docs/pages/guides/testing/jest) -- official Jest setup
- [Next.js Middleware Upgrade Guide](https://nextjs.org/docs/messages/middleware-upgrade-guide) -- middleware breaking changes
- [Edge Runtime Auth Limitations](https://medium.com/@shuhan.chan08/authentication-in-next-js-middleware-edge-runtime-limitations-solutions-7692a44f47ab) -- jose vs getToken
- Direct comparison of `origin/dev_v2` and `origin/dev_Upd_NextJS14SNode18` branch files (HIGH confidence -- primary source)
