# Audit: Configuration (Admin Settings)

**Date:** 2026-03-17
**Auditor:** Claude (AI) + code review + ESLint static analysis
**Route:** /configuration (Superuser only)
**Component(s):** AdminSettings.tsx (253 lines), ManageUsers.module.css (shared CSS)

## Overview

The Configuration view is Superuser-only. It displays admin settings organized as an Accordion with one section per "view" (e.g., Profile, Reports, Search). Each section expands to show configurable fields: label override (text input), help text (textarea), image path (text input), visibility toggle (checkbox), display rank (text input), and max limit (text input with validation). A single "Update" button at the bottom saves all changes. The view uses SkeletonForm from Phase 1 during loading -- a good pattern. Settings are stored as JSON in the `admin_settings` table and parsed on load.

## Screenshot

*Not captured -- no browser environment available. Recommend manual Lighthouse audit at `http://localhost:3000/configuration`.*

## Findings

### Critical

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| C1 | Form.Check checkbox for "Is visible" has `id=""` (empty string) -- multiple checkboxes across different settings will share the same empty id, breaking label association. The checkbox label "Is visible" is rendered as a separate `<p>` element, not as a `<Form.Check label>` prop -- the checkbox is unlabeled for screen readers | AdminSettings.tsx:195-203 | Use `id={viewName-${viewLabelIndex}-${viewAttrIndex}-visibility}` and pass the label text via `<Form.Check label="Is visible">` instead of the separate `<p>` | S | N |
| C2 | Form.Control inputs for "Label Override", "Help Text", "Image Path", "Display Rank", and "Max Limit" are not associated with their visible labels. The labels are `<p>` tags styled as labels but have no `htmlFor` attribute and the inputs have no matching `id` | AdminSettings.tsx:153-232 | Replace `<p className={styles.labels}>` with `<Form.Label htmlFor={unique-id}>` and add matching `id` to each `<Form.Control>` | M | N |

### Major

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| M1 | Card components use inline `style={{ width: '40rem', marginBottom: '3px' }}` -- hard-coded width limits the cards to 640px regardless of viewport. On narrow screens this causes horizontal overflow; on wide screens it wastes space | AdminSettings.tsx:146 | Remove fixed width, let cards fill the Accordion.Body width. Use Bootstrap responsive classes or max-width instead | S | N |
| M2 | "Is visible" checkbox only renders when `isVisible` is truthy (line 191). This means once a field is hidden (isVisible=false), the checkbox disappears and there is no way to make it visible again from the UI | AdminSettings.tsx:191 | Render the checkbox unconditionally -- remove the `{isVisible && ...}` conditional so administrators can toggle visibility in both directions | S | N |
| M3 | JSON viewAttributes parsing uses triple-nested typeof checks and JSON.parse calls (lines 48-51, 89-93) with no error handling. If stored JSON is malformed, the entire settings page crashes with an unhandled exception | AdminSettings.tsx:48-51, 89-93 | Wrap JSON.parse calls in try/catch blocks. Display a user-friendly error message for the specific malformed setting rather than crashing the entire view | M | N |
| M4 | No success/error feedback after "Update" button click. The handleSubmit function sets loading=true, sends the API request, and on success silently updates state. On error, it only console.logs. The user has no confirmation that their changes were saved | AdminSettings.tsx:101-126 | Add toast.success("Settings updated successfully") on API success and toast.error("Failed to update settings") on error, matching the pattern used in ManageUsers | S | N |
| M5 | "Reporting Article RTF" max limit validation compares with `>` and `<` but not `===` for the 30000 boundary value. When value equals exactly 30000, neither condition triggers -- the validation state from a previous check persists | AdminSettings.tsx:80-81 | Use `>= 30000` for invalid and `< 30000` for valid, or use `> 30000` and `<= 30000` to cover the boundary | S | N |
| M6 | `name="labelOverRide"` is used on both the "Label Override" input AND the "Image Path" input -- if any form processing relies on name attributes, these will conflict | AdminSettings.tsx:156, 183 | Give each input a unique name matching its purpose: "labelUserView", "syntax" | S | N |

### Minor

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| m1 | Accordion uses `defaultActiveKey="0"` which expands the first section on page load. This is reasonable UX but should be verified that the first section is the most commonly edited | AdminSettings.tsx:136 | No action needed unless user feedback indicates different default | - | - |
| m2 | `handleValueChange` uses loose equality `==` for index comparisons (lines 72, 77) instead of strict `===` | AdminSettings.tsx:72,77 | Replace `==` with `===` for consistent strict equality | S | N |
| m3 | Unused state variables: `labelOverRide`, `helpText`, `isChecked`, `settingsDummy` are declared but never read | AdminSettings.tsx:20-22, 18 | Remove unused state declarations to reduce component complexity | S | N |
| m4 | Unused selector: `createORupdateUserID` is imported from Redux but never used in the component logic (only used in ManageUsers.tsx) | AdminSettings.tsx:14 | Remove unused selector | S | N |
| m5 | console.log statements in handleValueChange (lines 69, 71) left in production code -- exposes internal state to browser console | AdminSettings.tsx:69,71 | Remove debug console.log statements | S | N |
| m6 | `data.map()` used with side effect (push to array) instead of returning values -- line 48. This is an anti-pattern; `forEach` or `reduce` would be more appropriate | AdminSettings.tsx:48-58 | Replace `.map()` with `.forEach()` since the return value is not used | S | N |

## Accessibility

### Lighthouse Score

*Not captured. Based on code analysis, estimated score: 50-65/100. Multiple form inputs without associated labels, empty checkbox id, and missing error feedback severely impact accessibility.*

### ESLint jsx-a11y Violations

| Rule | Count | Files |
|------|-------|-------|
| (none specific to AdminSettings.tsx) | 0 | -- |

*Note: AdminSettings.tsx has zero direct jsx-a11y ESLint violations because the accessibility issues are semantic HTML problems (missing htmlFor, empty id, labels as `<p>` tags) that the linter does not fully detect. The issues are real but require manual review to identify.*

### Keyboard Navigation

- **Tab order:** The Accordion uses react-bootstrap which provides native keyboard support (Enter/Space to expand/collapse sections, Tab to move between sections). Form inputs within each section are standard Form.Control elements and are fully keyboard accessible. The "Update" button is a semantic `<Button>` and is focusable.
- **Focus indicators:** Bootstrap default focus rings present on all form inputs, accordion headers, and the Update button.
- **Keyboard traps:** None detected. Accordion keyboard navigation works correctly with react-bootstrap.

## Performance

### Lighthouse Score

*Not captured. Based on code analysis:*
- **Estimated Performance:** 65-80/100
- **First Contentful Paint:** Single API call to fetch settings; SkeletonForm shown during loading
- **Largest Contentful Paint:** Accordion with all settings sections rendered

### React Profiler

*Not captured. Based on code analysis:*
- `handleValueChange` creates a new settings array via nested `.map()` on every value change (lines 70-98). For views with many settings attributes, this creates significant object churn.
- The triple JSON.parse logic in the else branch (lines 89-93) runs for every unmodified setting on every change -- unnecessary processing.
- No memoization of parsed settings -- each render re-parses all viewAttributes.
- SkeletonForm is properly used during loading -- good Phase 1 pattern.

## Recommendations

### Fix Now (Phase 2)

1. **C1:** Fix checkbox label association -- use Form.Check label prop and unique id
2. **C2:** Replace `<p>` label elements with proper `<Form.Label>` with htmlFor
3. **M2:** Remove conditional rendering on isVisible checkbox (allows toggling both directions)
4. **M4:** Add toast feedback for save success/error

### Fix Later (Phase 3+)

1. **M1:** Remove hard-coded card width, use responsive layout (S effort)
2. **M3:** Add try/catch for JSON.parse calls (M effort)
3. **M5:** Fix boundary condition in RTF max limit validation (S effort)
4. **M6:** Fix duplicate name attributes on inputs (S effort)
5. **m2:** Replace loose equality with strict equality (S effort)
6. **m3+m4:** Remove unused state variables and selectors (S effort)
7. **m5:** Remove console.log debug statements (S effort)
