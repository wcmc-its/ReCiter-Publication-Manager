# Phase 4: Curation Proxy - Research

**Researched:** 2026-03-17
**Domain:** Many-to-many proxy assignment system (database schema, JWT extension, search/curate UI, access control)
**Confidence:** HIGH

## Summary

Phase 4 adds a curation proxy system allowing Curator_Scoped users to be assigned as proxies for specific individuals beyond their normal scope. This is an additive layer on top of the Phase 3 scope system -- proxy assignments grant curation + profile management access for specific person table entries. The architecture follows established patterns from Phase 3 (scope data in JWT, access checks combining scope OR proxy, Manage Users form sections, search result badges/filtering).

The implementation requires a new `admin_users_proxy` junction table (userID -> personIdentifier many-to-many), a new Sequelize model, JWT extension with `proxyPersonIds`, expanded `canCuratePerson()` logic (`isPersonInScope OR isProxyFor`), a Proxy Assignments section in AddUser form, a Grant Proxy modal on the curation page, [PROXY] badge in search results and curation page, expanded scope filter to include proxy matches, proxy count column in UsersTable, and extended ScopeLabel with proxy count.

**Primary recommendation:** Follow the Phase 3 pattern exactly -- junction table, Sequelize model, embed data in JWT at login, expand existing access checks with OR logic, reuse CurationScopeSection component pattern for the new Proxy Assignments form section.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New "Proxy Assignments" section in AddUser/EditUser form, below Curation Scope section
- Section only visible when user has a curation role (Curator_All, Curator_Scoped, or Curator_Self) -- but in practice, proxy is only meaningful for Curator_Scoped
- Autocomplete multi-select to search and pick people from the full person table (~4000 people), not just admin_users
- Display format: "Smith, John (jhs2001) - Medicine"
- Removing a proxy chip and saving -- no confirmation dialog needed
- UsersTable shows proxy count column: "3 people" / "1 person" / "--"
- "Grant Proxy Access" button near the person's profile card on the curation page
- Clicking opens a modal to search/select which users to add as proxies for this person
- Modal searches admin_users with curation roles (the proxy assignees, not targets)
- Visible to any curator who can curate that person
- [PROXY] badge: teal/cyan colored pill badge next to person's name in search results
- Existing "Show only people I can curate" checkbox EXPANDED to include proxy assignments -- no separate proxy checkbox
- One filter concept: "people I can curate" = scope matches + proxy assignments (OR logic)
- Same curate icon (EditOutlined) for both proxied and in-scope people -- badge is the differentiator
- Clicking a proxied person goes straight to /curate/:id (no confirmation step)
- Extend existing scope label to include proxy count: "Curating: Faculty, Surgery + 3 proxied people"
- Subtle [PROXY] badge next to person's name on the curation page (consistent with search badge)
- Proxy access grants both curation AND profile management access
- Access check: canCuratePerson(user, personId) = isPersonInScope(user, person) OR isProxyFor(user, personId)
- Direct URL navigation to /curate/:id works for proxied people -- proxy overrides scope check
- Same denied access behavior for non-proxy/non-scope: redirect to /search + toast
- Existing admin_feedbacklog schema is sufficient -- no new columns needed
- userID records the proxy user, personIdentifier records whose publications are being curated
- Proxy assignments are for Curator_Scoped users only in practice (but form visible for all curation roles)
- Proxy targets: any person in the person table (not limited to admin_users)
- Overlap allowed without warning (proxy + scope for same person is harmless)
- No hard limit on proxy count per user
- Proxy personIdentifier list embedded in JWT alongside scope data (proxyPersonIds array)
- Changes take effect on next login

### Claude's Discretion
- Database table design (new admin_users_proxy junction table vs extending existing tables)
- Exact autocomplete search implementation (debounce, minimum characters, result limit)
- Grant Proxy modal component structure and state management
- Toast message wording for proxy-related actions
- Error handling for edge cases (deleted person, removed proxy mid-session)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROXY-01 | Superuser can assign one user as a curation proxy for another user from the Manage Users page | New admin_users_proxy table + AddUser ProxyAssignmentsSection + createOrUpdateAdminUser extension |
| PROXY-02 | Curators with existing curation privileges can grant proxy access from the individual curation page | Grant Proxy button + modal on CurateIndividual + new API endpoint for proxy CRUD |
| PROXY-03 | Proxy relationships are many-to-many (a user can proxy for multiple people, a person can have multiple proxies) | Junction table admin_users_proxy(userID, personIdentifier) with no uniqueness constraint on either side alone |
| PROXY-04 | Proxied users display with a [PROXY] badge in Find People search results for the proxy user | ProxyBadge component in Search.js, client-side check against proxyPersonIds from session |
| PROXY-05 | Proxy user can filter search results to show only their proxied users via a checkbox filter | Expand existing ScopeFilterCheckbox + scope filter logic to include proxy personIdentifiers |
| PROXY-06 | Proxy user can navigate to and curate publications on behalf of their proxied users | Middleware allows route access, curate page scope check expanded with isProxyFor, feedbacklog records proxy userID |
</phase_requirements>

## Standard Stack

### Core (already in project -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Sequelize | 6.9.0 | ORM for new admin_users_proxy table | Already used for all DB models |
| @mui/material (Autocomplete) | 5.x | Person search autocomplete in proxy form section | Already used for departments/person types autocomplete |
| react-bootstrap (Form, Collapse, Badge) | 1.6.x | Form sections, badge display | Already used for all form components |
| jose | 4.x | JWT decode in Edge middleware | Already used for JWT in middleware |
| next-auth | 3.29.10 | JWT callback extension for proxyPersonIds | Already used for auth flow |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-toastify | existing | Toast messages for proxy actions | Success/error feedback |
| @mui/icons-material | existing | EditOutlined for curate icon | Already in search results |

**No new npm packages required.** All UI components use existing MUI Autocomplete, react-bootstrap Form/Badge, and established patterns.

## Architecture Patterns

### Recommended Changes by Layer

```
Database Layer
  src/db/models/AdminUsersProxy.ts           # NEW: junction table model
  src/db/models/init-models.ts               # MODIFY: register model + associations

API Layer
  controllers/db/manage-users/user.controller.ts  # MODIFY: persist proxy assignments
  controllers/db/userroles.controller.ts          # MODIFY: query proxy table for JWT
  controllers/db/person.controller.ts             # MODIFY: include proxy matches in search
  src/pages/api/db/admin/proxy/                   # NEW: proxy CRUD endpoints
  src/pages/api/db/admin/proxy/index.ts           # NEW: list/save proxy assignments
  src/pages/api/db/admin/proxy/grant.ts           # NEW: grant proxy from curation page

Auth/Middleware Layer
  src/pages/api/auth/[...nextauth].jsx        # MODIFY: embed proxyPersonIds in JWT
  src/middleware.ts                            # NO CHANGE (already allows scoped curators)
  src/pages/curate/[id].js                    # MODIFY: expand scope check with proxy check
  src/pages/manageprofile/[userId].tsx         # MODIFY: expand scope check with proxy check

Frontend Components
  src/components/elements/AddUser/AddUser.tsx                    # MODIFY: add ProxyAssignmentsSection
  src/components/elements/AddUser/ProxyAssignmentsSection.tsx    # NEW: proxy person autocomplete
  src/components/elements/Manage/UsersTable.tsx                  # MODIFY: proxy count column
  src/components/elements/Search/Search.js                       # MODIFY: [PROXY] badge + expand filter
  src/components/elements/Search/ProxyBadge.tsx                  # NEW: teal pill badge component
  src/components/elements/CurateIndividual/CurateIndividual.tsx  # MODIFY: Grant Proxy button + badge
  src/components/elements/CurateIndividual/GrantProxyModal.tsx   # NEW: modal for granting proxy
  src/components/elements/Navbar/ScopeLabel.tsx                  # MODIFY: add proxy count

Utils
  src/utils/constants.js                      # MODIFY: expand getCapabilities with proxyPersonIds
```

### Pattern 1: Junction Table (admin_users_proxy)

**What:** New many-to-many junction table linking admin_users.userID to person.personIdentifier
**When to use:** Stores proxy assignments
**Schema:**
```sql
CREATE TABLE admin_users_proxy (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  personIdentifier VARCHAR(128) NOT NULL,
  createTimestamp DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
  modifyTimestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_userID (userID),
  INDEX idx_personIdentifier (personIdentifier),
  UNIQUE INDEX idx_user_person (userID, personIdentifier),
  FOREIGN KEY (userID) REFERENCES admin_users(userID)
);
```

**Rationale:** Follows the exact same pattern as `admin_users_person_types` and `admin_users_departments`. The UNIQUE INDEX on (userID, personIdentifier) prevents duplicate assignments. personIdentifier references the person table but uses a logical (not FK-enforced) relationship because person table is populated by ETL from ReCiter, not this application.

### Pattern 2: JWT Extension (proxyPersonIds)

**What:** Embed proxy target personIdentifiers in JWT alongside scopeData
**When to use:** At login time, queried from admin_users_proxy
**Example:**
```javascript
// In [...nextauth].jsx JWT callback
// After parsing scopeData:
if (parsed.proxyPersonIds) {
    token.proxyPersonIds = JSON.stringify(parsed.proxyPersonIds);
}

// In middleware/components -- parse from session:
const proxyPersonIds = session?.data?.proxyPersonIds
    ? JSON.parse(session.data.proxyPersonIds)
    : [];
```

**Size consideration:** For typical proxy counts (5-20 personIdentifiers, each ~8 chars), JWT payload increase is ~100-250 bytes. Even 50 proxies adds only ~500 bytes. Well within JWT limits.

### Pattern 3: Additive Access Check (isProxyFor)

**What:** Simple array lookup -- is personId in the user's proxyPersonIds array?
**When to use:** Alongside isPersonInScope in all access checks
**Example:**
```typescript
// New utility function (can add to scopeResolver.ts or constants.js)
export function isProxyFor(proxyPersonIds: string[] | null, personId: string): boolean {
    if (!proxyPersonIds || proxyPersonIds.length === 0) return false;
    return proxyPersonIds.includes(personId);
}

// Access check pattern (used in curate page, middleware, search):
const canCurate = caps.canCurate.all ||
    (caps.canCurate.scoped && isPersonInScope(scopeData, person.orgUnit, person.personTypes)) ||
    isProxyFor(proxyPersonIds, person.personIdentifier);
```

### Pattern 4: ProxyAssignmentsSection (Manage Users form)

**What:** Conditional form section below CurationScopeSection in AddUser form
**When to use:** When user has any curation role
**Example pattern (mirrors CurationScopeSection):**
```tsx
// ProxyAssignmentsSection.tsx -- follows CurationScopeSection pattern exactly
<fieldset className={styles.proxySection}>
  <legend>Proxy Assignments</legend>
  <p className={styles.helperText}>
    Assign specific people this user can curate beyond their scope.
  </p>
  <Autocomplete
    multiple
    options={personSearchResults}
    getOptionLabel={(option) => `${option.lastName}, ${option.firstName} (${option.personIdentifier}) - ${option.primaryOrganizationalUnit}`}
    value={selectedProxies}
    onChange={(e, value) => onProxiesChange(value)}
    onInputChange={(e, value) => handleProxySearch(value)}
    renderInput={(params) => <CssTextField ... placeholder="Search people..." />}
  />
</fieldset>
```

### Pattern 5: Grant Proxy Modal (Curation page)

**What:** Modal opened from curation page to assign proxy users for the current person
**When to use:** From the "Grant Proxy Access" button near the profile card
**Note:** This searches admin_users (the proxy assignees) NOT the person table (the proxy target is already determined -- it's the person being curated)
```tsx
// GrantProxyModal.tsx
// Searches admin_users with curation roles
// Displays: "Smith, John (jhs2001)" -- admin user display
// On save: POST /api/db/admin/proxy/grant with { personIdentifier, userIds }
```

### Anti-Patterns to Avoid
- **Storing proxy data in admin_users columns:** Use a junction table, not JSON or comma-separated columns
- **Real-time proxy sync:** Proxy changes take effect on next login (consistent with scope model). Do not try to update active sessions.
- **Server-side filtering for proxy matches:** For the "Show only people I can curate" filter with proxy, send the proxyPersonIds as an additional filter parameter to the person search API rather than fetching all and filtering client-side
- **Separate proxy filter checkbox:** The decision is explicit -- expand the existing "Show only people I can curate" checkbox, not a separate control

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Person autocomplete search | Custom search/dropdown | MUI Autocomplete with async options | Debounce, keyboard nav, accessibility all built-in |
| Badge styling | Custom CSS badge | react-bootstrap Badge with custom bg color | Consistent with project patterns |
| Form section conditional display | Manual show/hide | react-bootstrap Collapse | Already used for CurationScopeSection |
| Modal | Custom modal | react-bootstrap Modal | Already used for Profile modal and History modal |

## Common Pitfalls

### Pitfall 1: JWT Size with Large Proxy Counts
**What goes wrong:** JWT becomes too large for cookie if proxy list is enormous
**Why it happens:** Each personIdentifier adds ~10 bytes to JWT
**How to avoid:** Typical counts are 5-20, max realistic is ~50. Even 100 proxies = ~1KB. Cookie limit is 4KB. Monitor but not a practical concern given the use case.
**Warning signs:** JWT > 2KB total after adding proxyPersonIds

### Pitfall 2: Person Search Autocomplete Performance
**What goes wrong:** Querying ~4000 person records on every keystroke
**Why it happens:** Autocomplete fires on each character typed
**How to avoid:** Debounce at 300ms, require minimum 2 characters before searching, LIMIT results to 20, server-side LIKE query (not client-side filter)
**Warning signs:** UI lag when typing in proxy person search

### Pitfall 3: Proxy + Scope Filter Interaction
**What goes wrong:** "Show only people I can curate" filter only returns scope matches, missing proxy targets
**Why it happens:** Server-side filter uses personTypes/orgUnits parameters but proxy targets might not match those
**How to avoid:** When scope filter is active AND user has proxies, send TWO conditions: (1) scope filter params AND (2) additional personIdentifier IN (proxyPersonIds). API combines with OR logic.
**Warning signs:** Proxy users disappearing when scope filter checkbox is checked

### Pitfall 4: Grant Proxy Modal Searching Wrong Table
**What goes wrong:** Modal searches person table instead of admin_users table
**Why it happens:** Copy-pasting from the Manage Users proxy section which searches person table
**How to avoid:** The Grant Proxy modal on the curation page assigns proxy USERS (from admin_users) to a target PERSON. It must search admin_users with curation roles, not the person table.
**Warning signs:** Modal shows all ~4000 people instead of the ~20-50 admin users

### Pitfall 5: Sequelize Association Conflicts
**What goes wrong:** Model association errors when multiple hasMany relationships exist on AdminUser
**Why it happens:** AdminUser already has 6+ hasMany associations; adding proxy needs unique alias
**How to avoid:** Use distinct alias: `AdminUser.hasMany(AdminUsersProxy, { as: 'adminUsersProxies', foreignKey: 'userID' })`. Register in init-models.ts after all other associations.
**Warning signs:** Sequelize "Association with alias X already exists" error

### Pitfall 6: Stale Proxy Data After Mid-Session Changes
**What goes wrong:** User assigned new proxy but JWT still has old proxyPersonIds
**Why it happens:** Proxy data embedded in JWT at login, changes require re-login
**How to avoid:** This is by design (consistent with scope model). Display a toast when saving proxy changes: "Changes will take effect on the user's next login."
**Warning signs:** User reports proxied person not appearing after assignment

## Code Examples

### AdminUsersProxy Sequelize Model
```typescript
// src/db/models/AdminUsersProxy.ts -- follows AdminUsersPersonType pattern
import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminUser, AdminUserId } from './AdminUser';

export interface AdminUsersProxyAttributes {
  id: number;
  userID?: number;
  personIdentifier?: string;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminUsersProxyPk = "id";
export type AdminUsersProxyId = AdminUsersProxy[AdminUsersProxyPk];
export type AdminUsersProxyOptionalAttributes = "id" | "userID" | "personIdentifier" | "createTimestamp" | "modifyTimestamp";
export type AdminUsersProxyCreationAttributes = Optional<AdminUsersProxyAttributes, AdminUsersProxyOptionalAttributes>;

export class AdminUsersProxy extends Model<AdminUsersProxyAttributes, AdminUsersProxyCreationAttributes> implements AdminUsersProxyAttributes {
  id!: number;
  userID?: number;
  personIdentifier?: string;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  user!: AdminUser;
  getUser!: Sequelize.BelongsToGetAssociationMixin<AdminUser>;
  setUser!: Sequelize.BelongsToSetAssociationMixin<AdminUser, AdminUserId>;
  createUser!: Sequelize.BelongsToCreateAssociationMixin<AdminUser>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminUsersProxy {
    AdminUsersProxy.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    userID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'adminUsers',
        key: 'userID'
      }
    },
    personIdentifier: {
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
    tableName: 'admin_users_proxy',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [{ name: "id" }]
      },
      {
        name: "idx_userID",
        using: "BTREE",
        fields: [{ name: "userID" }]
      },
      {
        name: "idx_personIdentifier",
        using: "BTREE",
        fields: [{ name: "personIdentifier" }]
      },
      {
        name: "idx_user_person",
        unique: true,
        using: "BTREE",
        fields: [{ name: "userID" }, { name: "personIdentifier" }]
      },
    ]
  });
  return AdminUsersProxy;
  }
}
```

### userroles.controller.ts Extension (Query Proxy Data)
```typescript
// In getScopeDataForUser (or new getProxyDataForUser):
async function getProxyDataForUser(userID: number) {
    const result: any = await sequelize.query(
        "SELECT personIdentifier FROM admin_users_proxy WHERE userID = :userID",
        { replacements: { userID }, raw: true }
    );
    return result[0]?.length > 0
        ? result[0].map((r: any) => r.personIdentifier)
        : [];
}

// In findUserPermissions -- add after scopeData retrieval:
const proxyPersonIds = userID ? await getProxyDataForUser(userID) : [];
return JSON.stringify({ roles: userRolesList, scopeData, proxyPersonIds });
```

### Person Search API -- Proxy Filter Extension
```typescript
// In person.controller.ts findAll() -- when scope+proxy filter is active:
// New filter parameter: proxyPersonIds (array of personIdentifiers)
if (apiBody.filters?.proxyPersonIds && apiBody.filters.proxyPersonIds.length > 0) {
    // If scope filters also present, combine with OR:
    // (person matches scope) OR (person.personIdentifier IN proxyPersonIds)
    const scopeConditions = [...(where[Op.and] || [])];
    where[Op.and] = [{
        [Op.or]: [
            ...(scopeConditions.length > 0 ? [{ [Op.and]: scopeConditions }] : []),
            { '$Person.personIdentifier$': { [Op.in]: apiBody.filters.proxyPersonIds } }
        ]
    }];
}
```

### ProxyBadge Component
```tsx
// src/components/elements/Search/ProxyBadge.tsx
import React from 'react';
import Badge from 'react-bootstrap/Badge';

const ProxyBadge: React.FC = () => (
  <Badge
    pill
    style={{
      backgroundColor: '#17a2b8',
      color: '#fff',
      fontSize: '10px',
      fontWeight: 600,
      marginLeft: '6px',
      verticalAlign: 'middle',
    }}
  >
    PROXY
  </Badge>
);

export default ProxyBadge;
```

### isProxyFor Utility
```typescript
// Add to src/utils/scopeResolver.ts
export function isProxyFor(
  proxyPersonIds: string[] | null,
  personIdentifier: string
): boolean {
  if (!proxyPersonIds || proxyPersonIds.length === 0) return false;
  return proxyPersonIds.includes(personIdentifier);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Role-count middleware | Capability-based checks | Phase 1 | Proxy extends canCurate capability |
| No scope restrictions | Scope data in JWT | Phase 3 | Proxy data follows same JWT pattern |
| Single role for access | Scope + proxy layered | Phase 4 | Access = scope OR proxy |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 27.5.1 + @testing-library/react 12.1.5 |
| Config file | `jest.config.js` (next/jest based) |
| Quick run command | `npm test -- --testPathPattern=proxy -x` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROXY-01 | Superuser assigns proxy from Manage Users | unit | `npm test -- __tests__/utils/proxy.test.ts -x` | No -- Wave 0 |
| PROXY-02 | Curator grants proxy from curation page | manual-only | Manual: open curation page, click Grant Proxy, save | N/A |
| PROXY-03 | Many-to-many proxy relationships | unit | `npm test -- __tests__/utils/proxy.test.ts -x` | No -- Wave 0 |
| PROXY-04 | [PROXY] badge in search results | unit | `npm test -- __tests__/components/Search.test.tsx -x` | Yes (extend) |
| PROXY-05 | Scope filter includes proxy users | unit | `npm test -- __tests__/utils/proxy.test.ts -x` | No -- Wave 0 |
| PROXY-06 | Proxy user can curate on behalf | unit | `npm test -- __tests__/utils/proxy.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=proxy -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/utils/proxy.test.ts` -- covers isProxyFor utility, proxy-aware access checks (PROXY-01, PROXY-03, PROXY-05, PROXY-06)
- [ ] Extend `__tests__/components/Search.test.tsx` -- proxy badge rendering (PROXY-04)
- [ ] Extend `__tests__/utils/constants-scoped.test.ts` -- getCapabilities with proxyPersonIds

## Open Questions

1. **Person autocomplete debounce timing**
   - What we know: MUI Autocomplete supports onInputChange with debounce
   - What's unclear: Optimal debounce delay for ~4000 person records
   - Recommendation: Start with 300ms debounce, 2-char minimum, LIMIT 20 results. Adjust if needed.

2. **Grant Proxy modal -- concurrent editing**
   - What we know: Multiple curators could grant proxy access to the same person simultaneously
   - What's unclear: Whether race conditions matter
   - Recommendation: Unlikely in practice (admin action). Use simple replace-all pattern (delete + insert in transaction), same as scope assignments.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All source files listed in CONTEXT.md canonical references -- read and verified
- Phase 3 implementation: CurationScopeSection, scopeResolver, JWT callback, middleware -- verified patterns to replicate
- AdminUsersPersonType model -- verified template for new AdminUsersProxy model
- person.controller.ts findAll() -- verified filter extension pattern
- userroles.controller.ts -- verified JWT data query pattern

### Secondary (MEDIUM confidence)
- Sequelize 6.9.0 documentation -- bulkCreate, destroy, findAndCountAll with associations
- MUI Autocomplete -- async search with debounce pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns established in Phase 3
- Architecture: HIGH -- direct extension of existing scope system
- Pitfalls: HIGH -- identified from Phase 3 implementation experience and codebase analysis
- Database design: HIGH -- follows AdminUsersPersonType pattern exactly

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable -- internal patterns, no external dependency changes)
