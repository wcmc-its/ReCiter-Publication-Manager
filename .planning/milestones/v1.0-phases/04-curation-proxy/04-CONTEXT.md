# Phase 4: Curation Proxy - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Many-to-many proxy assignments allowing Curator_Scoped users to curate publications on behalf of specific individuals beyond their normal scope. Includes database schema for proxy relationships, JWT extension, proxy-aware search filtering, [PROXY] badge on search results, proxy curation navigation, proxy assignment UI on Manage Users and curation pages, and feedback logging via existing admin_feedbacklog. Requirements: PROXY-01, PROXY-02, PROXY-03, PROXY-04, PROXY-05, PROXY-06.

</domain>

<decisions>
## Implementation Decisions

### Proxy assignment UX (Manage Users)
- New "Proxy Assignments" section in AddUser/EditUser form, below Curation Scope section
- Section only visible when user has a curation role (Curator_All, Curator_Scoped, or Curator_Self) — but in practice, proxy is only meaningful for Curator_Scoped
- Autocomplete multi-select to search and pick people from the full person table (~4000 people), not just admin_users
- Display format: "Smith, John (jhs2001) - Medicine"
- Removing a proxy chip and saving — no confirmation dialog needed (consistent with roles/departments pattern)
- UsersTable shows proxy count column: "3 people" / "1 person" / "—"

### Proxy assignment UX (Curation page)
- "Grant Proxy Access" button near the person's profile card on the curation page
- Clicking opens a modal to search/select which users to add as proxies for this person
- Modal searches admin_users with curation roles (the proxy assignees, not targets)
- Visible to any curator who can curate that person: Curator_All sees it for everyone, Curator_Scoped sees it for in-scope + proxied people, Curator_Self sees it for themselves

### Search badge and filter
- [PROXY] badge: teal/cyan colored pill badge next to person's name in search results
- Existing "Show only people I can curate" checkbox EXPANDED to include proxy assignments — no separate proxy checkbox
- One filter concept: "people I can curate" = scope matches + proxy assignments (OR logic)
- [PROXY] badge distinguishes which results are proxy-based vs scope-based
- Same curate icon (EditOutlined) for both proxied and in-scope people — badge is the differentiator
- Clicking a proxied person goes straight to /curate/:id (no confirmation step)

### Sidebar scope label
- Extend existing scope label to include proxy count: "Curating: Faculty, Surgery + 3 proxied people"

### Proxy curation flow
- Subtle [PROXY] badge next to person's name on the curation page (consistent with search badge)
- No full banner or confirmation — just the badge as a reminder
- Proxy access grants both curation AND profile management access (consistent with Phase 3 pattern)
- Access check: canCuratePerson(user, personId) = isPersonInScope(user, person) OR isProxyFor(user, personId)
- Direct URL navigation to /curate/:id works for proxied people — proxy overrides scope check
- Same denied access behavior for non-proxy/non-scope: redirect to /search + toast

### Feedback logging
- Existing admin_feedbacklog schema is sufficient — no new columns needed
- userID records the proxy user, personIdentifier records whose publications are being curated
- History modal naturally shows proxy user's name (existing AdminUser join)

### Proxy eligibility
- Proxy assignments are for Curator_Scoped users only — Curator_All can already curate everyone (redundant)
- Proxy targets: any person in the person table (not limited to admin_users)
- Overlap allowed without warning: a proxied person can also be within the curator's scope (redundant but harmless)
- No hard limit on proxy count per user — typically 5-20, manageable even at 50+

### Data model
- Proxy personIdentifier list embedded in JWT alongside scope data (proxyPersonIds array)
- Changes take effect on next login (consistent with scope model)
- No JWT size concern for typical proxy counts

### Claude's Discretion
- Database table design (new admin_users_proxy junction table vs extending existing tables)
- Exact autocomplete search implementation (debounce, minimum characters, result limit)
- Grant Proxy modal component structure and state management
- Toast message wording for proxy-related actions
- Error handling for edge cases (deleted person, removed proxy mid-session)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` — PROXY-01 through PROXY-06
- `.planning/ROADMAP.md` — Phase 4 success criteria (5 items)

### Prior phase context (critical)
- `.planning/phases/01-search-result-filtering/01-CONTEXT.md` — Capability model: getCapabilities(), canCurate patterns, [AUTH] logging, session structure
- `.planning/phases/03-scoped-curation-roles/03-CONTEXT.md` — Scope system: Curator_Scoped role, scopeResolver, JWT scope data, CurationScopeSection pattern, search checkbox filter, denied access pattern (redirect + toast), Manage Profile scope enforcement

### Codebase patterns
- `.planning/codebase/CONVENTIONS.md` — Naming, code style, component structure
- `.planning/codebase/ARCHITECTURE.md` — Layer overview, data flow, RBAC abstraction
- `.planning/codebase/STRUCTURE.md` — Directory layout, where to add new code

### Key files to modify
- `src/utils/constants.js` — getCapabilities() (extend canCurate with proxy check)
- `src/middleware.ts` — Edge middleware (proxy-aware access checks)
- `src/pages/api/auth/[...nextauth].jsx` — JWT callback (embed proxyPersonIds)
- `controllers/db/userroles.controller.ts` — findUserPermissions() (query proxy table)
- `controllers/db/person.controller.ts` — findAll() (include proxy matches in "can curate" filter)
- `controllers/db/manage-users/user.controller.ts` — createOrUpdateAdminUser() (persist proxy assignments)
- `src/components/elements/AddUser/AddUser.tsx` — Proxy Assignments section (reuse CurationScopeSection pattern)
- `src/components/elements/Manage/ManageUsers.tsx` — Proxy count column in UsersTable
- `src/components/elements/Manage/UsersTable.tsx` — Render proxy count
- `src/components/elements/Search/Search.js` — [PROXY] badge, expand scope filter to include proxies
- `src/components/elements/Navbar/SideNavbar.tsx` — Extend scope label with proxy count
- `src/components/elements/CuratePublications/CuratePublications.tsx` — Grant Proxy button + modal, [PROXY] badge on curation page

### Database models
- `src/db/models/AdminFeedbackLog.ts` — Feedback logging (no changes needed, existing schema sufficient)
- `src/db/models/AdminUser.ts` — User model (add proxy association)
- `src/db/models/Person.ts` — Person model (proxy target)
- `src/db/models/init-models.ts` — Register new proxy model and associations

### Feedbacklog controller
- `controllers/db/admin.feedbacklog.controller.ts` — createFeedbackLog() already records userID + personIdentifier (no changes needed)
- `src/pages/api/db/admin/feedbacklog/create/index.ts` — Feedbacklog create API route

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CurationScopeSection` component in AddUser: Conditional form section pattern — reuse for Proxy Assignments section
- `getCapabilities(roles)` in constants.js: Extend with proxy-aware canCurate check
- `scopeResolver.ts`: Pure function for scope matching — proxy check is additive (OR with isProxyFor)
- Autocomplete multi-select (MUI): Already used for departments and person types — reuse for proxy person search
- `admin_feedbacklog` + `AdminFeedbackLog` model: Already records userID + personIdentifier, no schema changes needed
- Toast notifications: Existing `toast.success()`/`toast.error()` pattern for proxy actions
- `[AUTH]` logging prefix: Established in Phase 1, reuse for proxy access denials

### Established Patterns
- CurationScopeSection: Conditional form section that appears based on selected role — same pattern for proxy section
- JWT-embedded data: scopeData in JWT — add proxyPersonIds alongside
- Search checkbox filter: "Show only people I can curate" — expand to include proxy matches
- Access check pattern: isPersonInScope(user, person) — add OR isProxyFor(user, personId)
- Denied access: redirect to /search + toast — same for proxy access denied
- UsersTable role display: Scope shown inline — add proxy count column
- SideNavbar scope label: "Curating: Faculty, Surgery" — extend with "+ N proxied people"

### Integration Points
- JWT callback in `[...nextauth].jsx`: Add proxyPersonIds to token
- Middleware: Proxy check alongside scope check for /curate/* and /manageprofile/* routes
- Person search API (`/api/db/person`): Include proxy matches when "can curate" filter active
- Curation page access check: OR proxy check with scope check
- Manage Profile access check: Same OR logic as curation
- New API endpoint needed: proxy CRUD (create/read/update/delete proxy assignments)
- New API endpoint needed: search admin_users for Grant Proxy modal

</code_context>

<specifics>
## Specific Ideas

- "Proxies typically don't have their own profiles" — proxy users are administrative staff (Curator_Scoped), not researchers in the person table
- Proxy is an additive layer on top of Curator_Scoped: scope defines broad group access, proxy adds specific individuals
- One filter concept: "people I can curate" = scope OR proxy (no separate proxy checkbox — the distinction felt unnecessary)
- [PROXY] badge is the visual differentiator, not separate filters or icons

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-curation-proxy*
*Context gathered: 2026-03-17*
