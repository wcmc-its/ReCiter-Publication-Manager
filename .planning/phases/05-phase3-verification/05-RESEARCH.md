# Phase 5: Phase 3 Independent Verification - Research

**Researched:** 2026-03-18
**Domain:** Code verification / audit methodology (read-only phase)
**Confidence:** HIGH

## Summary

Phase 5 is a read-only verification phase that produces a VERIFICATION.md for Phase 3 (Scoped Curation Roles). Phase 3 implemented 6 SCOPE requirements across 5 plans but was never independently verified -- the milestone audit identified this as the primary gap. The verification must follow the established format from Phase 4's VERIFICATION.md (Observable Truths table, Key Links, Requirements Coverage, Anti-Patterns, Human Verification Required, Gaps Summary).

All 16 key source files exist on disk and are non-empty. The 2 existing test suites pass (27 tests across `scopeResolver.test.ts` and `constants-scoped.test.ts`). The VALIDATION.md Wave 0 stubs (`__tests__/phase03/`) were never created -- zero of 7 planned test files exist. The verification output goes into the Phase 3 directory at `.planning/phases/03-scoped-curation-roles/03-VERIFICATION.md`, not the Phase 5 directory.

**Primary recommendation:** Structure the verification as a single plan with one auto task that reads all 16 key files, runs the 2 existing test suites, traces all key links from plan frontmatter, and produces the VERIFICATION.md following the Phase 4 format exactly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Verification methodology:** Static code analysis (read actual source files, confirm code at specific lines, trace data flow) -- same approach as Phase 4's successful verification
- **Test execution:** Run existing Phase 3 tests (`scopeResolver.test.ts`, `constants-scoped.test.ts`) and include pass/fail results as additional evidence
- **Human verification section:** Include a "Human Verification Required" section for scope behaviors that can't be confirmed from code alone (scope label rendering, form show/hide, toast messages, redirect behavior)
- **Failure handling:** VERIFICATION.md records pass/fail per requirement with specific findings; failures flagged not milestone-blocking; gap-closure phase handles fixes
- **Output scope:** Primary focus on 6 SCOPE requirements; include test coverage assessment section; reference existing tests and note gaps against VALIDATION.md Wave 0 stubs; do NOT write missing tests
- **Output format:** Follow established VERIFICATION.md format from Phases 1, 2, and 4 (Observable Truths table, Required Artifacts, Key Link Verification, Requirements Coverage, Anti-Patterns, Human Verification Required, Test Coverage Assessment, Gaps Summary)
- **File location:** `.planning/phases/03-scoped-curation-roles/03-VERIFICATION.md`

### Claude's Discretion
- How to organize observable truths (per-requirement vs per-plan vs per-component)
- Which key links to trace (prioritize based on what's most verification-worthy)
- Severity classification of any gaps found
- Wording of human verification test instructions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCOPE-01 | Database schema supports scoped curation roles with nullable person type and org unit columns | Verify AdminUsersPersonType.ts model, init-models.ts registration, userroles.controller.ts scope query |
| SCOPE-02 | Scoped curators only see people matching their assigned scope on Find People page | Verify ScopeFilterCheckbox.tsx, Search.js scope filtering, person.controller.ts scope query params |
| SCOPE-03 | Scoped curators can only curate publications for people within their assigned scope | Verify userfeedback/[uid].ts 403, goldstandard.ts 403, curate/[id].js redirect, manageprofile/[userId].tsx redirect |
| SCOPE-04 | Superusers can assign person type scopes to users from Manage Users page | Verify CurationScopeSection.tsx, AddUser.tsx conditional render, user.controller.ts scope persistence |
| SCOPE-05 | Superusers can assign org unit scopes to users from Manage Users page | Verify CurationScopeSection.tsx org units field, departments reuse as org unit scope |
| SCOPE-06 | Scoped roles support flexible combination: person type only, org unit only, or both | Verify scopeResolver.ts null handling, getCapabilities() scoped flag, test coverage of combinations |
</phase_requirements>

## Standard Stack

This phase produces documentation only -- no code dependencies needed. The "stack" is the verification methodology and tools.

### Verification Tools
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| Static code analysis (Read tool) | Read source files, confirm code at specific lines | Same approach used successfully for Phase 4 verification |
| `npx jest --testPathPattern="..."` | Run existing tests as evidence | Automated pass/fail adds confidence to static analysis |
| Git history (`git log --oneline`) | Confirm commits exist | Validates SUMMARY claims about commit hashes |

### Verification Output Format
| Section | Purpose | Format |
|---------|---------|--------|
| Observable Truths | Confirm each plan's must_have.truths | `\| # \| Truth \| Status \| Evidence \|` |
| Required Artifacts | Confirm files exist and contain expected content | `\| Artifact \| Expected \| Status \| Details \|` |
| Key Link Verification | Trace data flow connections between files | `\| From \| To \| Via \| Status \| Details \|` |
| Requirements Coverage | Map each SCOPE-XX to evidence | `\| Requirement \| Source Plan \| Description \| Status \| Evidence \|` |
| Anti-Patterns Found | Flag stubs, TODOs, dead code | `\| File \| Line \| Pattern \| Severity \| Impact \|` |
| Human Verification Required | Behaviors needing manual testing | `\| Behavior \| Requirement \| Why Manual \| Test Instructions \|` |
| Test Coverage Assessment | Map SCOPE-XX to test coverage | Table of requirements vs existing tests |
| Gaps Summary | Summarize all issues found | Narrative with severity |

Status values:
- Truths: `VERIFIED`, `WARN`, `FAILED`
- Links: `WIRED` or `BROKEN`
- Requirements: `SATISFIED`, `PARTIAL`, `FAILED`

## Architecture Patterns

### Verification Structure

The verification follows a three-layer evidence model:

```
Layer 1: Observable Truths (from plan must_haves.truths)
    Plans 01-05 define 30 total truths across their must_haves blocks
    Each truth verified by reading actual source code

Layer 2: Key Links (from plan must_haves.key_links)
    Plans 01-05 define 12 total key links
    Each link verified by confirming import/export/call chain

Layer 3: Requirements Coverage (SCOPE-01 through SCOPE-06)
    Each requirement mapped to one or more truths/links
    Status derived from underlying evidence
```

### Requirement-to-Plan Mapping (from SUMMARY frontmatter)

This is the CLAIMED mapping -- verification must confirm each independently:

| Requirement | Claimed by Plans | What to verify |
|-------------|-----------------|----------------|
| SCOPE-01 | 01, 02, 03 | AdminUsersPersonType model, init-models registration, scope query in auth pipeline, scope persistence in user controller |
| SCOPE-02 | 04 | ScopeFilterCheckbox, Search.js scope filter, person API scope filtering |
| SCOPE-03 | 02, 04, 05 | API 403 enforcement (userfeedback, goldstandard), curate page redirect, manage profile redirect |
| SCOPE-04 | 03 | CurationScopeSection person types field, AddUser conditional render, controller persistence |
| SCOPE-05 | 03 | CurationScopeSection org units field, departments reuse as org unit scope |
| SCOPE-06 | 01, 03 | scopeResolver null handling (person type only, org unit only, both), capability model flexibility |

### Observable Truths Inventory (30 total across 5 plans)

**Plan 01 (6 truths):**
1. getCapabilities() recognizes Curator_Scoped role and returns canCurate.scoped = true
2. isPersonInScope() correctly evaluates AND across dimensions and OR within dimensions
3. Null personTypes in scope means no restriction on person type axis
4. Null orgUnits in scope means no restriction on org unit axis
5. AdminUsersPersonType Sequelize model exists and maps to admin_users_person_types table
6. Curator_Scoped is registered in ROLE_CAPABILITIES with canSearch: true and canCurate: { scoped: true }

**Plan 02 (7 truths):**
7. findUserPermissions returns scopeData (personTypes + orgUnits) for Curator_Scoped users
8. JWT token contains scopeData alongside userRoles for Curator_Scoped users
9. Middleware allows Curator_Scoped users to access /curate/* routes
10. Middleware adds /manageprofile/* to route matcher
11. userfeedback save API returns 403 when scoped curator tries to save for out-of-scope person
12. goldstandard update API returns 403 when scoped curator tries to update for out-of-scope person
13. Person search controller supports scope filtering via scopePersonTypes and scopeOrgUnits parameters

**Plan 03 (8 truths):**
14. When Curator_Scoped is selected in AddUser form, a Curation Scope section appears
15. When Curator_All and Curator_Scoped are both selected, form shows mutual exclusion error
16. If Curator_Scoped is selected with no scope fields, form shows 'At least one' error
17. Saving a Curator_Scoped user persists person types to admin_users_person_types
18. Editing an existing Curator_Scoped user pre-populates scope fields
19. UsersTable shows roles column with scope summary
20. ManageUsers page has a role filter dropdown
21. Server-side validation rejects simultaneous Curator_All + Curator_Scoped

**Plan 04 (10 truths):**
22. Scoped curator sees 'Show only people I can curate' checkbox
23. Checkbox is NOT visible for Curator_All, Curator_Self-only, or Reporter_All-only users
24. Checking the box filters results to only people matching scope
25. In-scope people show curate icon (EditOutlined)
26. Out-of-scope people do NOT show curate icon
27. Clicking in-scope person name navigates to /curate/:id
28. Clicking out-of-scope person name navigates to /report
29. Scope label appears in sidebar: 'Curating: ...'
30. Curate page checks scope on mount and redirects with toast
31. Checkbox state persists across pagination

**Plan 05 (5 truths):**
32. Manage Profile page renders ORCID management for a person
33. Scoped curator can access Manage Profile for in-scope people
34. Scoped curator is redirected with toast for out-of-scope person
35. Curator_All can access Manage Profile for any person
36. 5 files ported from master commit 544c0f2

### Key Links Inventory (12 total across 5 plans)

**Plan 01 (2 links):**
1. constants.js -> ROLE_CAPABILITIES (Curator_Scoped entry)
2. init-models.ts -> AdminUsersPersonType.ts (import + initModel + association)

**Plan 02 (3 links):**
3. userroles.controller.ts -> [...nextauth].jsx (findUserPermissions return -> JWT callback)
4. [...nextauth].jsx -> middleware.ts (JWT token scopeData -> middleware decode)
5. userfeedback/[uid].ts -> scopeResolver.ts (isPersonInScope import)

**Plan 03 (3 links):**
6. AddUser.tsx -> CurationScopeSection.tsx (conditional render)
7. AddUser.tsx -> user.controller.ts (form submit -> createOrUpdateAdminUser)
8. ManageUsers.tsx -> UsersTable.tsx (passes user data with roles)

**Plan 04 (4 links):**
9. Search.js -> ScopeFilterCheckbox.tsx (conditional render based on canCurate.scoped)
10. Search.js -> person.controller.ts (scope filter params to /api/db/person)
11. SideNavbar.tsx -> ScopeLabel.tsx (conditional render when canCurate.scoped)
12. curate/[id].js -> scopeResolver.ts (scope check on mount)

**Plan 05 (2 links):**
13. manageprofile/[userId].tsx -> ManageProfile.tsx (page imports component)
14. manageprofile/[userId].tsx -> scopeResolver.ts (scope check on mount)

### Files to Verify (16 key source files + 2 test files + 5 created files)

All files confirmed to exist on disk:

**Created in Phase 3:**
- `src/db/models/AdminUsersPersonType.ts` (2559 bytes)
- `src/utils/scopeResolver.ts` (2124 bytes)
- `src/components/elements/Search/ScopeFilterCheckbox.tsx`
- `src/components/elements/Navbar/ScopeLabel.tsx`
- `src/pages/api/db/person/scopecheck.ts`
- `src/components/elements/AddUser/CurationScopeSection.tsx`
- `src/components/elements/AddUser/CurationScopeSection.module.css`
- `src/pages/api/db/admin/users/persontypes/index.ts`
- `controllers/db/manage-profile/manageProfile.controller.ts`
- `src/components/elements/ManageProfile/ManageProfile.tsx`
- `src/components/elements/ManageProfile/ManageProfile.module.css`
- `src/pages/api/db/admin/manageProfile/getORCIDProfileDataByID/index.ts`
- `src/pages/manageprofile/[userId].tsx`

**Modified in Phase 3:**
- `src/utils/constants.js` (5609 bytes)
- `src/db/models/init-models.ts`
- `controllers/db/userroles.controller.ts` (4574 bytes)
- `src/pages/api/auth/[...nextauth].jsx` (9386 bytes)
- `src/middleware.ts` (5806 bytes)
- `src/pages/api/reciter/save/userfeedback/[uid].ts` (3162 bytes)
- `src/pages/api/reciter/update/goldstandard.ts` (3036 bytes)
- `controllers/db/person.controller.ts` (12746 bytes)
- `src/components/elements/AddUser/AddUser.tsx` (23596 bytes)
- `controllers/db/manage-users/user.controller.ts`
- `src/components/elements/Manage/UsersTable.tsx`
- `src/components/elements/Manage/ManageUsers.tsx` (7517 bytes)
- `src/components/elements/Search/Search.js` (20392 bytes)
- `src/components/elements/Navbar/SideNavbar.tsx` (8751 bytes)
- `src/pages/curate/[id].js` (3076 bytes)
- `src/redux/methods/methods.js`
- `src/redux/actions/actions.js`
- `src/redux/reducers/reducers.js`

**Test files:**
- `__tests__/utils/scopeResolver.test.ts` (13 tests, PASS)
- `__tests__/utils/constants-scoped.test.ts` (14 tests, PASS)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verification format | Custom format | Phase 4 VERIFICATION.md template | Established format, planner/auditor expect it |
| Evidence gathering | Manual file reads | Systematic must_haves.truths checklist from plan frontmatter | 30 truths already defined, no guesswork |
| Test execution | Manual code inspection | `npx jest` with existing test files | 27 automated tests already exist as evidence |

## Common Pitfalls

### Pitfall 1: Trusting SUMMARY claims without independent verification
**What goes wrong:** Verifier reads SUMMARY.md and marks things "verified" based on SUMMARY claims rather than reading actual source files
**Why it happens:** SUMMARYs are self-reported by the executor; they could contain errors or omissions
**How to avoid:** For every truth, cite the actual file path and line/content that confirms it; never cite SUMMARY as evidence
**Warning signs:** Evidence column references "per SUMMARY" or "claimed in 03-XX-SUMMARY.md"

### Pitfall 2: Missing anti-patterns hidden in large files
**What goes wrong:** Large files (Search.js at 20KB, AddUser.tsx at 23KB) may contain TODO/FIXME/placeholder code that gets overlooked
**Why it happens:** Verification focuses on presence of expected code but misses problematic code in the same files
**How to avoid:** After confirming expected code exists, also search for anti-patterns: TODO, FIXME, placeholder, stub, hardcoded, console.log that shouldn't be there
**Warning signs:** Files with significant complexity (Search.js, AddUser.tsx) not checked for anti-patterns

### Pitfall 3: Verifying file existence but not content correctness
**What goes wrong:** File exists and contains the expected keyword but the implementation is wrong (e.g., wrong logic, missing error handling)
**Why it happens:** Grep for keywords is easier than reading and understanding the actual logic
**How to avoid:** For critical enforcement points (403 responses, scope resolution), read the actual conditional logic and confirm it matches the specification
**Warning signs:** Evidence says "file contains 'isPersonInScope'" without confirming the conditional flow is correct

### Pitfall 4: Not cross-referencing with milestone audit findings
**What goes wrong:** Phase 4 VERIFICATION already found integration gaps (isProxyFor not checked in userfeedback/goldstandard APIs) that may affect Phase 3 verification too
**Why it happens:** Phase 5 focuses narrowly on SCOPE requirements without considering the broader integration context
**How to avoid:** Reference the milestone audit findings and note any overlap; specifically, Phase 6 addresses the PROXY-06 integration gap in the same API files Phase 3 modified
**Warning signs:** Verification misses the fact that isProxyFor was added to these files by Phase 4 after Phase 3 modified them

### Pitfall 5: Incomplete human verification section
**What goes wrong:** Some behaviors genuinely cannot be verified from code (visual rendering, toast timing, redirect UX) but are omitted from Human Verification section
**Why it happens:** Tendency to mark everything as VERIFIED from code analysis when some things really need runtime testing
**How to avoid:** The CONTEXT.md explicitly lists what needs human verification: scope label rendering, form show/hide, toast messages, redirect behavior
**Warning signs:** All truths marked VERIFIED with no HUMAN items

## Code Examples

### Verification Evidence Pattern (from Phase 4)

The Phase 4 VERIFICATION.md provides the exact evidence format:

```markdown
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Proxy relationships can be created and queried | VERIFIED | `AdminUsersProxy.ts` -- full Sequelize model, tableName `admin_users_proxy`, unique composite index `idx_user_person`. Registered in `init-models.ts` line 225. |
```

Evidence must cite:
- Specific file path
- Specific line numbers or content markers
- What was found at that location
- Why it confirms the truth

### Key Link Evidence Pattern

```markdown
| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `controllers/db/userroles.controller.ts` | `admin_users_proxy` table | `getProxyDataForUser` SQL query | WIRED | Line 37: `SELECT personIdentifier FROM admin_users_proxy WHERE userID = :userID`. |
```

### Requirements Coverage Pattern

```markdown
| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROXY-01 | 04-01, 04-02 | Superuser can assign proxy | SATISFIED | ProxyAssignmentsSection in AddUser form, proxy CRUD API, table model all in place. |
```

### Test Coverage Assessment Pattern (new section for Phase 5)

```markdown
| Requirement | Existing Tests | Coverage | Gaps |
|-------------|---------------|----------|------|
| SCOPE-01 | constants-scoped.test.ts (12 tests) | Capability model only | No schema test, no controller test |
| SCOPE-06 | scopeResolver.test.ts (13 tests) | Full edge case coverage | None -- all combinations tested |
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No verification | VERIFICATION.md per phase | Phase 1 (2026-03-16) | Every phase now has verification except Phase 3 |
| SUMMARY self-checks | Independent verifier reads code | Phase 4 (2026-03-17) | Higher confidence in verification results |
| Manual-only verification | Static analysis + automated tests | Phase 4 (2026-03-17) | 15/15 truths verified with line-level evidence |

## Open Questions

1. **Phase 4 modifications to Phase 3 files**
   - What we know: Phase 4 added `isProxyFor` checks and proxy-related code to several files that Phase 3 originally modified (Search.js, SideNavbar.tsx, curate/[id].js, manageprofile/[userId].tsx, person.controller.ts, userfeedback/[uid].ts, goldstandard.ts)
   - What's unclear: Whether Phase 4's modifications preserved all Phase 3 code correctly
   - Recommendation: Verify Phase 3 code is still present in files that Phase 4 also modified; this is a higher priority verification concern

2. **Test infrastructure gap**
   - What we know: VALIDATION.md planned 7 test stubs in `__tests__/phase03/`; zero were created. But 2 test files in `__tests__/utils/` cover core logic (27 tests passing)
   - What's unclear: Whether the existing tests are sufficient or if the missing Wave 0 stubs represent a real coverage gap
   - Recommendation: Document in Test Coverage Assessment section; the existing 27 tests cover core logic (scopeResolver + capabilities) but no UI component tests, no API endpoint tests, no integration tests

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 27.5.1 via next/jest |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="(scopeResolver\|constants-scoped)" --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCOPE-01 | AdminUsersPersonType model + Curator_Scoped capability | unit | `npx jest --testPathPattern="constants-scoped" --no-coverage` | Yes (partial -- tests capability model, not schema) |
| SCOPE-02 | Search scope filter checkbox and filtering | component | N/A | No |
| SCOPE-03 | API 403 enforcement + page redirects | integration | N/A | No |
| SCOPE-04 | CurationScopeSection person types UI | component | N/A | No |
| SCOPE-05 | CurationScopeSection org units UI | component | N/A | No |
| SCOPE-06 | Null handling, flexible combinations | unit | `npx jest --testPathPattern="scopeResolver" --no-coverage` | Yes (full coverage) |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern="(scopeResolver|constants-scoped)" --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Existing tests green before verification

### Wave 0 Gaps
None created -- VALIDATION.md listed 7 test stubs but Phase 5 is read-only (verification only, no test creation per CONTEXT.md decisions).

Test coverage assessment will be documented in VERIFICATION.md as evidence of what coverage exists vs what was planned.

## Sources

### Primary (HIGH confidence)
- Phase 3 PLAN files (03-01 through 03-05): must_haves.truths and must_haves.key_links (total: 30 truths, 14 key links)
- Phase 3 SUMMARY files (03-01 through 03-05): Claims to verify against
- Phase 4 VERIFICATION.md: Established format template
- Phase 5 CONTEXT.md: User decisions on methodology and output format
- Source files on disk: All 16 key files verified present
- Test results: 27 tests passing across 2 suites

### Secondary (MEDIUM confidence)
- Milestone audit (v1.0-MILESTONE-AUDIT.md): Motivation and gap identification
- Phase 3 VALIDATION.md: Wave 0 test stubs that were never created

## Metadata

**Confidence breakdown:**
- Verification methodology: HIGH -- Phase 4 provides proven template; CONTEXT.md locks decisions
- File inventory: HIGH -- all files verified present on disk with sizes
- Truth inventory: HIGH -- extracted directly from plan frontmatter (30 truths, 14 links)
- Test coverage: HIGH -- tests run and pass (27/27)

**Research date:** 2026-03-18
**Valid until:** 2026-04-17 (stable -- verification methodology doesn't change)
