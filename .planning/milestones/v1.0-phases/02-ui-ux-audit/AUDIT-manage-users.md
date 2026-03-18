# Audit: Manage Users

**Date:** 2026-03-17
**Auditor:** Claude (AI) + code review + ESLint static analysis
**Route:** /manageusers (Superuser only), /manageusers/add (Add User), /manageusers/[userId] (Edit User)
**Component(s):** ManageUsers.tsx (195 lines), UsersTable.tsx (48 lines), AddUser.tsx (307 lines), Pagination.tsx (94 lines, shared), Filter.tsx (shared)

## Overview

The Manage Users view is Superuser-only. It displays a paginated table of all admin users with name, department, email, and an action column. A search input allows filtering by name or user ID. An "Add User" button navigates to /manageusers/add where a form collects CWID, email, name, organizational unit, title, department assignment (MUI Autocomplete), and role assignment (MUI Autocomplete). Edit mode (/manageusers/[userId]) pre-populates the same form. The view uses SkeletonTable from Phase 1 during loading -- a good pattern.

## Screenshot

*Not captured -- no browser environment available. Recommend manual Lighthouse audit at `http://localhost:3000/manageusers`.*

## Findings

### Critical

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| C1 | "Reset" text uses `<div onClick>` without keyboard handler, role, or tabIndex -- completely inaccessible to keyboard users. Identical pattern to SearchBar.tsx (AUDIT-search.md M1) | ManageUsers.tsx:168 | Replace with `<Button variant="link">Reset</Button>` or add role="button", tabIndex={0}, onKeyDown | S | N |
| C2 | InputGroup.Text "search" button uses `onClick` on a styled `<span>` element (rendered by InputGroup.Text) -- no keyboard handler. The search action can only be triggered by mouse click on the text, not by pressing Enter in the input or by keyboard navigation to the button | ManageUsers.tsx:164 | Replace `<InputGroup.Text onClick={onSearch}>` with `<Button onClick={onSearch}>Search</Button>` as the InputGroup append, or add an onKeyDown handler to the Form.Control that triggers onSearch on Enter key | S | N |

### Major

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| M1 | UsersTable uses `<Table>` without `<caption>` or `aria-label` -- screen readers cannot identify the table's purpose | UsersTable.tsx:16 | Add `<caption className="visually-hidden">Admin users list</caption>` as first child of Table, or add `aria-label="Admin users list"` | S | N |
| M2 | UsersTable `<th>` elements lack `scope="col"` -- screen readers cannot associate data cells with column headers | UsersTable.tsx:19-22 | Add `scope="col"` to all `<th>` elements | S | N |
| M3 | "No Records Found" message renders as a `<p>` directly inside `<tbody>` which is invalid HTML -- only `<tr>` elements are allowed as children of `<tbody>` | UsersTable.tsx:42 | Wrap in `<tr><td colSpan={4}>No Records Found</td></tr>` | S | N |
| M4 | AddUser form uses MUI Autocomplete for department and role selection but these lack visible labels inside the MUI input. The `<Form.Label>` is associated with the `<Form.Group>` via controlId but the MUI TextField rendered by Autocomplete has no matching id or aria-label | AddUser.tsx:244-264, 268-291 | Add `aria-label="Select departments"` and `aria-label="Select roles"` to the CssTextField components, or pass an `id` matching the controlId | M | N |
| M5 | AddUser form reuses the same `controlId="formGridCwid"` for three different Form.Group elements (CWID, Email, and Primary organizational Unit) -- duplicate IDs break label association and are invalid HTML | AddUser.tsx:175, 186, 224 | Give each Form.Group a unique controlId: "formGridCwid", "formGridEmail", "formGridOrgUnit" | S | N |
| M6 | Client-side filter function in ManageUsers (line 98-131) filters the in-memory `users` array but only searches within the current page -- if the user types a name that exists on page 2, it will not be found. The search is misleading because it appears global but only operates on loaded data | ManageUsers.tsx:98-131 | Either make the filter trigger a server-side search (the fetchAllAdminUsers already supports searchTextInput), or clearly label the filter as "Filter visible results" vs the main search | M | N |
| M7 | Pagination component (shared) has the same Critical issues as documented in AUDIT-search.md (C1, C2): arrow icons not keyboard accessible, label not associated with dropdown | Pagination.tsx:73,83-85 | Fix in shared component -- see AUDIT-search.md | M | N |

### Minor

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| m1 | Search input uses `placeholder="Search users"` but has no visible label -- placeholder disappears when user starts typing, leaving no context for screen readers or users who forget what the field is for | ManageUsers.tsx:161 | Add a visible `<Form.Label>` or `aria-label="Search users"` to the Form.Control | S | N |
| m2 | UsersTable "Department" column is always empty (`<td>{""}</td>` at line 36) -- the column header exists but no data is displayed. Confusing for users | UsersTable.tsx:36 | Either display department data from the user record or remove the column until data is available | S | N |
| m3 | AddUser form uses `Loader` component (spinner) for loading state instead of SkeletonForm from Phase 1 | AddUser.tsx:171 | Replace `<Loader />` with `<SkeletonForm />` for consistency with other views | S | Y |
| m4 | AddUser form role validation error message uses a raw `<p className="text-danger">` below the Autocomplete instead of react-bootstrap Form.Control.Feedback -- inconsistent with other field validations on the same form | AddUser.tsx:290 | Use Form.Control.Feedback or a consistent error display pattern | S | N |
| m5 | Filter bar (ManageUsers line 180-185) uses a teal background color `rgb(193 233 235)` from ManageUsers.module.css which is not in the design contract color palette | ManageUsers.module.css:2 | Align to design contract secondary color `#f5f5f5` or document the teal as a deliberate accent for admin views | S | N |
| m6 | Spacing uses `padding: 15px` and `padding-top: 5px` in ManageUsers.module.css -- off the 4/8/16/24/32/48px grid (15px and 5px are non-standard) | ManageUsers.module.css:5,13 | Align to 16px (md) and 4px (xs) from the spacing scale | S | N |
| m7 | ManageUsers useEffect has empty dependency array but references dispatch, page, count -- known react-hooks/exhaustive-deps warning | ManageUsers.tsx:35-39 | Acknowledged as intentional mount-only effect | S | N |

## Accessibility

### Lighthouse Score

*Not captured. Based on code analysis, estimated score: 55-70/100. Missing keyboard support on Reset and search actions, missing table semantics, duplicate IDs in AddUser form, and shared Pagination issues.*

### ESLint jsx-a11y Violations

| Rule | Count | Files |
|------|-------|-------|
| jsx-a11y/click-events-have-key-events | 2 | ManageUsers.tsx:168 |
| jsx-a11y/no-static-element-interactions | 2 | ManageUsers.tsx:168 |
| jsx-a11y/label-has-associated-control | 1 | Pagination.tsx:73 (shared) |

*Note: AddUser.tsx has no direct jsx-a11y ESLint violations, but the duplicate controlId and missing MUI Autocomplete labels are semantic HTML issues not caught by the linter.*

### Keyboard Navigation

- **Tab order:** Form.Control (search input) is focusable. InputGroup.Text "search" is not a button and is not in the tab order for keyboard activation (C2). "Reset" div is not in tab order (C1). Pagination component has known issues (AUDIT-search.md). Add User form inputs are properly focusable via react-bootstrap Form components. MUI Autocomplete provides built-in keyboard support.
- **Focus indicators:** Bootstrap default focus rings present on form inputs and Button. "Reset" div and "search" InputGroup.Text have no focus indicator.
- **Keyboard traps:** None detected.

## Performance

### Lighthouse Score

*Not captured. Based on code analysis:*
- **Estimated Performance:** 60-75/100
- **First Contentful Paint:** Fast -- single API call for paginated user list
- **Largest Contentful Paint:** UsersTable after fetch completes

### React Profiler

*Not captured. Based on code analysis:*
- ManageUsers creates new arrow functions for event handlers on each render (handlePaginationUpdate, handleSearchUpdate, etc.) -- minor but could be wrapped in useCallback for optimization.
- AddUser creates `CssTextField` styled component inside the render function (line 148) -- this creates a new component class on every render, forcing full unmount/remount of the MUI TextField children. Should be extracted outside the component.
- AddUser useEffect has missing dependencies and triggers on `[router.query.userId]` which is correct for edit mode.
- SkeletonTable is properly used during loading in ManageUsers -- good Phase 1 pattern.

## Recommendations

### Fix Now (Phase 2)

1. **C1:** Replace "Reset" div with Button component (keyboard accessibility)
2. **C2:** Replace InputGroup.Text with Button for search action, or add Enter key handler
3. **M1+M2:** Add table caption/aria-label and scope="col" to UsersTable headers
4. **M3:** Fix invalid HTML -- "No Records Found" inside tbody
5. **M5:** Fix duplicate controlId values in AddUser form

### Fix Later (Phase 3+)

1. **M4:** Add aria-label to MUI Autocomplete fields in AddUser (M effort)
2. **M6:** Clarify client-side vs server-side search behavior (M effort)
3. **m2:** Display department data or remove empty column (S effort)
4. **m3:** Replace Loader with SkeletonForm in AddUser (S effort)
5. **m5+m6:** Align colors and spacing to design contract (S effort)
6. Extract CssTextField styled component outside AddUser render function (S effort)
