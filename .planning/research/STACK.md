# Technology Stack

**Project:** RPM Bug Fixes, UI/UX Audit, and Scoped Curation Roles
**Researched:** 2026-03-16

## Existing Stack (Locked, No Upgrades)

These are constraints from PROJECT.md. This milestone does NOT upgrade them.

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 12.2.5 | Framework |
| React | 16.14.0 | UI library |
| Node.js | 14.16.0 | Runtime |
| next-auth | 3.29.10 | Authentication (SAML + local) |
| Sequelize | 6.9.0 | ORM (MySQL) |
| Redux + redux-thunk | 4.1.1 / 2.3.0 | State management |
| saml2-js | 3.0.1 | SAML assertion handling |
| jose | 4.14.4 | JWT decode in edge middleware |
| MUI | 5.0.6 | Component library |
| Bootstrap | 5.1.3 | CSS framework |

## Recommended Additions

### 1. Scoped Role Authorization: CASL

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @casl/ability | ^6.8.0 | Define and check scoped permissions | Isomorphic (server + client), battle-tested, works with any data model. Lets you define abilities like `can('curate', 'Person', { personType: 'affiliate' })` which maps directly to the scoped curation requirement. |
| @casl/react | 4.0.0 | React `<Can>` component for conditional rendering | **Must use v4.0.0, not v5.** v5 requires React 17+. v4 supports React ^16.0.0 and @casl/ability ^6.0.0. Provides `<Can>` and `createContextualCan` for hiding/showing UI based on abilities. |

**Confidence:** HIGH. Verified via npm that @casl/react@4.0.0 has `peerDependencies: { react: '^16.0.0 || ^17.0.0 || ^18.0.0', '@casl/ability': '^3.0.0 || ^4.0.0 || ^5.1.0 || ^6.0.0' }`. This combination is confirmed compatible.

**Why CASL over alternatives:**

| Approach | Verdict | Reason |
|----------|---------|--------|
| CASL | **Use this** | Isomorphic, mature (6+ years), handles scoped/attribute-based permissions natively. No external service needed. Works server-side in API routes AND client-side in React components. |
| Hand-rolled if/else | Avoid | The current middleware.ts is 120 lines of deeply nested role-checking that is already fragile. Adding scoped roles (personType + orgUnit combinations) would make it unmaintainable. |
| Permit.io / OpenFGA | Overkill | External authorization services. Great for multi-tenant SaaS, but RPM is a single-institution app. Adding an external dependency and network hop for authorization is unnecessary complexity. |
| Oso | Overkill | Policy engine with its own language (Polar). Learning curve too steep for what amounts to "can this curator see people of type X in org Y." |
| accesscontrol npm | Abandoned | Last publish 6+ years ago. Not maintained. |

**How CASL maps to RPM's scoped role requirements:**

```typescript
// Define abilities based on user's scoped role assignments
import { AbilityBuilder, createMongoAbility } from '@casl/ability';

function defineAbilitiesFor(user) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  if (user.roles.includes('Superuser')) {
    can('manage', 'all');  // full access
  }
  if (user.roles.includes('Curator_All')) {
    can('curate', 'Person');  // curate anyone
  }
  if (user.roles.includes('Curator_Self')) {
    can('curate', 'Person', { personIdentifier: user.personIdentifier });
  }
  // NEW: Scoped curation roles from admin_users_scoped_roles table
  for (const scope of user.scopedRoles) {
    const conditions = {};
    if (scope.personType) conditions.personType = scope.personType;
    if (scope.orgUnit) conditions.primaryOrganizationalUnit = scope.orgUnit;
    can('curate', 'Person', conditions);
  }

  return build();
}
```

This is exactly the kind of attribute-based scoping RPM needs: "user X can curate people where personType = 'affiliate' AND orgUnit = 'Medicine'."

### 2. SAML Auth Debugging: No New Libraries Needed

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| saml-encoder-decoder-js | 1.0.2 | Dev-only: decode/encode SAML responses for debugging | Lightweight utility to decode base64 SAML responses without external tools. Useful for debugging the paa2013 /noaccess issue. |

**Confidence:** MEDIUM. The primary auth bugs (paa2013 redirect to /noaccess) are likely logic bugs in the nextauth callback chain, not library issues. Debugging approach is more about logging and code analysis than new tooling.

**Auth debugging strategy (no new dependencies for most):**
- The `findUserPermissions` controller returns `JSON.stringify(userRolesList)`, and the JWT callback stores it as `token.userRoles = apiResponse.userRoles`. The middleware then does `JSON.parse(allUserRoles)` followed by `JSON.parse(userRoles.userRoles)` (double-parse). This double-serialization is a known fragile pattern that likely causes the /noaccess redirect when the JSON structure is slightly different between SAML and local auth paths.
- The SAML path calls `findAdminUser` then `findUserPermissions`, but the direct login path calls `findOrCreateAdminUsers` then `findUserPermissions`. The SAML path does NOT auto-create users (deliberate), but its error handling silently returns `{ cwid, has_access: false }` on failure rather than surfacing the actual error.
- saml2-js 3.0.1 (installed) is the latest 3.x. v4.0.4 exists but is a different fork (AG-Teammate/saml2-js vs Clever/saml2). Staying on 3.x is fine for this milestone.

### 3. UI/UX Audit Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| eslint-plugin-jsx-a11y | ^6.10.2 | Lint-time accessibility checks | Catches missing alt text, invalid ARIA, missing labels at build time. Peer dep is eslint ^3-^9; the project has eslint 7.32.0, which is compatible. Zero runtime cost, integrates with existing lint setup. |
| axe-core | ^4.11.1 | Runtime accessibility engine (dev only) | Industry standard (3B+ downloads). Can be run against rendered pages via browser devtools or scripts. WCAG 2.0/2.1/2.2 coverage at A/AA/AAA. |
| @axe-core/react | ^4.11.1 | Dev-only: log accessibility violations in browser console | Wraps axe-core for React apps. Runs in development mode only, logs violations to console as you navigate. Helps find issues during manual UI/UX audit. |

**Confidence:** HIGH for eslint-plugin-jsx-a11y (verified peer deps). MEDIUM for @axe-core/react (could not verify React 16 compat via npm; the package has no listed peerDependencies, so it may work, but test before committing to it).

**Why NOT these alternatives:**

| Tool | Verdict | Reason |
|------|---------|--------|
| Storybook | Do not add | RPM has no component stories today. Setting up Storybook for a one-time UI/UX audit of an existing app is too much overhead. Use browser-based tools instead. |
| Chromatic | Do not add | Requires Storybook. Cloud service. Overkill for a maintenance milestone. |
| Lighthouse CI | Optional, not required | Good for performance regression tracking in CI, but the UI/UX audit described in PROJECT.md is a manual heuristic evaluation, not an automated performance check. If desired later, `@lhci/cli` v0.15.1 can be added. |
| pa11y | Reasonable alternative | CLI accessibility tester. Would work, but eslint-plugin-jsx-a11y + axe-core covers the same ground with better React integration. |

### 4. Database Migrations for Scoped Roles

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| sequelize-cli | ^6.6.2 | Run database migrations | RPM currently has no migration infrastructure. New tables for scoped roles (`admin_users_scoped_roles`, `admin_org_units`) need repeatable migrations, not manual SQL. sequelize-cli integrates with the existing Sequelize 6.x setup. |

**Confidence:** HIGH. sequelize-cli 6.x is the standard companion to Sequelize 6.x. The project already uses sequelize-auto for model generation; migrations are the natural next step.

**Why migrations matter for scoped roles:**
- The new `admin_users_scoped_roles` table must be created identically on dev, staging, and prod.
- Schema changes need to be version-controlled alongside the code that uses them.
- Rolling back a bad deploy requires rollback SQL; migrations provide this.

## New Database Tables (Schema Design)

These are not library choices but are critical stack decisions that feed the architecture.

### admin_users_scoped_roles

```sql
CREATE TABLE admin_users_scoped_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  personType VARCHAR(128) NULL,        -- nullable: scope by org unit only
  orgUnit VARCHAR(200) NULL,           -- nullable: scope by person type only
  createTimestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  modifyTimestamp DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES admin_users(userID),
  INDEX idx_userID (userID),
  INDEX idx_personType (personType),
  INDEX idx_orgUnit (orgUnit),
  CONSTRAINT chk_at_least_one CHECK (personType IS NOT NULL OR orgUnit IS NOT NULL)
);
```

**Design rationale:**
- Both `personType` and `orgUnit` are nullable, but at least one must be set (CHECK constraint). This enables the three flexible scoping modes: personType only, orgUnit only, or both combined.
- References `admin_users(userID)` following the existing FK pattern in `admin_users_roles` and `admin_users_departments`.
- `personType` values match `person_person_type.personType` (e.g., "affiliate", "alumni", "md-phd").
- `orgUnit` values match `person.primaryOrganizationalUnit`.
- One row per scope assignment. A user with two scoped roles gets two rows.

### admin_org_units (reference table, optional)

```sql
CREATE TABLE admin_org_units (
  orgUnitID INT AUTO_INCREMENT PRIMARY KEY,
  orgUnitLabel VARCHAR(200) NOT NULL UNIQUE,
  createTimestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Populated from: SELECT DISTINCT primaryOrganizationalUnit FROM person WHERE primaryOrganizationalUnit IS NOT NULL
```

**Rationale:** Provides a controlled list for the Manage Users dropdown rather than free-text org unit entry. This mirrors how `admin_departments` provides a controlled list for department assignment. Optional because the `person` table already has `primaryOrganizationalUnit` values that could be queried directly with `SELECT DISTINCT`.

## Recommended Stack Summary

### Install (production dependencies)

```bash
npm install @casl/ability@^6.8.0 @casl/react@4.0.0
```

### Install (dev dependencies)

```bash
npm install -D eslint-plugin-jsx-a11y@^6.10.2 axe-core@^4.11.1 sequelize-cli@^6.6.2 saml-encoder-decoder-js@^1.0.2
```

### Conditional install (test before committing)

```bash
# Test React 16 compat first; if peer dep errors, skip this and use axe-core directly
npm install -D @axe-core/react@^4.11.1
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Authorization | @casl/ability + @casl/react | Hand-rolled middleware logic | Current middleware is 120 lines of nested if/else for 4 roles. Adding scoped roles would double or triple this. CASL centralizes permission logic. |
| Authorization | @casl/ability | Permit.io, OpenFGA, Oso | External services/policy engines are overkill for a single-institution internal tool. |
| Auth debugging | Console logging + saml-encoder-decoder-js | BoxyHQ SAML, Osso | These replace the SAML provider entirely. The goal is to debug the existing saml2-js flow, not replace it. |
| A11y linting | eslint-plugin-jsx-a11y | eslint-plugin-react-a11y | Does not exist as a real package; jsx-a11y is the standard. |
| A11y runtime | axe-core + @axe-core/react | pa11y | pa11y is CLI-only. @axe-core/react gives in-browser console feedback during development, which is better for a manual UI/UX audit workflow. |
| Migrations | sequelize-cli | Manual SQL scripts | Not repeatable, not version-controlled, error-prone across environments. |
| Migrations | sequelize-cli | Prisma Migrate | Would require replacing Sequelize with Prisma ORM. Way out of scope. |
| Visual regression | None (skip for now) | Storybook + Chromatic | No existing stories. Adding Storybook infrastructure for a maintenance milestone is not justified. |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| next-auth v4 or v5 (Auth.js) | Requires Next.js 13+ and React 17+. Out of scope per constraints. |
| NextAuth `CredentialsProvider` (new import path) | v3 uses `Providers.Credentials`, not `CredentialsProvider`. Do not mix v3 and v4 patterns. |
| @casl/react v5 | Requires React ^17.0.0. RPM is on React 16.14.0. **Use v4.0.0.** |
| Storybook | No existing component stories. Setup cost not justified for this milestone. |
| Prisma | Would replace Sequelize. Not in scope. |
| TypeORM | Would replace Sequelize. Not in scope. |
| Zustand, Jotai, Recoil | Would replace Redux. Not in scope. |
| accesscontrol npm | Abandoned, last published 6+ years ago. |
| node-saml / @node-saml/node-saml | Would replace saml2-js. Different API. Not needed when the issue is likely a logic bug, not a library deficiency. |

## Version Compatibility Matrix

| New Package | Node 14 | React 16 | Next.js 12 | Sequelize 6 | eslint 7 |
|-------------|---------|----------|------------|-------------|----------|
| @casl/ability@6.8.0 | Yes (no engine constraint) | N/A (pure JS) | N/A | N/A | N/A |
| @casl/react@4.0.0 | Yes | **Yes** (^16.0.0) | Yes | N/A | N/A |
| eslint-plugin-jsx-a11y@6.10.2 | Yes | N/A | N/A | N/A | **Yes** (^3-^9) |
| axe-core@4.11.1 | Yes | N/A | N/A | N/A | N/A |
| sequelize-cli@6.6.2 | Yes | N/A | N/A | **Yes** (6.x) | N/A |
| saml-encoder-decoder-js@1.0.2 | Yes | N/A | N/A | N/A | N/A |

## SAML Debugging Best Practices

No new production libraries needed. The approach for debugging the paa2013 /noaccess issue:

1. **Add structured logging to the nextauth callback chain.** The current `[...nextauth].jsx` has minimal error handling. The SAML authorize function catches errors and returns `null`, swallowing diagnostics. Add `console.error` with the actual error before returning null.

2. **Verify the double JSON.parse pattern.** In middleware.ts, the JWT token's `userRoles` field is stringified JSON inside stringified JSON. Line 21 does `JSON.stringify(decodedTokenJson)` and line 25 does `JSON.parse(userRoles.userRoles)`. If `userRoles` is already an array (from the direct login path) rather than a JSON string (from the SAML path), this double-parse will fail silently and the user gets redirected to /error.

3. **Use saml-encoder-decoder-js (dev only)** to decode SAML responses when debugging certificate or assertion issues. The tool decodes base64 SAML responses into readable XML.

4. **Check `admin_users.status` field.** The `findOrCreateAdminUsers` function sets `status: 0` for new users by default (line 17 of admin.users.controller.ts). If paa2013's record was auto-created, status would be 0 (inactive). However, PROJECT.md says status=1, so this is likely not the issue for this specific user.

5. **Verify certificate freshness.** saml2-js uses `allow_unencrypted_assertion: false` and `sign_get_request: true`. If the IdP certificate (`idp.crt`) has been rotated without updating the EKS secret, all SAML logins would fail with "SAML Assertion signature check failed."

## Sources

- npm registry: @casl/ability@6.8.0, @casl/react@4.0.0, @casl/react@5.0.1 (peer dependency verification)
- [CASL official docs](https://casl.js.org/v6/en/guide/install/)
- [CASL React integration](https://casl.js.org/v6/en/package/casl-react/)
- [next-auth v3 callbacks documentation](https://next-auth.js.org/configuration/callbacks)
- [saml2-js GitHub (Clever/saml2)](https://github.com/Clever/saml2)
- [axe-core by Deque](https://www.deque.com/axe/axe-core/)
- [eslint-plugin-jsx-a11y npm](https://www.npmjs.com/package/eslint-plugin-jsx-a11y)
- [Auth.js RBAC guide](https://authjs.dev/guides/role-based-access-control)
- [Permit.io: Frontend authorization with CASL](https://www.permit.io/blog/frontend-authorization-with-nextjs-and-casl-tutorial)
- [RBAC vs ABAC](https://www.osohq.com/learn/rbac-vs-abac)
- [Common SAML authentication issues](https://help.anthology.com/blackboard/administrator/en/authentication/implement-authentication/saml-authentication-provider-type/common-issues-with-saml-authentication.html)
- [Troubleshoot SAML configurations (Auth0)](https://auth0.com/docs/troubleshoot/authentication-issues/troubleshoot-saml-configurations)
