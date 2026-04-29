# Phase 11: Polish and Testing - Research

**Researched:** 2026-04-06
**Domain:** Testing infrastructure (Jest/RTL), accessibility linting (jsx-a11y), CSS skeleton verification, API audit tag
**Confidence:** HIGH

## Summary

Phase 11 covers four distinct workstreams: (1) verifying CSS-based skeleton loading under React 18 StrictMode, (2) running a fresh eslint-plugin-jsx-a11y strict-mode audit and fixing all violations, (3) extending the existing Jest 29 infrastructure with a jsdom config for RTL component tests, and (4) appending a source tag to the goldstandard API URL.

The research confirms the existing test infrastructure is solid (Jest 29.7.0, ts-jest 29.4.9, 27 passing tests), but reveals a critical missing dependency: `@testing-library/dom` is a required peer dependency of `@testing-library/react@16.3.2` that is not installed. The a11y audit found 58 violations across 21 files on the current branch, dominated by three rule categories: `no-static-element-interactions` (17), `click-events-have-key-events` (16), and `label-has-associated-control` (22). The skeleton loading is purely CSS-based and requires no code changes -- only visual verification under StrictMode. The goldstandard source tag is a one-line URL modification.

**Primary recommendation:** Install `@testing-library/dom@^10.4.1` first (blocks all RTL tests), create `jest.config.dom.js` with jsdom environment, configure eslint-plugin-jsx-a11y strict mode in `.eslintrc.json`, then fix violations by category for efficiency.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The NextJS14 branch already uses CSS-based skeleton loading (`.skeletonCard` classes in Report, TabAddPublication, CuratePublications) -- NOT `react-content-loader`
- **D-02:** CSS-based skeletons have no React 18 StrictMode issues (no component lifecycle, no double-render concerns)
- **D-03:** Verify existing skeletons render correctly under StrictMode -- inspect visually, confirm no animation glitches or doubled elements
- **D-04:** Test scope/proxy components only: CurationScopeSection, ProxyAssignmentsSection, ScopeLabel, ProxyBadge, ScopeFilterCheckbox, GrantProxyModal, checkCurationScope -- approximately 10-15 tests
- **D-05:** Separate Jest config for component tests: `jest.config.dom.js` with `testEnvironment: 'jsdom'`. Keep existing `jest.config.js` (node environment) for utility tests
- **D-06:** Both configs run via `npm test` -- use Jest projects or a wrapper script
- **D-07:** Component tests go in `__tests__/components/` directory, separate from existing `__tests__/` utility tests
- **D-08:** Mock `next-auth/react` (`useSession`) and API calls -- components need session context for scope/proxy data
- **D-09:** Run a fresh eslint-plugin-jsx-a11y audit in strict mode on the NextJS14 branch -- do NOT reference the original 31 v1.0 violations (different codebase, ground-up rewrite)
- **D-10:** Strict mode (errors + warnings) to match v1.0 audit rigor
- **D-11:** Fix all violations found -- no scoping to just v1.1 components
- **D-12:** If eslint-plugin-jsx-a11y is not already installed on the branch, add it as a devDependency and configure in .eslintrc
- **D-13:** Jest 29.7.0 + ts-jest already configured and running (commit `f74b02f`)
- **D-14:** 27 passing tests across 2 suites: scopeResolver (13 tests) + capabilities (14 tests)
- **D-15:** CSS module mocks already configured (`__tests__/__mocks__/styleMock.js`)
- **D-16:** No changes needed to existing test infrastructure -- extend it with the jsdom config
- **D-17:** Append `&source=publication-manager` to the gold standard API URL in `controllers/goldstandard.controller.ts` line 13
- **D-18:** This enables the ReCiter Java audit log to correctly attribute gold standard changes to Publication Manager vs other clients

### Claude's Discretion
- Exact mock patterns for useSession and API calls in RTL tests
- CSS module mock strategy for jsdom tests (extend existing styleMock or add identity-obj-proxy)
- Order of operations for a11y fixes (batch by violation type vs fix per-component)
- Whether to add eslint-plugin-jsx-a11y to CI (lint script in package.json)

### Deferred Ideas (OUT OF SCOPE)
- Runtime a11y checking with @axe-core/react -- future enhancement, not in Phase 11 scope
- Expanding RTL tests beyond scope/proxy components (middleware, AddUser, Search page) -- future
- Admin settings for default scope on SAML auto-create -- future enhancement

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PORT-18 | Skeleton loading components work under React 18 StrictMode | Verified: `reactStrictMode: true` in next.config.js; skeletons are pure CSS (`.skeletonCard` classes in 4 component files); no lifecycle or state -- StrictMode double-render is irrelevant. Visual verification only. |
| A11Y-01 | Outstanding a11y violations resolved | Fresh audit found 58 violations across 21 files in 4 rule categories. eslint-plugin-jsx-a11y@6.10.2 already installed as transitive dep of eslint-config-next. Needs `.eslintrc.json` config extension. |
| PORT-19 | Jest 29 + RTL 16 test infrastructure live | Already done: Jest 29.7.0, ts-jest 29.4.9, 27 passing tests. Missing: `@testing-library/dom` (peer dep of RTL 16, not installed). Needs `jest.config.dom.js` for jsdom environment. |
| PORT-20 | Passing scope/proxy unit tests | 7 components identified with specific import dependencies documented. None use `useSession` directly -- mock needs are `reciterConfig` (config/local), `fetch` (global), and CSS modules (existing styleMock). |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Port 3000 is the assigned port for this application
- Never hardcode credentials -- use environment variables
- No "Co-Authored-By" or AI attribution in commits
- Create PR for review only, never merge unless explicitly told
- Test commands must work without external service dependencies (database, ReCiter API)

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| jest | 29.7.0 | Test runner | Installed, configured [VERIFIED: npm ls] |
| ts-jest | 29.4.9 | TypeScript transform for Jest | Installed, configured [VERIFIED: npm ls] |
| jest-environment-jsdom | 30.3.0 | Browser environment for component tests | Installed, verified working with Jest 29 [VERIFIED: runtime test] |
| @testing-library/react | 16.3.2 | React component testing utilities | Installed [VERIFIED: npm ls] |
| @testing-library/jest-dom | 6.9.1 | Custom Jest matchers for DOM assertions | Installed [VERIFIED: npm ls] |
| eslint-plugin-jsx-a11y | 6.10.2 | JSX accessibility linting rules | Installed as transitive dep of eslint-config-next [VERIFIED: npm ls] |
| eslint | 8.57.0 | JavaScript linter | Installed [VERIFIED: npm ls] |

### Missing (Must Install)

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| @testing-library/dom | ^10.4.1 | DOM testing utilities | REQUIRED peer dep of @testing-library/react@16.3.2, currently missing [VERIFIED: npm ls shows empty, require() fails] |

### Optional (Recommended)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/user-event | ^14.6.1 | Simulates realistic user interactions | If testing typing/clicking in ProxyAssignmentsSection or GrantProxyModal search |

**Installation:**
```bash
npm install --save-dev @testing-library/dom@^10.4.1
```

## Architecture Patterns

### Test Directory Structure
```
__tests__/
├── __mocks__/
│   └── styleMock.js         # CSS module mock (existing, returns {})
├── capabilities.test.ts      # Existing: 14 tests, node env (jest.config.js)
├── scopeResolver.test.ts     # Existing: 13 tests, node env (jest.config.js)
├── checkCurationScope.test.ts # NEW: server-side utility, node env (jest.config.js)
└── components/               # NEW: jsdom env component tests (jest.config.dom.js)
    ├── ScopeLabel.test.tsx
    ├── ProxyBadge.test.tsx
    ├── ScopeFilterCheckbox.test.tsx
    ├── CurationScopeSection.test.tsx
    ├── ProxyAssignmentsSection.test.tsx
    └── GrantProxyModal.test.tsx
```

### Pattern 1: Jest Separate Config Files (per D-05)

**What:** Create a separate `jest.config.dom.js` file for jsdom component tests alongside the existing `jest.config.js` for node utility tests. Run both sequentially via `npm test` script (per D-06).

**Why separate files over Jest projects:** D-05 explicitly specifies `jest.config.dom.js` as a separate file. The `npm test` script chains both configs: `"test": "jest --config jest.config.js && jest --config jest.config.dom.js"`.

**jest.config.js (existing, narrowed testMatch):**
```javascript
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['<rootDir>/__tests__/*.test.(ts|tsx|js)'],
  moduleNameMapper: {
    '\\.module\\.css$': '<rootDir>/__tests__/__mocks__/styleMock.js',
    '\\.css$': '<rootDir>/__tests__/__mocks__/styleMock.js',
  },
}
```

**jest.config.dom.js (NEW):**
```javascript
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['<rootDir>/__tests__/components/**/*.test.(ts|tsx|js)'],
  moduleNameMapper: {
    '\\.module\\.css$': '<rootDir>/__tests__/__mocks__/styleMock.js',
    '\\.css$': '<rootDir>/__tests__/__mocks__/styleMock.js',
  },
  setupFilesAfterSetup: ['@testing-library/jest-dom'],
}
```

**package.json test script:**
```json
"test": "jest --config jest.config.js && jest --config jest.config.dom.js"
```

### Pattern 2: Component Mocking Strategy

**What:** Mock external dependencies that components import, not `useSession` (since none of the target components use it directly).

**Analysis of actual imports per component:** [VERIFIED: codebase grep]

| Component | External Dependencies to Mock |
|-----------|-------------------------------|
| ProxyBadge | None (pure render, only `react-bootstrap/Badge`) |
| ScopeFilterCheckbox | None (pure render, `react-bootstrap/Form`) |
| ScopeLabel | `@mui/material/Tooltip` (renders children) |
| CurationScopeSection | `@mui/material/Autocomplete`, `@mui/material/TextField` |
| ProxyAssignmentsSection | `@mui/material/Autocomplete`, `@mui/material/TextField`, `@mui/material/CircularProgress`, `config/local` (reciterConfig), global `fetch` |
| GrantProxyModal | `react-bootstrap/Modal`, `@mui/material/Autocomplete`, `@mui/material/TextField`, `react-toastify`, `config/local` (reciterConfig), global `fetch`, `../Common/Loader` |
| checkCurationScope | `next-auth/jwt` (getToken), `../db/sequelize` (models), `./constants` (getCapabilities), `./scopeResolver` |

**Key insight:** D-08 mentions mocking `useSession`, but research shows NONE of the 6 UI components directly import `useSession`. The `checkCurationScope` utility uses `getToken` from `next-auth/jwt` (server-side), not `useSession` (client-side). Mock targets are: `reciterConfig`, global `fetch`, `next-auth/jwt`, and Sequelize models.

**Example -- mocking reciterConfig:**
```typescript
// __tests__/components/GrantProxyModal.test.tsx
jest.mock('../../../../config/local', () => ({
  reciterConfig: {
    backendApiKey: 'test-api-key',
  },
}));
```

**Example -- mocking global fetch:**
```typescript
beforeEach(() => {
  global.fetch = jest.fn();
});
afterEach(() => {
  jest.restoreAllMocks();
});
```

**Example -- mocking next-auth/jwt for checkCurationScope:**
```typescript
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}));
jest.mock('../../src/db/sequelize', () => ({
  Person: { findOne: jest.fn() },
  PersonPersonType: { findAll: jest.fn() },
}));
```

### Pattern 3: eslint-plugin-jsx-a11y Strict Configuration

**What:** Extend `.eslintrc.json` to include `plugin:jsx-a11y/strict` alongside `next/core-web-vitals`.

**Why not install separately:** eslint-plugin-jsx-a11y@6.10.2 is already installed as a dependency of eslint-config-next@14.2.35. No npm install needed -- only configuration. [VERIFIED: `npm ls eslint-plugin-jsx-a11y` shows 6.10.2 under eslint-config-next]

**Config change:**
```json
{
  "extends": ["next/core-web-vitals", "plugin:jsx-a11y/strict"]
}
```

**Current state:** Only 6 jsx-a11y rules active at `warn` level (from `next/core-web-vitals`). Strict mode adds 27 additional rules at `error` level, covering click-events, static-element-interactions, label-has-associated-control, and more. [VERIFIED: runtime eslint --print-config]

### Anti-Patterns to Avoid

- **Do not install eslint-plugin-jsx-a11y as a direct devDependency:** It's already a transitive dependency. Installing it separately risks version conflicts. Just configure `.eslintrc.json` to extend `plugin:jsx-a11y/strict`. [VERIFIED: npm ls]
- **Do not use Jest `projects` config when D-05 specifies separate config files:** D-05 explicitly says `jest.config.dom.js` as a separate file. Use separate config files with a sequential npm test script (`jest -c jest.config.js && jest -c jest.config.dom.js`) per D-06.
- **Do not mock MUI components:** MUI Autocomplete, TextField, etc. render real DOM in jsdom. Mocking them defeats the purpose of RTL tests. Instead, interact with them through their rendered DOM elements (input fields, listboxes).
- **Do not use jest-environment-jsdom@29.7.0:** The installed 30.3.0 works fine with Jest 29 (verified via runtime test). Downgrading is unnecessary. [VERIFIED: runtime sanity test passed]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS module mocking in tests | Custom transform | Existing `styleMock.js` (returns `{}`) | Already configured, CSS module content irrelevant for component logic tests |
| DOM assertions | Custom expect helpers | `@testing-library/jest-dom` matchers (toBeInTheDocument, toHaveTextContent, etc.) | Already installed, provides 20+ semantic DOM matchers |
| User event simulation | Manual dispatchEvent | `@testing-library/user-event` or RTL `fireEvent` | Handles event bubbling, async state updates correctly |
| A11y rule configuration | Manual rule-by-rule config | `plugin:jsx-a11y/strict` preset | Maintained by jsx-eslint team, covers 33 rules with correct severity |

## Common Pitfalls

### Pitfall 1: Missing @testing-library/dom Peer Dependency
**What goes wrong:** `@testing-library/react@16.3.2` requires `@testing-library/dom@^10.0.0` as a peer dependency. It is NOT installed.
**Why it happens:** The package was added to devDependencies but its peer dep was not auto-installed (npm 7+ behavior varies).
**How to avoid:** Install it explicitly: `npm install --save-dev @testing-library/dom@^10.4.1`
**Warning signs:** `Cannot find module '@testing-library/dom'` error when running any RTL render() call.
**Confidence:** HIGH [VERIFIED: `require('@testing-library/dom')` fails, `npm ls @testing-library/dom` shows empty]

### Pitfall 2: jest-environment-jsdom and TextEncoder/TextDecoder
**What goes wrong:** jsdom does not provide `TextEncoder` / `TextDecoder` by default in older versions. Some libraries (like `jose`, used by `next-auth`) fail with `ReferenceError: TextEncoder is not defined`.
**Why it happens:** jsdom historically didn't polyfill encoding APIs. jest-environment-jsdom@30.3.0 does include them, but imports of server-side code (like `next-auth/jwt`) in tests may still surface this.
**How to avoid:** For `checkCurationScope` tests, mock `next-auth/jwt` entirely so `jose` never loads. For component tests, the components don't import `next-auth` directly so this should not surface.
**Warning signs:** `ReferenceError: TextEncoder is not defined` during test setup.
**Confidence:** MEDIUM [ASSUMED: based on common jest-environment-jsdom issues with Next.js auth libraries]

### Pitfall 3: MUI Autocomplete Accessibility in Tests
**What goes wrong:** MUI Autocomplete renders a complex DOM structure (input + listbox + options). Finding elements by role or label requires understanding MUI's aria attributes.
**Why it happens:** Autocomplete uses `role="combobox"` on the input, `role="listbox"` on the dropdown, and `role="option"` on each item.
**How to avoid:** Use `screen.getByRole('combobox')` to find the input. To open the dropdown, focus the input and type. Use `screen.getByRole('option', { name: /text/ })` to find options.
**Warning signs:** Tests that use `getByTestId` or `querySelector` instead of RTL's role-based queries.
**Confidence:** MEDIUM [ASSUMED: MUI Autocomplete DOM structure from training data; verify at implementation time]

### Pitfall 4: a11y Fix for onClick on <span> Elements
**What goes wrong:** The `click-events-have-key-events` and `no-static-element-interactions` rules fire on `<span onClick={...}>` elements (found in GrantProxyModal line 232, other components).
**Why it happens:** `<span>` is non-interactive. Adding `onClick` without keyboard support makes the element inaccessible.
**How to avoid:** Change `<span onClick={handler}>` to `<button type="button" onClick={handler}>` where semantically appropriate, OR add `role="button"`, `tabIndex={0}`, and `onKeyDown`/`onKeyUp` handler. Prefer `<button>` when the element triggers an action.
**Warning signs:** Quick fix of just adding `role="button"` without `tabIndex` and keyboard handler -- still fails `interactive-supports-focus`.
**Confidence:** HIGH [VERIFIED: eslint audit output confirms these violations]

### Pitfall 5: React Bootstrap Form.Check and label-has-associated-control
**What goes wrong:** `eslint-plugin-jsx-a11y` may not recognize React Bootstrap's `<Form.Check>` or `<Form.Label>` as properly associated.
**Why it happens:** The rule checks for `htmlFor`/`id` association or wrapping `<label>` patterns. Component libraries like React Bootstrap handle this internally but eslint sees the JSX, not the rendered DOM.
**How to avoid:** Use eslint's `label-has-associated-control` configuration to recognize component names, or use `// eslint-disable-next-line jsx-a11y/label-has-associated-control` with a comment explaining the component handles association internally.
**Warning signs:** False positives from React Bootstrap components that actually ARE accessible.
**Confidence:** MEDIUM [ASSUMED: common issue with component libraries and jsx-a11y]

## A11y Audit Results (Fresh Scan)

### Summary
**Total violations found:** 58 errors across 21 files [VERIFIED: eslint audit on current branch]

### Violations by Rule

| Rule | Count | Fix Pattern |
|------|-------|-------------|
| `jsx-a11y/label-has-associated-control` | 22 | Add `htmlFor`/`id` association, or wrap input in `<label>` |
| `jsx-a11y/no-static-element-interactions` | 17 | Change `<span>`/`<div>` with onClick to `<button>`, or add `role` + `tabIndex` + keyboard handler |
| `jsx-a11y/click-events-have-key-events` | 16 | Add `onKeyDown`/`onKeyUp` handler alongside `onClick` |
| `jsx-a11y/no-noninteractive-element-interactions` | 2 | Remove event handler from non-interactive element, or change element semantics |
| `jsx-a11y/anchor-is-valid` | 1 | Replace `<a onClick>` with `<button>` or add valid `href` |

### Violations by File (Top 10)

| File | Count | Primary Issues |
|------|-------|----------------|
| `AddUser/AddUser.tsx` | 10 | label-has-associated-control, static-element-interactions |
| `Dropdown/Dropdown.tsx` | 6 | click-events, static-element-interactions |
| `Report/ExportModal.tsx` | 4 | click-events, static-element-interactions |
| `Report/CheckboxSelect.tsx` | 4 | click-events, static-element-interactions |
| `Common/AuthorsComponent.tsx` | 4 | click-events, static-element-interactions |
| `Manage/AdminSettings.tsx` | 3 | label-has-associated-control |
| `Header/Header.tsx` | 3 | click-events, static-element-interactions, anchor-is-valid |
| `TabAddPublication/TabAddPublication.tsx` | 2 | label-has-associated-control |
| `Search/SearchBar.tsx` | 2 | click-events, static-element-interactions |
| `Report/DatePicker.tsx` | 2 | label-has-associated-control |

### Fix Efficiency Recommendation

Fix by violation type, not by file:
1. **label-has-associated-control (22 fixes):** Most are `<label>` elements without `htmlFor` or not wrapping an input. Mechanical fix: add `htmlFor` matching the input's `id`.
2. **click-events + no-static-element-interactions (17+16 = 33 fixes, ~17 unique locations):** These co-occur on the same elements. Fix once per location. Pattern: change `<span onClick>` or `<div onClick>` to `<button type="button" onClick>`.
3. **no-noninteractive-element-interactions (2 fixes):** Similar to above but on semantic elements (e.g., `<tr>`, `<li>`). Add `role` attribute or move handler to child interactive element.
4. **anchor-is-valid (1 fix):** Replace `<a onClick>` with `<button>`.

## Skeleton Loading Verification

### Current State [VERIFIED: codebase grep]
CSS-based skeleton loading exists in 4 component files:
- `src/components/elements/Report/Report.module.css` -- `.skeletonCard`, `.skTitle`, `.skAuthors`, `.skMeta`
- `src/components/elements/TabAddPublication/TabAddPublication.module.css` -- same pattern
- `src/components/elements/CuratePublications/CuratePublications.module.css` -- same pattern
- `src/components/elements/CurateIndividual/CurateIndividual.module.css` -- same pattern

Each renders 3 skeleton cards with CSS animation (shimmer effect via `@keyframes`). No React component state, no lifecycle methods, no `useEffect`. Pure `<div>` elements with CSS classes.

### StrictMode Status [VERIFIED: next.config.js]
`reactStrictMode: true` is already enabled in `next.config.js`. CSS-based skeletons are completely unaffected by StrictMode's double-render behavior because they:
- Have no state
- Have no effects
- Have no refs
- Use no DOM APIs
- Render identically on every call

### Verification Approach
Visual verification only -- start dev server, navigate to pages that show loading states, confirm skeletons display correctly without doubling or glitching. No code changes expected.

## GoldStandard Source Tag

### Current Code [VERIFIED: controllers/goldstandard.controller.ts line 13]
```typescript
return fetch(`${reciterConfig.reciter.reciterUpdateGoldStandardEndpoint}?goldStandardUpdateFlag=${goldStandardUpdateFlag}`, {
```

### Required Change
```typescript
return fetch(`${reciterConfig.reciter.reciterUpdateGoldStandardEndpoint}?goldStandardUpdateFlag=${goldStandardUpdateFlag}&source=publication-manager`, {
```

Single-line change. The `source` parameter is read by the ReCiter Java API's audit log to attribute gold standard changes to the originating client.

## Code Examples

### RTL Test for Pure Presentational Component (ProxyBadge)
```typescript
// __tests__/components/ProxyBadge.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProxyBadge from '../../src/components/elements/Search/ProxyBadge';

describe('ProxyBadge', () => {
  it('renders the Proxy text', () => {
    render(<ProxyBadge />);
    expect(screen.getByText('Proxy')).toBeInTheDocument();
  });

  it('renders as a Bootstrap Badge', () => {
    render(<ProxyBadge />);
    const badge = screen.getByText('Proxy');
    expect(badge).toHaveClass('badge');
  });
});
```

### RTL Test for Component with Props (ScopeLabel)
```typescript
// __tests__/components/ScopeLabel.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScopeLabel from '../../src/components/elements/Navbar/ScopeLabel';

describe('ScopeLabel', () => {
  it('returns null when no scope data and no proxies', () => {
    const { container } = render(<ScopeLabel scopeData={null} proxyCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays scope items', () => {
    render(
      <ScopeLabel
        scopeData={{ personTypes: ['academic-faculty'], orgUnits: ['Medicine'] }}
        proxyCount={0}
      />
    );
    expect(screen.getByText(/academic-faculty, Medicine/)).toBeInTheDocument();
  });

  it('truncates after 3 items and shows overflow count', () => {
    render(
      <ScopeLabel
        scopeData={{ personTypes: ['a', 'b', 'c', 'd'], orgUnits: null }}
        proxyCount={0}
      />
    );
    expect(screen.getByText(/\+1 more/)).toBeInTheDocument();
  });

  it('shows proxy count', () => {
    render(<ScopeLabel scopeData={null} proxyCount={3} />);
    expect(screen.getByText('3 proxies')).toBeInTheDocument();
  });

  it('uses singular "proxy" for count of 1', () => {
    render(<ScopeLabel scopeData={null} proxyCount={1} />);
    expect(screen.getByText('1 proxy')).toBeInTheDocument();
  });
});
```

### A11y Fix Pattern: onClick on non-interactive element
```tsx
// BEFORE (violates click-events-have-key-events + no-static-element-interactions)
<span onClick={tagProps.onDelete} style={{ cursor: 'pointer' }}>
  &times;
</span>

// AFTER (accessible)
<button
  type="button"
  onClick={tagProps.onDelete}
  aria-label="Remove"
  style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
>
  &times;
</button>
```

### A11y Fix Pattern: label without associated control
```tsx
// BEFORE (violates label-has-associated-control)
<label className={styles.fieldLabel}>Person type(s)</label>
<Autocomplete id="scope-person-types" ... />

// AFTER (accessible -- htmlFor matches Autocomplete's id)
<label className={styles.fieldLabel} htmlFor="scope-person-types">Person type(s)</label>
<Autocomplete id="scope-person-types" ... />
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.4.9 |
| Config files | `jest.config.js` (node env, utility tests), `jest.config.dom.js` (jsdom env, component tests) |
| Quick run command | `npx jest --config jest.config.dom.js --bail` |
| Full suite command | `npm test` (runs both configs sequentially) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORT-18 | Skeleton loading renders under StrictMode | manual-only | Visual inspection via dev server | N/A -- no code change |
| A11Y-01 | Zero jsx-a11y strict violations | lint | `npx eslint --ext .tsx,.jsx src/` | N/A -- eslint config |
| PORT-19 | Jest infrastructure runs both environments | unit | `npm test` | Existing (extend) |
| PORT-20 | Scope/proxy component tests pass | unit | `npx jest --config jest.config.dom.js` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (runs both node + component suites)
- **Per wave merge:** `npm test && npx eslint --ext .tsx,.jsx src/`
- **Phase gate:** Full suite green + zero eslint a11y errors before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `@testing-library/dom` -- must install: `npm install --save-dev @testing-library/dom@^10.4.1`
- [ ] `__tests__/components/` directory -- create for component tests
- [ ] `jest.config.dom.js` -- create with jsdom environment (per D-05)
- [ ] `jest.config.js` -- narrow testMatch to exclude components/ subdirectory
- [ ] `.eslintrc.json` -- extend with `plugin:jsx-a11y/strict`
- [ ] `@testing-library/jest-dom` setup file -- configure in jest.config.dom.js `setupFilesAfterSetup`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-content-loader (v1.0) | CSS-based `.skeletonCard` | NextJS14 branch rewrite | No React lifecycle = no StrictMode issues |
| Jest 27.5 + RTL 12 (v1.0) | Jest 29.7 + RTL 16 (v1.1) | Phase 7 (foundation) | React 18 compatible, modern assertions |
| 6 jsx-a11y rules at warn (next/core-web-vitals default) | 33 rules at error (strict mode) | Phase 11 | Catches interactive element, label, and ARIA violations |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Separate `jest.config.dom.js` with sequential npm test script satisfies both D-05 and D-06 | Architecture Patterns | LOW -- this is exactly what D-05 specifies |
| A2 | MUI Autocomplete uses `role="combobox"` in RTL tests | Pitfall 3 | LOW -- can inspect rendered DOM during test writing |
| A3 | `setupFilesAfterSetup` is the correct Jest 29 config key (camelCase) | Architecture Patterns | MEDIUM -- verify exact Jest config key name at implementation |
| A4 | `react-bootstrap` Form.Check may trigger false positive label-has-associated-control | Pitfall 5 | LOW -- fix is to configure or eslint-disable with comment |

## Open Questions (RESOLVED)

1. **D-05 vs D-06 implementation approach**
   - RESOLVED: Use separate `jest.config.dom.js` file per D-05. Both configs run via a single `npm test` script that chains them sequentially: `"test": "jest --config jest.config.js && jest --config jest.config.dom.js"` per D-06. The existing `jest.config.js` testMatch is narrowed to `<rootDir>/__tests__/*.test.(ts|tsx|js)` to exclude the `components/` subdirectory.

2. **checkCurationScope test scope**
   - RESOLVED: Test in node environment via `jest.config.js` since it is a server-side utility (imports Sequelize models, next-auth/jwt), not a DOM component. Place test file at `__tests__/checkCurationScope.test.ts` (root level), which is matched by jest.config.js's narrowed testMatch. It uses no DOM APIs.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `jest.config.js`, `package.json`, `__tests__/`, all 7 target component files
- npm registry: `npm ls` for all test dependency versions and installation status
- npm registry: `npm view @testing-library/dom version` for latest version
- Runtime verification: jest-environment-jsdom@30.3.0 sanity test with Jest 29 (passed)
- eslint runtime: `npx eslint --print-config` for current jsx-a11y rule status
- eslint audit: `npx eslint --rule` scan of `src/` for full a11y violation inventory

### Secondary (MEDIUM confidence)
- Jest documentation for projects configuration pattern
- eslint-plugin-jsx-a11y documentation for strict mode preset composition

### Tertiary (LOW confidence)
- MUI Autocomplete ARIA role structure in jsdom (training data -- verify during implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified via npm ls and runtime tests
- Architecture: HIGH -- patterns derived from actual codebase inspection and verified dependency compatibility
- A11y audit: HIGH -- fresh scan produced exact violation counts and locations
- Test patterns: MEDIUM -- mock strategies and MUI interaction patterns assumed from training data
- Pitfalls: MEDIUM-HIGH -- most verified, TextEncoder/Autocomplete patterns from training data

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- testing infrastructure and a11y rules change slowly)
