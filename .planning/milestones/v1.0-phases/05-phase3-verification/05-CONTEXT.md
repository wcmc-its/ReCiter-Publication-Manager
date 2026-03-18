# Phase 5: Phase 3 Independent Verification - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Independently verify all 6 SCOPE requirements (SCOPE-01 through SCOPE-06) against the actual codebase, producing a VERIFICATION.md in the Phase 3 directory. This is a read-only verification phase — no code changes. If requirements fail verification, document findings and create a gap-closure phase.

</domain>

<decisions>
## Implementation Decisions

### Verification methodology
- Static code analysis (read actual source files, confirm code at specific lines, trace data flow) — same approach as Phase 4's successful verification
- Run existing Phase 3 tests (`scopeResolver.test.ts`, `constants-scoped.test.ts`) and include pass/fail results as additional evidence
- Include a "Human Verification Required" section for scope behaviors that can't be confirmed from code alone (scope label rendering, form show/hide, toast messages, redirect behavior)

### Failure handling
- VERIFICATION.md records pass/fail per requirement with specific findings and evidence
- If any SCOPE requirement fails verification, create a new gap-closure phase in ROADMAP.md
- Failures are flagged, not milestone-blocking — the gap-closure phase handles fixes

### Output scope
- Primary focus: verify the 6 SCOPE requirements against the codebase
- Include a test coverage assessment section — note which SCOPE requirements have test coverage and which don't
- Reference existing tests and note gaps against the VALIDATION.md Wave 0 stubs
- Do NOT write missing tests — just document the coverage gaps

### Output format
- Follow the established VERIFICATION.md format from Phases 1, 2, and 4
- Structure: Observable Truths table, Required Artifacts, Key Link Verification, Requirements Coverage, Anti-Patterns, Human Verification Required, Test Coverage Assessment, Gaps Summary
- File location: `.planning/phases/03-scoped-curation-roles/03-VERIFICATION.md`

### Claude's Discretion
- How to organize the observable truths (per-requirement vs per-plan vs per-component)
- Which key links to trace (prioritize based on what's most verification-worthy)
- Severity classification of any gaps found
- Wording of human verification test instructions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SCOPE-01 through SCOPE-06 definitions
- `.planning/ROADMAP.md` — Phase 3 success criteria (5 items) and Phase 5 success criteria (3 items)

### Phase 3 implementation context
- `.planning/phases/03-scoped-curation-roles/03-CONTEXT.md` — All implementation decisions made during Phase 3
- `.planning/phases/03-scoped-curation-roles/03-VALIDATION.md` — Wave 0 test stubs (7 tests planned, none created)
- `.planning/phases/03-scoped-curation-roles/03-01-SUMMARY.md` through `03-05-SUMMARY.md` — Plan execution claims to verify against

### Verification format reference
- `.planning/phases/04-curation-proxy/04-VERIFICATION.md` — Established VERIFICATION.md format (Observable Truths, Key Links, Requirements Coverage, Anti-Patterns, Human Verification Required)

### Milestone audit (motivation)
- `.planning/v1.0-MILESTONE-AUDIT.md` — Documents the verification gap that motivated this phase

### Key source files to verify
- `src/db/models/AdminUsersPersonType.ts` — SCOPE-01 schema
- `src/utils/scopeResolver.ts` — SCOPE-02, SCOPE-03, SCOPE-06 enforcement logic
- `src/utils/constants.js` — Curator_Scoped capability model
- `controllers/db/userroles.controller.ts` — Scope data in auth pipeline
- `src/pages/api/auth/[...nextauth].jsx` — JWT scope embedding
- `src/middleware.ts` — Route-level scope enforcement
- `controllers/db/person.controller.ts` — Search scope filtering
- `src/pages/api/reciter/save/userfeedback/[uid].ts` — API-level scope enforcement
- `src/pages/api/reciter/update/goldstandard.ts` — API-level scope enforcement
- `src/components/elements/AddUser/AddUser.tsx` — SCOPE-04, SCOPE-05 admin UI
- `src/components/elements/Manage/ManageUsers.tsx` — Role filter, scope display
- `src/components/elements/Search/Search.js` — Scope filter checkbox
- `src/components/elements/Navbar/SideNavbar.tsx` — Scope label
- `src/pages/curate/[id].js` — Page-level scope enforcement
- `src/pages/manageprofile/[userId].tsx` — Page-level scope enforcement

### Existing tests to run
- `__tests__/utils/scopeResolver.test.ts` — isPersonInScope unit tests
- `__tests__/utils/constants-scoped.test.ts` — getCapabilities with Curator_Scoped

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 4's VERIFICATION.md: Complete format template with Observable Truths, Key Links, Requirements Coverage sections
- Phase 3's 5 SUMMARY.md files: Claims to verify against (but NOT to be trusted — independent verification required)
- Existing test files: `scopeResolver.test.ts` and `constants-scoped.test.ts` provide automated evidence

### Established Patterns
- VERIFICATION.md uses table format: `| # | Truth | Status | Evidence |`
- Key links table: `| From | To | Via | Status | Details |`
- Requirements coverage: `| Requirement | Source Plan | Description | Status | Evidence |`
- Status values: VERIFIED, WARN, FAILED for truths; WIRED for links; SATISFIED, PARTIAL, FAILED for requirements

### Integration Points
- Output goes into Phase 3 directory (not Phase 5): `.planning/phases/03-scoped-curation-roles/03-VERIFICATION.md`
- Milestone audit should be updated to reflect verification results
- REQUIREMENTS.md traceability should be updated based on findings

</code_context>

<specifics>
## Specific Ideas

- "Independent" means: do NOT trust SUMMARY claims or REQUIREMENTS.md checkboxes — verify by reading the actual source files
- Use the same level of rigor as Phase 4's verification (line-level code references, specific file paths)
- Test run results should be included as evidence alongside static analysis
- Human verification section should match Phase 4's style (behavior, requirement, why manual, test instructions)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-phase3-verification*
*Context gathered: 2026-03-18*
