# Phase 3: Scoped Curation Roles - Research

**Researched:** 2026-03-17
**Domain:** Role-based access control, database schema design, JWT session management, Sequelize ORM, Next.js middleware
**Confidence:** HIGH

## Summary

Phase 3 implements a new `Curator_Scoped` role that restricts curation access to specific person types and/or organizational units. The implementation touches every layer of the stack: database schema (new role + scope storage), auth flow (JWT embedding), middleware (route-level enforcement), API routes (request-level enforcement), and frontend (scope-aware UI in search, curation, navbar, and admin pages).

The codebase already has strong foundations for this work. The `getCapabilities()` function in `constants.js` provides an isomorphic capability resolver used consistently across Edge middleware, API routes, and React components. The person search controller (`person.controller.ts`) already supports filtering by personTypes and orgUnits. The AddUser form already uses MUI Autocomplete for department selection. The key challenge is threading scope data through the JWT, building the scope resolution logic, and adding enforcement at multiple points without disrupting existing Curator_All and Curator_Self behavior.

**Primary recommendation:** Extend the existing capability model (`getCapabilities`) with a `scoped` property on `canCurate`, create a new `admin_users_person_types` junction table for person type scope storage, reuse the existing `admin_users_departments` table for org unit scope, and build a centralized `isPersonInScope()` helper that both middleware and API routes can call.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New `Curator_Scoped` role added to `admin_roles` table alongside existing Superuser, Curator_All, Curator_Self, Reporter_All
- Curator_All and Curator_Scoped are mutually exclusive (form prevents selecting both)
- Curator_Self CAN combine with Curator_Scoped or Curator_All (additive "can curate own publications" flag)
- Existing Curator_All + Curator_Self combinations in the database are left alone (Curator_All already grants full access so Curator_Self is redundant but harmless)
- Reporter_All combines freely with any curator role; reports are unrestricted by scope
- No admin page access for Curator_Scoped (Manage Users and Configuration stay Superuser-only)
- Scoped curators see ALL people on Find People by default (needed for reporting and group views)
- Checkbox filter "Show only people I can curate" in the filter area narrows results to scope
- Checkbox only visible when the user's scope covers > 1 person and < everyone (meaningless for Curator_All/Curator_Self)
- In search results: in-scope people show a curate action/icon; out-of-scope people do not
- Clicking a person's name: in-scope -> /curate/:id; out-of-scope -> Create Reports with that person selected
- Curation access implies profile management access for the same people
- Curator_Scoped lands on `/search` after login
- "Curate Publications" nav link takes Curator_Scoped to `/search` with the scope filter checkbox pre-checked
- Subtle scope label in side navbar under user's name (e.g., "Curating: Faculty, Surgery")
- Port 5 files from master branch (commit 544c0f2) into dev_v2 for Manage Profile: controller, component, CSS module, API route, page
- ORCID management only (port as-is, no new profile fields)
- Scope-gated: curators can only manage profiles for people they can curate
- Same denial behavior as curation (redirect + toast)
- When Curator_Scoped is selected in role dropdown, a "Curation Scope" section appears inline below roles
- Existing Departments multi-select field IS the org unit scope (same concept, merged) -- moves into the Curation Scope section when Curator_Scoped is active
- New Person Types multi-select added (values from distinct person_person_type table)
- Either or both optional, but at least one required (form validation: can't save Curator_Scoped with empty scope)
- Pre-populate scope fields when editing existing Curator_Scoped user
- Save directly -- no confirmation preview (SCOPE-08 permissions preview is a v2 requirement)
- Manage Users table shows scope inline in the roles column: "Curator_Scoped (Faculty, Surgery)"
- New role filter dropdown on Manage Users page to find all scoped curators quickly
- AND across dimensions, OR within: (Faculty OR Staff) AND (Surgery OR Medicine)
- Nullable dimension = no restriction on that axis: person types only -> all departments; departments only -> all person types
- A person matches if ANY of their person types (from person_person_type) matches the scope's person type list
- Scope data embedded in JWT at login; changes take effect on next login (consistent with existing auth model)
- Page-level denial: redirect to /search with toast "You don't have curation access for this person"
- API-level denial: HTTP 403 Forbidden with body `{error: 'Person not in curation scope'}`
- Console log denials server-side with `[AUTH]` prefix (matching Phase 1 logging pattern)

### Claude's Discretion
- Database schema choice (extend admin_users_roles with scope columns vs new junction table)
- JWT payload structure for scope data
- Exact scope resolver implementation (middleware vs API-level enforcement points)
- Toast message wording
- Curate icon choice for in-scope indicator in search results
- How to handle edge case where person has no person types in person_person_type

### Deferred Ideas (OUT OF SCOPE)
- Manage Profile page enhancements beyond ORCID (additional profile fields, research interests, etc.) -- future phase
- Group Curation redesign with scope support -- already planned in Phase 2 audit, will use scoped filtering when redesigned
- Permissions preview showing what a user can access before saving role changes -- SCOPE-08 (v2)
- Auto-filtering of curation queue based on curator's scope -- SCOPE-07 (v2)
- Audit trail for scoped role assignment changes -- SCOPE-09 (v2)
- Session invalidation when scope changes -- AUTH-05 (v2)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCOPE-01 | Database schema supports scoped curation roles with nullable person type and org unit columns | New `admin_users_person_types` junction table + reuse `admin_users_departments`; new row in `admin_roles` for Curator_Scoped; schema design below |
| SCOPE-02 | Scoped curators only see people matching their assigned scope on the Find People page (REFINED: see all, but can filter to scope and only curate within scope) | Scope checkbox filter in Search component; `person.controller.ts` already supports personType/orgUnit filtering; scope data from JWT session |
| SCOPE-03 | Scoped curators can only curate publications for people within their assigned scope | Middleware scope check on `/curate/*` and `/manageprofile/*` routes; API-level enforcement on userfeedback/save and goldstandard endpoints; centralized `isPersonInScope()` helper |
| SCOPE-04 | Superusers can assign person type scopes to users from the Manage Users page | AddUser form conditional "Curation Scope" section with person type multi-select; `findAllPersonTypes` API already exists |
| SCOPE-05 | Superusers can assign org unit scopes to users from the Manage Users page | Existing departments multi-select repurposed as org unit scope; moves into Curation Scope section when Curator_Scoped selected |
| SCOPE-06 | Scoped roles support flexible combination: person type only, org unit only, or both | AND/OR combination logic in `isPersonInScope()` helper; nullable dimensions in schema (no person types = all, no org units = all) |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sequelize | 6.9.0 | ORM for MySQL - schema changes, new models, queries | Already used for all DB access |
| next-auth | 3.29.10 | JWT session management - embed scope data | Already manages auth flow |
| jose | (bundled) | JWT decode in Edge middleware - read scope from token | Already used in middleware.ts |
| react-bootstrap | 2.x | Form components, Collapse for conditional sections | Already used in AddUser form |
| @mui/material Autocomplete | 5.x | Multi-select dropdowns for person types and departments | Already used in AddUser for departments |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-toastify | (installed) | Toast messages for scope denial feedback | Scope denial user feedback |
| @mui/icons-material | 5.x | Curate icon for in-scope indicator in search results | Search results scope indicator |

### No New Dependencies Required
This phase requires NO new npm packages. All functionality can be built with existing dependencies.

## Architecture Patterns

### Recommended Project Structure (new/modified files)
```
src/
  db/models/
    AdminUsersPersonType.ts          # NEW: junction table for person type scope
  utils/
    constants.js                     # MODIFY: extend getCapabilities() with scoped curation
    scopeResolver.ts                 # NEW: isPersonInScope() helper (isomorphic)
  middleware.ts                      # MODIFY: add scope checks for /curate/* and /manageprofile/*
  pages/
    api/auth/[...nextauth].jsx       # MODIFY: embed scope data in JWT
    api/db/users/persontypes/index.ts  # EXISTS: already returns distinct person types
    manageprofile/[userId].tsx        # NEW: port from master (commit 544c0f2)
  components/elements/
    ManageProfile/                   # NEW: port from master (commit 544c0f2)
    AddUser/AddUser.tsx              # MODIFY: conditional Curation Scope section
    Search/Search.js                 # MODIFY: scope checkbox filter, curate icon
    Manage/ManageUsers.tsx           # MODIFY: role filter dropdown, scope display in table
    Manage/UsersTable.tsx            # MODIFY: show scope inline in roles column
    Navbar/SideNavbar.tsx            # MODIFY: scope label under user name
controllers/
  db/
    userroles.controller.ts          # MODIFY: include scope data in findUserPermissions
    person.controller.ts             # MODIFY: scope enforcement on search
    manage-users/user.controller.ts  # MODIFY: persist person type scope assignments
    manage-profile/                  # NEW: port from master (commit 544c0f2)
```

### Pattern 1: Scope Data in JWT
**What:** Embed scope data (personTypes array, orgUnits array) in the JWT token at login time, alongside existing userRoles.
**When to use:** Every scope check reads from JWT -- no additional DB queries needed at runtime.
**Implementation:**

The JWT callback in `[...nextauth].jsx` already stores `userRoles`. Extend it to also store scope data:

```typescript
// In JWT callback
if (apiResponse.userRoles) {
    token.userRoles = apiResponse.userRoles;
}
// NEW: Add scope data
if (apiResponse.scopeData) {
    token.scopeData = apiResponse.scopeData;
    // scopeData = { personTypes: string[] | null, orgUnits: string[] | null }
}
```

The `findUserPermissions()` in `userroles.controller.ts` must be extended to query scope data alongside roles. A separate query joins `admin_users_person_types` and `admin_users_departments` for users with Curator_Scoped role.

**JWT Size Consideration:** Scope data is small arrays of strings (typically 1-5 items each). JWT size increase is negligible. The token is stored in an HTTP-only cookie; Next.js/next-auth default cookie size limit is 4KB which is more than sufficient.

### Pattern 2: Centralized Scope Resolution (isPersonInScope)
**What:** A single pure function that determines if a given person matches a curator's scope.
**When to use:** Called by Edge middleware, API routes, and React components.

```typescript
// src/utils/scopeResolver.ts
interface ScopeData {
    personTypes: string[] | null;  // null = no restriction
    orgUnits: string[] | null;     // null = no restriction
}

/**
 * Check if a person matches the curator's scope.
 * AND across dimensions (person type AND org unit), OR within each dimension.
 * null dimension = no restriction on that axis.
 */
export function isPersonInScope(
    scope: ScopeData,
    personOrgUnit: string | null,
    personPersonTypes: string[]
): boolean {
    // No scope restrictions = matches everything (shouldn't happen for Curator_Scoped, but safety)
    if (!scope.personTypes && !scope.orgUnits) return true;

    // Check person type dimension (if restricted)
    if (scope.personTypes && scope.personTypes.length > 0) {
        // Person must have at least one matching person type
        const hasMatchingType = personPersonTypes.some(pt =>
            scope.personTypes.includes(pt)
        );
        if (!hasMatchingType) return false;
    }

    // Check org unit dimension (if restricted)
    if (scope.orgUnits && scope.orgUnits.length > 0) {
        if (!personOrgUnit || !scope.orgUnits.includes(personOrgUnit)) {
            return false;
        }
    }

    return true;
}
```

**Edge middleware limitation:** The middleware can only decode the JWT (scope data) and the person ID from the URL. It cannot query the database to get the person's org unit or person types. Two approaches:

1. **Middleware does basic role check; API does full scope check.** Middleware allows Curator_Scoped to access `/curate/*` but the API route (or page component on mount) verifies the specific person is in scope, redirecting if not.
2. **Middleware queries person data via internal API call.** This adds latency to every request.

**Recommendation:** Approach 1. Middleware ensures only users with curation capability (all, self, or scoped) can reach `/curate/*`. The CurateIndividual component and the userfeedback API routes perform the full scope check, which requires person type data from the database.

### Pattern 3: Extended Capability Model
**What:** Extend `getCapabilities()` to include scoped curation.
**When to use:** Everywhere capabilities are checked.

```javascript
// canCurate extended shape:
canCurate: {
    all: false,
    self: false,
    scoped: false,        // NEW
    personIdentifier: null,
    scopeData: null       // NEW: { personTypes: string[]|null, orgUnits: string[]|null }
}
```

ROLE_CAPABILITIES gets a new entry:
```javascript
Curator_Scoped: {
    canCurate: { scoped: true },
    canReport: false,
    canSearch: true,
    canManageUsers: false,
    canConfigure: false,
}
```

The getCapabilities merge logic already uses OR across roles. Adding `scoped: true` follows the same pattern. The scope data itself comes from the JWT (not from the role capabilities map).

### Pattern 4: Conditional Form Section in AddUser
**What:** When Curator_Scoped is selected in the roles Autocomplete, a "Curation Scope" section appears below.
**When to use:** AddUser/Edit user form.

```tsx
// React state tracks whether Curator_Scoped is selected
const hasScopedRole = selectedRoles.includes('Curator_Scoped');

// In JSX, conditionally show scope section
{hasScopedRole && (
    <div className="mt-3 p-3 border rounded">
        <h6>Curation Scope</h6>
        <Form.Group>
            <Form.Label>Person Types</Form.Label>
            <Autocomplete multiple options={personTypeOptions} ... />
        </Form.Group>
        <Form.Group>
            <Form.Label>Organizational Units</Form.Label>
            <Autocomplete multiple options={departmentOptions} ... />
        </Form.Group>
    </div>
)}
```

The existing departments Autocomplete moves INTO this section when Curator_Scoped is active.

### Anti-Patterns to Avoid
- **Querying the database in Edge middleware:** Middleware runs at the edge and should only decode JWTs. Put DB-dependent scope checks in API routes or page-level `getServerSideProps`.
- **Duplicating scope logic:** There must be ONE `isPersonInScope()` function. Do not inline scope checking in multiple files.
- **Modifying existing role behavior:** Curator_All, Curator_Self, and Superuser must work EXACTLY as before. All new scope logic should be additive, gated behind `canCurate.scoped === true`.
- **Storing scope as JSON in admin_users:** This would bypass relational integrity. Use proper junction tables.
- **Client-side-only enforcement:** Scope MUST be enforced server-side (API routes). Client-side UI changes are for UX only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-select dropdowns | Custom select component | MUI Autocomplete (already used for departments) | Accessibility, search, chip display built-in |
| JWT parsing in middleware | Manual JWT parsing | jose.decodeJwt() (already used) | Handles edge cases, security-reviewed |
| Form validation for scope | Custom validation from scratch | Extend existing checkFormValidations() pattern | Consistency with AddUser form |
| Database transactions | Manual query sequencing | Sequelize transactions (already used in createOrUpdateAdminUser) | Atomicity for scope + role saves |
| Toast notifications | Custom notification system | react-toastify toast.error/success (already used) | Consistent UX |

## Common Pitfalls

### Pitfall 1: Org Unit Naming Mismatch
**What goes wrong:** `admin_departments.departmentLabel` values may not exactly match `person.primaryOrganizationalUnit` values. The CONTEXT.md says "Departments field IS the org unit scope" but these are different database tables with potentially different values.
**Why it happens:** The `admin_departments` table is manually maintained while `person.primaryOrganizationalUnit` comes from ReCiter identity data.
**How to avoid:** The scope matching for org units should use the `admin_departments.departmentLabel` values stored in the user's scope. The `findAll` query in `person.controller.ts` already filters by `primaryOrganizationalUnit` using `Op.in`. For scope enforcement, use the same approach: compare the person's `primaryOrganizationalUnit` against the scope's org unit list. The admin will need to ensure department labels match org unit names. Alternatively, if they don't match, a lookup mapping could be added, but the CONTEXT.md implies they should match.
**Warning signs:** During testing, a person with `primaryOrganizationalUnit = "Surgery"` doesn't match a scope with `departmentLabel = "Department of Surgery"`.

### Pitfall 2: Person With No Person Types
**What goes wrong:** If a person has no entries in `person_person_type`, a scope filter that requires specific person types will exclude them even if they match on org unit.
**Why it happens:** Not all people have person types assigned.
**How to avoid:** The AND logic means both dimensions must match. If the scope has person types AND the person has zero person types in the junction table, they fail the person type check. This is arguably correct behavior (unknown person type = not in scope). However, if the scope is org-unit-only (personTypes = null), the person SHOULD match. Document this edge case clearly and test it.
**Warning signs:** People disappearing from scoped curator's view when they have no person_person_type rows.

### Pitfall 3: JWT Cookie Size Limit
**What goes wrong:** Adding too much scope data to the JWT could exceed cookie size limits.
**Why it happens:** Browser cookies are typically limited to 4KB. next-auth v3 stores the entire JWT in a single cookie.
**How to avoid:** Keep scope data minimal: arrays of short strings. Typical scope is 1-5 person types and 1-5 org units. If a scope grows large, next-auth v3 can chunk cookies, but this shouldn't be necessary. Monitor JWT size during development.
**Warning signs:** Authentication failures or missing cookies in production.

### Pitfall 4: Middleware Cannot Do Full Scope Checks
**What goes wrong:** Attempting to query the database from Edge middleware to check if a specific person is in scope.
**Why it happens:** Edge middleware in Next.js 12 runs in a limited runtime (no Node.js APIs, no database connections).
**How to avoid:** Middleware only checks role-level access (does user have any curation capability?). Person-specific scope checks happen in the CurateIndividual component on mount and in API routes server-side. Use a two-tier enforcement: middleware gates the route category, API gates the specific person.
**Warning signs:** Import errors when trying to use Sequelize in middleware.ts.

### Pitfall 5: Breaking Existing Curator_All Behavior
**What goes wrong:** Adding scope checks that accidentally affect Curator_All users (who should have unrestricted access).
**Why it happens:** Overly broad scope enforcement that doesn't properly short-circuit for non-scoped roles.
**How to avoid:** Always check `canCurate.all` first. If true, skip all scope logic. Only apply scope checks when `canCurate.scoped` is true and `canCurate.all` is false.
**Warning signs:** Curator_All users seeing scope checkbox or being unable to curate certain people.

### Pitfall 6: Mutually Exclusive Role Validation Only Client-Side
**What goes wrong:** The AddUser form prevents selecting both Curator_All and Curator_Scoped, but the API doesn't validate this constraint.
**Why it happens:** Forgetting server-side validation that mirrors frontend validation.
**How to avoid:** Add validation in `createOrUpdateAdminUser` controller: if selectedRoleIds includes both Curator_All and Curator_Scoped roleIDs, return 400 error.
**Warning signs:** Database containing users with both Curator_All and Curator_Scoped roles, causing undefined behavior.

### Pitfall 7: Scope Filter Checkbox State Not Persisting
**What goes wrong:** The "Show only people I can curate" checkbox resets when paginating or applying other filters.
**Why it happens:** Local state not properly threaded through filter/pagination flow.
**How to avoid:** Store the scope filter state in Redux alongside existing filters, or as a query parameter. The existing filter architecture dispatches `updateFilters(updatedFilters)` -- add a `showOnlyScopeFiltered` flag to this.
**Warning signs:** Checkbox unchecking itself after pagination or search updates.

## Code Examples

### Database Schema: New Table for Person Type Scope

```sql
-- New junction table: admin_users_person_types
CREATE TABLE admin_users_person_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userID INT,
    personType VARCHAR(128),
    createTimestamp DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
    modifyTimestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_userID (userID),
    INDEX idx_personType (personType),
    FOREIGN KEY (userID) REFERENCES admin_users(userID)
);

-- Insert new role into admin_roles
INSERT INTO admin_roles (roleLabel, createTimestamp) VALUES ('Curator_Scoped', NOW());
```

**Why a new table instead of extending admin_users_roles:** The `admin_users_roles` table has a clean (userID, roleID) structure. Adding nullable scope columns would violate its purpose as a role junction. A separate `admin_users_person_types` table keeps the schema clean and allows multiple person types per user. The existing `admin_users_departments` table already serves as the org unit junction -- reuse it as-is.

### Sequelize Model: AdminUsersPersonType

```typescript
// src/db/models/AdminUsersPersonType.ts
import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AdminUsersPersonTypeAttributes {
    id: number;
    userID?: number;
    personType?: string;
    createTimestamp: Date;
    modifyTimestamp: Date;
}

export type AdminUsersPersonTypePk = "id";
export type AdminUsersPersonTypeCreationAttributes = Optional<AdminUsersPersonTypeAttributes, "id" | "userID" | "personType" | "createTimestamp" | "modifyTimestamp">;

export class AdminUsersPersonType extends Model<AdminUsersPersonTypeAttributes, AdminUsersPersonTypeCreationAttributes> {
    id!: number;
    userID?: number;
    personType?: string;
    createTimestamp!: Date;
    modifyTimestamp!: Date;

    static initModel(sequelize: Sequelize.Sequelize): typeof AdminUsersPersonType {
        AdminUsersPersonType.init({
            id: {
                autoIncrement: true,
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true
            },
            userID: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'admin_users', key: 'userID' }
            },
            personType: {
                type: DataTypes.STRING(128),
                allowNull: true
            },
            createTimestamp: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: "0000-00-00 00:00:00"
            },
            modifyTimestamp: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.Sequelize.fn('current_timestamp')
            }
        }, {
            sequelize,
            tableName: 'admin_users_person_types',
            timestamps: false,
            indexes: [
                { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "id" }] },
                { name: "idx_userID", using: "BTREE", fields: [{ name: "userID" }] },
                { name: "idx_personType", using: "BTREE", fields: [{ name: "personType" }] },
            ]
        });
        return AdminUsersPersonType;
    }
}
```

### Extended findUserPermissions Query

```typescript
// controllers/db/userroles.controller.ts -- extended
export const findUserPermissions = async (attrValue: string, attrType: string) => {
    try {
        // Existing: get roles
        const whereClause = attrType === "email"
            ? "au.email = :value"
            : "au.personIdentifier = :value";

        const userRolesList = await sequelize.query(
            `SELECT au.personIdentifier, ar.roleLabel
             FROM admin_users au
             INNER JOIN admin_users_roles aur ON au.userID = aur.userID
             INNER JOIN admin_roles ar ON aur.roleID = ar.roleID
             WHERE ${whereClause}`,
            { replacements: { value: attrValue }, nest: true, raw: true }
        );

        // NEW: if user has Curator_Scoped role, also fetch scope data
        const hasScoped = userRolesList.some(r => r.roleLabel === 'Curator_Scoped');
        let scopeData = null;

        if (hasScoped) {
            const userIdResult = await sequelize.query(
                `SELECT userID FROM admin_users WHERE ${whereClause}`,
                { replacements: { value: attrValue }, raw: true }
            );
            const userID = userIdResult[0]?.[0]?.userID;

            if (userID) {
                const personTypes = await sequelize.query(
                    `SELECT personType FROM admin_users_person_types WHERE userID = :userID`,
                    { replacements: { userID }, raw: true }
                );
                const departments = await sequelize.query(
                    `SELECT ad.departmentLabel FROM admin_users_departments aud
                     INNER JOIN admin_departments ad ON aud.departmentID = ad.departmentID
                     WHERE aud.userID = :userID`,
                    { replacements: { userID }, raw: true }
                );

                scopeData = {
                    personTypes: personTypes[0]?.length > 0
                        ? personTypes[0].map(r => r.personType) : null,
                    orgUnits: departments[0]?.length > 0
                        ? departments[0].map(r => r.departmentLabel) : null,
                };
            }
        }

        return JSON.stringify({ roles: userRolesList, scopeData });
    } catch (e) {
        console.log(e);
    }
};
```

**Note:** This changes the return format from a simple roles array to `{ roles, scopeData }`. The JWT callback and all consumers of `findUserPermissions` must be updated accordingly.

### Scope Check in API Route (userfeedback save)

```typescript
// src/pages/api/reciter/save/userfeedback/[uid].ts -- scope enforcement
import { getToken } from 'next-auth/jwt'; // next-auth v3 compatible
import { isPersonInScope } from '../../../../../../utils/scopeResolver';

// Inside handler, after auth check:
const token = await getToken({ req, secret: reciterConfig.tokenSecret });
const caps = getCapabilities(JSON.parse(token.userRoles));

if (caps.canCurate.scoped && !caps.canCurate.all) {
    // Need to check if target person is in scope
    const personData = await getPersonWithTypes(uid as string);
    const inScope = isPersonInScope(
        caps.canCurate.scopeData,
        personData.primaryOrganizationalUnit,
        personData.personTypes
    );
    if (!inScope) {
        console.log('[AUTH] DENY: Scoped curator', token.username, 'tried to save feedback for', uid, '-- not in scope');
        return res.status(403).json({ error: 'Person not in curation scope' });
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Role-count comparison for access | Capability-based checks via getCapabilities() | Phase 1 (2026-03-16) | All access checks use capabilities now |
| Hardcoded role checks in components | Isomorphic capability resolver | Phase 1 (2026-03-16) | Single source of truth for role interpretation |
| No UI audit patterns | PATTERNS.md design reference | Phase 2 (2026-03-17) | All new UI follows audit patterns |
| react-bootstrap + MUI mixed approach | react-bootstrap for forms/layout, MUI for icons only | Phase 2 (2026-03-17) | Consistent component library usage |

## Open Questions

1. **Org Unit Value Matching**
   - What we know: `admin_departments.departmentLabel` stores department names. `person.primaryOrganizationalUnit` stores org unit names. The CONTEXT.md says they are "the same concept, merged."
   - What's unclear: Whether the actual string values in these two columns always match exactly (e.g., "Surgery" vs "Department of Surgery").
   - Recommendation: During implementation, query both tables to compare distinct values. If they don't match exactly, document the mapping needed. For the initial implementation, assume exact string matching (consistent with how `findAll` already filters by orgUnits using `Op.in`).

2. **Person Type Scope on Curation API Routes**
   - What we know: The userfeedback save and goldstandard API routes need scope enforcement. These routes receive a person identifier (uid) but not the person's types.
   - What's unclear: The most efficient way to look up a person's types for scope checking without adding excessive DB queries.
   - Recommendation: Create a lightweight `getPersonWithTypes(uid)` helper that queries person + person_person_type in a single Sequelize query. Cache it per request if multiple scope checks are needed.

3. **Managing Profile Page Integration**
   - What we know: 5 files from commit 544c0f2 on master need to be ported. The controller queries `PersonArticleAuthor` for ORCID data.
   - What's unclear: Whether the ported code needs modifications beyond scope gating (it was written for master which has different patterns).
   - Recommendation: Port the files first, then add scope enforcement. The controller, component, and page structure look compatible with dev_v2 conventions. Minor adjustments may be needed for import paths.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 27.5.1 + @testing-library/react 12.1.5 |
| Config file | `jest.config.js` (uses next/jest) |
| Quick run command | `npx jest --testPathPattern="<specific-test>" --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCOPE-01 | Curator_Scoped role recognized by getCapabilities() | unit | `npx jest --testPathPattern="constants" --no-coverage` | Wave 0 |
| SCOPE-02 | Scope filter applies correct WHERE clauses to person search | unit | `npx jest --testPathPattern="scopeResolver" --no-coverage` | Wave 0 |
| SCOPE-03 | isPersonInScope correctly evaluates AND/OR logic | unit | `npx jest --testPathPattern="scopeResolver" --no-coverage` | Wave 0 |
| SCOPE-04 | AddUser form shows scope fields when Curator_Scoped selected | unit | `npx jest --testPathPattern="AddUser" --no-coverage` | Wave 0 |
| SCOPE-05 | Departments move into scope section when Curator_Scoped active | unit | `npx jest --testPathPattern="AddUser" --no-coverage` | Wave 0 |
| SCOPE-06 | Null dimension = no restriction (all match) | unit | `npx jest --testPathPattern="scopeResolver" --no-coverage` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern="<changed-module>" --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/utils/scopeResolver.test.ts` -- covers SCOPE-02, SCOPE-03, SCOPE-06 (isPersonInScope logic)
- [ ] `__tests__/utils/constants-scoped.test.ts` -- covers SCOPE-01 (getCapabilities with Curator_Scoped)
- [ ] `__tests__/components/AddUser.test.tsx` -- covers SCOPE-04, SCOPE-05 (conditional scope fields)

*(Existing tests: Search.test.tsx, Pagination.test.tsx, Tabs.test.tsx, Publication.test.tsx -- these cover existing functionality but not scope-specific features)*

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct examination of all files listed in CONTEXT.md canonical refs
  - `src/utils/constants.js` (lines 70-167) -- getCapabilities(), ROLE_CAPABILITIES, getLandingPage()
  - `src/middleware.ts` (full file) -- Edge middleware pattern, jose JWT decode, route matching
  - `src/pages/api/auth/[...nextauth].jsx` (full file) -- JWT callback, findUserPermissions integration
  - `controllers/db/userroles.controller.ts` (full file) -- SQL query pattern for role fetching
  - `controllers/db/person.controller.ts` (full file) -- findAll() with personType/orgUnit filtering
  - `controllers/db/manage-users/user.controller.ts` (full file) -- createOrUpdateAdminUser with transaction pattern
  - `src/db/models/AdminUsersRole.ts` -- junction table model pattern
  - `src/db/models/AdminUsersDepartment.ts` -- department junction pattern (reusable)
  - `src/db/models/PersonPersonType.ts` -- person type data model
  - `src/db/models/AdminRole.ts` -- role definition model
  - `src/db/models/Person.ts` -- primaryOrganizationalUnit field
  - `src/db/models/init-models.ts` -- model registration and association pattern
  - `src/components/elements/AddUser/AddUser.tsx` (full file) -- form pattern, Autocomplete usage
  - `src/components/elements/Search/Search.js` (full file) -- filter/pagination/role-based UI
  - `src/components/elements/Manage/ManageUsers.tsx` (full file) -- admin user listing
  - `src/components/elements/Manage/UsersTable.tsx` (full file) -- user table display
  - `src/components/elements/Navbar/SideNavbar.tsx` (full file) -- capability-based menu rendering
  - `controllers/db/persontype.controller.ts` -- existing person type query
  - `src/pages/api/db/users/persontypes/index.ts` -- existing person type API route
  - `git show 544c0f2 --stat` -- manage profile files to port (5 files, 267 lines)
  - `jest.config.js` -- test framework configuration

### Secondary (MEDIUM confidence)
- `.planning/phases/01-search-result-filtering/01-CONTEXT.md` (referenced) -- Phase 1 capability model design decisions
- `.planning/phases/02-ui-ux-audit/02-CONTEXT.md` (referenced) -- Phase 2 UI pattern decisions
- `.planning/codebase/CONVENTIONS.md` -- naming and code style patterns
- `.planning/codebase/ARCHITECTURE.md` -- layer structure and data flow
- `.planning/codebase/STRUCTURE.md` -- directory layout conventions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- patterns directly extend existing code (getCapabilities, middleware, junction tables)
- Pitfalls: HIGH -- identified from direct codebase analysis of data model relationships and framework constraints
- Schema design: HIGH -- follows exact same patterns as existing admin_users_roles and admin_users_departments
- Scope resolution logic: HIGH -- AND/OR combination logic is well-defined in CONTEXT.md
- Manage Profile port: MEDIUM -- commit exists and files reviewed, but minor integration adjustments may be needed

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable -- internal application, no external dependency changes)
