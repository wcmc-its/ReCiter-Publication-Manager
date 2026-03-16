# RPM Bug Fixes, UI/UX Audit, Scoped Curation Roles, and Proxy Curation

## What This Is

A maintenance and feature release for ReCiter-Publication-Manager addressing login issues, UI bugs, a full UI/UX audit, and a new scoped curation role system. The app runs on the EKS dev cluster (`reciter-dev`) using SAML authentication against the `dev_v2` branch.

## Core Value

Curators and administrators can reliably log in, navigate without encountering broken UI, and have fine-grained control over who curates publications for which groups of people.

## Requirements

### Validated

<!-- Existing capabilities already working in the codebase -->

- ✓ SAML and local authentication flow — existing
- ✓ Role-based access control (Superuser, Curator_All, Reporter_All, Curator_Self) — existing
- ✓ Manage Users page with role and department assignment — existing
- ✓ Search/Find People page with identity lookup — existing
- ✓ Individual curation page with accept/reject workflow — existing
- ✓ Profile modal with biographical and bibliometric data — existing
- ✓ PubMed search with client-side dedup, pending badges, filter persistence — v1.0

### Active

<!-- Current scope. Building toward these. -->

- [ ] Fix: User paa2013 (and potentially others with valid roles) redirected to /noaccess despite having all roles in admin_users/admin_users_roles
- [ ] Fix: "Curate publications" action should not be enabled on the Find People (search) page
- [ ] Fix: "View Profile" click shows "unable to load profile" error
- [ ] Fix: Replace legacy red circle loading animation with current design in all locations
- [ ] Full UI/UX audit of all views (Search, Curate, Report, Manage Users, Configuration, Notifications, Group Curation)
- [ ] New feature: Scoped curation roles by person type (e.g., affiliate, alumni, md-phd)
- [ ] New feature: Scoped curation roles by organizational unit
- [ ] Flexible scoping: assign person type only, org unit only, or both combined
- [ ] Manage scoped curation roles from the existing Manage Users page
- [ ] New feature: Many-to-many curation proxy assignments (User A curates on behalf of User B)
- [ ] Proxied users show with [PROXY] badge and filter checkbox on Find People search
- [ ] Superuser assigns proxies via Manage Users; curators with privileges grant from curation page

### Out of Scope

- Phase 2 of PubMed search improvements (author name highlighting, affiliation hover) — deferred from v1.0
- Mobile app or responsive redesign — web-first
- Migration to Next.js 13+ or React 18 — separate effort
- Notification system overhaul — partially implemented, separate scope

## Context

- The app is on the `dev_v2` branch, 70+ commits ahead of `dev`
- Authentication uses SAML on EKS (LOGIN_PROVIDER=SAML) with next-auth v3
- User paa2013 (userID 40099) has all 4 roles (roleID 1-4), status=1, email paa2013@med.cornell.edu
- The /noaccess redirect suggests the nextauth callback or middleware role-checking is failing
- Group Curation view has not been actively used; may need significant UX attention
- Current curation model is binary: curate everything (Curator_All) or just yourself (Curator_Self)
- The new scoped roles create a middle ground: curate publications for specific person types or org units
- Person types and org units already exist in the `person` and `person_person_type` tables
- The UI/UX audit will use the /ui-ux-pro-max skill for systematic evaluation

## Constraints

- **Tech stack**: Next.js 12, React 16, Node 14 — no framework upgrades in this milestone
- **Auth**: SAML on EKS; local auth for local dev — fix must work in both modes
- **Database**: MySQL via Sequelize — new scoped role tables must follow existing model patterns
- **Existing patterns**: Redux + thunk async pattern for state management
- **Deployment**: EKS dev cluster via CodeBuild pipeline

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scoped roles use flexible combination (type + org) | Maximum flexibility without overcomplicating assignments | — Pending |
| Manage scoped roles in existing Manage Users page | Avoids a separate admin page; keeps user management centralized | — Pending |
| Full UI/UX audit scope (all views) | Group Curation and other views may have accumulated UX debt | — Pending |
| Curation proxy uses search page with badge/filter | Leverages existing search UX; avoids new navigation surface | — Pending |
| Proxy assignment from both Manage Users and curation page | Superusers centralize; curators grant contextually | — Pending |

---
*Last updated: 2026-03-16 after adding curation proxy (Phase 4)*
