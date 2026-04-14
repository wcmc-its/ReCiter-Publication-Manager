---
phase: 17
slug: admin-crud
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (via Next.js built-in) |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `npx jest --testPathPattern=admin` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=admin`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | ADMIN-01 | — | N/A | integration | `curl /api/db/admin/adminRoles` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 1 | ADMIN-02 | — | N/A | integration | `curl /api/db/admin/adminPermissions` | ❌ W0 | ⬜ pending |
| 17-03-01 | 03 | 2 | ADMIN-03 | — | N/A | unit | `npx jest --testPathPattern=RolesTab` | ❌ W0 | ⬜ pending |
| 17-04-01 | 04 | 2 | ADMIN-07 | — | N/A | unit | `npx jest --testPathPattern=PermissionsTab` | ❌ W0 | ⬜ pending |
| 17-05-01 | 05 | 3 | ADMIN-04 | T-17-01 | Role deletion blocked when users assigned | integration | `curl DELETE /api/db/admin/adminRoles/:id` | ❌ W0 | ⬜ pending |
| 17-06-01 | 06 | 3 | ADMIN-05 | T-17-02 | Permission deletion blocked when roles assigned | integration | `curl DELETE /api/db/admin/adminPermissions/:id` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Jest configuration verified for API route testing
- [ ] Test utilities for mocking Sequelize models if needed
- [ ] Shared fixtures for admin roles, permissions, and resources test data

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab navigation preserves Users tab state | ADMIN-01 | Requires browser interaction with React state | Navigate to Roles tab and back; verify search text persists |
| Modal form layout and field visibility | ADMIN-06, ADMIN-08 | Visual layout verification | Open each modal type; verify fields match spec |
| MUI Chip rendering for permissions | ADMIN-03 | Visual component rendering | Verify permission chips display in Roles table rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
