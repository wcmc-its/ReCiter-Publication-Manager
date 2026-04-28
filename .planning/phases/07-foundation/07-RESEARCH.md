# Phase 7: Foundation - Research

**Researched:** 2026-03-18
**Domain:** Sequelize model extension (JSON columns), TypeScript utility porting, constants merging, MariaDB DDL
**Confidence:** HIGH

## Summary

Phase 7 lays the data layer foundation for the v1.1 feature port. Instead of creating new junction tables (the v1.0 approach), the user decided to add three JSON columns to the existing `admin_users` table: `scope_person_types`, `scope_org_units`, and `proxy_person_ids`. This simplifies the schema and eliminates the need for new Sequelize models (AdminUsersPersonType/AdminUsersProxy). The work involves: (1) extending the AdminUser Sequelize model with three JSON attributes, (2) copying scopeResolver.ts verbatim from dev_v2, (3) merging capability constants (Curator_Scoped, ROLE_CAPABILITIES, getCapabilities, getLandingPage) into the NextJS14 branch's constants.js, and (4) writing and applying an ALTER TABLE DDL script.

The primary technical risk is the MariaDB JSON column behavior: the database is MariaDB (not MySQL), but Sequelize connects via the `mysql` dialect. MariaDB stores JSON as `LONGTEXT` with a `JSON_VALID` check constraint, and Sequelize's `DataTypes.JSON` with the `mysql` dialect may return raw strings instead of parsed objects. This is a known issue but is manageable since the existing `AdminSettings` model already uses `DataTypes.JSON` successfully on this stack.

**Primary recommendation:** Extend AdminUser.ts with three `DataTypes.JSON` attributes (matching the AdminSettings pattern), copy scopeResolver.ts verbatim, merge constant additions into the NextJS14 version of constants.js (preserving NextJS14-specific functions), and write an idempotent ALTER TABLE migration script.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single branch `feature/v1.1-port` created from latest `origin/dev_Upd_NextJS14SNode18` HEAD
- All v1.1 phases (7-11) land on this one branch
- **Do NOT create separate AdminUsersPersonType or AdminUsersProxy tables** -- instead ALTER TABLE admin_users to add three JSON columns: scope_person_types, scope_org_units, proxy_person_ids
- PORT-01 is satisfied by updating existing AdminUser model, not by creating new models
- scopeResolver.ts copied verbatim from dev_v2 (pure functions, zero framework coupling)
- Constants additions merged into NextJS14 version of constants.js (do not overwrite)
- ALTER TABLE applied to dev reciterDB during Phase 7; prod after Phase 8 verification
- ALTER TABLE migration committed to ReCiterDB repo

### Claude's Discretion
- SWC-safe modelName property implementation details for updated AdminUser model
- Exact ALTER TABLE syntax and column ordering
- Import test script structure and location
- How to handle v1.0 AdminUsersPersonType/AdminUsersProxy model files (delete or ignore)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PORT-01 | Sequelize models ported with SWC-safe modelName property | CONTEXT.md overrides: no new models needed. Extend AdminUser with JSON columns. modelName already present on NextJS14 AdminUser. Research provides JSON column pattern from AdminSettings model. |
| PORT-02 | scopeResolver.ts (isPersonInScope, isProxyFor) available on NextJS14 branch | Verbatim copy from dev_v2 commit f80d1c6. Pure TypeScript, zero framework coupling. ScopeData interface takes arrays -- storage-agnostic. |
| PORT-03 | getCapabilities, ROLE_CAPABILITIES, getLandingPage, Curator_Scoped added to constants | Merge additions from dev_v2 commit 3bae1a0 into NextJS14 constants.js. Preserve NextJS14-specific functions (setReportFilterKeyNames, setIsVisible). |
| DB-01 | DDL for scope/proxy columns applied to dev/prod reciterDB and committed to ReCiterDB repo | ALTER TABLE admin_users ADD COLUMN for three JSON columns. MariaDB-specific: stored as LONGTEXT with JSON_VALID check constraint. Idempotent script needed. |
</phase_requirements>

## Standard Stack

### Core (Already on NextJS14 Branch)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sequelize | ^6.37.0 | ORM for MariaDB | Already in use; AdminSettings model proves DataTypes.JSON works |
| mysql2 | (bundled) | MariaDB driver via mysql dialect | Already configured in src/db/db.ts |
| next | ^14.2.35 | Framework (SWC compiler) | Target branch runtime |
| typescript | (bundled) | Type checking | tsconfig already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-toastify | (existing) | Toast messages | Already imported by constants.js |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON columns on admin_users | Separate junction tables (AdminUsersPersonType, AdminUsersProxy) | Junction tables are more normalized but add 2 models, 2 tables, JOIN complexity. User chose JSON columns for simplicity. |
| DataTypes.JSON | DataTypes.TEXT + manual JSON.parse/stringify | DataTypes.JSON handles serialization automatically, but on MariaDB via mysql dialect, may return strings anyway. Either approach works -- use JSON for consistency with AdminSettings pattern. |

**Installation:**
```bash
# No new dependencies needed for Phase 7
# All required packages already on NextJS14 branch
```

## Architecture Patterns

### Recommended Project Structure (Phase 7 Touchpoints)
```
src/
├── db/
│   └── models/
│       ├── AdminUser.ts          # MODIFY: add 3 JSON column attributes
│       └── init-models.ts        # NO CHANGE (no new models to register)
├── utils/
│   ├── constants.js              # MODIFY: merge capability model additions
│   └── scopeResolver.ts          # CREATE: copy from dev_v2 verbatim
└── ...
ReCiterDB/                        # SEPARATE REPO
└── setup/
    └── createDatabaseTableReciterDb.sql  # MODIFY: add columns to admin_users DDL
```

### Pattern 1: Sequelize JSON Column Definition (AdminUser Extension)
**What:** Add JSON-typed attributes to an existing Sequelize model
**When to use:** When adding structured data that doesn't warrant a separate table
**Example:**
```typescript
// Source: AdminSettings model on NextJS14 branch (existing pattern)
// Pattern: DataTypes.JSON with allowNull: true, defaultValue: null
scope_person_types: {
  type: DataTypes.JSON,
  allowNull: true,
  defaultValue: null
},
scope_org_units: {
  type: DataTypes.JSON,
  allowNull: true,
  defaultValue: null
},
proxy_person_ids: {
  type: DataTypes.JSON,
  allowNull: true,
  defaultValue: null
}
```

### Pattern 2: SWC-Safe modelName Property
**What:** Explicitly set `modelName` in Sequelize init options for SWC compatibility
**When to use:** On the NextJS14 branch, several models include explicit `modelName` (AdminUser, AdminUsersRole, AdminUsersDepartment, PersonPersonType, Person). SWC may minify class names, breaking Sequelize's automatic modelName inference.
**Example:**
```typescript
// Source: AdminUser.ts on NextJS14 branch (line 143-144)
{
  sequelize,
  tableName: 'admin_users',
  modelName: 'AdminUser',  // Explicit -- SWC-safe
  timestamps: false,
  // ...
}
```
**Note:** AdminUser on NextJS14 already HAS modelName. No action needed for this model specifically. The concern was about new models -- but since the user decided against new models, this is moot. However, the AdminUser model update MUST preserve the existing `modelName: 'AdminUser'` property.

### Pattern 3: Constants Merging (Not Overwriting)
**What:** Add new exports to the NextJS14 version of constants.js without removing NextJS14-specific additions
**When to use:** When porting features that added to a shared file
**Key difference between branches:**

NextJS14-only exports (PRESERVE):
- `setReportFilterKeyNames()` -- not present on dev_v2
- `setIsVisible()` -- not present on dev_v2
- All functions use `Array.isArray(allFilters) &&` guard -- NextJS14 addition

v1.0-only exports (ADD):
- `Curator_Scoped` in allowedPermissions
- `ROLE_CAPABILITIES` frozen map
- `getCapabilities()` function
- `getLandingPage()` function

### Pattern 4: Idempotent ALTER TABLE
**What:** DDL migration that can be safely run multiple times
**When to use:** When the same script may be applied to dev, then prod, then new environments
**Example:**
```sql
-- Check if column exists before adding (MariaDB 10.x compatible)
-- MariaDB does not support IF NOT EXISTS on ADD COLUMN directly,
-- so use a procedure or accept the error on re-run
ALTER TABLE admin_users
  ADD COLUMN scope_person_types JSON DEFAULT NULL,
  ADD COLUMN scope_org_units JSON DEFAULT NULL,
  ADD COLUMN proxy_person_ids JSON DEFAULT NULL;
```

### Anti-Patterns to Avoid
- **Overwriting constants.js with dev_v2 version:** The NextJS14 version has additional functions (setReportFilterKeyNames, setIsVisible) and Array.isArray guards. Overwriting would break existing features.
- **Creating AdminUsersPersonType.ts or AdminUsersProxy.ts models:** User explicitly decided against separate tables. Do NOT create these files.
- **Using `dialect: 'mariadb'` in db.ts:** The existing config uses `dialect: 'mysql'` and changing it could break other things. Keep as-is.
- **Removing modelName from AdminUser:** The NextJS14 branch has it for SWC safety. Always preserve it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON serialization for MariaDB | Custom getter/setter for JSON parse/stringify | DataTypes.JSON | Sequelize handles serialization; AdminSettings already uses this pattern successfully |
| Scope resolution logic | New implementation | Copy scopeResolver.ts verbatim | Pure functions, thoroughly tested in v1.0, no framework coupling |
| Capability derivation | Ad-hoc role checks | getCapabilities() from constants.js | Isomorphic function works in Edge middleware, API routes, and React components |
| DDL migration tracking | Custom migration system | Simple ALTER TABLE script in ReCiterDB repo | Project doesn't use Sequelize migrations; DDL is managed as SQL files |

**Key insight:** Phase 7 is almost entirely about copying and adapting existing, proven code. The scopeResolver and capability model were built and tested during v1.0. The only novel work is the JSON column approach (simpler than v1.0's junction tables).

## Common Pitfalls

### Pitfall 1: MariaDB JSON Returns Strings via mysql Dialect
**What goes wrong:** When Sequelize uses `dialect: 'mysql'` to connect to MariaDB, `DataTypes.JSON` columns may return raw JSON strings instead of parsed JavaScript objects.
**Why it happens:** MariaDB stores JSON as LONGTEXT. The mysql dialect doesn't know it needs to JSON.parse the result. This is documented in [Sequelize issue #10946](https://github.com/sequelize/sequelize/issues/10946).
**How to avoid:** Always `JSON.parse()` when reading JSON columns from the model. The AdminSettings controller already does this pattern -- downstream consumers (Phase 8+) call `JSON.parse()` on the values. For Phase 7, this only affects the import test script, not the model definition itself.
**Warning signs:** Receiving `"[\"academic-faculty\"]"` (string) instead of `["academic-faculty"]` (array) when querying the model.

### Pitfall 2: Constants.js Has Branch-Specific Differences
**What goes wrong:** Blindly copying dev_v2's constants.js loses NextJS14-specific functions.
**Why it happens:** Both branches independently modified constants.js. The NextJS14 branch added `setReportFilterKeyNames()`, `setIsVisible()`, and `Array.isArray()` guards.
**How to avoid:** Merge the capability model additions (Curator_Scoped, ROLE_CAPABILITIES, getCapabilities, getLandingPage) INTO the NextJS14 version. Do not replace the file.
**Warning signs:** Report page or configuration page breaking after constants.js change (they use the NextJS14-specific functions).

### Pitfall 3: AdminUser Interface Must Include New Attributes
**What goes wrong:** TypeScript interface `AdminUserAttributes` doesn't include the new JSON columns, causing type errors in downstream phases.
**Why it happens:** Forgetting to update both the interface AND the init options.
**How to avoid:** Add `scope_person_types`, `scope_org_units`, and `proxy_person_ids` to: (1) AdminUserAttributes interface, (2) AdminUserOptionalAttributes type, (3) class properties, and (4) init() column definitions.
**Warning signs:** TypeScript errors when accessing `adminUser.scope_person_types` in Phase 8.

### Pitfall 4: MariaDB ADD COLUMN Not Idempotent
**What goes wrong:** Running ALTER TABLE a second time fails with "Duplicate column name" error.
**Why it happens:** MariaDB's ALTER TABLE ADD COLUMN does not support `IF NOT EXISTS` syntax (unlike some MySQL forks).
**How to avoid:** Either (a) accept the error on re-run (columns already exist), (b) wrap in a stored procedure that checks INFORMATION_SCHEMA first, or (c) document that the script should only be run once per environment. Option (a) is simplest and most common in this project.
**Warning signs:** Script fails on second run -- this is expected and harmless.

### Pitfall 5: ScopeData Interface Compatibility
**What goes wrong:** The scopeResolver.ts ScopeData interface expects `personTypes: string[] | null` and `orgUnits: string[] | null`, but the JSON columns store raw values that may need parsing.
**Why it happens:** The scopeResolver is storage-agnostic -- it takes arrays as input. The caller (Phase 8's findUserPermissions) is responsible for reading JSON columns and constructing the ScopeData object.
**How to avoid:** Phase 7 just copies the resolver. Phase 8 builds the bridge between JSON columns and the resolver interface. No adaptation needed in Phase 7.
**Warning signs:** None in Phase 7 -- this pitfall manifests in Phase 8.

## Code Examples

Verified patterns from the actual codebase on both branches:

### AdminUser Model Extension (3 JSON Columns)
```typescript
// Based on: AdminUser.ts on NextJS14 branch + AdminSettings.ts JSON pattern
// These lines ADD to the existing AdminUser interface and init:

// In AdminUserAttributes interface:
export interface AdminUserAttributes {
  userID: number;
  personIdentifier?: string;
  nameFirst?: string;
  nameMiddle?: string;
  nameLast?: string;
  email?: string;
  status?: number;
  createTimestamp: Date;
  modifyTimestamp: Date;
  // NEW: v1.1 scope/proxy columns
  scope_person_types?: string[] | null;
  scope_org_units?: string[] | null;
  proxy_person_ids?: string[] | null;
}

// In AdminUserOptionalAttributes:
export type AdminUserOptionalAttributes = "userID" | "personIdentifier" | "nameFirst"
  | "nameMiddle" | "nameLast" | "email" | "status" | "createTimestamp" | "modifyTimestamp"
  | "scope_person_types" | "scope_org_units" | "proxy_person_ids";

// In class body:
scope_person_types?: string[] | null;
scope_org_units?: string[] | null;
proxy_person_ids?: string[] | null;

// In init() attributes:
scope_person_types: {
  type: DataTypes.JSON,
  allowNull: true,
  defaultValue: null
},
scope_org_units: {
  type: DataTypes.JSON,
  allowNull: true,
  defaultValue: null
},
proxy_person_ids: {
  type: DataTypes.JSON,
  allowNull: true,
  defaultValue: null
}
```

### scopeResolver.ts (Verbatim Copy from dev_v2)
```typescript
// Source: git show f80d1c6:src/utils/scopeResolver.ts
// Copy this file exactly -- pure functions, no framework coupling

export interface ScopeData {
  personTypes: string[] | null;
  orgUnits: string[] | null;
}

export function isPersonInScope(
  scope: ScopeData,
  personOrgUnit: string | null,
  personPersonTypes: string[]
): boolean {
  if (!scope) return true;
  if (!scope.personTypes && !scope.orgUnits) return true;
  if (scope.orgUnits) {
    if (!personOrgUnit || !scope.orgUnits.includes(personOrgUnit)) return false;
  }
  if (scope.personTypes) {
    if (!personPersonTypes || personPersonTypes.length === 0) return false;
    if (!personPersonTypes.some(pt => scope.personTypes!.includes(pt))) return false;
  }
  return true;
}

export function isProxyFor(
  proxyPersonIds: string[] | null,
  personIdentifier: string
): boolean {
  if (!proxyPersonIds || proxyPersonIds.length === 0) return false;
  return proxyPersonIds.includes(personIdentifier);
}
```

### Constants Additions (Merge into NextJS14 Version)
```javascript
// Source: git show 3bae1a0:src/utils/constants.js
// ADD these to the BOTTOM of the NextJS14 constants.js
// Also add Curator_Scoped to the existing allowedPermissions object

// 1. Update allowedPermissions (add Curator_Scoped):
export const allowedPermissions = Object.freeze({
  Superuser: "Superuser",
  Curator_All: "Curator_All",
  Reporter_All: "Reporter_All",
  Curator_Self: "Curator_Self",
  Curator_Scoped: "Curator_Scoped"  // NEW
})

// 2. Add ROLE_CAPABILITIES map
// 3. Add getCapabilities() function
// 4. Add getLandingPage() function
// (full code in the git commit, ~100 lines total)
```

### ALTER TABLE DDL (MariaDB Compatible)
```sql
-- Migration: Add scope and proxy JSON columns to admin_users
-- Target: MariaDB (JSON is alias for LONGTEXT with JSON_VALID CHECK)
-- Apply: dev reciterDB in Phase 7, prod reciterDB after Phase 8

ALTER TABLE admin_users
  ADD COLUMN scope_person_types JSON DEFAULT NULL,
  ADD COLUMN scope_org_units JSON DEFAULT NULL,
  ADD COLUMN proxy_person_ids JSON DEFAULT NULL;

-- Verification:
-- DESCRIBE admin_users;
-- Expected: three new columns of type longtext (MariaDB JSON alias)
```

## State of the Art

| Old Approach (v1.0) | Current Approach (v1.1) | When Changed | Impact |
|---------------------|------------------------|--------------|--------|
| Separate AdminUsersPersonType + AdminUsersProxy tables | JSON columns on admin_users | v1.1 planning (user decision) | Simpler schema, fewer models, no JOINs needed; downstream uses JSON_CONTAINS or in-app parsing |
| Sequelize models for each junction table | Single AdminUser model extended | v1.1 planning | No new model files to create; init-models.ts unchanged |
| JOIN queries for scope/proxy data | Direct column access on admin_users | v1.1 planning | findUserPermissions in Phase 8 reads JSON columns directly instead of JOINing |

**Deprecated/outdated:**
- AdminUsersPersonType.ts model file (v1.0): Not needed -- do not create
- AdminUsersProxy.ts model file (v1.0): Not needed -- do not create
- admin_users_person_types table DDL (v1.0): Not needed -- do not create
- admin_users_proxy table DDL (v1.0): Not needed -- do not create

## Open Questions

1. **MariaDB JSON column returns: string or parsed object?**
   - What we know: AdminSettings uses DataTypes.JSON and works. The admin.settings.controller.ts reads it without explicit JSON.parse (though fetchUpdatedAdminSettings wraps result in JSON.stringify).
   - What's unclear: Whether Sequelize auto-parses JSON on read for the mysql dialect connecting to MariaDB, or whether consumers must JSON.parse manually.
   - Recommendation: The import test script should verify whether `adminUser.scope_person_types` returns a parsed array or a JSON string. Document the result for Phase 8.

2. **MariaDB version on dev/prod reciterDB?**
   - What we know: ReCiterDB CLAUDE.md confirms MariaDB. JSON type requires MariaDB 10.2.7+ (JSON alias support) or 10.4.3+ (automatic JSON_VALID check constraint).
   - What's unclear: Exact MariaDB version on dev and prod.
   - Recommendation: Run `SELECT VERSION()` on dev before applying ALTER TABLE. If older than 10.2.7, JSON columns won't work as expected. This is LOW risk since the AdminSettings model already uses JSON successfully.

3. **Handling stale v1.0 model files on the port branch?**
   - What we know: AdminUsersPersonType.ts and AdminUsersProxy.ts exist on dev_v2 branch from v1.0 work. They are NOT on the NextJS14 branch.
   - What's unclear: Whether to explicitly ignore them or create placeholder files with deprecation notes.
   - Recommendation: Simply don't create them. They don't exist on the NextJS14 branch and are not needed. No action required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently on NextJS14 branch (Phase 11 adds Jest 29) |
| Config file | none -- see Wave 0 |
| Quick run command | `npm run build` (SWC compilation check) |
| Full suite command | `node scripts/test-phase7-imports.js` (custom import test) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORT-01 | AdminUser model includes JSON columns, compiles without SWC errors | build | `npm run build` | N/A (build check) |
| PORT-02 | scopeResolver.ts exports isPersonInScope and isProxyFor | import | `node -e "const s = require('./src/utils/scopeResolver'); console.log(typeof s.isPersonInScope)"` | Wave 0 |
| PORT-03 | constants.js exports Curator_Scoped, ROLE_CAPABILITIES, getCapabilities, getLandingPage | import | `node -e "const c = require('./src/utils/constants'); console.log(c.allowedPermissions.Curator_Scoped, typeof c.getCapabilities)"` | Wave 0 |
| DB-01 | admin_users table has three JSON columns in dev reciterDB | manual | `mysql -e "DESCRIBE admin_users" reciterdb` | manual-only (requires DB access) |

### Sampling Rate
- **Per task commit:** `npm run build`
- **Per wave merge:** `npm run build` + import test script
- **Phase gate:** Build succeeds + import test script passes + DESCRIBE admin_users shows 3 JSON columns on dev

### Wave 0 Gaps
- [ ] `scripts/test-phase7-imports.js` -- import test that verifies scopeResolver, constants exports, and AdminUser model compile/load correctly
- [ ] No test framework needed for Phase 7 (build check + import script is sufficient; Jest arrives in Phase 11)

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `origin/dev_Upd_NextJS14SNode18` branch AdminUser.ts, AdminSettings.ts, constants.js, init-models.ts, db.ts, next.config.js
- Direct codebase inspection: `origin/dev_v2` branch constants.js (commits 039ad88, 603d071, 3bae1a0), scopeResolver.ts (commit f80d1c6)
- `.planning/research/ARCHITECTURE.md` -- complete diff analysis of both branches
- `.planning/phases/07-foundation/07-CONTEXT.md` -- user decisions (JSON columns, not junction tables)
- `ReCiterDB/CLAUDE.md` -- confirms MariaDB, not MySQL
- `ReCiterDB/setup/createDatabaseTableReciterDb.sql` -- existing admin_users DDL

### Secondary (MEDIUM confidence)
- [Sequelize v6 Other Data Types docs](https://sequelize.org/docs/v6/other-topics/other-data-types/) -- DataTypes.JSON support for MySQL/MariaDB
- [MariaDB JSON Data Type docs](https://mariadb.com/docs/server/reference/data-types/string-data-types/json) -- JSON is alias for LONGTEXT with JSON_VALID check
- [Sequelize issue #10946](https://github.com/sequelize/sequelize/issues/10946) -- JSON returns string with mysql dialect on MariaDB
- [Sequelize issue #14356](https://github.com/sequelize/sequelize/issues/14356) -- DataTypes.JSON generates longtext on MariaDB

### Tertiary (LOW confidence)
- None -- all findings verified against primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all libraries already on NextJS14 branch and verified via inspection
- Architecture: HIGH -- all patterns derived from existing code on both branches, not hypothetical
- Pitfalls: HIGH -- MariaDB JSON behavior verified via Sequelize issue tracker; constants diff verified by direct branch comparison
- DDL: MEDIUM -- MariaDB version not confirmed; JSON column support assumed based on AdminSettings model already working

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain -- Sequelize 6, Next.js 14, MariaDB all mature)
