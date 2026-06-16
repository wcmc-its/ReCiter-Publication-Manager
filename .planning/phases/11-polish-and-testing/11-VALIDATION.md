---
phase: 11
slug: polish-and-testing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.7.0 + ts-jest |
| **Config files** | `jest.config.js` (node env), `jest.config.dom.js` (jsdom env -- created in this phase, per D-05) |
| **Quick run command** | `npx jest --config jest.config.dom.js --bail` |
| **Full suite command** | `npm test` (runs both configs sequentially) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --config jest.config.dom.js --bail`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | PORT-19 | — | N/A | config | `test -f jest.config.dom.js && npx jest --config jest.config.js 2>&1 \| tail -3` | NO W0 | pending |
| 11-01-02 | 01 | 1 | PORT-20 | — | N/A | unit | `npm test` | NO W0 | pending |
| 11-02-01 | 02 | 1 | A11Y-01 | — | N/A | lint | `npx eslint --rule '{"jsx-a11y/label-has-associated-control":"error"}' --ext .tsx,.jsx src/ 2>&1 \| grep -c "label-has-associated-control"` | YES | pending |
| 11-03-01 | 03 | 1 | A11Y-01 | — | N/A | lint | `npx eslint --ext .tsx,.jsx src/ 2>&1 \| grep -c "jsx-a11y"` | YES | pending |
| 11-03-02 | 03 | 1 | A11Y-01 | — | N/A | build | `npx next build 2>&1 \| tail -5` | YES | pending |
| 11-04-01 | 04 | 1 | PORT-18 | T-11-05 | Audit attribution | unit | `grep 'source=publication-manager' controllers/goldstandard.controller.ts` | YES | pending |
| 11-05-01 | 05 | 2 | PORT-18,PORT-19,PORT-20,A11Y-01 | — | N/A | suite | `npm test` | YES | pending |
| 11-05-02 | 05 | 2 | PORT-18 | — | N/A | manual | Visual inspection in browser | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `jest.config.dom.js` — jsdom environment config for component tests (per D-05)
- [ ] `jest.config.js` — narrow testMatch to exclude `__tests__/components/` subdirectory
- [ ] `__tests__/components/` — directory for RTL component tests
- [ ] `@testing-library/dom` — missing peer dependency (install)
- [ ] `package.json` test script — updated to run both configs: `jest --config jest.config.js && jest --config jest.config.dom.js`

*Existing infrastructure covers utility tests (jest.config.js, node env).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skeleton loading renders correctly under StrictMode | PORT-18 | Visual appearance check — no functional assertion possible | Load curate/report pages in dev mode, verify skeleton animations render without glitches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
