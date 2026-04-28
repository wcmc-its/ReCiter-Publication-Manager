---
phase: 7
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 7 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (build check + custom import script) |
| **Config file** | none -- Wave 0 creates import test script |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npx tsx scripts/test-phase7-imports.mjs` |
| **Estimated runtime** | ~90 seconds (build ~60-90s, import test ~5s) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npx tsx scripts/test-phase7-imports.mjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds for import test alone; build step exempt (SWC full-project compilation inherently slower)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PORT-01 | build | `npm run build` | N/A | pending |
| 07-01-02 | 01 | 1 | PORT-02 | import | `npx tsx scripts/test-phase7-imports.mjs` | W0 | pending |
| 07-02-01 | 02 | 2 | PORT-03 | import | `npx tsx scripts/test-phase7-imports.mjs` | W0 | pending |
| 07-02-02 | 02 | 2 | DB-01 | manual | `mysql -e "DESCRIBE admin_users" reciterdb` | manual-only | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `scripts/test-phase7-imports.mjs` -- import test that verifies scopeResolver exports, constants exports, and AdminUser model compile/load correctly
- [ ] No test framework install needed (build check + Node import script sufficient; Jest arrives Phase 11)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| admin_users has 3 JSON columns in dev reciterDB | DB-01 | Requires database access | Run `DESCRIBE admin_users` on dev reciterDB, verify scope_person_types, scope_org_units, proxy_person_ids columns exist as longtext |
| ALTER TABLE DDL committed to ReCiterDB repo | DB-01 | Cross-repo verification | Check ReCiterDB repo for updated createDatabaseTableReciterDb.sql |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (import test alone; build step exempt as noted)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
