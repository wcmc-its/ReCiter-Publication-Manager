# Phase 1: Auth Fix and Bug Remediation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the /noaccess redirect blocker (users with valid roles getting redirected), refactor middleware from role-count logic to capability-based permission checks, unify SAML/local session structures, and fix known UI bugs. Also: standardize loading states with skeleton preloading across all pages. Requirements: AUTH-01, AUTH-02, AUTH-03, AUTH-04, UIBUG-01, UIBUG-02, UIBUG-03.

</domain>

<decisions>
## Implementation Decisions

### Capability model (AUTH-01, AUTH-02)
- Route-level capabilities: canCurate, canReport, canManageUsers, canConfigure, canSearch
- canCurate uses scope metadata: `{self: true, personIdentifier: X}` for Curator_Self, `{all: true}` for Curator_All — prepares for Phase 3 scoped roles
- Role-to-capability mapping lives in `src/utils/constants.js` alongside existing `allowedPermissions`
- Isomorphic `getCapabilities(roles)` utility exportable for Edge middleware, Node API routes, and React components — single source of truth
- Unify ALL permission checks: middleware, index.js redirect, SideNavbar, and Search.js all use the same capability helper
- Superuser explicitly grants ALL capabilities in the mapping (no bypass shortcut)
- Capabilities derived on every request from roles in JWT (not stored in JWT) — capability model changes take effect without re-login
- Curator_Self + Reporter_All combo: curate scope stays self-only; Reporter_All adds canReport but doesn't expand curation scope
- Landing page priority unchanged: self-scope curators → /curate/:id, broader curators/reporters → /search
- Unknown/future roles: no capabilities granted beyond baseline

### Baseline access (AUTH-01, AUTH-03)
- Any authenticated user (SAML or local) gets `canReport + canSearch` as baseline — even without explicit roles
- SAML users without an admin_users row get auto-created: admin_users record with status=1, no explicit roles (baseline only)
- **CRITICAL: Preserve existing email-first, CWID-fallback account matching logic exactly as-is. Do NOT refactor the matching. Auto-create only triggers when existing matching finds NO admin_users row.**
- Auto-create populates from data already available in the SAML flow
- Attempt person table match by email/CWID to fill personIdentifier (so user can see their own publications)
- Local auth gets same baseline behavior (AUTH-03 consistency)

### Session unification (AUTH-03)
- Single shared JWT callback function used by both SAML and local providers
- Session always has: {userId, personIdentifier, email, userRoles[]}
- Capabilities derived from userRoles at check time, not stored in JWT

### Auth logging (AUTH-04)
- Server-side console.log only (pod stdout → CloudWatch if EKS forwarding configured)
- `[AUTH]` prefix on all auth log messages for easy grep/search
- Log events: SAML/local login attempt, account match result, role lookup, capability derivation, route decision
- Include email + CWID in log output for easy identification
- Auto-create events logged at WARN level with extra detail: `[AUTH] WARN AUTO-CREATE: New user {cwid} ({email}) → admin_users created, personIdentifier={id}, baseline access granted`
- Always log (no verbosity toggle) — low-volume login events only
- Login-time only; middleware only logs when it REDIRECTS (not every page access)

### Search page actions (UIBUG-01)
- Remove "Curate publications" action from the dropdown for ALL users (including curators and Superuser) — UIBUG-01 is a blanket rule
- No curate action on search for anyone, including Curator_Self
- Keep the dropdown with View Profile + View Report as remaining options
- Preserve the bulk CWID input + "Create Reports" workflow (main search input doubles as bulk entry)
- Curators: clicking person name navigates to /curate/:id
- Non-curators: clicking person name goes to Create Reports with that person selected (existing behavior, preserve as-is)
- Curate page is curators-only, period — non-curators who directly navigate get an error

### View Profile (UIBUG-02)
- Fix root cause of "unable to load profile" error AND improve error messaging (replace generic "Something went wrong" with specific message)
- View Profile modal available to all users from search page
- Non-curators see stripped-down profile: hide emails and relationships (PII); keep name, title, department, publication metrics, keywords, article scores
- Curators see full profile with all data

### Loading states (UIBUG-03)
- Verify no legacy red circle GIF loader exists (codebase scout found none — Loader.tsx already uses React Bootstrap Spinner)
- Standardize spinner usage AND add skeleton preloading to ALL pages with loading states
- Preserve existing skeleton preloading pattern on Create Reports page
- CSS-based skeleton implementation (no library dependency) — matches existing pattern
- Generic reusable skeleton components: SkeletonTable, SkeletonCard, SkeletonProfile, SkeletonForm
- Pages getting skeleton: Curate, Search, Manage Users, and all other pages with loading states

### Claude's Discretion
- Exact capability constant names and mapping structure
- Skeleton animation style (pulse vs shimmer)
- Profile modal error message wording
- Which specific profile fields are PII (beyond emails and relationships)
- Auth log message format details
- Whether to add size prop to skeleton components (small/large variants)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authentication and middleware
- `src/middleware.ts` — Edge middleware with role-count logic that needs refactoring to capability-based checks
- `src/pages/api/auth/[...nextauth].jsx` — NextAuth config with SAML and local providers; JWT/session callbacks need unification
- `src/pages/index.js` — Landing page redirect logic (uses userPermissions.some() — better pattern to follow)
- `src/utils/constants.js` — Role definitions (allowedPermissions); new capability mapping goes here

### Search page and UI bugs
- `src/components/elements/Search/Search.js` — Complex role-based dropdown logic (lines 95-196, 411-452); "Curate publications" removal target
- `src/components/elements/Profile/Profile.tsx` — Profile modal component; UIBUG-02 fix target (lines 95-121 fetch + error handling)
- `src/pages/api/reciter/getidentity/[uid].ts` — API endpoint for profile data
- `src/components/elements/CurateIndividual/CurateIndividual.tsx` — Opens Profile modal with uid prop (line 171)

### Loading states
- `src/components/elements/Common/Loader.tsx` — Current React Bootstrap Spinner (already correct, no legacy GIF)
- `src/components/elements/Report/` — Create Reports page with existing skeleton preloading pattern (reference for new skeletons)
- `src/components/elements/Navbar/SideNavbar.tsx` — Uses role-based filtering (lines 151-235); needs capability model update

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-04, UIBUG-01 through UIBUG-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Loader.tsx`: React Bootstrap Spinner — already correct, standardize usage across app
- `src/utils/constants.js`: Role definitions — extend with capability mapping
- `index.js` redirect logic: Uses `userPermissions.some()` pattern — good model for capability checks
- Create Reports skeleton preloading: CSS-based pattern to replicate across other pages

### Established Patterns
- Redux + thunk async pattern: FETCHING → SUCCESS/ERROR dispatch cycle
- Bootstrap/MUI hybrid styling throughout
- Edge middleware uses `jose` for JWT validation
- next-auth v3 with JWT strategy (not database sessions)
- Account matching: email-first, CWID-fallback — battle-tested, do not refactor

### Integration Points
- Middleware.ts matcher routes: `/manageusers/*`, `/curate/*`, `/report`, `/search`, `/configuration`, `/notifications/*`
- NextAuth callbacks: JWT callback populates token, session callback exposes to client
- SideNavbar role filtering: needs same capability model as middleware
- Search.js RoleSplitDropdown: needs capability-based simplification

</code_context>

<specifics>
## Specific Ideas

- "We went to great lengths to get account matching mostly working dealing with the account match problem. We first look for email and then we fall back to CWID." — Preserve this logic exactly.
- Bulk CWID input for Create Reports is a critical workflow on the search page — must not be broken by any search page changes.
- Create Reports has an existing skeleton preloading pattern — use it as the reference implementation for other pages.
- Auth logs should be structured enough for CloudWatch search (likely already have EKS → CloudWatch forwarding but not 100% certain).

</specifics>

<deferred>
## Deferred Ideas

- Configurable profile field visibility per role via admin settings — future enhancement
- CloudWatch log forwarding infrastructure setup (if not already configured) — infrastructure task
- Adding skeleton preloading as a Phase 2 UI/UX audit recommendation was superseded by the decision to add it in Phase 1

</deferred>

---

*Phase: 01-auth-fix-and-bug-remediation*
*Context gathered: 2026-03-16*
