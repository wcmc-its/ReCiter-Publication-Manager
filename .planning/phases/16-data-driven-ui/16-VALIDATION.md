---
phase: 16
slug: data-driven-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (via next/jest) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --testPathPattern permissionUtils` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern permissionUtils`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 0 | UI-02 | — | N/A | unit | `npx jest --testPathPattern iconRegistry` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | UI-01 | T-16-01 | Default-deny: empty permissionResources → no nav items | manual-only | N/A (requires browser session) | N/A | ⬜ pending |
| 16-01-03 | 01 | 1 | UI-02 | — | N/A | manual-only | N/A (requires browser session) | N/A | ⬜ pending |
| 16-01-04 | 01 | 2 | UI-03 | T-16-03 | Missing permission → tab hidden (default-deny) | manual-only | N/A (requires browser session) | N/A | ⬜ pending |
| 16-01-05 | 01 | 2 | UI-04 | T-16-02 | Grant Proxy requires both canCurate AND canManageUsers | manual-only | N/A (requires browser session) | N/A | ⬜ pending |
| 16-01-06 | 01 | 2 | UI-05 | — | N/A | unit | `npx jest --testPathPattern permissionUtils` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/iconRegistry.test.ts` — stubs for UI-02 (icon name resolution, fallback behavior)
- [ ] Playwright verification plan: Curator_Self nav items (manual via Playwright MCP)
- [ ] Playwright verification plan: Superuser nav items (manual via Playwright MCP)

*Existing `__tests__/permissionUtils.test.ts` (18 tests) covers permission utility behavior.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SideNavbar renders from permissionResources | UI-01 | Requires authenticated browser session with role-specific JWT | 1. Login as Curator_Self 2. Verify only "Curate Publications" nav item 3. Login as Superuser 4. Verify all 7 nav items |
| Nav icons/labels/routes match DB seed data | UI-02 | Visual verification of MUI icons rendering | 1. Login as Superuser 2. Compare each nav icon/label against seed data in migration |
| ReciterTabs uses permission checks | UI-03 | Requires curation page with active publications | 1. Login as Curator_Self 2. Navigate to curate page 3. Verify tab visibility matches permissions |
| Grant Proxy button conditional display | UI-04 | Requires authenticated session with specific permission combo | 1. Login as user with canCurate + canManageUsers 2. Verify Grant Proxy visible 3. Login as Curator_Self (canCurate only) 4. Verify Grant Proxy hidden |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
