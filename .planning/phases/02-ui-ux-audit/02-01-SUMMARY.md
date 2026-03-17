---
phase: 02-ui-ux-audit
plan: 01
subsystem: ui
tags: [eslint, jsx-a11y, accessibility, wcag, audit, lighthouse]

# Dependency graph
requires:
  - phase: 01-search-result-filtering
    provides: skeleton components, capability model, canViewPII
provides:
  - eslint-plugin-jsx-a11y strict mode configuration with component mappings
  - baseline lint with 64 a11y errors across 32 files, 10 rules
  - AUDIT-search.md with 2 critical, 6 major, 5 minor findings
  - AUDIT-curate.md with 5 critical, 8 major, 6 minor findings
  - AUDIT-report.md with 2 critical, 7 major, 9 minor findings
  - AUDIT-group-curation.md with 2 critical, 5 major, 6 minor findings plus redesign gap analysis
affects: [02-02, 02-03, 03-scoped-roles]

# Tech tracking
tech-stack:
  added: [eslint-plugin-jsx-a11y@6.10.2]
  patterns: [jsx-a11y strict mode, component mapping for react-bootstrap/Next.js]

key-files:
  created:
    - .planning/phases/02-ui-ux-audit/lint-a11y-baseline.txt
    - .planning/phases/02-ui-ux-audit/AUDIT-search.md
    - .planning/phases/02-ui-ux-audit/AUDIT-curate.md
    - .planning/phases/02-ui-ux-audit/AUDIT-report.md
    - .planning/phases/02-ui-ux-audit/AUDIT-group-curation.md
  modified:
    - .eslintrc.json
    - package.json
    - package-lock.json

key-decisions:
  - "eslint-plugin-jsx-a11y installed as exact version 6.10.2 with component mappings for Button, Image, Link"
  - "Resolutions field in package.json fixed from caret ranges to exact versions for npm 10 compatibility"
  - "Audit conducted via code review + ESLint static analysis (no browser environment for Lighthouse/screenshots)"
  - "Individual Curation has 35 of 64 total violations -- highest-priority view for fixes"
  - "Custom Tabs.js component is the single largest a11y debt item (12+ violations)"
  - "Group Curation redesign gap analysis identifies self-contained entry point as highest-impact improvement"

patterns-established:
  - "jsx-a11y strict mode extends array (not plugins array) to avoid eslint-config-next conflict"
  - "Audit template: Overview, Findings (Critical/Major/Minor), Accessibility, Performance, Recommendations"
  - "Severity definitions: Critical=blocks usage/a11y, Major=significant UX friction, Minor=cosmetic"

requirements-completed: [UIUX-01, UIUX-02, UIUX-03]

# Metrics
duration: 13min
completed: 2026-03-17
---

# Phase 2 Plan 1: UI/UX Audit (High-Traffic Views) Summary

**eslint-plugin-jsx-a11y strict mode installed with 64-error baseline captured, plus 4 view audits identifying 11 critical, 26 major, and 26 minor findings across Search, Curate, Report, and Group Curation**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-17T02:09:01Z
- **Completed:** 2026-03-17T02:22:43Z
- **Tasks:** 2
- **Files modified:** 8 (3 source + 5 audit/baseline)

## Accomplishments

- Installed eslint-plugin-jsx-a11y@6.10.2 in strict mode with component mappings for react-bootstrap Button, Next.js Image, and Next.js Link
- Captured baseline lint output: 64 accessibility errors across 32 files spanning 10 distinct jsx-a11y rules
- Audited 4 high-traffic views with complete findings tables, ESLint violation mappings, keyboard navigation assessments, and performance observations
- Produced Group Curation redesign gap analysis comparing current implementation against 02-UI-SPEC.md design contract with 8 specific recommendations

## Task Commits

Each task was committed atomically:

1. **Task 1: Install eslint-plugin-jsx-a11y strict mode and capture baseline** - `2eb8149` (chore)
2. **Task 2: Audit high-traffic views (Search, Curate, Report, Group Curation)** - `3dd15b8` (feat)

## Files Created/Modified

- `.eslintrc.json` - Extended with plugin:jsx-a11y/strict and component mappings
- `package.json` - Added eslint-plugin-jsx-a11y@6.10.2 devDependency, fixed resolutions for npm 10
- `package-lock.json` - Updated lock file with new dependency
- `.planning/phases/02-ui-ux-audit/lint-a11y-baseline.txt` - Full ESLint output with violation summary
- `.planning/phases/02-ui-ux-audit/AUDIT-search.md` - Search view audit (2C, 6M, 5m)
- `.planning/phases/02-ui-ux-audit/AUDIT-curate.md` - Individual Curation audit (5C, 8M, 6m)
- `.planning/phases/02-ui-ux-audit/AUDIT-report.md` - Report view audit (2C, 7M, 9m)
- `.planning/phases/02-ui-ux-audit/AUDIT-group-curation.md` - Group Curation audit (2C, 5M, 6m) + redesign gap analysis

## Decisions Made

1. **Resolutions field fix:** Changed `package.json` resolutions from caret ranges (`^17.0.38`) to exact versions (`17.0.91`) because npm 10 rejects caret ranges in the resolutions field as invalid semver. Also fixed corresponding entry in `package-lock.json`.

2. **Audit methodology:** Conducted code review + ESLint static analysis rather than live browser testing. Lighthouse scores documented as estimated ranges based on code analysis. This approach is appropriate for the diagnostic phase; live testing will be performed during Plan 2 when fixes are verified.

3. **Priority assessment:** Individual Curation view (AUDIT-curate.md) has 35 of 64 total ESLint violations -- more than half the codebase total. The custom Tabs.js component alone generates 12+ violations. This should be the highest-priority fix target.

4. **Group Curation redesign:** The gap analysis identifies making Group Curation self-contained (with its own person search rather than requiring Search page round-trip) as the highest-impact UX improvement for the redesign.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed npm 10 resolutions field incompatibility**
- **Found during:** Task 1 (npm install)
- **Issue:** `package.json` resolutions field used caret ranges (`^17.0.38`) which npm 10 rejects as invalid semver. The `package-lock.json` also contained the invalid version string.
- **Fix:** Changed resolutions to exact versions (`17.0.91`, `17.0.25`). Fixed matching entry in `package-lock.json`. Used `--legacy-peer-deps --ignore-scripts` flags for install.
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm install` succeeds, `eslint-plugin-jsx-a11y` appears in `node_modules/`
- **Committed in:** 2eb8149 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking issue)
**Impact on plan:** Necessary to unblock npm install on the current Node 22 / npm 10 environment. No scope creep.

## Issues Encountered

- npm 10 rejects caret ranges in the `resolutions` field (a feature intended for yarn). The `npm-force-resolutions` preinstall script in this project was designed for older npm versions. Fixed by using exact version numbers in both `package.json` and `package-lock.json`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 high-traffic view audits complete with severity-tagged findings
- ESLint baseline established for before/after comparison after fixes
- Group Curation redesign gap analysis provides clear targets for Plan 2/3
- Phase 2 Plan 2 can reference audit findings to prioritize critical fixes
- Remaining 4 views (Manage Users, Configuration, Notifications, Login/NoAccess) to be audited in Plan 2 or 3

### Key Fix Priorities for Plan 2

1. Replace custom Tabs.js with react-bootstrap Tab (eliminates 12+ violations)
2. Fix Pagination component a11y (shared -- benefits Search, Report, Group Curation)
3. Add alt text to Identity.js image (only alt-text error in codebase)
4. Fix QuickReport empty href links
5. Make evidence toggle and Show History keyboard-accessible
6. Replace Loader with skeleton components in Report and Group Curation (Phase 1 regression)

## Self-Check: PASSED

All files verified present. All commits verified in git history. ESLint config verified correct.

---
*Phase: 02-ui-ux-audit*
*Completed: 2026-03-17*
