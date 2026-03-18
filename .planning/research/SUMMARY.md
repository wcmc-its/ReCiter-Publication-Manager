# Research Summary: v1.1 Feature Port to Next.js 14

**Domain:** Stack migration -- porting validated features across framework versions
**Researched:** 2026-03-18
**Overall confidence:** HIGH

## Executive Summary

The v1.1 milestone ports three v1.0 feature systems (capability-based auth, scoped curation roles, curation proxy) from a Next.js 12 / React 16 / next-auth v3 codebase (dev_v2) to a Next.js 14 / React 18 / next-auth v4 codebase (dev_Upd_NextJS14SNode18). Both branches use Pages Router -- there is no App Router migration.

The most impactful breaking change is next-auth v3 to v4. This affects approximately 30 files (import paths), 20 components (useSession return type), and the entire authentication configuration ([...nextauth].jsx callback signatures, SAML flow architecture, middleware JWT access). The good news is that the NextJS14 branch has already applied these v4 patterns to all existing code -- the port only needs to ensure new/modified files follow the same conventions.

The second concern is React 18 compatibility. The primary issue is `useSession` destructuring (already addressed by next-auth v4 migration), StrictMode double-mount in development (cosmetic), and testing library versions (Jest 27 + RTL 12 from v1.0 are incompatible with React 18 -- upgrade to Jest 29 + RTL 16).

Critically, approximately 60% of v1.0 code ports with zero changes: Sequelize models, pure TypeScript utilities (scopeResolver, getCapabilities), SQL migrations, API controllers, and Redux state management. These have no coupling to the framework versions that changed.

## Key Findings

**Stack:** next-auth v3-to-v4 is the only breaking change that requires systematic code adaptation. React 18 and Next.js 14 changes are minor for Pages Router apps. See STACK.md for before/after patterns on every breaking change.

**Architecture:** The SAML authentication flow is architecturally different (cookie-bridge pattern on v4 vs inline assertion on v3). The auth enrichment logic (scopeData, proxyPersonIds) must be wired into the NextJS14 branch's `samlUtils.ts` flow, not the old inline flow.

**Critical pitfall:** Copying v1.0's [...nextauth].jsx callbacks verbatim into the NextJS14 branch will fail silently because callback signatures changed from positional to named parameters. The SAML authorize function is completely rewritten and must not be replaced.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation: Models, utilities, and database** -- Port Sequelize models (AdminUsersPersonType, AdminUsersProxy), scopeResolver.ts, constants.js additions (ROLE_CAPABILITIES, getCapabilities, getLandingPage), and SQL migrations. These have zero framework coupling and form the data layer everything else depends on.
   - Addresses: All scope/proxy data access
   - Avoids: Accidentally mixing v3/v4 patterns in framework-coupled code

2. **Auth enrichment: JWT and session** -- Adapt findUserPermissions (enriched return with scopeData + proxyPersonIds) for the NextJS14 branch's samlUtils.ts flow. Wire the parsed fields into the v4 JWT and session callbacks.
   - Addresses: Capability model, proxy session data
   - Avoids: Auth callback signature mismatch (v3 positional vs v4 named)

3. **Middleware: Capability-based routing** -- Replace the NextJS14 branch's role-count middleware with v1.0's capability-based middleware, adapted to use `getToken` instead of `jose.decodeJwt`.
   - Addresses: Correct route-level access control for all role types including Curator_Scoped
   - Avoids: jose dependency (not installed on NextJS14 branch)

4. **API scope enforcement** -- Port the userfeedback and goldstandard controller modifications (isProxyFor bypass, scope checking). These are server-side Node.js and port nearly unchanged.
   - Addresses: API-level scope and proxy enforcement
   - Avoids: None -- these are framework-agnostic

5. **UI components** -- Port admin UI for scoped roles (CurationScopeSection), proxy UI (ProxyBadge, ScopeFilterCheckbox, GrantProxyModal), and skeleton loading. Each component needs useSession destructuring update and import path change.
   - Addresses: User-facing functionality
   - Avoids: StrictMode double-mount issues (add cleanup functions)

6. **Testing** -- Set up Jest 29 + RTL 16 infrastructure for React 18.
   - Addresses: Regression safety for ported features
   - Avoids: RTL 12 / Jest 27 incompatibility with React 18

**Phase ordering rationale:**
- Models and utilities first because they have zero dependencies and everything else imports from them
- Auth enrichment before middleware because middleware needs the enriched JWT to work
- Middleware before API enforcement because API enforcement is the inner layer that middleware defers to
- UI last because it depends on all backend layers being in place
- Testing last because you need working features to test

**Research flags for phases:**
- Phase 2 (Auth enrichment): Needs careful testing -- the SAML cookie-bridge flow is different enough from v1.0's inline assertion flow that manual SAML testing is essential
- Phase 5 (UI components): The NextJS14 branch has a completely different visual design (Header, SideNavbar, layout). v1.0 UI components may need style adaptation beyond framework changes. Investigate before coding.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Both branches examined file-by-file. All version differences documented with before/after code patterns. |
| Features | HIGH | v1.0 features are fully defined and shipped. The question is only how to adapt them for v4, not what they are. |
| Architecture | HIGH | SAML flow difference is the only architectural surprise. Both middleware, callback, and session patterns documented in full. |
| Pitfalls | HIGH | next-auth v3/v4 migration is well-documented. React 18 migration for existing apps is mature territory. |

## Gaps to Address

- **Visual design differences:** The NextJS14 branch has a completely redesigned UI with MUI ThemeProvider, DM Sans font, custom color palette. v1.0 components were designed for the old UI. Style integration needs phase-specific investigation.
- **AdminOrcid model:** Exists on NextJS14 branch but not dev_v2 -- this is new functionality on the target branch. v1.0 code should not interfere with it.
- **AdminSettings loading pattern:** Moved from session callback (v1.0) to Redux dispatch in _app.tsx (NextJS14). Components reading adminSettings from session need to read from Redux instead.
- **Config endpoint sourcing:** NextJS14 branch uses `RECITER_API_BASE_URL` + path concatenation instead of individual endpoint env vars. Controllers referencing reciterConfig endpoints work fine since the config keys are the same, but K8s deployment must have the new env var.
- **Score threshold difference:** `totalStandardizedArticleScore` is 3 on dev_v2 vs 30 on NextJS14. This is a business logic choice, not a migration issue. Document and preserve the target branch value.
