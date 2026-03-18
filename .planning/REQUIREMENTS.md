# Requirements: v1.1 Feature Port to Next.js 14

**Defined:** 2026-03-18
**Core Value:** All v1.0 features (capability auth, scoped curation, proxy delegation) work on the Next.js 14 / React 18 codebase running on reciter-dev.

## v1.1 Requirements

Requirements for this release. Each maps to roadmap phases.

### Foundation

- [x] **PORT-01**: AdminUser Sequelize model extended with three JSON columns (scope_person_types, scope_org_units, proxy_person_ids) on existing admin_users table, with SWC-safe modelName property preserved
- [x] **PORT-02**: scopeResolver.ts (isPersonInScope, isProxyFor) available on NextJS14 branch
- [ ] **PORT-03**: getCapabilities, ROLE_CAPABILITIES, getLandingPage, Curator_Scoped added to constants

### Database

- [ ] **DB-01**: ALTER TABLE admin_users adding scope_person_types, scope_org_units, and proxy_person_ids JSON columns -- DDL committed to ReCiterDB repo schema and applied to both dev and prod reciterDB databases

### Auth Pipeline

- [ ] **PORT-04**: findUserPermissions returns enriched { roles, scopeData, proxyPersonIds } on NextJS14 branch
- [ ] **PORT-05**: next-auth v4 JWT/session callbacks include scopeData and proxyPersonIds
- [ ] **PORT-06**: Capability-based middleware replaces role-count checks using getToken (not jose)
- [ ] **PORT-07**: SAML auto-create with default role grant works within existing cookie-bridge flow

### Scoped Curation

- [ ] **PORT-08**: CurationScopeSection UI in AddUser form for assigning person type and org unit scopes
- [ ] **PORT-09**: ScopeFilterCheckbox and curate icon on Search page for scoped curators
- [ ] **PORT-10**: ScopeLabel in sidebar shows active scope description
- [ ] **PORT-11**: Curate and Manage Profile pages enforce scope (redirect + toast for out-of-scope)

### Curation Proxy

- [ ] **PORT-12**: ProxyAssignmentsSection UI in AddUser form for proxy management
- [ ] **PORT-13**: ProxyBadge [PROXY] on search results with proxy filter checkbox
- [ ] **PORT-14**: GrantProxyModal on curation page for in-context proxy grants
- [ ] **PORT-15**: Proxy CRUD API endpoints (grant, list, search-persons, search-users)

### API Enforcement

- [ ] **PORT-16**: userfeedback save API checks isProxyFor before isPersonInScope
- [ ] **PORT-17**: goldstandard update API checks isProxyFor before isPersonInScope

### UI Polish

- [ ] **PORT-18**: Skeleton loading components (Table, Card, Profile, Form) adapted for React 18
- [ ] **A11Y-01**: Remaining 31 deferred a11y violations fixed

### Testing

- [ ] **PORT-19**: Jest 29 + @testing-library/react 16 infrastructure for React 18
- [ ] **PORT-20**: Scope resolver and proxy unit tests passing on new test stack

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
| SAML2-js debugging/fixes | Already stable on NextJS14 branch per Mahender |
| Next.js App Router migration | Both branches use Pages Router; no migration needed |
| New features beyond v1.0 port | This milestone is about parity, not new functionality |
| PubMed search improvements (author highlighting) | Deferred from v1.0 |
| Mobile/responsive redesign | Web-first, separate scope |
| Notification system overhaul | Partially implemented, separate scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PORT-01 | Phase 7 | Complete |
| PORT-02 | Phase 7 | Complete |
| PORT-03 | Phase 7 | Pending |
| DB-01 | Phase 7 | Pending |
| PORT-04 | Phase 8 | Pending |
| PORT-05 | Phase 8 | Pending |
| PORT-06 | Phase 8 | Pending |
| PORT-07 | Phase 8 | Pending |
| PORT-08 | Phase 9 | Pending |
| PORT-09 | Phase 9 | Pending |
| PORT-10 | Phase 9 | Pending |
| PORT-11 | Phase 9 | Pending |
| PORT-12 | Phase 9 | Pending |
| PORT-13 | Phase 9 | Pending |
| PORT-14 | Phase 9 | Pending |
| PORT-15 | Phase 9 | Pending |
| PORT-16 | Phase 10 | Pending |
| PORT-17 | Phase 10 | Pending |
| PORT-18 | Phase 11 | Pending |
| A11Y-01 | Phase 11 | Pending |
| PORT-19 | Phase 11 | Pending |
| PORT-20 | Phase 11 | Pending |

**Coverage:**
- v1.1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 -- PORT-01 and DB-01 updated to reflect JSON column approach per Phase 7 context decisions*
