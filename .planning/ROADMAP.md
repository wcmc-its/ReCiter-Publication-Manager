# Roadmap: RPM Bug Fixes, UI/UX Audit, and Scoped Curation Roles

## Overview

Four phases deliver a stable, audited, and scope-aware curation platform with proxy support. Phase 1 fixes the authentication blocker and known UI bugs so the application is reliably usable. Phase 2 conducts a systematic UI/UX audit to surface issues and establish patterns before new UI is built. Phase 3 delivers the scoped curation role system, giving administrators fine-grained control over who curates publications for which groups of people. Phase 4 adds curation proxy assignments, allowing designated users to curate publications on behalf of others.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Auth Fix and Bug Remediation** - Fix the /noaccess redirect blocker, refactor middleware to capability-based checks, unify SAML/local session structures, and fix known UI bugs (completed 2026-03-16)
- [ ] **Phase 2: UI/UX Audit** - Systematic visual and accessibility audit of all views, with critical fixes applied and architectural issues documented
- [ ] **Phase 3: Scoped Curation Roles** - Database schema, scope resolver, JWT extension, search filtering, curation enforcement, and admin UI for assigning scoped roles by person type and org unit
- [ ] **Phase 4: Curation Proxy** - Many-to-many proxy assignments, [PROXY] badge on search results, proxy filter checkbox, and proxy curation navigation

## Phase Details

### Phase 1: Auth Fix and Bug Remediation
**Goal**: Every user with valid roles can log in and navigate the application without encountering broken features
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, UIBUG-01, UIBUG-02, UIBUG-03
**Success Criteria** (what must be TRUE):
  1. User paa2013 (and any user with valid roles in admin_users/admin_users_roles) can log in and reach the correct landing page, regardless of how many roles they hold
  2. A user on the Find People (search) page does not see "Curate publications" as an available action
  3. Clicking "View Profile" on any person loads and displays the profile modal with biographical and bibliometric data
  4. All loading animations across the application use the React Bootstrap Spinner design; no legacy red circle GIF appears anywhere
  5. Auth flow decisions (role resolution, routing) are logged for troubleshooting
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Capability-based auth model (getCapabilities, SAML auto-create, middleware rewrite)
- [x] 01-02-PLAN.md -- UI bug fixes (dropdown, profile PII, skeleton loading)

### Phase 2: UI/UX Audit
**Goal**: All application views have been systematically evaluated, critical issues are fixed, and patterns are documented for new UI work
**Depends on**: Phase 1
**Requirements**: UIUX-01, UIUX-02, UIUX-03
**Success Criteria** (what must be TRUE):
  1. Every view in the application (Search, Curate, Report, Manage Users, Configuration, Notifications, Group Curation) has been evaluated with findings categorized by severity
  2. The Group Curation view has specific issues documented with actionable recommendations
  3. eslint-plugin-jsx-a11y is integrated and critical accessibility violations are fixed
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- ESLint a11y setup + audit high-traffic views (Search, Curate, Report, Group Curation)
- [x] 02-02-PLAN.md -- Audit remaining views (Manage Users, Configuration, Notifications, Login/NoAccess) + PATTERNS.md + user review checkpoint
- [ ] 02-03-PLAN.md -- Critical a11y fixes + Jest test infrastructure + smoke tests + Lighthouse before/after comparison

### Phase 3: Scoped Curation Roles
**Goal**: Administrators can assign curators to specific person types and/or organizational units, and those curators can only see and curate people within their assigned scope
**Depends on**: Phase 1, Phase 2
**Requirements**: SCOPE-01, SCOPE-02, SCOPE-03, SCOPE-04, SCOPE-05, SCOPE-06
**Success Criteria** (what must be TRUE):
  1. A Superuser can assign a scoped curation role to a user from the Manage Users page, specifying person type only, org unit only, or both
  2. A scoped curator searching on Find People sees only people matching their assigned scope (person type and/or org unit)
  3. A scoped curator attempting to curate a person outside their scope is denied at both the page level and API level
  4. Scoped role assignments persist across sessions (stored in database, embedded in JWT at login)
  5. Existing Curator_All and Curator_Self roles continue to work exactly as before
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Curation Proxy
**Goal**: Any user with appropriate privileges can be assigned as a curation proxy for one or more other users, and can discover and curate publications on their behalf through the existing search interface
**Depends on**: Phase 1, Phase 3
**Requirements**: PROXY-01, PROXY-02, PROXY-03, PROXY-04, PROXY-05, PROXY-06
**Success Criteria** (what must be TRUE):
  1. A Superuser can assign User A as a curation proxy for User B from the Manage Users page, and the relationship persists in the database
  2. A curator with existing privileges can grant proxy access from the individual curation page
  3. When User A searches on Find People, proxied users display with a [PROXY] badge
  4. User A can check "Show only my proxied users" to filter search results to just their proxied users
  5. User A can click through to curate publications for any of their proxied users, and the feedback is logged with User A's userID in admin_feedbacklog
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth Fix and Bug Remediation | 2/2 | Complete   | 2026-03-16 |
| 2. UI/UX Audit | 2/3 | In Progress|  |
| 3. Scoped Curation Roles | 0/? | Not started | - |
| 4. Curation Proxy | 0/? | Not started | - |
