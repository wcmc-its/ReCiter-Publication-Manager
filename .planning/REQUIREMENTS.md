# Requirements: RPM Bug Fixes, UI/UX Audit, and Scoped Curation Roles

**Defined:** 2026-03-16
**Core Value:** Curators and administrators can reliably log in, navigate without broken UI, and have fine-grained control over who curates publications for which groups of people.

## v1 Requirements

Requirements for this release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User with valid roles in admin_users and admin_users_roles can log in and reach the correct landing page regardless of role combination
- [x] **AUTH-02**: Middleware uses capability-based permission checks instead of role-count comparisons
- [x] **AUTH-03**: SAML and local auth providers produce identical session structures with consistent role data
- [x] **AUTH-04**: Auth flow logs role resolution and routing decisions for troubleshooting

### UI Bug Fixes

- [x] **UIBUG-01**: "Curate publications" action is not available on the Find People (search) page
- [x] **UIBUG-02**: "View Profile" click loads and displays the profile modal without error
- [x] **UIBUG-03**: All loading animations use the current React Bootstrap Spinner design (no legacy red circle GIF)

### Scoped Curation Roles

- [ ] **SCOPE-01**: Database schema supports scoped curation roles with nullable person type and org unit columns
- [ ] **SCOPE-02**: Scoped curators only see people matching their assigned scope on the Find People page
- [ ] **SCOPE-03**: Scoped curators can only curate publications for people within their assigned scope
- [ ] **SCOPE-04**: Superusers can assign person type scopes to users from the Manage Users page
- [ ] **SCOPE-05**: Superusers can assign org unit scopes to users from the Manage Users page
- [ ] **SCOPE-06**: Scoped roles support flexible combination: person type only, org unit only, or both

### UI/UX Audit

- [x] **UIUX-01**: Full visual audit of all views completed using systematic evaluation methodology
- [x] **UIUX-02**: Group Curation view reviewed and issues documented with recommendations
- [x] **UIUX-03**: Critical accessibility issues identified and fixed (eslint-plugin-jsx-a11y integrated)

### Curation Proxy

- [ ] **PROXY-01**: Superuser can assign one user as a curation proxy for another user from the Manage Users page
- [ ] **PROXY-02**: Curators with existing curation privileges can grant proxy access from the individual curation page
- [ ] **PROXY-03**: Proxy relationships are many-to-many (a user can proxy for multiple people, a person can have multiple proxies)
- [ ] **PROXY-04**: Proxied users display with a [PROXY] badge in Find People search results for the proxy user
- [ ] **PROXY-05**: Proxy user can filter search results to show only their proxied users via a checkbox filter
- [ ] **PROXY-06**: Proxy user can navigate to and curate publications on behalf of their proxied users

## v2 Requirements

### Scoped Role Enhancements

- **SCOPE-07**: Auto-filtering of curation queue based on curator's scope
- **SCOPE-08**: Permissions preview showing what a user can access before saving role changes
- **SCOPE-09**: Audit trail for scoped role assignment changes

### UI/UX Improvements

- **UIUX-04**: Implement all non-critical recommendations from UI/UX audit
- **UIUX-05**: Dark mode support

### Auth Enhancements

- **AUTH-05**: Session invalidation when a superuser changes another user's role assignments

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-article permission assignments | Excessive granularity; maintainability nightmare |
| Custom role creation UI | Complexity not justified; roles are relatively stable |
| Negative/deny permission rules | Adds combinatorial complexity; allow-only model is sufficient |
| Real-time collaborative curation | High complexity, not requested |
| Next.js/React framework upgrade | Separate effort, different risk profile |
| PubMed search Phase 2 (author highlighting) | Deferred from v1.0 milestone |
| Mobile/responsive redesign | Web-first, separate scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| UIBUG-01 | Phase 1 | Complete |
| UIBUG-02 | Phase 1 | Complete |
| UIBUG-03 | Phase 1 | Complete |
| SCOPE-01 | Phase 3 | Pending |
| SCOPE-02 | Phase 3 | Pending |
| SCOPE-03 | Phase 3 | Pending |
| SCOPE-04 | Phase 3 | Pending |
| SCOPE-05 | Phase 3 | Pending |
| SCOPE-06 | Phase 3 | Pending |
| UIUX-01 | Phase 2 | Complete -- All 8 views audited with severity-tagged findings (8 AUDIT-*.md files) |
| UIUX-02 | Phase 2 | Complete -- Group Curation audited, redesign gap analysis documented, UI-SPEC.md produced |
| UIUX-03 | Phase 2 | Complete -- eslint-plugin-jsx-a11y strict mode, 33/64 violations fixed, Jest infrastructure + smoke tests |
| PROXY-01 | Phase 4 | Pending |
| PROXY-02 | Phase 4 | Pending |
| PROXY-03 | Phase 4 | Pending |
| PROXY-04 | Phase 4 | Pending |
| PROXY-05 | Phase 4 | Pending |
| PROXY-06 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-17 after Phase 2 completion*
