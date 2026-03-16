# Requirements: RPM Bug Fixes, UI/UX Audit, and Scoped Curation Roles

**Defined:** 2026-03-16
**Core Value:** Curators and administrators can reliably log in, navigate without broken UI, and have fine-grained control over who curates publications for which groups of people.

## v1 Requirements

Requirements for this release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User with valid roles in admin_users and admin_users_roles can log in and reach the correct landing page regardless of role combination
- [ ] **AUTH-02**: Middleware uses capability-based permission checks instead of role-count comparisons
- [ ] **AUTH-03**: SAML and local auth providers produce identical session structures with consistent role data
- [ ] **AUTH-04**: Auth flow logs role resolution and routing decisions for troubleshooting

### UI Bug Fixes

- [ ] **UIBUG-01**: "Curate publications" action is not available on the Find People (search) page
- [ ] **UIBUG-02**: "View Profile" click loads and displays the profile modal without error
- [ ] **UIBUG-03**: All loading animations use the current React Bootstrap Spinner design (no legacy red circle GIF)

### Scoped Curation Roles

- [ ] **SCOPE-01**: Database schema supports scoped curation roles with nullable person type and org unit columns
- [ ] **SCOPE-02**: Scoped curators only see people matching their assigned scope on the Find People page
- [ ] **SCOPE-03**: Scoped curators can only curate publications for people within their assigned scope
- [ ] **SCOPE-04**: Superusers can assign person type scopes to users from the Manage Users page
- [ ] **SCOPE-05**: Superusers can assign org unit scopes to users from the Manage Users page
- [ ] **SCOPE-06**: Scoped roles support flexible combination: person type only, org unit only, or both

### UI/UX Audit

- [ ] **UIUX-01**: Full visual audit of all views completed using systematic evaluation methodology
- [ ] **UIUX-02**: Group Curation view reviewed and issues documented with recommendations
- [ ] **UIUX-03**: Critical accessibility issues identified and fixed (eslint-plugin-jsx-a11y integrated)

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
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| AUTH-04 | TBD | Pending |
| UIBUG-01 | TBD | Pending |
| UIBUG-02 | TBD | Pending |
| UIBUG-03 | TBD | Pending |
| SCOPE-01 | TBD | Pending |
| SCOPE-02 | TBD | Pending |
| SCOPE-03 | TBD | Pending |
| SCOPE-04 | TBD | Pending |
| SCOPE-05 | TBD | Pending |
| SCOPE-06 | TBD | Pending |
| UIUX-01 | TBD | Pending |
| UIUX-02 | TBD | Pending |
| UIUX-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after initial definition*
