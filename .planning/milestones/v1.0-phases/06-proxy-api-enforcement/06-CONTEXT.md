# Phase 6: Proxy API Scope Enforcement - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add isProxyFor check to userfeedback save and goldstandard update API endpoints so proxy users can save curation decisions for out-of-scope proxied persons without getting 403 errors. Requirement: PROXY-06.

</domain>

<decisions>
## Implementation Decisions

### Proxy check placement
- Add isProxyFor check BEFORE isPersonInScope in both API files (short-circuit pattern from curate/[id].js)
- Check goes inside the existing `caps.canCurate.scoped && !caps.canCurate.all` conditional block
- Parse proxyPersonIds from JWT token (same pattern as scopeData)
- If isProxyFor returns true, skip the scope check entirely and allow the request through

### Authorization logging
- Keep existing [AUTH] DENY logging for scope failures
- No additional allow-logging for proxy bypass (consistent with current deny-only pattern)

### JWT data model
- proxyPersonIds already in JWT from Phase 4 — no changes to auth pipeline
- Changes take effect on next login (established in Phase 4, no change)

### Claude's Discretion
- Exact code placement within the scope enforcement block
- Whether to extract shared proxy+scope check logic into a helper (vs inline in each file)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` — PROXY-06 (the only requirement for this phase)
- `.planning/ROADMAP.md` — Phase 6 success criteria (3 items)

### Prior phase context
- `.planning/phases/04-curation-proxy/04-CONTEXT.md` — Proxy system decisions: isProxyFor pattern, JWT proxyPersonIds, OR logic with scope

### Target files to modify
- `src/pages/api/reciter/save/userfeedback/[uid].ts` — Add isProxyFor import and check (lines 28-48)
- `src/pages/api/reciter/update/goldstandard.ts` — Add isProxyFor import and check (lines 27-46)

### Reference implementation (client-side pattern)
- `src/pages/curate/[id].js` — Lines 46-51: existing proxy-before-scope pattern to mirror
- `src/utils/scopeResolver.ts` — isProxyFor function (lines 63-69) and isPersonInScope (lines 24-54)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isProxyFor(proxyPersonIds, personIdentifier)` in scopeResolver.ts: Already built, tested, ready to import
- `getToken({ req, secret })` call: Already in both target files, provides access to token.proxyPersonIds

### Established Patterns
- Client-side proxy check in curate/[id].js (line 49): `if (isProxyFor(proxyPersonIds, personId)) { return; }` — server-side should mirror this
- JWT parsing: `token.proxyPersonIds ? JSON.parse(token.proxyPersonIds as string) : []`
- Scope enforcement block: `if (caps.canCurate.scoped && !caps.canCurate.all)` — proxy check goes inside, before scope check

### Integration Points
- Both API files already import from scopeResolver — just add isProxyFor to the import
- Both already call getToken — just read proxyPersonIds from the token
- No new API endpoints, models, or middleware changes needed

</code_context>

<specifics>
## Specific Ideas

No specific requirements — the fix is mechanical, mirroring the client-side pattern already established in Phase 4.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-proxy-api-enforcement*
*Context gathered: 2026-03-18*
