# Phase 2: UI/UX Audit - Research

**Researched:** 2026-03-16
**Domain:** Accessibility linting, systematic UI audit methodology, component smoke testing (React 16 + Next.js 12)
**Confidence:** HIGH

## Summary

This phase requires integrating `eslint-plugin-jsx-a11y` in strict mode, conducting a systematic audit of all 8 application views (using live app review + Lighthouse + React profiler), fixing critical accessibility and UX issues, and producing a PATTERNS.md design system document plus a Group Curation UI-SPEC.md.

The key technical finding is that `eslint-plugin-jsx-a11y` v6.10.2 is already installed as a transitive dependency of `eslint-config-next` (v11.1.2). The `eslint-config-next` configuration already loads the jsx-a11y plugin but only enables 6 rules at `warn` level. Extending to `plugin:jsx-a11y/strict` will activate 33+ rules at `error` level. The codebase has at least 18 onClick handlers on non-interactive elements and only 4 label/htmlFor usages, so expect significant initial violation counts that require triage.

For smoke testing, the project has zero test infrastructure. Jest 27.5.1 (Node 14 compatible) with `next/jest` (available in Next.js 12) and `@testing-library/react@12.1.5` (React <18 peer dep) form the compatible stack. Setup is straightforward.

**Primary recommendation:** Install eslint-plugin-jsx-a11y as a direct devDependency and extend `.eslintrc.json` with `plugin:jsx-a11y/strict`. Run initial lint to quantify violations. Use violation count as the audit baseline. Fix critical violations (broken keyboard nav, missing labels on inputs, onClick on divs without keyboard handlers) after all 8 view audits complete.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use /ui-ux-pro-max skill for systematic 6-pillar evaluation across all views
- Live app review (npm run dev on port 3000 with real MySQL data) combined with code review
- Chrome DevTools MCP for screenshots embedded in audit reports
- Lighthouse accessibility + performance audits on each view via Chrome DevTools MCP
- React profiler for render performance observations per view
- Log in as Superuser (paa2013) in one browser session, navigate between views
- All 8 views audited -- no views skipped, all roles treated equally including Superuser-only views
- One markdown audit file per view (e.g., AUDIT-search.md, AUDIT-curate.md) in the phase directory
- 3-tier severity: Critical (blocks usage or a11y), Major (significant UX friction), Minor (cosmetic/polish)
- Each finding includes: issue description, severity, recommendation, file:line reference, T-shirt effort estimate (S/M/L/XL), regression tag (Y/N for Phase 1 regressions)
- Full template per view: Overview, Screenshot, Findings (by severity), Accessibility (Lighthouse + ESLint + keyboard nav), Performance (Lighthouse + React profiler), Recommendations (fix now vs fix later)
- Cross-view PATTERNS.md summary after all per-view audits complete
- Re-evaluate with fresh eyes -- do not treat CONCERNS.md findings as already covered
- High-traffic views first: Search -> Curate -> Report -> Group Curation -> Manage Users -> Configuration -> Notifications -> Login/NoAccess
- ESLint a11y integration happens BEFORE visual audit (so violations surface during audit)
- Fix in Phase 2: accessibility blockers + broken functionality + high-friction UX issues
- Document for Phase 3+: all other findings with severity, recommendation, and T-shirt effort estimate
- Batch fixes: complete all 8 view audits first, user reviews findings, THEN apply critical fixes in Plan 2
- When fixing fragile components (Publication.tsx 690 lines, TabAddPublication 576 lines): apply fix + light refactor (extract affected section into sub-component)
- Surgical approach for non-fragile components
- Plan 1: ESLint a11y setup + audit all 8 views (with Lighthouse, Chrome DevTools screenshots, React profiler) + PATTERNS.md
- User reviews Plan 1 audit reports and confirms which critical items get fixed
- Plan 2: Batch critical fixes + basic component smoke tests + Group Curation UI-SPEC via /gsd:ui-phase + before/after Lighthouse re-runs
- Target: WCAG 2.1 AA compliance
- eslint-plugin-jsx-a11y in strict mode (errors, not warnings) -- blocks linting on violations
- Auto-fix where possible (eslint --fix), then manual review of remaining violations for correct semantics
- Test keyboard navigation (tab order) on each view during live review
- Lighthouse handles color contrast checking
- Skip @axe-core/react to avoid React 16 compatibility risk
- PATTERNS.md: prescriptive rules ("do this"), four focus areas (component reuse, spacing/layout, color/typography, interaction patterns)
- Group Curation: full redesign proposal via /gsd:ui-phase producing UI-SPEC.md
- No Group Curation code changes in Phase 2 (except if critical a11y/broken issues found)
- Redesign must account for Phase 3 scoped curators seeing a filtered view
- Default sort: highest scoring articles first
- Visual re-check + Lighthouse re-run after fixes to confirm improvement (before/after comparison)
- ESLint jsx-a11y in CI catches future a11y regressions
- Basic component smoke tests (Jest + React Testing Library) for fixed components

### Claude's Discretion
- Exact Lighthouse score thresholds for pass/fail
- React profiler interpretation and which observations to surface
- Audit report narrative tone and level of detail beyond the template
- Which ESLint a11y rules need granular overrides if strict mode is too invasive
- Component test selection (which fixed components get smoke tests)

### Deferred Ideas (OUT OF SCOPE)
- @axe-core/react integration -- deferred due to React 16 compatibility concern; revisit after React upgrade
- Comprehensive test suite beyond smoke tests -- separate initiative
- Performance optimization work (beyond flagging issues) -- future phase
- Mobile/responsive audit -- out of scope per PROJECT.md ("web-first, no mobile redesign")

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UIUX-01 | Full visual audit of all views completed using systematic evaluation methodology | ESLint a11y setup provides quantitative baseline; Lighthouse CLI provides per-view scores; Chrome DevTools MCP provides screenshots; audit template structure documented below |
| UIUX-02 | Group Curation view reviewed and issues documented with recommendations | CuratePublications.tsx (128 lines) identified as the Group Curation component at `/curate` (index.js); uses `publicationsFetchGroupData` and `fetchGroupFeedbacklog` Redux actions; /gsd:ui-phase skill produces UI-SPEC.md |
| UIUX-03 | Critical accessibility issues identified and fixed (eslint-plugin-jsx-a11y integrated) | eslint-plugin-jsx-a11y v6.10.2 already installed as transitive dep; strict mode config documented; 18+ onClick-on-div violations and 1 missing alt-text already detected; Jest + RTL stack for smoke tests identified |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| eslint-plugin-jsx-a11y | 6.10.2 | Static AST accessibility linting for JSX | Already transitive dep via eslint-config-next; industry standard for React a11y; supports ESLint 7 (project uses 7.32.0); WCAG-aligned rules |
| jest | 27.5.1 | Test runner | Last version supporting Node 14 (`^10.13.0 \|\| ^12.13.0 \|\| ^14.15.0 \|\| >=15.0.0`); Next.js 12 provides `next/jest` helper |
| jest-environment-jsdom | 27.5.1 | Browser-like DOM for tests | Matches Jest 27 version; provides document/window globals for component rendering |
| @testing-library/react | 12.1.5 | Component test rendering | Last version with `react: <18.0.0` peer dep; compatible with React 16.14.0 |
| @testing-library/jest-dom | 5.17.0 | Custom Jest matchers (.toBeInTheDocument, etc.) | No React version peer dep; provides ergonomic DOM assertions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/dom | 8.20.1 | DOM querying primitives | Auto-installed as dep of @testing-library/react@12.1.5; no direct install needed |
| @testing-library/user-event | 14.5.2 | Simulated user interactions for tests | Only if smoke tests need click/type simulation; optional for Phase 2 scope |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| eslint-plugin-jsx-a11y strict | eslint-plugin-jsx-a11y recommended | Recommended only warns; strict errors -- user locked strict mode |
| @axe-core/react | eslint-plugin-jsx-a11y | axe-core/react has React 16 compatibility risk (deferred per user decision) |
| Jest 29 | Jest 27 | Jest 29 supports Node 14.15.0+ but 27 is safer with this older stack; no benefit to newer Jest here |
| @testing-library/react 16 (latest) | @testing-library/react 12.1.5 | RTL 13+ requires React 18+; 12.1.5 is the ceiling for React 16 |

**Installation:**
```bash
# ESLint a11y (make it a direct devDependency even though already transitive)
npm install --save-dev eslint-plugin-jsx-a11y@6.10.2

# Test infrastructure
npm install --save-dev jest@27.5.1 jest-environment-jsdom@27.5.1 @testing-library/react@12.1.5 @testing-library/jest-dom@5.17.0
```

**Version verification:**
- eslint-plugin-jsx-a11y: 6.10.2 (verified via `npm view`, peer dep: eslint ^3-^9)
- jest: 27.5.1 (verified via `npm view`, engine: node ^10.13.0 || ^12.13.0 || ^14.15.0 || >=15.0.0)
- @testing-library/react: 12.1.5 (verified via `npm view`, peer dep: react <18.0.0)
- @testing-library/jest-dom: 5.17.0 (verified via `npm view`, no React peer dep)

## Architecture Patterns

### Recommended Phase Output Structure
```
.planning/phases/02-ui-ux-audit/
├── 02-CONTEXT.md              # Already exists
├── 02-RESEARCH.md             # This file
├── 02-01-PLAN.md              # Plan 1: ESLint setup + all 8 audits + PATTERNS.md
├── 02-02-PLAN.md              # Plan 2: Critical fixes + smoke tests + UI-SPEC.md
├── AUDIT-search.md            # Per-view audit reports
├── AUDIT-curate.md
├── AUDIT-report.md
├── AUDIT-group-curation.md
├── AUDIT-manage-users.md
├── AUDIT-configuration.md
├── AUDIT-notifications.md
├── AUDIT-login-noaccess.md
├── PATTERNS.md                # Cross-view design system document
└── UI-SPEC-group-curation.md  # Group Curation redesign (from /gsd:ui-phase)
```

### Pattern 1: ESLint Strict A11y Configuration

**What:** Extend `.eslintrc.json` to include `plugin:jsx-a11y/strict` alongside the existing `next/core-web-vitals`.

**When to use:** Phase 2 Plan 1, first task.

**Example:**
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:jsx-a11y/strict"
  ]
}
```

**Key detail:** The `eslint-config-next` already loads the `jsx-a11y` plugin and sets 6 rules to `warn`:
- `jsx-a11y/alt-text` (warn)
- `jsx-a11y/aria-props` (warn)
- `jsx-a11y/aria-proptypes` (warn)
- `jsx-a11y/aria-unsupported-elements` (warn)
- `jsx-a11y/role-has-required-aria-props` (warn)
- `jsx-a11y/role-supports-aria-props` (warn)

Extending with `plugin:jsx-a11y/strict` will override these to `error` and add 27+ additional rules at `error` level, including:
- `jsx-a11y/click-events-have-key-events` (catches onClick without onKeyDown)
- `jsx-a11y/no-static-element-interactions` (catches onClick on div/span)
- `jsx-a11y/no-noninteractive-element-interactions` (catches onClick on non-interactive elements)
- `jsx-a11y/label-has-associated-control` (catches inputs without labels)
- `jsx-a11y/anchor-is-valid` (catches anchors without href)
- `jsx-a11y/heading-has-content` (catches empty headings)
- `jsx-a11y/no-autofocus` (catches autoFocus usage)

### Pattern 2: Strict vs Recommended Differences

**What:** The 7 rules that differ between recommended and strict configurations.

**When to use:** When triaging violations and deciding if any rules need per-file overrides.

| Rule | Recommended | Strict |
|------|-------------|--------|
| `anchor-ambiguous-text` | `off` | not set (inherited off) |
| `interactive-supports-focus` | error (with exceptions for progressbar, slider) | error (more tabbable roles required) |
| `no-interactive-element-to-noninteractive-role` | error (allows tr->none, canvas->img) | error (no exceptions) |
| `no-noninteractive-element-interactions` | error (allows onClick on alert, dialog) | error (only body, iframe, img exceptions) |
| `no-noninteractive-element-to-interactive-role` | error (allows ul->listbox, li->menuitem, etc.) | error (no exceptions) |
| `no-noninteractive-tabindex` | error (allows tabpanel) | error (no exceptions) |
| `no-static-element-interactions` | error (allows expression values) | error (no exceptions) |

The practical impact: strict mode removes the "escape hatches" that recommended provides. If strict is too aggressive for specific Bootstrap/MUI patterns, targeted `// eslint-disable-next-line` or rule-level configuration adjustments may be needed.

### Pattern 3: Jest + next/jest Configuration

**What:** Jest configuration using Next.js 12's built-in `next/jest` helper.

**When to use:** Phase 2 Plan 2, test setup task.

**Example:**
```javascript
// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterSetup: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

module.exports = createJestConfig(customJestConfig)
```

```javascript
// jest.setup.js
import '@testing-library/jest-dom'
```

```json
// package.json (add to scripts)
{
  "test": "jest",
  "test:watch": "jest --watch"
}
```

### Pattern 4: Component Smoke Test Pattern

**What:** Minimal render test verifying a component mounts without crashing.

**When to use:** After fixing a component in Plan 2; ensures fix doesn't break rendering.

**Example:**
```tsx
// __tests__/components/Search.test.tsx
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { SessionProvider } from 'next-auth/client'
import configureStore from 'redux-mock-store'
import thunk from 'redux-thunk'

const mockStore = configureStore([thunk])

describe('Search', () => {
  it('renders without crashing', () => {
    const store = mockStore({
      // minimal state shape
      identityData: [],
      identityFetching: false,
      filters: {},
      errors: [],
    })

    render(
      <Provider store={store}>
        <Search />
      </Provider>
    )

    // Verify key element exists
    expect(screen.getByText(/Find People/i)).toBeInTheDocument()
  })
})
```

**Key constraint:** Components depend heavily on Redux state and next-auth session. Smoke tests must wrap components in both `<Provider>` (Redux) and mock the session. The `next-auth/client` module will need mocking via `jest.mock('next-auth/client')`.

### Pattern 5: Audit Report Template

**What:** Standardized template for per-view audit files.

**When to use:** Each of the 8 view audits in Plan 1.

```markdown
# Audit: [View Name]

**Date:** YYYY-MM-DD
**Auditor:** Claude (AI) + manual review
**Route:** /path
**Component(s):** ComponentName.tsx (X lines)

## Overview
[1-2 sentence description of view purpose and user flow]

## Screenshot
[Chrome DevTools MCP screenshot embedded]

## Findings

### Critical
| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|

### Major
| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|

### Minor
| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|

## Accessibility

### Lighthouse Score
- Accessibility: XX/100
- [Key findings from Lighthouse]

### ESLint jsx-a11y Violations
| Rule | Count | Files |
|------|-------|-------|

### Keyboard Navigation
- Tab order: [logical/illogical, details]
- Focus indicators: [visible/not visible]
- Keyboard traps: [none found / details]

## Performance

### Lighthouse Score
- Performance: XX/100
- First Contentful Paint: Xs
- Largest Contentful Paint: Xs

### React Profiler
- [Notable render observations]
- [Unnecessary re-renders if any]

## Recommendations

### Fix Now (Phase 2)
1. [Critical items]

### Fix Later (Phase 3+)
1. [Non-critical items with effort estimates]
```

### Anti-Patterns to Avoid

- **Fixing issues during audit:** The audit phase (Plan 1) is observation only. All fixes happen in Plan 2 after user review. Mixing audit and fix creates unclear before/after comparison.
- **Using eslint-disable liberally during setup:** First run ESLint to see all violations, quantify them, then decide which rules need overrides. Do not pre-emptively disable rules.
- **Testing implementation details:** Smoke tests should test "does it render" and "does the key element appear," not internal state management or Redux action dispatching.
- **Skipping keyboard navigation testing:** ESLint catches many a11y issues statically but cannot detect keyboard traps, illogical tab order, or invisible focus indicators. Manual keyboard testing per view is required.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessibility rule checking | Custom JSX AST walker | eslint-plugin-jsx-a11y strict | 33+ rules maintained by community; covers WCAG 2.1 AA surface area; integrates with existing ESLint |
| Color contrast checking | Manual pixel comparison | Lighthouse accessibility audit | Automated WCAG contrast ratio checking (4.5:1 for normal text, 3:1 for large); covers all elements |
| Component render testing | Manual browser refresh | Jest + React Testing Library | Repeatable, automated; catches regressions; `next/jest` handles Next.js-specific transforms |
| Performance profiling | Manual timing | Lighthouse + React Profiler (DevTools) | Standardized metrics (FCP, LCP, CLS); component-level render timing |
| Audit report generation | Ad-hoc notes | Structured template (Pattern 5 above) | Consistent format enables cross-view comparison and severity aggregation |
| UI spec for Group Curation redesign | Freeform design document | /gsd:ui-phase skill | Produces structured UI-SPEC.md with component hierarchy, state management, and interaction patterns |

**Key insight:** The audit phase is primarily about observation and documentation. The tools (ESLint, Lighthouse, React Profiler) do the heavy lifting for accessibility and performance measurement. The human/AI value is in interpreting results, prioritizing findings, and prescribing patterns in PATTERNS.md.

## Common Pitfalls

### Pitfall 1: eslint-plugin-jsx-a11y Already Loaded by eslint-config-next
**What goes wrong:** Adding `"plugins": ["jsx-a11y"]` to `.eslintrc.json` when it is already loaded by `eslint-config-next` causes a "plugin already loaded" error or rule conflicts.
**Why it happens:** `eslint-config-next/index.js` already includes `plugins: ['import', 'react', 'jsx-a11y']` and sets 6 jsx-a11y rules to `warn`.
**How to avoid:** Only add `"plugin:jsx-a11y/strict"` to `extends` array. Do NOT add `"jsx-a11y"` to `plugins` array. The extends will override the warn-level rules to error.
**Warning signs:** ESLint error about duplicate plugin definition; or rules still at warn level after config change.

### Pitfall 2: Strict Mode Overwhelm on First Run
**What goes wrong:** Running `npx next lint` after adding strict mode produces hundreds of errors, developer panic-disables rules.
**Why it happens:** Codebase has 18+ onClick on non-interactive elements, minimal label usage (4 total), and minimal aria attributes (22 total across all components). Strict mode will flag all of these.
**How to avoid:** First run is diagnostic only. Capture output to a file (`npx next lint 2>&1 > lint-a11y-baseline.txt`). Categorize violations by rule and count. Only then decide which rules need temporary overrides vs. which violations get fixed.
**Warning signs:** Developer adds `/* eslint-disable */` at file tops or switches back to recommended mode.

### Pitfall 3: Bootstrap/MUI Components Triggering False Positives
**What goes wrong:** React Bootstrap and MUI components render non-semantic HTML internally (e.g., `<div role="button">` without tabIndex). ESLint flags JSX that uses these components even though the rendered HTML is accessible.
**Why it happens:** eslint-plugin-jsx-a11y analyzes JSX AST, not rendered DOM. It doesn't know that `<Button>` from react-bootstrap renders an accessible `<button>` element.
**How to avoid:** Configure component mapping in ESLint config if needed:
```json
{
  "settings": {
    "jsx-a11y": {
      "components": {
        "Button": "button",
        "Image": "img",
        "Input": "input",
        "Link": "a"
      }
    }
  }
}
```
**Warning signs:** Violations on react-bootstrap `<Form.Control>`, `<Button>`, or MUI `<TextField>` that are actually accessible.

### Pitfall 4: Jest Configuration Conflicts with Next.js SWC
**What goes wrong:** Jest tests fail with SWC transform errors or TypeScript compilation issues.
**Why it happens:** Next.js 12 uses SWC compiler, but `next/jest` automatically handles the transform configuration. Issues arise if a separate babel config or tsconfig conflicts.
**How to avoid:** Use `next/jest` helper (confirmed available in this project). Do NOT create a separate `.babelrc` or `babel.config.js` -- let `next/jest` handle transforms via SWC. If `tsconfig.json` has strict: false, ensure test files follow the same rules.
**Warning signs:** `SyntaxError: Unexpected token` in JSX/TSX test files; module resolution failures.

### Pitfall 5: React Testing Library Version Mismatch
**What goes wrong:** Installing `@testing-library/react` latest (v16) which requires React 18+, causing peer dependency errors.
**Why it happens:** `npm install @testing-library/react` without version pin installs latest.
**How to avoid:** Always pin to `@testing-library/react@12.1.5` for React 16 projects. This is the last version with `react: <18.0.0` peer dep.
**Warning signs:** npm peer dep warnings mentioning React 18 requirement; test files fail to render components.

### Pitfall 6: Confusing Group Curation Route with Individual Curation
**What goes wrong:** Auditing `/curate/:id` (individual curation) and thinking it covers Group Curation.
**Why it happens:** Two routes exist: `/curate` (index.js = Group Curation via CuratePublications.tsx) and `/curate/:id` ([id].js = Individual Curation via CurateIndividual/). Both are under `/curate`.
**How to avoid:** Audit both separately. `/curate` (no ID) renders CuratePublications.tsx (128 lines, group view with pagination). `/curate/[id]` renders CurateIndividual.tsx (individual person view).
**Warning signs:** Missing audit for the Group Curation view; UI-SPEC.md references wrong component.

### Pitfall 7: Fragile Component Fix Without Extraction
**What goes wrong:** Fixing a11y issues in Publication.tsx (690 lines) or TabAddPublication.tsx (629 lines) causes regressions because the component is too large to understand holistically.
**Why it happens:** Large components with mixed concerns. A fix in one section has unintended side effects.
**How to avoid:** Per CONTEXT.md decision: when fixing fragile components, extract the affected section into a sub-component first, then apply the fix to the extracted component. This isolates changes.
**Warning signs:** Fix touches 10+ lines in a 690-line file; no test coverage to catch regressions.

## Code Examples

### ESLint Configuration (Phase 2 Target)

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:jsx-a11y/strict"
  ],
  "settings": {
    "jsx-a11y": {
      "components": {
        "Button": "button",
        "Image": "img",
        "Link": "a"
      }
    }
  }
}
```

### Common A11y Fix: onClick on div

**Before (violation):**
```tsx
<div className={styles.row} onClick={() => handleSelect(item)}>
  {item.name}
</div>
```

**After (accessible):**
```tsx
<div
  className={styles.row}
  onClick={() => handleSelect(item)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(item) }}
  role="button"
  tabIndex={0}
>
  {item.name}
</div>
```

**Or better -- use a semantic element:**
```tsx
<button
  className={`${styles.row} btn btn-link`}
  onClick={() => handleSelect(item)}
  type="button"
>
  {item.name}
</button>
```

### Common A11y Fix: Missing Label

**Before (violation):**
```tsx
<input
  type="text"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Search..."
/>
```

**After (accessible):**
```tsx
<label htmlFor="search-input" className="visually-hidden">Search</label>
<input
  id="search-input"
  type="text"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Search..."
  aria-label="Search"
/>
```

### Common A11y Fix: Image Without Alt

**Before (violation -- exists in Identity.js line 33):**
```tsx
<img src={`${imageUrl}`} width="144" className={styles.imgProps}/>
```

**After (accessible):**
```tsx
<img
  src={`${imageUrl}`}
  width="144"
  className={styles.imgProps}
  alt={`Profile photo of ${personName}`}
/>
```

### Jest Config for Next.js 12

```javascript
// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterSetup: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  moduleDirectories: ['node_modules', '<rootDir>/'],
}

module.exports = createJestConfig(customJestConfig)
```

```javascript
// jest.setup.js
import '@testing-library/jest-dom'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| eslint-plugin-jsx-a11y recommended | eslint-plugin-jsx-a11y strict | Available since v6.x | Stricter rules catch more violations; no escape hatches for role/interaction exceptions |
| Manual a11y testing only | Lighthouse + ESLint + manual | Lighthouse a11y audit stable since 2020 | Automated baseline; manual covers keyboard/focus that tools miss |
| @testing-library/react 14+ | @testing-library/react 12.1.5 | RTL 13 dropped React <18 (2022) | For React 16 projects, 12.1.5 is the ceiling |
| Jest 29+ | Jest 27.5.1 | Jest 28 dropped Node <14.15 | For Node 14.16.0, Jest 27 is safe; Jest 29 technically supports 14.15+ but 27 is proven |
| Create React App test setup | next/jest | Next.js 12 (2022) | Built-in SWC transforms; no separate babel config needed |

**Deprecated/outdated:**
- `@axe-core/react`: Deferred per user decision. React 16 compatibility uncertain. Would require React DevTools integration. Skip.
- `eslint-plugin-jsx-a11y` recommended mode: Insufficient for WCAG 2.1 AA target. Too many exceptions in recommended config.

## Open Questions

1. **Exact Lighthouse Score Thresholds**
   - What we know: Lighthouse provides 0-100 accessibility and performance scores per view
   - What's unclear: What score constitutes "pass" vs "needs work" for this project
   - Recommendation: Use 90+ accessibility as target (industry standard for WCAG AA), 70+ performance as baseline. Document actual scores without hard pass/fail gates. Let user decide fix priority based on actual numbers.

2. **ESLint Strict Mode Override Extent**
   - What we know: Strict removes exceptions for common patterns (onClick on div with role, tabIndex on tabpanel). Bootstrap/MUI components may trigger false positives.
   - What's unclear: How many violations will be false positives from component library usage vs. real accessibility issues.
   - Recommendation: Run initial lint, quantify by rule. If a specific rule has >80% false positives from component library patterns, configure component mapping (see Pitfall 3) rather than disabling the rule.

3. **Group Curation Current State**
   - What we know: CuratePublications.tsx (128 lines) renders at `/curate`. It uses `publicationsFetchGroupData` for batch scoring, has pagination, and relies on `curateIdsFromSearchPage` from Redux (data comes from Search page navigation).
   - What's unclear: Whether this view is functional in its current state or has broken features. It may require navigating from Search first to populate Redux state.
   - Recommendation: During audit, test the full flow: Search -> select multiple people -> navigate to Group Curation. Document if the view is accessible standalone or requires prior navigation.

4. **next-auth/client Mocking for Tests**
   - What we know: Components use `useSession()` from `next-auth/client` (v3 API). Tests need to mock this.
   - What's unclear: Whether `next-auth/client` v3 has a built-in test helper or requires manual jest.mock().
   - Recommendation: Use `jest.mock('next-auth/client', () => ({ useSession: () => [mockSession, false], getSession: () => Promise.resolve(mockSession) }))`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 27.5.1 + @testing-library/react 12.1.5 |
| Config file | none -- Wave 0 must create jest.config.js + jest.setup.js |
| Quick run command | `npx jest --passWithNoTests` |
| Full suite command | `npx jest` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UIUX-01 | All views audited with findings | manual-only | N/A (audit reports are markdown deliverables) | N/A |
| UIUX-02 | Group Curation documented with recommendations | manual-only | N/A (AUDIT-group-curation.md + UI-SPEC.md are deliverables) | N/A |
| UIUX-03 | eslint-plugin-jsx-a11y integrated, critical violations fixed | lint + smoke | `npx next lint` (zero a11y errors) | No -- Wave 0 |
| UIUX-03 | Fixed components render without crashing | unit | `npx jest --testPathPattern="__tests__"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx next lint` (must pass with zero a11y errors after fixes)
- **Per wave merge:** `npx jest && npx next lint`
- **Phase gate:** Full lint green + all smoke tests pass + 8 audit files exist + PATTERNS.md exists

### Wave 0 Gaps
- [ ] `jest.config.js` -- Jest configuration using next/jest
- [ ] `jest.setup.js` -- @testing-library/jest-dom import
- [ ] `package.json` test script -- `"test": "jest"`
- [ ] devDependencies install: jest@27.5.1, jest-environment-jsdom@27.5.1, @testing-library/react@12.1.5, @testing-library/jest-dom@5.17.0
- [ ] `.eslintrc.json` update -- extend with plugin:jsx-a11y/strict
- [ ] devDependency: eslint-plugin-jsx-a11y@6.10.2 (make direct dep, not just transitive)

## Codebase Audit Scope

### Views and Components to Audit

| # | View | Route | Primary Component | Lines | Known Issues |
|---|------|-------|-------------------|-------|-------------|
| 1 | Search (Find People) | /search | Search.js | 477 | onClick on non-interactive elements; heavy useEffect deps warnings |
| 2 | Individual Curation | /curate/[id] | CurateIndividual.tsx | 184 | Contains Publication.tsx (690 lines) and TabAddPublication.tsx (629 lines) -- fragile |
| 3 | Report | /report | Report.tsx + SearchSummary.tsx + FilterSection.tsx | 590+ | Unfetched filter data TODO; complex filter state |
| 4 | Group Curation | /curate | CuratePublications.tsx | 128 | Rarely used; depends on Search page Redux state; redesign planned |
| 5 | Manage Users | /manageusers | ManageUsers.tsx + UsersTable.tsx + AddUser.tsx | 194+ | Superuser only |
| 6 | Configuration | /configuration | AdminSettings.tsx | 253 | Superuser only; accordion UI |
| 7 | Notifications | /notifications | Notifications.tsx | 94 | Partially implemented feature; menu hidden via capability flag |
| 8 | Login/NoAccess | /login, /noaccess | Login.js, NoAccess.tsx | ~200 | autoFocus usage in Login.js |

### Known A11y Violation Baseline (Pre-Audit)

| Category | Count | Details |
|----------|-------|---------|
| onClick on non-interactive elements (div/span/td/tr) | 18+ | Across 11 component files; will trigger no-static-element-interactions |
| Missing img alt text | 1 confirmed | Identity.js line 33 |
| Missing form labels (htmlFor) | ~30+ estimated | Only 4 label/htmlFor usages found across entire component tree |
| aria-* attribute usage | 22 total | Very sparse; most components have no ARIA attributes |
| autoFocus | 1 | Login.js |
| Current ESLint warnings | ~20 | Mostly react-hooks/exhaustive-deps; 1 jsx-a11y/alt-text |

### Bootstrap/MUI Usage Patterns

Both libraries are used throughout, creating a hybrid styling approach:
- **react-bootstrap:** 46 files import from it (Spinner, Button, Form, Modal, Accordion, Nav, Tab, Badge, Table, Pagination)
- **@mui/material:** 46 files import from it (primarily icons via @mui/icons-material, also List, ListItem, Collapse, TextField)
- **CSS Modules:** Used for component-specific styles (ComponentName.module.css)
- **Bootstrap utility classes:** Used inline (d-flex, justify-content-center, text-muted, etc.)

PATTERNS.md should document: which library to prefer for which component type, when to use CSS modules vs Bootstrap utilities, and a direction for the hybrid (consolidate toward one or accept the hybrid with clear rules).

## Sources

### Primary (HIGH confidence)
- `eslint-plugin-jsx-a11y` v6.10.2 installed package (verified by reading `node_modules/eslint-plugin-jsx-a11y` configs directly) -- strict vs recommended rule comparison
- `eslint-config-next` v11.1.2 source (`node_modules/eslint-config-next/index.js`) -- jsx-a11y plugin already loaded with 6 warn-level rules
- npm registry (`npm view` commands) -- version verification for all recommended packages
- `next/jest` module resolution -- confirmed available in Next.js 12.2.5

### Secondary (MEDIUM confidence)
- [eslint-plugin-jsx-a11y GitHub README](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) -- configuration patterns for strict mode
- [Next.js Jest testing guide](https://nextjs.org/docs/app/guides/testing/jest) -- jest.config.js setup pattern
- [WCAG 2.1 AA checklist resources](https://accessible.org/wcag/) -- common accessibility requirements

### Tertiary (LOW confidence)
- None -- all findings verified against installed packages or npm registry

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified against npm registry and installed packages; peer dependencies confirmed compatible with React 16/Node 14
- Architecture: HIGH - ESLint config pattern verified by reading `eslint-config-next` source; `next/jest` availability confirmed in project; audit template derived from CONTEXT.md decisions
- Pitfalls: HIGH - Based on direct code analysis (grep counts for onClick, labels, aria attributes) and reading actual ESLint config source

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- no fast-moving dependencies; all pinned versions)
