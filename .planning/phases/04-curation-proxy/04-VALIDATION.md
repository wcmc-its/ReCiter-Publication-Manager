---
phase: 4
slug: curation-proxy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 27.5.1 + @testing-library/react 12.1.5 |
| **Config file** | `jest.config.js` (next/jest based) |
| **Quick run command** | `npm test -- --testPathPattern=proxy -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=proxy -x`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PROXY-01 | unit | `npm test -- __tests__/utils/proxy.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | PROXY-03 | unit | `npm test -- __tests__/utils/proxy.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | PROXY-04 | unit | `npm test -- __tests__/components/Search.test.tsx -x` | ✅ (extend) | ⬜ pending |
| 04-02-02 | 02 | 1 | PROXY-05 | unit | `npm test -- __tests__/utils/proxy.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | PROXY-02 | manual-only | Manual: open curation page, click Grant Proxy, save | N/A | ⬜ pending |
| 04-03-02 | 03 | 2 | PROXY-06 | unit | `npm test -- __tests__/utils/proxy.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/utils/proxy.test.ts` — stubs for PROXY-01, PROXY-03, PROXY-05, PROXY-06
- [ ] Extend `__tests__/components/Search.test.tsx` — proxy badge rendering (PROXY-04)
- [ ] Extend `__tests__/utils/constants-scoped.test.ts` — getCapabilities with proxyPersonIds

*Existing jest infrastructure covers test running; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Curator grants proxy from curation page modal | PROXY-02 | UI interaction with modal + autocomplete + API call chain | 1. Log in as Curator_Scoped with scope for target person 2. Navigate to curate page for that person 3. Click "Grant Proxy Access" 4. Search for another curator in modal 5. Select and save 6. Verify proxy relationship persists in database |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
