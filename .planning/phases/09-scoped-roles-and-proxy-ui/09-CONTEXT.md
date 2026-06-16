# Phase 9: Scoped Roles and Proxy UI - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Superusers can assign scoped curation roles and proxy relationships via the admin UI (Manage Users → AddUser form), and scoped curators see their scope reflected in the search page sidebar and curation enforcement. The curate page gains a GrantProxyModal for in-context proxy assignment. This phase ports 6 new UI components and modifies 4 existing components/pages, plus creates/rewrites 6 API endpoints to operate on the JSON columns established in Phase 7.

This phase does NOT add server-side scope enforcement on userfeedback/goldstandard API endpoints — that's Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Proxy API Design (JSON-only)
- **D-01:** All proxy API endpoints operate on `admin_users.proxy_person_ids` JSON column — NO junction table (`AdminUsersProxy` is NOT ported from v1.0)
- **D-02:** Reverse lookups (find users who proxy for person X) use `JSON_CONTAINS(proxy_person_ids, '"personIdentifier"')` on `admin_users`
- **D-03:** Data volumes are small (tens of admin users) — JSON queries are adequate, no index optimization needed
- **D-04:** Six API endpoints under `/api/db/admin/proxy/`:
  - `GET ?userID=N` — read proxy_person_ids from admin_users, enrich with person names
  - `GET ?personIdentifier=X` — JSON_CONTAINS reverse lookup, return matching admin users
  - `POST /` — update admin_users.proxy_person_ids for a given userID (used by AddUser form)
  - `POST /grant` — add/remove personIdentifier in proxy_person_ids for selected userIDs (used by GrantProxyModal)
  - `GET /search-persons?q=` — search person table for proxy targets (unchanged from v1.0)
  - `GET /search-users?q=` — search admin_users with curation roles (simplified, no junction join)

### GrantProxyModal — Included
- **D-05:** GrantProxyModal ships in Phase 9 — the proxy feature requires both entry points (admin user management + curate page) to be complete
- **D-06:** Modal operates per-person: "which users can curate person X?" — uses the reverse lookup (D-02) and grant endpoint (D-04)
- **D-07:** Accessible from curate page to Superuser and Curator_All users viewing any person's publications

### Person Type / Department Options Source
- **D-08:** Department options come from existing `admin_departments` table (endpoint already exists: `GET /api/db/admin/departments`)
- **D-09:** Person type options come from a new endpoint: `GET /api/db/admin/person-types` returning `SELECT DISTINCT personType FROM person_person_type`
- **D-10:** Options are NOT hard-coded — they vary per institution and are derived from the database

### Search Page Scope Filtering — Server-side
- **D-11:** When ScopeFilterCheckbox is checked, pass `scopePersonTypes` and `scopeOrgUnits` as additional parameters to `/api/db/person` search API
- **D-12:** Server adds WHERE clauses filtering by person type and org unit — pagination reflects filtered result set accurately
- **D-13:** Proxy person IDs (small array) sent as additional OR condition — persons in proxy list always appear even when scope filter is active
- **D-14:** When checkbox is unchecked, no scope filtering — all results appear with ProxyBadge decoration on proxied persons
- **D-15:** `isPersonInScope()` and `isProxyFor()` from scopeResolver may still be used client-side for badge/decoration logic

### UsersTable Scope Display
- **D-16:** Scoped roles displayed inline in the existing role column: "Curator_Scoped (Faculty, Surgery)" format
- **D-17:** Proxy count shown as badge or text: "3 proxies" / "1 proxy" / "—"
- **D-18:** Non-scoped roles displayed as-is: "Curator_All", "Superuser", etc.

### Proxy Entry Points — Both Included
- **D-19:** ManageUsers → AddUser form → ProxyAssignmentsSection: admin assigns user→persons (uses POST /proxy)
- **D-20:** Curate page → GrantProxyModal: admin/curator assigns person→users (uses POST /proxy/grant)
- **D-21:** Same underlying data (admin_users.proxy_person_ids), different access angles — API layer handles both directions

### Claude's Discretion
- React 18 adaptations for ported components (useSession destructuring pattern, etc.)
- CSS module naming and styling approach for new components
- Exact MUI Autocomplete configuration for person/user search
- Debounce timing for search inputs
- Error handling and loading states in new components
- Whether to split Phase 9 into multiple plans or deliver as one

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 & 8 Context (foundation + auth decisions)
- `.planning/phases/07-foundation/07-CONTEXT.md` — JSON column schema decision, scopeResolver placement, constants.js merge
- `.planning/phases/08-auth-pipeline/08-CONTEXT.md` — session.data.scopeData and session.data.proxyPersonIds shape, findUserPermissions composite format, middleware capability routing

### Architecture Research
- `.planning/research/ARCHITECTURE.md` — Branch diff analysis, auth flow differences, component port patterns, React 16→18 adaptation notes

### v1.0 Source Code (port reference on origin/dev_v2)
- `src/components/elements/AddUser/CurationScopeSection.tsx` — 99 lines, scope assignment form with MUI Autocomplete
- `src/components/elements/AddUser/CurationScopeSection.module.css` — 26 lines
- `src/components/elements/AddUser/ProxyAssignmentsSection.tsx` — 107 lines, proxy person search with debounce
- `src/components/elements/AddUser/ProxyAssignmentsSection.module.css` — 12 lines
- `src/components/elements/Navbar/ScopeLabel.tsx` — 67 lines, sidebar scope badge
- `src/components/elements/Search/ProxyBadge.tsx` — 20 lines, cyan proxy indicator
- `src/components/elements/Search/ScopeFilterCheckbox.tsx` — 24 lines, scope filter toggle
- `src/components/elements/CurateIndividual/GrantProxyModal.tsx` — 225 lines, per-person proxy assignment modal
- `src/pages/api/db/admin/proxy/index.ts` — proxy CRUD (junction table pattern — needs rewrite for JSON)
- `src/pages/api/db/admin/proxy/grant.ts` — per-person proxy grant (needs rewrite for JSON)
- `src/pages/api/db/admin/proxy/search-persons.ts` — person search (reusable as-is)
- `src/pages/api/db/admin/proxy/search-users.ts` — user search with role filter (simplify for JSON)

### Existing code on feature branch (to modify)
- `src/components/elements/AddUser/AddUser.tsx` — exists but missing scope/proxy sections
- `src/components/elements/Search/Search.js` — needs ScopeFilterCheckbox, ProxyBadge, server-side filter params
- `src/components/elements/Navbar/SideNavbar.tsx` — needs ScopeLabel integration
- `src/components/elements/CurateIndividual/CurateIndividual.tsx` — needs GrantProxyModal integration
- `src/components/elements/Manage/UsersTable.tsx` — needs scope display and proxy count column
- `src/pages/api/db/person.ts` — needs optional scope filter parameters (D-11)
- `controllers/db/manage-users/user.controller.ts` — listAllUsers needs to include proxy_person_ids for count display

### V1.1 Port Proposal
- `V1.1-PORT-PROPOSAL.md` §Phase 9 — Requirements PORT-08 through PORT-15

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/scopeResolver.ts` — `isPersonInScope()` and `isProxyFor()` already on branch from Phase 7
- `src/utils/constants.js` — `getCapabilities()`, `ROLE_CAPABILITIES`, `Curator_Scoped` already on branch from Phase 7
- `src/db/models/AdminUser.ts` — already has `scope_person_types`, `scope_org_units`, `proxy_person_ids` JSON columns from Phase 7
- `@mui/material/Autocomplete` — already in project dependencies, used elsewhere on NextJS14 branch
- `react-bootstrap` — already in project, used for Badge, Form, Modal components

### Established Patterns
- NextJS14 uses `const { data: session, status } = useSession()` from `next-auth/react` — all ported components must use this pattern
- API routes check `req.headers.authorization !== reciterConfig.backendApiKey` for auth
- Sequelize queries use `raw: true` for simple selects, model instances for updates
- CSS Modules used throughout for component styling
- AddUser form uses controlled state with individual useState hooks per field

### Integration Points
- `session.data.scopeData` — Phase 8 exposes this; Phase 9 components consume it (ScopeLabel, ScopeFilterCheckbox, Search page filtering)
- `session.data.proxyPersonIds` — Phase 8 exposes this; Phase 9 components consume it (ProxyBadge, scope filter OR condition)
- `/api/db/person` — existing search endpoint; needs optional scope filter params added
- `/api/db/admin/users/addEditUser` — existing user save endpoint; needs to handle scope/proxy JSON fields on save
- `controllers/db/manage-users/user.controller.ts` — `listAllUsers` needs proxy count for UsersTable display

</code_context>

<specifics>
## Specific Ideas

- v1.0 proxy APIs used AdminUsersProxy junction table with transactions (destroy-then-bulkCreate pattern). For JSON columns, the equivalent is a single `UPDATE admin_users SET proxy_person_ids = ? WHERE userID = ?` — much simpler, no transactions needed for single-user updates
- GrantProxyModal's grant endpoint is more complex: it touches multiple admin_users rows (one per selected user). Each user's proxy_person_ids JSON array needs personIdentifier added or removed. Consider a loop of individual UPDATEs or a bulk approach
- The ScopeFilterCheckbox should only appear when the logged-in user actually has scope restrictions (Curator_Scoped) or proxy assignments — don't show it to Superuser/Curator_All since they can curate everyone
- Person type search endpoint returns institution-specific values from the `person_person_type` table — this is reference data, not configuration, so it should be fast and cacheable

</specifics>

<deferred>
## Deferred Ideas

- Server-side scope enforcement on userfeedback/goldstandard API endpoints — Phase 10
- Skeleton loading components for React 18 — Phase 11
- a11y audit fixes — Phase 11
- Admin settings for default scope on SAML auto-create — future enhancement
- GoldStandard audit source tag (`&source=publication-manager`) — Phase 10

</deferred>

---

*Phase: 09-scoped-roles-and-proxy-ui*
*Context gathered: 2026-03-27*
