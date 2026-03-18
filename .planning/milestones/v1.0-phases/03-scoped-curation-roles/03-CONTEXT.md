# Phase 3: Scoped Curation Roles - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Administrators can assign curators to specific person types and/or organizational units via a new Curator_Scoped role. Scoped curators can see all people (for reporting) but can only curate and manage profiles for people within their assigned scope. Includes database schema, scope resolver, JWT extension, search filtering, curation/profile enforcement, and admin UI for assigning scoped roles. Requirements: SCOPE-01, SCOPE-02, SCOPE-03, SCOPE-04, SCOPE-05, SCOPE-06.

Note: SCOPE-02 is refined from the original requirement. The original says "scoped curators only see people matching their assigned scope." The actual behavior is: scoped curators see ALL people on Find People (needed for reporting), but have a toggle to filter to their scope, and can only CURATE within scope.

</domain>

<decisions>
## Implementation Decisions

### Role model
- New `Curator_Scoped` role added to `admin_roles` table alongside existing Superuser, Curator_All, Curator_Self, Reporter_All
- Curator_All and Curator_Scoped are mutually exclusive (form prevents selecting both)
- Curator_Self CAN combine with Curator_Scoped or Curator_All (additive "can curate own publications" flag)
- Existing Curator_All + Curator_Self combinations in the database are left alone (Curator_All already grants full access so Curator_Self is redundant but harmless)
- Reporter_All combines freely with any curator role; reports are unrestricted by scope
- No admin page access for Curator_Scoped (Manage Users and Configuration stay Superuser-only)

### Scope restricts curation, not visibility
- Scoped curators see ALL people on Find People by default (needed for reporting and group views)
- Checkbox filter "Show only people I can curate" in the filter area narrows results to scope
- Checkbox only visible when the user's scope covers > 1 person and < everyone (meaningless for Curator_All/Curator_Self)
- In search results: in-scope people show a curate action/icon; out-of-scope people do not
- Clicking a person's name: in-scope -> /curate/:id; out-of-scope -> Create Reports with that person selected
- Curation access implies profile management access for the same people

### Navigation and landing
- Curator_Scoped lands on `/search` after login
- "Curate Publications" nav link takes Curator_Scoped to `/search` with the scope filter checkbox pre-checked
- Subtle scope label in side navbar under user's name (e.g., "Curating: Faculty, Surgery")
- Group Curation: scoped to their people when accessed, but "Curate Publications" nav routes to /search for now since Group Curation needs redesign

### Manage Profile page
- Port 5 files from master branch (commit 544c0f2) into dev_v2: controller, component, CSS module, API route, page
- ORCID management only (port as-is, no new profile fields)
- Scope-gated: curators can only manage profiles for people they can curate
- Same denial behavior as curation (redirect + toast)

### Scope assignment UX (Manage Users page)
- When Curator_Scoped is selected in role dropdown, a "Curation Scope" section appears inline below roles
- Existing Departments multi-select field IS the org unit scope (same concept, merged) — moves into the Curation Scope section when Curator_Scoped is active
- New Person Types multi-select added (values from distinct person_person_type table)
- Either or both optional, but at least one required (form validation: can't save Curator_Scoped with empty scope)
- Pre-populate scope fields when editing existing Curator_Scoped user
- Save directly — no confirmation preview (SCOPE-08 permissions preview is a v2 requirement)
- Manage Users table shows scope inline in the roles column: "Curator_Scoped (Faculty, Surgery)"
- New role filter dropdown on Manage Users page to find all scoped curators quickly

### Scope combination logic
- AND across dimensions, OR within: (Faculty OR Staff) AND (Surgery OR Medicine)
- Nullable dimension = no restriction on that axis: person types only -> all departments; departments only -> all person types
- A person matches if ANY of their person types (from person_person_type) matches the scope's person type list
- Scope data embedded in JWT at login; changes take effect on next login (consistent with existing auth model)

### Denied access behavior
- Page-level (direct URL to /curate/:id or /manage/:id for out-of-scope person): redirect to /search with toast "You don't have curation access for this person"
- API-level (e.g., save feedback for out-of-scope person): HTTP 403 Forbidden with body `{error: 'Person not in curation scope'}`
- Console log denials server-side with `[AUTH]` prefix (matching Phase 1 logging pattern)
- Full audit trail (SCOPE-09) deferred to v2

### Claude's Discretion
- Database schema choice (extend admin_users_roles with scope columns vs new junction table)
- JWT payload structure for scope data
- Exact scope resolver implementation (middleware vs API-level enforcement points)
- Toast message wording
- Curate icon choice for in-scope indicator in search results
- How to handle edge case where person has no person types in person_person_type

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` — SCOPE-01 through SCOPE-06 (note: SCOPE-02 refined per discussion above)
- `.planning/ROADMAP.md` — Phase 3 success criteria (5 items)

### Prior phase context
- `.planning/phases/01-search-result-filtering/01-CONTEXT.md` — Capability model design: getCapabilities(), canCurate: {all/self}, baseline access, session structure, auth logging with [AUTH] prefix
- `.planning/phases/02-ui-ux-audit/02-CONTEXT.md` — UI patterns (PATTERNS.md reference), react-bootstrap for forms, CSS Modules, Group Curation redesign notes

### Codebase patterns
- `.planning/codebase/CONVENTIONS.md` — Naming, code style, component structure
- `.planning/codebase/ARCHITECTURE.md` — Layer overview, data flow, RBAC abstraction
- `.planning/codebase/STRUCTURE.md` — Directory layout, where to add new code

### Key files to modify
- `src/utils/constants.js` — Role definitions, ROLE_CAPABILITIES map, getCapabilities() function (lines 70-148)
- `src/middleware.ts` — Edge middleware for route protection (add scope checks)
- `src/pages/api/auth/[...nextauth].jsx` — JWT callback (embed scope data in token)
- `controllers/db/userroles.controller.ts` — findUserPermissions() (add scope data to query)
- `controllers/db/person.controller.ts` — findAll() (add scope enforcement to search, lines 12-108)
- `controllers/db/manage-users/user.controller.ts` — createOrUpdateAdminUser() (persist scope assignments)
- `src/components/elements/AddUser/AddUser.tsx` — Add conditional scope fields (lines 244-292 role/dept area)
- `src/components/elements/Manage/ManageUsers.tsx` — Add role filter, show scope in table
- `src/components/elements/Search/Search.js` — Add scope checkbox filter, curate icon for in-scope people
- `src/components/elements/Navbar/SideNavbar.tsx` — Add scope label under user name

### Manage Profile page (port from master)
- Git commit `544c0f2` (master branch) — 5 files to cherry-pick:
  - `controllers/db/manage-profile/manageProfile.controller.ts`
  - `src/components/elements/ManageProfile/ManageProfile.module.css`
  - `src/components/elements/ManageProfile/ManageProfile.tsx`
  - `src/pages/api/db/admin/manageProfile/getORCIDProfileDataByID/index.ts`
  - `src/pages/manageprofile/[userId].tsx`

### Database models
- `src/db/models/AdminUser.ts` — User model (no scope fields yet)
- `src/db/models/AdminRole.ts` — Role definitions
- `src/db/models/AdminUsersRole.ts` — User-role junction (needs scope extension or new table)
- `src/db/models/AdminUsersDepartment.ts` — User-department junction (reused as org unit scope)
- `src/db/models/AdminDepartment.ts` — Department definitions
- `src/db/models/Person.ts` — Person model with `primaryOrganizationalUnit` field
- `src/db/models/PersonPersonType.ts` — Person-to-personType junction (scope matching source)

### v2 requirements (out of scope but informational)
- `.planning/REQUIREMENTS.md` — SCOPE-07 (auto-filtering), SCOPE-08 (permissions preview), SCOPE-09 (audit trail)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getCapabilities(roles)` in constants.js: Isomorphic capability resolver — extend with `canCurate: { scoped: true, personTypes: [], orgUnits: [] }`
- `admin_users_departments` junction table: Already stores department assignments — reuse as org unit scope (no new table needed for org units)
- Person search controller `findAll()`: Already supports filtering by personTypes and orgUnits — add scope enforcement layer
- `findAllOrgUnits()` in person.controller.ts: Returns distinct org unit values for dropdowns
- Autocomplete multi-select in AddUser form: Existing pattern for departments — replicate for person types
- Toast notifications: Existing pattern via `toast.error()` in Redux actions
- `[AUTH]` logging prefix: Established in Phase 1 for auth-related console logs

### Established Patterns
- Redux + thunk for async data: FETCHING -> SUCCESS/ERROR dispatch cycle
- react-bootstrap for forms (Autocomplete from MUI for multi-select)
- CSS Modules for component-specific styling
- Edge middleware uses `jose` for JWT validation — scope check needs to work here
- next-auth v3 JWT strategy: scope data goes in JWT callback
- API routes validate `Authorization` header then delegate to controllers
- Conditional form fields: No existing pattern, but react-bootstrap collapse/show would work

### Integration Points
- JWT callback in `[...nextauth].jsx`: Add scope data alongside userRoles
- Middleware matcher: `/curate/*` route already matched — add scope check within
- `/manageprofile/*` needs adding to middleware matcher
- Person search API (`/api/db/person`): Scope enforcement point
- Curation APIs (`/api/reciter/userfeedback/save/[uid]`, `/api/reciter/goldstandard`): Scope enforcement points
- SideNavbar: Scope label display (reads from session)
- Search component: Checkbox filter state (new Redux state or local state)

</code_context>

<specifics>
## Specific Ideas

- "Everyone should be listed — for reporting purposes especially for groups of users — but they should have the ability to toggle those users for which they have curate scoped role"
- "Anyone who can curate pubs for a user should also be able to manage a profile"
- Departments field IS the org unit scope — same concept, merged into Curation Scope section
- "Show only people I can curate" checkbox should only appear if scope covers > 1 person and < everyone
- In-scope people: click name -> curate. Out-of-scope people: click name -> Create Reports with that person selected
- "Group Curation does not work great at the moment so I would be inclined to have users start out at /search"

</specifics>

<deferred>
## Deferred Ideas

- Manage Profile page enhancements beyond ORCID (additional profile fields, research interests, etc.) — future phase
- Group Curation redesign with scope support — already planned in Phase 2 audit, will use scoped filtering when redesigned
- Permissions preview showing what a user can access before saving role changes — SCOPE-08 (v2)
- Auto-filtering of curation queue based on curator's scope — SCOPE-07 (v2)
- Audit trail for scoped role assignment changes — SCOPE-09 (v2)
- Session invalidation when scope changes — AUTH-05 (v2)

</deferred>

---

*Phase: 03-scoped-curation-roles*
*Context gathered: 2026-03-17*
