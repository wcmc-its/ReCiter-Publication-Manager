---
phase: 5
slug: phase3-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing) |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npx jest --testPathPattern="phase03|scope" --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="phase03|scope" --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SCOPE-01 | verification | `grep -c "ScopeCapability\|ScopeRole\|ScopeContext" src/utils/scopeConstants.ts` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | SCOPE-02 | verification | `grep -c "scopeResolver\|resolveScope" src/components/elements/Navbar/SideNavbar.tsx` | ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | SCOPE-03 | verification | `grep -c "scopeResolver\|resolveScope" src/pages/curate/\\[id\\].js` | ✅ | ⬜ pending |
| 05-01-04 | 01 | 1 | SCOPE-04 | verification | `grep -c "scopeResolver\|resolveScope" src/pages/search/index.js` | ✅ | ⬜ pending |
| 05-01-05 | 01 | 1 | SCOPE-05 | verification | `grep -c "scopeResolver\|resolveScope" src/pages/report/index.js` | ✅ | ⬜ pending |
| 05-01-06 | 01 | 1 | SCOPE-06 | verification | `npx jest --testPathPattern="scopeResolver" --no-coverage` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 5 is a verification-only phase — it reads and inspects codebase artifacts rather than creating new functional code. Existing tests (27 passing) provide the automated verification baseline.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phase 4 co-modified files preserve Phase 3 code | SCOPE-01 through SCOPE-06 | Requires diff analysis of shared files | Compare Phase 3 observable truths against current file state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
