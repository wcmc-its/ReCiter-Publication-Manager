---
phase: 17
slug: admin-crud
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc) for static analysis |
| **Config file** | tsconfig.json (existing) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

**Rationale:** This phase creates new controller files, API routes, and React components. The existing project does not have Jest configured for these code paths, and introducing a Jest setup would be a separate infrastructure task outside phase scope. TypeScript compilation (`npx tsc --noEmit`) provides static type checking across all new files, verifying imports resolve, Sequelize model usage is correct, React component props match, and no type errors exist. This is the same verification pattern used successfully in Phases 14-16.

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` on modified files
- **After every plan wave:** Run `npx tsc --noEmit` (full project)
- **Before `/gsd-verify-work`:** Full tsc must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 17-01-01 | 01 | 1 | ADMIN-01 | T-17-01 | Auth header check | static | `npx tsc --noEmit controllers/db/admin/roles.controller.ts` | ⬜ pending |
| 17-01-02 | 01 | 1 | ADMIN-04 | T-17-01 | Auth header check | static | `npx tsc --noEmit controllers/db/admin/permissions.controller.ts` | ⬜ pending |
| 17-01-03 | 01 | 1 | ADMIN-01..08 | T-17-01 | Auth on all routes | static | `npx tsc --noEmit src/pages/api/db/admin/roles/*.ts src/pages/api/db/admin/permissions/*.ts` | ⬜ pending |
| 17-02-01 | 02 | 2 | ADMIN-01 | T-17-08 | Auth fetch pattern | static | `npx tsc --noEmit src/components/elements/Manage/RolesTab.tsx` | ⬜ pending |
| 17-02-02 | 02 | 2 | ADMIN-02,03 | T-17-10 | Server-side validation | static | `npx tsc --noEmit src/components/elements/Manage/RoleEditModal.tsx src/components/elements/Manage/DeleteBlockedModal.tsx src/components/elements/Manage/DeleteConfirmModal.tsx` | ⬜ pending |
| 17-03-01 | 03 | 2 | ADMIN-09 | — | N/A | static | `npx tsc --noEmit src/components/elements/Manage/ManageUsersTabs.tsx src/pages/manageusers/index.tsx` | ⬜ pending |
| 17-03-02 | 03 | 2 | ADMIN-04,07 | T-17-11 | Auth fetch pattern | static | `npx tsc --noEmit src/components/elements/Manage/PermissionsTab.tsx` | ⬜ pending |
| 17-03-03 | 03 | 2 | ADMIN-05,06,08 | T-17-12 | Server-side validation | static | `npx tsc --noEmit src/components/elements/Manage/PermissionEditModal.tsx src/components/elements/Manage/ResourceRow.tsx` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The TypeScript compiler is already configured via `tsconfig.json`. No additional test framework setup is needed for this phase's verification strategy.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab navigation preserves Users tab state | ADMIN-09 | Requires browser interaction with React state | Navigate to Roles tab and back; verify search text persists |
| Modal form layout and field visibility | ADMIN-06, ADMIN-08 | Visual layout verification | Open each modal type; verify fields match spec |
| MUI Chip rendering for permissions | ADMIN-01 | Visual component rendering | Verify permission chips display in Roles table rows |
| Category header row styling | ADMIN-04 | Visual styling check | Verify gray background on category separator rows |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none needed -- tsc is pre-existing)
- [x] No watch-mode flags
- [x] Feedback latency < 15s (tsc --noEmit runs in ~10s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
