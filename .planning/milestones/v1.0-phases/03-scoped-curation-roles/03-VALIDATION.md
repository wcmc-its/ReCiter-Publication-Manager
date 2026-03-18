---
phase: 3
slug: scoped-curation-roles
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (Next.js built-in) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx jest --testPathPattern=__tests__/phase03` |
| **Full suite command** | `npx jest --testPathPattern=__tests__/phase03 --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=__tests__/phase03`
- **After every plan wave:** Run `npx jest --testPathPattern=__tests__/phase03 --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SCOPE-01 | unit | `npx jest --testPathPattern=scope-schema` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SCOPE-04 | unit | `npx jest --testPathPattern=scope-resolver` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SCOPE-05 | unit | `npx jest --testPathPattern=capabilities` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | SCOPE-03 | unit | `npx jest --testPathPattern=scope-enforcement` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | SCOPE-01 | unit | `npx jest --testPathPattern=manage-users-scope` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | SCOPE-02 | unit | `npx jest --testPathPattern=search-scope-filter` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | SCOPE-06 | integration | `npx jest --testPathPattern=backward-compat` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/phase03/scope-schema.test.ts` — stubs for SCOPE-01 (database schema, junction table)
- [ ] `__tests__/phase03/scope-resolver.test.ts` — stubs for SCOPE-04 (isPersonInScope logic)
- [ ] `__tests__/phase03/capabilities.test.ts` — stubs for SCOPE-05 (getCapabilities extension)
- [ ] `__tests__/phase03/scope-enforcement.test.ts` — stubs for SCOPE-03 (API 403 + page redirect)
- [ ] `__tests__/phase03/manage-users-scope.test.ts` — stubs for SCOPE-01 (admin UI scope assignment)
- [ ] `__tests__/phase03/search-scope-filter.test.ts` — stubs for SCOPE-02 (search filtering)
- [ ] `__tests__/phase03/backward-compat.test.ts` — stubs for SCOPE-06 (existing roles unchanged)
- [ ] `jest.config.js` — if no jest config detected, add minimal config

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scope label displays in side navbar | SCOPE-02 | Visual rendering | Login as scoped curator, verify "Curating: {types}, {units}" appears under name |
| Curation Scope section appears/hides based on role selection | SCOPE-01 | Interactive form behavior | On Manage Users, select Curator_Scoped role, verify scope fields appear |
| Out-of-scope person click routes to reports | SCOPE-02 | Navigation behavior | As scoped curator, click out-of-scope person name, verify redirect to reports |
| Toast message on denied curation access | SCOPE-03 | Visual notification | Navigate directly to /curate/:out-of-scope-id, verify toast appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
