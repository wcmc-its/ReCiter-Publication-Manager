---
phase: 15
slug: auth-and-middleware
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x with ts-jest |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest --config jest.config.js --testPathPattern="permission"` |
| **Full suite command** | `npx jest --config jest.config.js` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --config jest.config.js --testPathPattern="permission"`
- **After every plan wave:** Run `npx jest --config jest.config.js`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | AUTH-01 | T-15-01 | Permission resolution returns correct keys for each role | unit | `npx jest --testPathPattern="findUserPermissionsEnriched"` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | AUTH-02 | — | Permission resources include route, icon, label for resolved permissions | unit | `npx jest --testPathPattern="permissionResources"` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | AUTH-03 | T-15-02 | JWT token includes permissions array and permissionResources array | integration | `npx jest --testPathPattern="jwt"` | ❌ W0 | ⬜ pending |
| 15-01-04 | 01 | 1 | AUTH-04 | — | Session exposes permissions and permissionResources to client | integration | `npx jest --testPathPattern="session"` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | MW-01 | T-15-03 | Middleware checks permission keys not role labels | unit | `npx jest --testPathPattern="middleware"` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | MW-02 | — | ROUTE_PERMISSIONS map covers all 7 protected routes | unit | `npx jest --testPathPattern="routePermissions"` | ❌ W0 | ⬜ pending |
| 15-02-03 | 02 | 2 | MW-03 | T-15-04 | Empty permission set falls back to canSearch + canReport | unit | `npx jest --testPathPattern="baseline"` | ❌ W0 | ⬜ pending |
| 15-02-04 | 02 | 2 | MW-04 | — | Curator_Self redirect still works via role array | unit | `npx jest --testPathPattern="curatorSelf"` | ❌ W0 | ⬜ pending |
| 15-02-05 | 02 | 2 | MW-05 | — | Landing page uses getLandingPageFromPermissions | unit | `npx jest --testPathPattern="landingPage"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/findUserPermissionsEnriched.test.ts` — stubs for AUTH-01, AUTH-02
- [ ] `__tests__/middleware.test.ts` — stubs for MW-01 through MW-05
- [ ] Existing jest.config.js covers new test paths

*Existing infrastructure covers framework requirements. Only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login flow works end-to-end with SAML | AUTH-03, AUTH-04 | Requires SAML IdP and real browser session | Log in via SAML on reciter-dev, check browser session for permissions and permissionResources |
| Curation scope unchanged for live users | MW-04 | Requires multiple user accounts with different scope configs | Test with Curator_Self, Curator_Scoped, and proxy users on reciter-dev |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
