# Phase 7: Foundation - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Port the data layer -- Sequelize model changes, scopeResolver utility, capability constants, and database DDL -- to the NextJS14 branch so all subsequent phases (8-11) have something to import. This phase does NOT touch auth pipelines, middleware, UI components, or API routes.

</domain>

<decisions>
## Implementation Decisions

### Working Branch Setup
- Single branch `feature/v1.1-port` created from latest `origin/dev_Upd_NextJS14SNode18` HEAD
- All v1.1 phases (7-11) land on this one branch
- Fetch origin before branching to get the most recent state (including Mahender's SAML work)

### Schema Approach (CRITICAL CHANGE FROM v1.0)
- **Do NOT create separate AdminUsersPersonType or AdminUsersProxy tables**
- Instead, ALTER TABLE `admin_users` to add three JSON columns:
  - `scope_person_types` JSON DEFAULT NULL -- string array of person types
  - `scope_org_units` JSON DEFAULT NULL -- string array of org units
  - `proxy_person_ids` JSON DEFAULT NULL -- string array of person identifiers
- This means PORT-01 is satisfied by updating the existing AdminUser model, not by creating new models
- The v1.0 AdminUsersPersonType and AdminUsersProxy Sequelize models are NOT ported

### DDL Deployment
- Apply ALTER TABLE to dev reciterDB during Phase 7 for testing
- Apply ALTER TABLE to prod reciterDB after Phase 8 (Auth Pipeline) is verified
- Commit ALTER TABLE migration script to the ReCiterDB repo for reproducibility
- Verify with DESCRIBE admin_users after applying to dev

### Constants Organization
- Add Curator_Scoped, ROLE_CAPABILITIES, getCapabilities(), getLandingPage() to existing `constants.js` on the NextJS14 branch
- Merge additions into the NextJS14 version of constants.js -- do not overwrite with v1.0's version
- Preserve any NextJS14-specific values already in the file

### scopeResolver
- Copy `src/utils/scopeResolver.ts` verbatim from dev_v2 -- pure functions, zero framework coupling
- ScopeData interface and function signatures stay the same (takes arrays as input, doesn't care about storage backend)

### Validation Approach
- Run `npm run build` to verify SWC compiles all ported files without errors
- Write a quick import test script that imports scopeResolver, constants exports, and AdminUser model to verify exports work
- Run DESCRIBE admin_users on dev database to confirm three new JSON columns exist

### Claude's Discretion
- SWC-safe modelName property implementation details for updated AdminUser model
- Exact ALTER TABLE syntax and column ordering
- Import test script structure and location
- How to handle the v1.0 AdminUsersPersonType/AdminUsersProxy model files (delete or ignore on the port branch)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v1.0 Source Code (port reference)
- `src/utils/scopeResolver.ts` -- isPersonInScope and isProxyFor functions to copy verbatim
- `src/utils/constants.js` -- getCapabilities, ROLE_CAPABILITIES, getLandingPage, Curator_Scoped to merge into NextJS14 version
- `src/db/models/AdminUser.ts` -- existing AdminUser model that will be extended with JSON columns

### Architecture Research
- `.planning/research/ARCHITECTURE.md` -- Complete diff analysis of dev_v2 vs NextJS14 branches, auth flow differences, port patterns, anti-patterns to avoid

### Requirements
- `.planning/REQUIREMENTS.md` -- PORT-01 (models), PORT-02 (scopeResolver), PORT-03 (constants), DB-01 (DDL)

### Project Decisions
- `.planning/PROJECT.md` -- Key decisions section, especially: "Sequelize models need SWC-safe modelName property", "DB-01 DDL must go to ReCiterDB repo AND both dev and prod databases"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/scopeResolver.ts` (dev_v2): Pure functions, copy-paste directly
- `src/utils/constants.js` (dev_v2): getCapabilities/ROLE_CAPABILITIES/getLandingPage -- merge additions into NextJS14 version
- `src/db/models/AdminUser.ts` (dev_v2 and NextJS14): Base model to extend with JSON columns

### Established Patterns
- Sequelize models use `static initModel(sequelize)` pattern with explicit attribute definitions
- NextJS14 branch requires SWC-safe modelName property on Sequelize models (constraint not present on dev_v2)
- Constants uses Object.freeze() for immutable role maps

### Integration Points
- `src/db/models/init-models.ts`: Will need AdminUser model updated (no new model registration needed since no new tables)
- `controllers/db/userroles.controller.ts`: findUserPermissions() will need to query JSON columns on admin_users instead of joining junction tables (Phase 8 scope, but Phase 7 schema enables it)
- ReCiterDB repo: ALTER TABLE script must be committed there for reproducibility

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose JSON columns on admin_users over separate junction tables -- this simplifies the schema and avoids two new Sequelize models, but changes how downstream phases query scope/proxy data (JSON_CONTAINS instead of JOIN)
- Three separate JSON columns (not a single nested JSON object) to keep each concern independently queryable and nullable
- The scopeResolver interface already works with arrays -- it doesn't need to know about the storage backend change

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 07-foundation*
*Context gathered: 2026-03-18*
