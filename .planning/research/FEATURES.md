# Feature Research

**Domain:** Scholarly publication management, scoped curation roles, admin user management
**Researched:** 2026-03-16
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Working authentication for all valid users | Users with correct roles in the database must not be redirected to /noaccess. This is the #1 blocker. | MEDIUM | Current bug: paa2013 with all 4 roles gets /noaccess. Root cause likely in next-auth callback or JWT encoding of userRoles array. Must work in both SAML (EKS) and local auth modes. |
| Consistent loading indicators | Red circle legacy loader is jarring and inconsistent. Users expect a single, polished loading pattern across all views. | LOW | Grep the codebase for all Loader references and the legacy red circle; replace with the current design component. |
| Profile modal that loads | "View Profile" click currently shows "unable to load profile" error. Profile viewing is a core workflow for curators evaluating a person. | MEDIUM | Likely an API endpoint issue or missing data for certain person records. |
| Role display in user table | The Manage Users table currently shows Name, Department (always empty), Email, Actions. Users managing other users need to see at a glance what roles someone has. | LOW | The department column is rendered as empty string `{""}`. Roles are not shown at all. Fetch roles eagerly with the user list query or display them in a summary column. |
| Search-driven user management | ManageUsers has both server-side search (3+ chars) and a client-side filter. The client-side filter only operates on the current page of results. Admins expect search to work across all users. | LOW | Remove the confusing dual-search pattern. Server-side search is correct; client-side filtering on paginated data is misleading. |
| Disable/deactivate user accounts | The admin_users table has a `status` field but the UI has no toggle for it. Admins need to deactivate users without deleting them. | LOW | Add a status toggle (active/inactive) to the user edit form. The data model already supports it. |
| Scoped curation role: by person type | Curators responsible for specific populations (e.g., "affiliate," "alumni," "md-phd") need to see only those people in their curation queue. This is the primary requested feature. | HIGH | Requires new DB table (e.g., `admin_users_scopes`), middleware changes to filter curation targets, and API query changes to filter person results by person type when a scoped curator is logged in. |
| Scoped curation role: by organizational unit | Curators responsible for specific departments (e.g., "Medicine," "Psychiatry") need curation scoped to those org units. | HIGH | Uses `person.primaryOrganizationalUnit`. Can share the same scoping infrastructure as person type scoping. Org units already exist as a filter dimension in Search and Reports. |
| Combined person type + org unit scoping | A curator may be responsible for "affiliates in Radiology." Both scope dimensions must be composable. | HIGH | The combination should be AND logic: curator sees people matching the person type AND belonging to the org unit. If only one dimension is specified, only that filter applies. |
| Manage scoped roles from Manage Users page | Centralized user management is a clear expectation. Adding a separate admin page for scoped roles creates confusion. | MEDIUM | Extend the existing AddUser form. When a scoped curation role is selected, show conditional fields for person type(s) and org unit(s). Use the existing MUI Autocomplete multi-select pattern already in the form. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Scoped curation queue auto-filtering | When a scoped curator navigates to Search or Group Curation, automatically pre-filter results to their scope. No manual filter selection needed. | MEDIUM | This is the UX payoff of scoped roles. Pure and Symplectic Elements both do this: scoped users see only their assigned population. Requires middleware/API layer to inject scope filters automatically. |
| Scope summary badge on user list | In the Manage Users table, show a compact summary of each user's scope (e.g., "Cardiology, Psychiatry" or "Alumni, Affiliate"). At-a-glance understanding of who manages what. | LOW | Fetch scope data with the user list query. Render as small badges or a comma-separated tag list in the table row. |
| Auth debugging panel (Superuser) | A diagnostic view showing: current JWT contents, decoded roles, session state, SAML assertion details, and a "test as user" simulation mode. Invaluable for debugging the /noaccess redirect class of bugs. | MEDIUM | Not available in comparable tools, but extremely valuable for this team given recurring auth issues. Show decoded JWT claims, role resolution logic, and the middleware's routing decision for any given user. Read-only, Superuser-only. |
| Scope inheritance via org hierarchy | If a curator is assigned to "Department of Medicine," they automatically get access to subdivisions (e.g., "Cardiology," "Gastroenterology"). | HIGH | Requires an org hierarchy table or recursive lookup. The current `primaryOrganizationalUnit` field is a flat string, not a hierarchical structure. Worth considering for v2 but not v1 of scoped roles. |
| Delegation/proxy curation | Allow a curator to temporarily delegate their curation responsibilities to another user (as in Symplectic Elements' delegate feature). Useful for vacations, sabbaticals. | MEDIUM | Requires a delegation table mapping delegator to delegate with optional expiration date. The delegate acts with the delegator's scope. |
| Audit trail for role changes | Log who changed which user's roles and when. Critical for compliance in academic settings. | LOW | The `admin_users_roles` table has `createTimestamp` and `modifyTimestamp` but no audit of who made the change. Add a simple `admin_audit_log` table. |
| Bulk user import/update | Upload a CSV of users with their roles, scopes, and departments. Useful for annual onboarding of new curators. | MEDIUM | Common in enterprise admin tools. Elsevier Digital Commons supports batch user management. |
| Effective permissions preview | When editing a user, show a live preview of "this user will be able to curate publications for 347 people in 3 departments." Helps admins understand the impact of scope assignments. | MEDIUM | Query the person table with the selected scope filters and show the count. Prevents assignment errors. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Per-article permission assignments | "Let curators be assigned to individual people, not groups." | Explodes administrative complexity. With thousands of people and dozens of curators, managing individual assignments becomes unmanageable. It also doesn't scale: new people wouldn't auto-assign to anyone. | Use person type and org unit scoping. These are group-based and self-maintaining: when a new person of type "affiliate" arrives in the system, they automatically fall into the affiliate curator's scope. |
| Negative permissions / deny rules | "Allow curator to see everyone EXCEPT certain org units." | Deny rules create confusing permission interactions. Pure's documentation notes that overlapping allow/deny permissions are a common source of admin errors. | Use positive-only permissions. Assign the specific person types and org units the curator should manage. If they need "almost everything," give them Curator_All. |
| Custom role creation UI | "Let admins define new role types with arbitrary permission sets." | Role proliferation leads to unmaintainable systems. The RBAC best practice (Oso 2025) is to use a small number of well-defined roles with scoping, not unlimited custom roles. RPM has 4 roles; adding scoping to the Curator role is the right granularity. | Keep the 4 existing roles. Add scoping dimensions (person type, org unit) as modifiers on the Curator role, not as new roles. |
| Real-time collaborative curation | "Multiple curators working on the same person simultaneously with live updates." | Requires WebSocket infrastructure, conflict resolution, and a fundamentally different state management approach. The accept/reject workflow is inherently sequential per-article. | The current model (one curator works on a person's articles at a time) is fine. If two scoped curators overlap on a person, last-write-wins is acceptable for this domain. |
| Complex approval workflows for curation | "Require supervisor approval before a curator's accept/reject decisions are finalized." | Adds friction to a workflow that needs to be fast. Curators are trusted domain experts. Multi-step approval slows throughput without proportional quality gain. | Trust curators within their scope. Use the audit trail to review decisions after the fact if needed. |
| Cascading org unit permissions without explicit hierarchy | "Automatically infer department hierarchies from naming conventions (e.g., 'Medicine - Cardiology' implies Cardiology is under Medicine)." | String parsing is fragile and institution-specific. Org unit naming conventions vary wildly. | If hierarchy is needed, build an explicit parent-child relationship table for org units. Do not try to parse it from strings. |

## Feature Dependencies

```
[Auth fix: /noaccess redirect]
    (no dependencies, fix first)

[Scoped curation role: person type]
    └──requires──> [New DB table: admin_users_scopes]
                       └──requires──> [API: distinct person types query]
                       └──requires──> [API: filter persons by scope]

[Scoped curation role: org unit]
    └──requires──> [New DB table: admin_users_scopes]
                       └──requires──> [API: distinct org units query]
                       └──requires──> [API: filter persons by scope]

[Combined scoping (type + org)]
    └──requires──> [Scoped curation role: person type]
    └──requires──> [Scoped curation role: org unit]

[Manage scoped roles in Manage Users]
    └──requires──> [New DB table: admin_users_scopes]
    └──requires──> [API: CRUD for scope assignments]

[Scoped curation queue auto-filtering]
    └──requires──> [Combined scoping (type + org)]
    └──requires──> [Middleware: inject scope into API queries]

[Scope summary badge on user list]
    └──requires──> [New DB table: admin_users_scopes]

[Auth debugging panel]
    (independent, but should come after auth fix)

[Effective permissions preview]
    └──requires──> [Combined scoping (type + org)]

[UI/UX audit]
    └──requires──> [Auth fix] (can't audit what you can't log into)
    └──enhances──> [All UI features]

[Audit trail for role changes]
    └──enhances──> [Manage scoped roles in Manage Users]
```

### Dependency Notes

- **Auth fix has no dependencies and blocks everything else:** Until valid users can log in, no other feature can be tested or used. Fix first.
- **The DB scope table is the foundation:** Both person type and org unit scoping share the same table structure. Design this table to handle both dimensions from day one.
- **UI/UX audit enhances all features:** Running the audit after the auth fix but before building new scoped role UI ensures the new UI follows the corrected patterns.
- **Auto-filtering is the UX payoff:** Without auto-filtering, scoped curators still have to manually select their scope filters every time. This is where the feature delivers real value.

## MVP Definition

### Launch With (v1)

Minimum viable product for the scoped curation milestone.

- [ ] **Auth fix: /noaccess redirect** -- Users with valid roles must be able to log in. This is a blocker for all testing and adoption.
- [ ] **Fix profile modal loading error** -- Core curator workflow depends on viewing person profiles.
- [ ] **Fix "Curate publications" on Search page** -- The action should only appear on the curation page, not the search page.
- [ ] **Replace legacy red circle loader** -- Low effort, high visual consistency improvement.
- [ ] **Scoped curation role: person type** -- The primary new feature. Curators can be assigned to specific person types.
- [ ] **Scoped curation role: org unit** -- The secondary scope dimension. Curators can be assigned to specific departments.
- [ ] **Combined scoping** -- Both dimensions composable with AND logic.
- [ ] **Manage scoped roles from Manage Users** -- Extend existing form with conditional scope fields.
- [ ] **Role display in user table** -- Show roles (and scope summary) in the Manage Users list.
- [ ] **User status toggle** -- Activate/deactivate users from the edit form.

### Add After Validation (v1.x)

Features to add once core scoping is working and validated by curators.

- [ ] **Scoped curation queue auto-filtering** -- Pre-filter Search/Group Curation for scoped curators. Add after v1 scope assignment is working and curators confirm the scope definitions are correct.
- [ ] **Effective permissions preview** -- Show count of people in a curator's scope during role editing. Add after curators start asking "who does this scope include?"
- [ ] **Auth debugging panel** -- Build after the /noaccess bug is fixed, but include as a diagnostic tool for future auth issues.
- [ ] **Audit trail for role changes** -- Add when the team starts managing more than a handful of scoped curators and needs accountability.

### Future Consideration (v2+)

Features to defer until the scoped role system is proven and adoption is established.

- [ ] **Scope inheritance via org hierarchy** -- Defer until flat org unit scoping proves insufficient. Requires significant data modeling work.
- [ ] **Delegation/proxy curation** -- Defer until curators request it. The existing Curator_All role can serve as a temporary workaround.
- [ ] **Bulk user import/update** -- Defer until the user base grows large enough that manual management becomes painful (likely 50+ curators).

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth fix: /noaccess redirect | HIGH | MEDIUM | P1 |
| Fix profile modal | HIGH | LOW-MEDIUM | P1 |
| Fix "Curate publications" on Search | MEDIUM | LOW | P1 |
| Replace legacy red circle loader | LOW | LOW | P1 |
| Scoped role: person type | HIGH | HIGH | P1 |
| Scoped role: org unit | HIGH | HIGH | P1 |
| Combined scoping (type + org) | HIGH | MEDIUM | P1 |
| Manage scoped roles in Manage Users | HIGH | MEDIUM | P1 |
| Role display in user table | MEDIUM | LOW | P1 |
| User status toggle | MEDIUM | LOW | P1 |
| Full UI/UX audit | MEDIUM | MEDIUM | P1 |
| Scoped queue auto-filtering | HIGH | MEDIUM | P2 |
| Effective permissions preview | MEDIUM | MEDIUM | P2 |
| Auth debugging panel | MEDIUM | MEDIUM | P2 |
| Audit trail for role changes | LOW | LOW | P2 |
| Scope inheritance (org hierarchy) | LOW | HIGH | P3 |
| Delegation/proxy curation | LOW | MEDIUM | P3 |
| Bulk user import | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Elsevier Pure | Symplectic Elements | Digital Commons | RPM (Our Approach) |
|---------|---------------|--------------------|-----------------|--------------------|
| Scoped roles by org unit | Yes. "Local roles" are scoped to specific organizations. Global roles operate system-wide. | Yes. Statistician role scoped to department/school/campus. | Yes. Publication-level permissions scoped to specific collections/journals. | Implement via `admin_users_scopes` table linking users to org units. Follows Pure's local/global pattern. |
| Scoped roles by person type | Indirect. Academic vs. Non-academic staff type classification determines license counting. Not a curation scope. | Not directly. Delegate model is person-to-person, not type-based. | Not applicable (repository, not person-centric). | Direct support. Unique to RPM's person-centric curation model. Competitive advantage. |
| Role hierarchy | 6+ distinct roles (Administrator, Editor, Validator, Claim Admin, Deduplicator, Personal User) with graded permissions. | Reviewer, Viewer, Statistician, and Delegate roles with varying access. | Site Admin and Publication Admin with cascading permissions. | 4 roles + scoping. Simpler than Pure, which is appropriate for RPM's focused use case. |
| Delegate/proxy | Not prominent in docs. | Yes. Users can delegate record editing to assistants via Account Settings. | Not documented. | Defer to v2. |
| Permission inheritance | Yes. Roles cascade through org hierarchy. | Yes. Campus > School > Department scoping. | Yes. Site-level permissions cascade to publications. | Flat scoping in v1. Hierarchy in v2 if needed. |
| Admin audit trail | Yes. Built-in audit module. | Yes. Change tracking on records. | Yes. Activity logs for admin actions. | Add simple audit log table in v1.x. |
| Auth debugging | Not user-facing. Backend diagnostics only. | Not user-facing. | Not documented. | Auth debugging panel is a differentiator for RPM. Addresses a real pain point (recurring /noaccess bugs). |

## Data Model Implications

The existing RPM data model already has the building blocks:

- `person.primaryOrganizationalUnit` -- flat string, already used as a search filter
- `person_person_type.personType` -- already used as a search filter
- `admin_users` -- has status field (unused in UI)
- `admin_users_roles` -- maps users to roles
- `admin_users_departments` -- maps users to departments (conceptually similar to scoped org units, but currently used for the user's own department, not their curation scope)

**New table needed:** `admin_users_scopes`

```
admin_users_scopes
├── id (PK, auto-increment)
├── userID (FK -> admin_users.userID)
├── scopeType (ENUM: 'personType', 'orgUnit')
├── scopeValue (VARCHAR -- the person type string or org unit string)
├── createTimestamp
└── modifyTimestamp
```

This design:
- Supports both person type and org unit scoping in one table
- Allows multiple scope values per user per dimension
- Uses the same string values already in `person_person_type.personType` and `person.primaryOrganizationalUnit`
- Follows the existing Sequelize model patterns in the codebase

## UI/UX Audit Scope

Based on the PROJECT.md, a full UI/UX audit covers all views. Key areas likely to surface issues:

| View | Expected Issues | Audit Focus |
|------|-----------------|-------------|
| Search / Find People | "Curate publications" action showing when it shouldn't; filter state persistence; pagination behavior | Action availability by role; filter UX consistency |
| Curate Individual | Profile modal errors; loading states; accept/reject workflow clarity | Error handling; loading indicators; confirmation patterns |
| Report | Filter complexity; export functionality; empty states | Filter discoverability; export UX; zero-results messaging |
| Manage Users | Empty department column; missing role display; search confusion (dual search) | Table columns; search UX; form validation |
| Configuration | Accordion UX; JSON-based viewAttributes complexity | Admin comprehension; setting discoverability |
| Notifications | Partially implemented; placeholder routing logic | Completeness; disabled state communication |
| Group Curation | "Not actively used"; may have significant UX debt | Basic functionality; loading states; empty states |

## Sources

- [Elsevier Pure: Reporting Roles](https://helpcenter.pure.elsevier.com/en_US/reporting/reporting-roles)
- [Pure API: Users and Roles](https://helpcenter.pure.elsevier.com/en_US/pure-api/pure-api-users-and-roles)
- [Pure: Open Access Roles and Rights](https://helpcenter.pure.elsevier.com/open-access/open-access-roles-and-rights-overview)
- [Digital Commons: Managing Administrator Permissions](https://digitalcommons.elsevier.com/managing-administrator-permissions)
- [Symplectic Elements: User Guide](https://manualzz.com/doc/4174490/symplectic-v4-elements-user-guide)
- [Symplectic Elements: Oxford FAQ](https://researchsupport.admin.ox.ac.uk/reporting/symplectic/help/faqs)
- [Oso: 10 RBAC Best Practices for 2025](https://www.osohq.com/learn/rbac-best-practices)
- [Oso: RBAC Implementation in 5 Steps](https://www.osohq.com/learn/rbac-role-based-access-control-implementation)
- [Perpetual: How to Design Effective SaaS Roles and Permissions](https://www.perpetualny.com/blog/how-to-design-effective-saas-roles-and-permissions)
- [UX Collective: Designing Permissions for SaaS](https://uxdesign.cc/design-permissions-for-a-saas-app-db6c1825f20e)
- [Auth.js: Role-Based Access Control](https://authjs.dev/guides/role-based-access-control)
- [Admin Dashboard UI/UX: Best Practices for 2025](https://medium.com/@CarlosSmith24/admin-dashboard-ui-ux-best-practices-for-2025-8bdc6090c57d)

---
*Feature research for: Scoped curation roles, auth debugging, and UI/UX audit in scholarly publication management*
*Researched: 2026-03-16*
