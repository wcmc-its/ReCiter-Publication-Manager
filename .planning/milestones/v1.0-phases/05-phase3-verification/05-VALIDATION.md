---
phase: 5
slug: phase3-verification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 27.5.1 (existing, via next/jest) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --testPathPattern="(scopeResolver\|constants-scoped)" --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="(scopeResolver|constants-scoped)" --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 05-01-T1 | 01 | 1 | SCOPE-01 through SCOPE-06 | verification | `test -f .planning/phases/03-scoped-curation-roles/03-VERIFICATION.md && grep -c "SCOPE-0[1-6]" .planning/phases/03-scoped-curation-roles/03-VERIFICATION.md` | pending |
| 05-01-T2 | 01 | 1 | SCOPE-01 through SCOPE-06 | traceability | `grep -cE "SCOPE-0[1-6].*(Complete\|Partial\|Failed)" .planning/REQUIREMENTS.md && grep "Phase 5" .planning/STATE.md` | pending |

**Key source files verified by Task 1:**
- `src/utils/scopeResolver.ts` -- SCOPE-06 resolver logic
- `src/utils/constants.js` -- Curator_Scoped capability model
- `src/db/models/AdminUsersPersonType.ts` -- SCOPE-01 schema
- `controllers/db/userroles.controller.ts` -- auth pipeline scope data
- `src/middleware.ts` -- route-level enforcement
- `src/components/elements/Search/Search.js` -- SCOPE-02 search filtering
- `src/components/elements/AddUser/AddUser.tsx` -- SCOPE-04/05 admin UI
- `src/pages/curate/[id].js` -- SCOPE-03 page enforcement

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 5 is a verification-only phase -- it reads and inspects codebase artifacts rather than creating new functional code. Existing tests (27 passing) provide the automated verification baseline.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phase 4 co-modified files preserve Phase 3 code | SCOPE-01 through SCOPE-06 | Requires diff analysis of shared files | Compare Phase 3 observable truths against current file state |
| Scope label rendering in sidebar | SCOPE-02 | Visual UI behavior | Navigate as scoped curator, confirm "Curating:" label appears in sidebar |
| CurationScopeSection show/hide on role toggle | SCOPE-04, SCOPE-05 | Form interaction behavior | Toggle Curator_Scoped checkbox in AddUser, confirm scope fields appear/disappear |
| Toast messages on scope redirect | SCOPE-03 | Runtime toast notification | Navigate scoped curator to out-of-scope person's curate page, confirm toast and redirect |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
