# Audit: Notifications

**Date:** 2026-03-17
**Auditor:** Claude (AI) + code review + ESLint static analysis
**Route:** /notifications
**Component(s):** Notifications.tsx (94 lines), Notifications.module.css (8 lines)

## Overview

The Notifications view allows users to configure email notification preferences: enable/disable all notifications, set frequency (daily/7/14/28 days), choose triggers (new accepted publications, new suggested publications), set minimum evidence score threshold, and save. The view is **partially implemented** -- the navigation menu item is hidden via `capabilityKey=canNotifications` which always evaluates to false in the capability model. The page itself is reachable by direct URL navigation to /notifications but is not discoverable through normal UI navigation.

**Implementation Status:** Partially complete. The form UI renders and the save button dispatches a Redux action, but:
- No data is loaded from the server on page mount (preferences are not fetched)
- The form always starts with default values (frequency=1, minimumThreshold=8)
- The "suggested publications" checkbox has no onChange handler (line 68) -- it is non-functional
- The email destination shows static text "Emails will be sent to Email" instead of the actual user email address
- The notification backend (sendNotifications.controller.ts) sends to a hardcoded test email address
- SkeletonForm import is present but never used -- the view has no loading state

## Screenshot

*Not captured -- no browser environment available. Recommend manual Lighthouse audit at `http://localhost:3000/notifications`.*

## Findings

### Critical

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| C1 | Four Form.Check checkboxes all share the same `controlId="formBasicCheckbox"` -- duplicate IDs break label association for all but the first checkbox. Screen readers will associate all four labels with the first checkbox | Notifications.tsx:50,64,67,71 | Give each Form.Group a unique controlId: "disableNotifications", "acceptedPubs", "suggestedPubs", "minEvidenceScore" | S | N |

### Major

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| M1 | "A new publication has been suggested" checkbox has no onChange handler. The checkbox renders but clicking it does nothing -- the state is not captured. User expectation is that checking this box would enable suggested publication notifications | Notifications.tsx:68 | Add onChange handler: `onChange={() => setSuggested(!suggested)}` and add `suggested` to state, then include in save payload | S | N |
| M2 | No existing notification preferences are loaded on page mount. The useEffect (line 26-28) only extracts the username from the session but does not fetch saved preferences from the API. Users always see default values regardless of what they previously saved | Notifications.tsx:26-28 | Add a fetch call in useEffect to load existing preferences from `/api/db/admin/notifications` and populate state with saved values | M | N |
| M3 | Page heading "Manage Notifications" uses a raw `<h1>` with custom CSS class instead of the shared `<PageHeader>` component used by all other views (ManageUsers, Configuration, Search, Report). Inconsistent visual hierarchy | Notifications.tsx:49 | Replace `<h1 className={styles.header}>Manage Notifications</h1>` with `<PageHeader label="Manage Notifications" />` | S | N |
| M4 | Save button uses `variant="warning"` (yellow/amber) while all other action buttons in the application use `variant="primary"` (blue). This creates a visual inconsistency and may confuse users about the button's purpose (warning implies caution) | Notifications.tsx:87 | Change to `variant="primary"` to match the pattern used across other views | S | N |
| M5 | "Emails will be sent to Email" (line 85) is placeholder text that was never replaced with the actual user's email address. This provides no useful information to the user | Notifications.tsx:85 | Display the actual email: `Emails will be sent to {session?.data?.email || "your registered email"}` | S | N |

### Minor

| # | Issue | File:Line | Recommendation | Effort | Regression? |
|---|-------|-----------|----------------|--------|-------------|
| m1 | SkeletonForm is imported but never used -- the view has no loading state during save or initial load | Notifications.tsx:5 | Either add a loading state that displays SkeletonForm while saving/loading, or remove the unused import | S | N |
| m2 | Frequency Form.Select uses `aria-label="Default select example"` -- a meaningless label copied from Bootstrap documentation | Notifications.tsx:55 | Change to `aria-label="Notification frequency"` | S | N |
| m3 | Evidence score Form.Select also uses `aria-label="Default select example"` | Notifications.tsx:74 | Change to `aria-label="Minimum evidence score threshold"` | S | N |
| m4 | No form validation -- the Save button is always enabled even if the form is in an invalid state. The "Disable all notifications" checkbox does not actually disable the other form fields | Notifications.tsx:87 | Disable frequency and trigger options when "Disable all notifications" is checked. Add visual feedback (grey out controls) | S | N |
| m5 | CSS uses fixed width `300px` for frequency select and `80px` for score select -- not responsive and not aligned to design system | Notifications.module.css:1-3, 7-8 | Use Bootstrap responsive classes or percentage-based widths | S | N |
| m6 | useEffect has missing dependency 'session.data.username' -- react-hooks/exhaustive-deps warning in ESLint baseline | Notifications.tsx:26-28 | Acknowledged as intentional mount-only effect | S | N |

## Accessibility

### Lighthouse Score

*Not captured. Based on code analysis, estimated score: 60-75/100. The critical issue is duplicate controlId values across all checkboxes, plus meaningless aria-labels on select elements. However, react-bootstrap Form components provide good baseline accessibility.*

### ESLint jsx-a11y Violations

| Rule | Count | Files |
|------|-------|-------|
| (none specific to Notifications.tsx) | 0 | -- |

*Note: Notifications.tsx has zero jsx-a11y ESLint violations. The duplicate controlId issue is a semantic HTML problem (duplicate id attributes) not caught by the jsx-a11y linter rules. The meaningless aria-labels are technically valid strings but provide poor screen reader experience.*

### Keyboard Navigation

- **Tab order:** Logical and complete. Checkbox, select, checkbox, checkbox, nested checkbox, select, save button -- all in visual order. React-bootstrap Form components provide native keyboard support.
- **Focus indicators:** Bootstrap default focus rings present on all form controls (checkboxes, selects, button).
- **Keyboard traps:** None detected.

## Performance

### Lighthouse Score

*Not captured. Based on code analysis:*
- **Estimated Performance:** 85-95/100
- **First Contentful Paint:** Very fast -- no API calls on mount (this is a bug, not a feature -- preferences should be loaded)
- **Largest Contentful Paint:** The form is a small static component with minimal DOM

### React Profiler

*Not captured. Based on code analysis:*
- Minimal component -- 94 lines, few state variables, no complex rendering.
- No re-render concerns at this size.
- The missing API fetch (M2) means no async data loading occurs, keeping the component artificially simple.

## Partial Implementation Status

This feature is intentionally hidden from navigation and partially implemented. The following items are **out of scope for Phase 2 fixes** but documented for awareness:

| Aspect | Status | Notes |
|--------|--------|-------|
| UI form rendering | Working | Form displays and is interactive |
| Save to database | Partially working | Redux action dispatches but backend may not persist correctly |
| Load saved preferences | Not implemented | Always shows defaults |
| Email delivery | Not implemented | Backend sends to hardcoded test email |
| Scheduled delivery | Not implemented | No cron/scheduler configured |
| Menu visibility | Hidden | capabilityKey=canNotifications always false |

## Recommendations

### Fix Now (Phase 2)

1. **C1:** Fix duplicate controlId values across all Form.Group elements
2. **M3:** Use shared PageHeader component for consistent visual hierarchy

### Fix Later (Phase 3+ / When feature is completed)

1. **M1:** Add onChange handler for suggested publications checkbox (S effort)
2. **M2:** Implement preference loading from API on mount (M effort)
3. **M4:** Change button variant to "primary" (S effort)
4. **M5:** Display actual user email address (S effort)
5. **m2+m3:** Replace meaningless aria-labels with descriptive text (S effort)
6. **m4:** Disable form controls when "Disable all" is checked (S effort)
7. Complete the notification backend (XL effort -- separate initiative)
