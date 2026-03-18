# Phase 2: UI/UX Audit - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Systematic visual, accessibility, and performance audit of all 8 application views (Search, Curate, Report, Group Curation, Manage Users, Configuration, Notifications, Login/NoAccess). Critical issues fixed, patterns documented for Phase 3+ UI work, and Group Curation redesign proposal produced. Requirements: UIUX-01, UIUX-02, UIUX-03.

</domain>

<decisions>
## Implementation Decisions

### Audit methodology
- Use /ui-ux-pro-max skill for systematic 6-pillar evaluation across all views
- Live app review (npm run dev on port 3000 with real MySQL data) combined with code review
- Chrome DevTools MCP for screenshots embedded in audit reports
- Lighthouse accessibility + performance audits on each view
- React profiler for render performance observations per view
- Log in as Superuser (paa2013) in one browser session, navigate between views
- All 8 views audited — no views skipped, all roles treated equally including Superuser-only views

### Audit output format
- One markdown audit file per view (e.g., AUDIT-search.md, AUDIT-curate.md) in the phase directory
- 3-tier severity: Critical (blocks usage or a11y), Major (significant UX friction), Minor (cosmetic/polish)
- Each finding includes: issue description, severity, recommendation, file:line reference, T-shirt effort estimate (S/M/L/XL), regression tag (Y/N for Phase 1 regressions)
- Full template per view: Overview, Screenshot, Findings (by severity), Accessibility (Lighthouse + ESLint + keyboard nav), Performance (Lighthouse + React profiler), Recommendations (fix now vs fix later)
- Cross-view PATTERNS.md summary after all per-view audits complete
- Re-evaluate with fresh eyes — do not treat CONCERNS.md findings as already covered

### Audit execution order
- High-traffic views first: Search → Curate → Report → Group Curation → Manage Users → Configuration → Notifications → Login/NoAccess
- ESLint a11y integration happens BEFORE visual audit (so violations surface during audit)

### Fix scope
- Fix in Phase 2: accessibility blockers + broken functionality + high-friction UX issues
- Document for Phase 3+: all other findings with severity, recommendation, and T-shirt effort estimate
- Batch fixes: complete all 8 view audits first, user reviews findings, THEN apply critical fixes in Plan 2
- When fixing fragile components (Publication.tsx 690 lines, TabAddPublication 576 lines): apply fix + light refactor (extract affected section into sub-component)
- Surgical approach for non-fragile components

### Plan structure
- Plan 1: ESLint a11y setup + audit all 8 views (with Lighthouse, Chrome DevTools screenshots, React profiler) + PATTERNS.md
- User reviews Plan 1 audit reports and confirms which critical items get fixed
- Plan 2: Batch critical fixes + basic component smoke tests + Group Curation UI-SPEC via /gsd:ui-phase + before/after Lighthouse re-runs

### Accessibility approach
- Target: WCAG 2.1 AA compliance
- eslint-plugin-jsx-a11y in strict mode (errors, not warnings) — blocks linting on violations
- Auto-fix where possible (eslint --fix), then manual review of remaining violations for correct semantics
- Lighthouse accessibility audit on each view via Chrome DevTools MCP
- Test keyboard navigation (tab order) on each view during live review — verify logical focus order, visible focus indicators, no keyboard traps
- Lighthouse handles color contrast checking
- Skip @axe-core/react to avoid React 16 compatibility risk (flagged in STATE.md)

### Design patterns documentation (PATTERNS.md)
- Prescriptive rules ("do this") not just descriptive ("this is what exists")
- Four focus areas:
  1. Component reuse patterns — which to reuse, which to create, naming conventions
  2. Spacing & layout system — propose consistent spacing scale, document current inconsistencies
  3. Color & typography — document tokens, font hierarchy, what's consistent vs inconsistent
  4. Interaction patterns — modals, toasts, dropdowns, loading states, error states standardization

### Group Curation focus
- Rarely used, likely rough — audit will check current implementation
- Full redesign proposal via /gsd:ui-phase producing UI-SPEC.md
- Forward-looking for Phase 3+ — no Group Curation code changes in Phase 2 (except if critical a11y/broken issues found)
- Redesign must account for Phase 3 scoped curators seeing a filtered view (only people in their scope)
- Curation is per-person (not bulk) — Group Curation is about navigation/discovery: finding who to curate next
- Default sort: highest scoring articles first so curators blitz through easy accepts quickly

### Verification
- Visual re-check + Lighthouse re-run after fixes to confirm improvement (before/after comparison)
- ESLint jsx-a11y in CI catches future a11y regressions
- Basic component smoke tests (Jest + React Testing Library) for fixed components

### Claude's Discretion
- Exact Lighthouse score thresholds for pass/fail
- React profiler interpretation and which observations to surface
- Audit report narrative tone and level of detail beyond the template
- Which ESLint a11y rules need granular overrides if strict mode is too invasive
- Component test selection (which fixed components get smoke tests)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` — UIUX-01 (full audit), UIUX-02 (Group Curation), UIUX-03 (eslint a11y)
- `.planning/ROADMAP.md` — Phase 2 success criteria (3 items)

### Prior phase context
- `.planning/phases/01-search-result-filtering/01-CONTEXT.md` — Phase 1 decisions: capability model, skeleton components, canViewPII, Loader.tsx preservation

### Codebase analysis
- `.planning/codebase/CONCERNS.md` — Known issues (fragile components, security, performance) — re-evaluate with fresh eyes during audit
- `.planning/codebase/CONVENTIONS.md` — Naming, code style, component structure patterns
- `.planning/codebase/STRUCTURE.md` — Directory layout and file organization
- `.planning/codebase/STACK.md` — Technology stack details (React 16, Next.js 12, Bootstrap/MUI hybrid)

### Key components to audit
- `src/components/elements/Search/Search.js` — Search view (high-traffic, complex role logic)
- `src/components/elements/CurateIndividual/CurateIndividual.tsx` — Individual curation view
- `src/components/elements/Report/` — Report view components
- `src/components/elements/Manage/` — ManageUsers + AdminSettings views
- `src/components/elements/Notifications/` — Notification preferences view
- `src/components/elements/Publication/Publication.tsx` — 690-line fragile component
- `src/components/elements/TabAddPublication/TabAddPublication.tsx` — 576-line fragile component
- `src/components/elements/Navbar/SideNavbar.tsx` — Navigation (role-based menu)
- `src/components/elements/Common/Loader.tsx` — Current spinner + skeleton components from Phase 1

### Configuration
- `config/report.js` — Report filter/sort options (audit Report view against these)
- `src/utils/constants.js` — Role definitions, capability model (audit against role-based UI)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Skeleton components (SkeletonTable, SkeletonCard, SkeletonProfile, SkeletonForm): Created in Phase 1 — audit should verify they're used consistently
- Loader.tsx: React Bootstrap Spinner preserved for modal contexts — audit should confirm no legacy usage
- Capability model (getCapabilities): Audit role-based UI elements against this
- CSS modules pattern: Components use `{ComponentName}.module.css` — PATTERNS.md should evaluate if this pattern should continue

### Established Patterns
- Bootstrap + MUI hybrid styling throughout — audit should document inconsistencies and prescribe direction
- Redux + thunk async: FETCHING → SUCCESS/ERROR — interaction pattern doc should cover loading states
- 4-space indent, no Prettier configured — PATTERNS.md should note formatting gaps
- ESLint with next/core-web-vitals — adding jsx-a11y extends existing setup

### Integration Points
- Chrome DevTools MCP: Available for screenshots and Lighthouse audits
- ESLint config (.eslintrc.json): Extends next/core-web-vitals — jsx-a11y plugin adds here
- package.json: Jest + React Testing Library need adding for smoke tests
- /gsd:ui-phase workflow: Produces UI-SPEC.md for Group Curation redesign

</code_context>

<specifics>
## Specific Ideas

- "Curation needs to be done one person at a time" — Group Curation is navigation/discovery, not bulk operations
- Sort Group Curation by highest scoring articles first so curators blitz through easy accepts quickly
- PROJECT.md mentions using /ui-ux-pro-max skill for systematic evaluation — confirmed as methodology
- The Group Curation redesign should account for scoped curators (Phase 3) from the start

</specifics>

<deferred>
## Deferred Ideas

- @axe-core/react integration — deferred due to React 16 compatibility concern; revisit after React upgrade
- Comprehensive test suite beyond smoke tests — separate initiative
- Performance optimization work (beyond flagging issues) — future phase
- Mobile/responsive audit — out of scope per PROJECT.md ("web-first, no mobile redesign")

</deferred>

---

*Phase: 02-ui-ux-audit*
*Context gathered: 2026-03-16*
