# Audit: Login / NoAccess

**Date:** 2026-03-17
**Auditor:** Claude (AI) + code review + ESLint static analysis
**Routes:** /login AND /noaccess (two pages, one audit)
**Component(s):** Login.js (141 lines), Login.module.css (72 lines), NoAccess.tsx (25 lines), NoAccess.module.css (12 lines), Header.tsx (30 lines, shared), Footer.tsx (10 lines, shared)

## Overview

The Login view provides credential-based authentication (CWID + password) with optional SAML support (when LOGIN_PROVIDER=SAML). It renders a standalone page with the Header (WCM-branded top bar), a centered login form, and a Footer. Successful login redirects based on roles; failed login shows a toast error message.

The NoAccess view is shown to users who are authenticated but have no roles or are inactive (status=0). It displays a single red text message: "Sorry, you don't have access to the system. Please, contact your administrator." with the Header and Footer.

Both views use a separate layout (no sidebar navigation) since the user is not yet within the authenticated application shell.

## Screenshot

*Not captured -- no browser environment available. Recommend manual Lighthouse audit at `http://localhost:3000/login` and `http://localhost:3000/noaccess`.*

## Findings

### Critical

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| C1 | Login form inputs have no visible labels. The username and password fields rely solely on `placeholder` text which disappears when the user starts typing. Screen readers may not announce the field purpose since there is no `<label>`, `aria-label`, or `aria-labelledby`. The `controlId` on FormGroup provides implicit label association only if a `<Form.Label>` child exists -- it does not | Login.js:86-101,103-118 | Add visible `<Form.Label>` for each input: "CWID" for username, "Password" for password. Or add `aria-label="CWID"` and `aria-label="Password"` to the FormControl elements if visible labels are not desired | S | N |
| C2 | `autoFocus` prop on username input reduces accessibility. Screen readers may skip page content and announcements before the focused input. Users with motor disabilities may find unexpected focus disorienting. The jsx-a11y/no-autofocus ESLint rule flags this in strict mode | Login.js:88 | Remove `autoFocus` prop. If desired UX is to focus the username field, use a `useEffect` with `inputRef.current.focus()` after page load announcement, or accept the eslint violation with a documented override | S | N |

### Major

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| M1 | Header "Logout" link uses `<a onClick>` without href -- triggers jsx-a11y/anchor-is-valid and click-events-have-key-events. The Logout action is mouse-only; keyboard users cannot sign out | Header.tsx:22 | Replace `<a onClick>` with `<button className="link-style" onClick>` or add `href="#"` with `e.preventDefault()` and keyboard handler | S | N |
| M2 | Login error feedback uses ToastContainerWrapper (toast notification) which auto-closes after 2 seconds. Screen readers may not announce the toast before it disappears. There is no persistent error message in the form itself | Login.js:66-70,131-133 | Add a persistent error message below the form (e.g., `<div role="alert">Invalid credentials</div>`) in addition to the toast. Use `aria-live="assertive"` for immediate screen reader announcement | S | N |
| M3 | NoAccess page provides no actionable guidance beyond "contact your administrator." It does not explain: what "access" means, who the administrator is, how to contact them, or what the user should do next. Users reaching this page may not know their status is "inactive" or what roles they are missing | NoAccess.tsx:14-16 | Add specific guidance: "Your account is currently inactive or does not have the required permissions. Please contact [admin email or link] to request access." Add a link to the login page or institution support page | M | N |
| M4 | Login form `type="username"` on the CWID input (line 89) is not a valid HTML input type. Valid types are "text", "email", "password", etc. "username" is not recognized by browsers, which may fall back to "text" but with unpredictable autocomplete behavior | Login.js:89 | Change to `type="text"` and add `autoComplete="username"` for proper browser autocomplete support | S | N |
| M5 | Form validation logic in `validateForm()` is called synchronously inside `handleUserNameInput` but the state update via `setUsername` is asynchronous. The validation always runs against stale state (previous value) because the new value has not been committed yet | Login.js:32-35 | Move validation to a `useEffect` that watches `username` and `password` state changes, or pass the current value directly to the validation function | S | N |
| M6 | Header component `<a onClick>` for Logout has 3 ESLint violations: anchor-is-valid, click-events-have-key-events, no-static-element-interactions. This affects both Login and NoAccess pages as Header is shared | Header.tsx:22 | Same fix as M1 -- replace anchor with button or add keyboard support | S | N |

### Minor

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| m1 | Login form container uses `width: 30%` which is not responsive. On mobile/tablet screens this creates an extremely narrow form; on wide screens it may be too small | Login.module.css:21 | Use `max-width: 400px; width: 90%;` for responsive behavior, or use Bootstrap responsive grid classes | S | N |
| m2 | Login form uses inline `style={{ marginBottom: '10px' }}` on FormGroup elements instead of CSS classes or Bootstrap spacing utilities | Login.js:86,103 | Replace with Bootstrap class `className="mb-2"` (8px) or `className="mb-3"` (16px) | S | N |
| m3 | Login.module.css has malformed CSS values with spaces inside units: `max-width: 500 px`, `border: 1 px solid`, `border-radius: 4 px`, `padding: 30 px 50 px` (lines 51-58). These are invalid CSS and will be ignored by the browser | Login.module.css:51-58 | Remove spaces: `max-width: 500px`, `border: 1px solid`, etc. Note: these rules appear to be for an unused `.userLoginContainer` class | S | N |
| m4 | Login.module.css `.formContainer h3` uses `font-weight: 400` -- matches design contract. Good | Login.module.css:67 | No action needed | - | - |
| m5 | NoAccess error text uses `color: red` (Login.module.css equivalent: NoAccess.module.css line 8) which is Bootstrap danger red but not one of the named design contract colors. Should be `#dc3545` (Bootstrap danger) | NoAccess.module.css:8 | Change to `color: #dc3545` for consistency with Bootstrap's danger color | S | N |
| m6 | NoAccess page heading hierarchy: there is no `<h1>` heading on the page -- the only content is a `<span>` with the error message. Screen readers have no heading to navigate to | NoAccess.tsx:14 | Add `<h1>Access Denied</h1>` before the error message for proper heading structure | S | N |
| m7 | Login button uses `className="btn btn-danger"` which applies a red/danger button color for the primary sign-in action. Red typically indicates destructive actions. The sign-in button should use primary (blue) color | Login.js:122-123 | Change to `className="btn btn-primary"` or use `variant="primary"` | S | N |
| m8 | Login.js imports `useRouter` and `Router` from next/router -- both imported but `Router` is never used (dead import) | Login.js:6 | Remove unused `import Router from "next/router"` | S | N |
| m9 | `session` is assigned via `getSession()` at component initialization (line 19) outside any hook -- this is a synchronous call that may not return the current session state. Should use `useSession()` hook pattern | Login.js:19 | Replace with `const [session] = useSession()` hook or use getSession() only inside async handlers | S | N |

## Accessibility

### Lighthouse Score

*Not captured. Based on code analysis:*
- **Login estimated score:** 55-70/100. Missing form labels and autoFocus are significant issues. The form structure itself (react-bootstrap Form) provides good baseline semantics.
- **NoAccess estimated score:** 70-85/100. Simple page with few interactive elements, but missing heading structure and non-actionable error message reduce score.

### ESLint jsx-a11y Violations

| Rule | Count | Files |
|------|-------|-------|
| jsx-a11y/no-autofocus | 1 | Login.js:88 |
| jsx-a11y/anchor-is-valid | 1 | Header.tsx:22 (shared) |
| jsx-a11y/click-events-have-key-events | 1 | Header.tsx:22 (shared) |
| jsx-a11y/no-static-element-interactions | 1 | Header.tsx:22 (shared) |

*Note: The missing form labels on Login.js are not caught by jsx-a11y because the FormGroup/FormControl pattern uses controlId which the linter considers sufficient. The actual HTML output may still lack proper label association.*

### Keyboard Navigation

- **Tab order (Login):** Username input (auto-focused) -> Password input -> Sign in button. Logical and complete for the form. However, the SAML login button (if present) should also be in tab order.
- **Tab order (NoAccess):** Only the Header "Logout" link is interactive, and it lacks keyboard support (M1/M6). The page has no other interactive elements.
- **Focus indicators:** Bootstrap default focus rings present on form inputs and the Sign in button. Header "Logout" `<a>` has browser default link focus but no custom indicator.
- **Keyboard traps:** None detected.

## Performance

### Lighthouse Score

*Not captured. Based on code analysis:*
- **Login estimated Performance:** 85-95/100. Minimal component with no API calls on mount. Static form rendering.
- **NoAccess estimated Performance:** 90-100/100. Extremely simple page with static content only.

### React Profiler

*Not captured. Based on code analysis:*
- Login.js: `getSession()` called at component initialization (line 19) is a network call that occurs on every render -- should be inside a useEffect or use the `useSession` hook.
- Login.js: `validateForm()` called inside event handlers creates synchronous validation against stale state -- minor render inefficiency.
- NoAccess.tsx: No performance concerns -- static rendering only.

## Recommendations

### Fix Now (Phase 2)

1. **C1:** Add visible form labels or aria-labels to Login form inputs
2. **C2:** Document autoFocus issue (remove or add eslint-disable override)
3. **M1+M6:** Fix Header Logout anchor -- replace with button or add keyboard support
4. **M2:** Add persistent error message for invalid credentials (not just auto-closing toast)
5. **M4:** Fix invalid input type="username" to type="text"

### Fix Later (Phase 3+)

1. **M3:** Improve NoAccess page with actionable guidance and heading structure (M effort)
2. **M5:** Fix stale-state validation in Login form (S effort)
3. **m1:** Make login form container responsive (S effort)
4. **m3:** Fix malformed CSS values in Login.module.css (S effort)
5. **m6:** Add h1 heading to NoAccess page (S effort)
6. **m7:** Change sign-in button from danger (red) to primary (blue) (S effort)
7. **m9:** Replace getSession() with useSession() hook (S effort)
