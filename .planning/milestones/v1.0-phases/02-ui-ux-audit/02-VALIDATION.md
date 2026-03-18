---
phase: 02
slug: ui-ux-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 27.5.1 + @testing-library/react 12.1.5 |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx next lint` |
| **Full suite command** | `npx jest && npx next lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx next lint`
- **After every plan wave:** Run `npx jest && npx next lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | UIUX-03 | lint | `npx next lint` (zero a11y errors after setup) | No — W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | UIUX-01 | manual-only | N/A (audit reports are markdown deliverables) | N/A | ⬜ pending |
| 02-01-03 | 01 | 1 | UIUX-02 | manual-only | N/A (AUDIT-group-curation.md is deliverable) | N/A | ⬜ pending |
| 02-02-01 | 02 | 2 | UIUX-03 | lint + smoke | `npx jest && npx next lint` | No — W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `jest.config.js` — Jest configuration using next/jest
- [ ] `jest.setup.js` — @testing-library/jest-dom import
- [ ] `package.json` test script — `"test": "jest"`
- [ ] devDependencies install: jest@27.5.1, jest-environment-jsdom@27.5.1, @testing-library/react@12.1.5, @testing-library/jest-dom@5.17.0
- [ ] `.eslintrc.json` update — extend with plugin:jsx-a11y/strict
- [ ] devDependency: eslint-plugin-jsx-a11y@6.10.2 (make direct dep, not just transitive)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 8 views audited with severity-tagged findings | UIUX-01 | Audit reports are qualitative markdown deliverables | Verify 8 AUDIT-*.md files exist in phase directory with Critical/Major/Minor sections |
| Group Curation documented with actionable recommendations | UIUX-02 | Redesign proposal is a qualitative design artifact | Verify AUDIT-group-curation.md exists with recommendations section |
| PATTERNS.md created with prescriptive design rules | UIUX-01 | Design patterns are qualitative | Verify PATTERNS.md exists with 4 sections (components, spacing, color, interaction) |
| Lighthouse scores captured per view | UIUX-01 | Requires live browser session | Scores embedded in each AUDIT-*.md file |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
