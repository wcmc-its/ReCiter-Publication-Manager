# Codebase Concerns

**Analysis Date:** 2026-03-15

## Critical Security Issues

### Hardcoded Email Credentials

**Issue:** SMTP credentials are hardcoded directly in source code.

**Files:** `controllers/sendNotifications.controller.ts` (lines 10-18)

**Impact:**
- Credentials exposed in git history and deployed containers
- Email service compromised if repository is public or leaked
- Service account `svc_deptdb` password visible in code

**Current Mitigation:** None

**Recommendations:**
1. Immediately rotate service account password
2. Move credentials to environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`)
3. Add `.env` to `.gitignore` if not already present
4. Audit git history and remove credentials using `git-filter-branch` or `BFG Repo-Cleaner`
5. Enable branch protection rules requiring secrets scanning
6. Implement pre-commit hooks to detect hardcoded secrets (e.g., `detect-secrets`)

### JWT Validation Gaps

**Issue:** JWT tokens are decoded without signature verification in edge middleware.

**Files:** `src/middleware.ts` (line 18)

**Impact:**
- Middleware uses `jose.decodeJwt()` which only decodes without validating signature
- Attacker can forge tokens and bypass authorization if next-auth verification fails upstream
- Role-based access control depends on unverified JWT payload

**Current Mitigation:** next-auth session token is assumed valid (verified at authentication layer)

**Recommendations:**
1. Verify JWT signature in middleware using `jose.jwtVerify()` with secret key
2. Add explicit error handling for malformed/expired tokens
3. Consider moving authorization logic server-side with session validation
4. Add logging for failed JWT validations (potential attack indicator)

### Missing JWT Verification Function

**Issue:** `decodeJwt()` function in middleware is defined but unused (dead code).

**Files:** `src/middleware.ts` (lines 112-117)

**Impact:**
- Incomplete implementation suggests abandoned refactoring
- Increases technical debt and code confusion

**Recommendations:**
- Remove unused function or complete implementation

---

## Performance Bottlenecks

### Unoptimized getAllIdentity Endpoint

**Issue:** Endpoint fetches and processes all identities without pagination or caching.

**Files:**
- `controllers/identity.controller.ts` (lines 51-94)
- `src/pages/api/reciter/getAllIdentity.ts`

**Impact:**
- No pagination means large dataset loads entirely into memory
- Each request re-fetches all identities from ReCiter API
- Network bandwidth waste for clients requesting subset of data
- Admin settings note this as "resource-intensive"

**Current Capacity:** Unknown (depends on ReCiter API response size)

**Scaling Path:**
1. Implement pagination with offset/limit parameters
2. Add caching layer (Redis) with configurable TTL
3. Consider batch endpoints for specific identity ranges
4. Monitor response time/size in production

### Missing Admin Settings Caching

**Issue:** Admin settings loaded from database on every login without caching.

**Files:** Session initialization (referenced in CLAUDE.md, not directly inspected)

**Impact:**
- Repeated database queries for static configuration
- Slower login flow as requests scale
- Unnecessary database load

**Scaling Path:**
1. Cache admin settings in Redis with 15-30 minute TTL
2. Implement cache invalidation on settings update
3. Consider session-based caching (store settings in JWT or session)

### RTF File Generation Memory Pressure

**Issue:** RTF generation uses stored procedures and can consume significant memory for large datasets.

**Files:** `controllers/db/reports/publication.report.controller.ts` (lines 26-62)

**Impact:**
- 30KB RTF file size limit enforced in admin settings
- File size increases linearly with publication count
- Server-side generation blocks request thread
- Potential OOM on high-concurrency scenarios

**Current Capacity:** 30KB RTF limit (approx 100-200 publications per person depending on title length)

**Scaling Path:**
1. Implement chunked RTF generation
2. Stream results instead of buffering
3. Consider client-side RTF generation using library
4. Set request timeout for long-running exports

---

## Data Flow & Consistency Issues

### Incomplete Publication Update Handler

**Issue:** TODO comment indicates incomplete implementation for publication updates.

**Files:** `src/components/elements/CurateIndividual/ReciterTabContent.tsx` (line 114)

**Impact:**
- Request object is constructed but marked as unsent
- Unclear if publication update completes server-side
- User may see stale data after acceptance/rejection

**Safe Modification:**
- Review Redux action `reciterUpdatePublication()` to ensure it sends request
- Add error handling for failed updates
- Add optimistic UI updates with rollback on failure

### Unfetched Filter Data in Report

**Issue:** TODO comments indicate filter data not fetched on page load.

**Files:**
- `src/components/elements/Report/SearchSummary.tsx` (lines 82, 130)

**Impact:**
- Possible missing data in filter dropdowns on initial load
- User may need to wait or refresh to see options
- Experience degrades if filters depend on fresh data

**Safe Modification:**
- Call data fetching inside `useEffect` hook on component mount
- Add loading states while fetching
- Cache filter data in Redux to avoid repeated requests

---

## Architecture & Design Concerns

### Overly Complex Middleware Authorization Logic

**Issue:** Role-based access control in middleware uses deeply nested conditionals (72 explicit conditions).

**Files:** `src/middleware.ts` (lines 36-102)

**Impact:**
- Difficult to understand and maintain (72 lines of if-else chains)
- High risk of bugs when adding new roles
- Impossible to audit all paths manually
- Single change requires extensive testing

**Why Fragile:**
- Each role combination hardcoded as separate condition
- No centralized permission model
- Adding new role or route requires editing multiple conditions

**Safe Modification:**
1. Extract role-permission mapping to configuration object:
   ```typescript
   const permissions = {
     'Superuser': ['manageusers', 'configuration', 'curate', 'search', 'report'],
     'Curator_All': ['curate', 'search', 'report'],
     'Curator_Self': ['curate/:own-id'],
     'Reporter_All': ['search', 'report']
   }
   ```
2. Use matrix lookup instead of conditionals
3. Add unit tests for each role path
4. Create middleware factory pattern for reuse

### Type Safety Gaps with `any` Types

**Issue:** Extensive use of `any` type throughout components and controllers reduces type safety.

**Files:**
- `src/components/elements/Publication/Publication.tsx` (line 27 - interface uses `any`)
- `src/components/elements/CurateIndividual/ReciterTabContent.tsx` (lines 13-25)
- Multiple controller files

**Impact:**
- Compiler cannot catch type mismatches
- IDE autocomplete unreliable
- Refactoring risk increases
- Runtime errors that could be caught at compile-time

**Priority:** Medium (affects maintainability, not immediate functionality)

**Recommendations:**
- Create proper type definitions for API responses
- Use discriminated unions for publication state
- Gradual migration: define types for new code, refactor old code incrementally

---

## Test Coverage Gaps

### No Test Files Found

**Issue:** Zero test files discovered in codebase.

**Files:** None (no `*.test.*` or `*.spec.*` files)

**What's Not Tested:**
- Authorization logic in middleware (highest risk)
- Role-based access control edge cases
- Publication update workflows
- Filter/search functionality
- Data transformation in controllers

**Risk:**
- High: Critical features like access control untested
- Medium: Performance regressions undetected
- Business logic bugs only caught in production

**Priority:** High

**Recommendations:**
1. Set up Jest with React Testing Library
2. Start with unit tests for controllers (easier to test)
3. Add integration tests for API routes
4. Add E2E tests for role-based access flows
5. Target 70%+ coverage for `controllers/` directory first

---

## Known Issues & Incomplete Features

### Notification System Partially Implemented

**Issue:** Notification preferences UI exists but backend implementation is incomplete.

**Files:**
- `src/pages/notifications/` (UI present)
- `controllers/sendNotifications.controller.ts` (stub implementation with test data)

**Impact:**
- Notifications send to hardcoded test email (`manikya442@gmail.com`)
- User preferences not actually respected
- No scheduled notification delivery
- Subject/body hardcoded

**Current Mitigation:** Feature disabled or ignored in UI

**Recommendations:**
1. Complete notification queue implementation (RabbitMQ or similar)
2. Implement preference validation before sending
3. Replace hardcoded email with user's actual email
4. Add notification history tracking
5. Test with real SMTP credentials in staging before production

### Unused Redux Action

**Issue:** `clearPendingFeedback()` function is defined but has no implementation.

**Files:** `controllers/featuregenerator.controller.ts` (lines 52-53)

**Impact:**
- Pending feedback may not clear when refresh flag is set
- User state inconsistency if publications re-analyzed

**Safe Modification:**
- Implement function to delete user feedback from database
- Or remove function and call delete endpoint directly

### Filter Publishing Not Working

**Issue:** TODO in FilterPubSection suggests call to Redux action not wired.

**Files:** `src/components/elements/CurateIndividual/FilterPubSection.tsx` (line 38)

**Impact:**
- Filtering publications may not persist state
- User filters reset on navigation

**Safe Modification:**
- Wire Redux dispatch call for filter updates
- Ensure filter state persists across page transitions

---

## Dependency & Maintenance Issues

### Outdated Framework Stack

**Issue:** Multiple dependencies are significantly outdated relative to 2026 standards.

**Dependencies:**
- **React:** 16.14.0 (EOL since Jan 2023) → Current: 19.x
- **Next.js:** 12.2.5 (Released Apr 2022) → Current: 14.x+
- **next-auth:** 3.29.10 (v3 EOL) → Current: 5.x
- **Sequelize:** 6.9.0 (v6 has limited support) → Current: 6.35.x or v7
- **TypeScript:** 4.4.3 (Aug 2021) → Current: 5.x

**Impact:**
- No security patches for known vulnerabilities
- Missing performance improvements and features
- Incompatible with modern tooling and libraries
- Harder to recruit/retain developers (outdated tech)
- Known bugs in React 16 around concurrent rendering

**Migration Path:**
1. Target: React 18+ / Next.js 14 / Node 18+ (per dev_Upd_NextJS14SNode18 branch)
2. Phase 1: Upgrade Next.js 12 → 13 (breaking: app/ directory)
3. Phase 2: Upgrade React 16 → 18 (concurrent rendering improvements)
4. Phase 3: Upgrade next-auth 3 → 5 (session handling changes)
5. Phase 4: Update remaining dependencies

**Timeline Estimate:** 4-6 weeks (with testing)

### MySQL2 RC Version in Production

**Issue:** Using release candidate version `mysql2@2.3.3-rc.0`.

**Files:** `package.json` (line 31)

**Impact:**
- RC versions not recommended for production
- May have unresolved bugs or breaking changes in next release
- No guaranteed long-term support

**Recommendations:**
- Upgrade to latest stable version (3.x or 4.x)
- Test database connection pooling and prepared statements after upgrade

### Force Resolution Workarounds

**Issue:** Using `npm-force-resolutions` to work around dependency conflicts.

**Files:** `package.json` (lines 6, 8)

**Impact:**
- Indicates dependency tree incompatibilities
- Workaround masks real issues
- Can cause version mismatches between pre-install and runtime

**Recommendations:**
- Audit which packages conflict
- Consider alternative packages or upgrade problematic ones
- Investigate why React types are being forced to 17.0.38

---

## Error Handling & Observability

### Verbose Console Logging in Production

**Issue:** 55+ `console.log()` statements throughout codebase without environment-based filtering.

**Files:** All controller files and middleware

**Impact:**
- Logs exposed in production container output
- Sensitive data might be logged
- Performance degradation with high volume
- No structured logging format (can't easily parse/search)

**Recommendations:**
1. Implement logger utility (Winston or Pino) with levels
2. Filter logs by environment: suppress DEBUG in production
3. Use structured logging (JSON format) for log aggregation
4. Never log sensitive data (emails, user IDs, API responses)
5. Add request correlation IDs for tracing

### Inadequate Error Responses

**Issue:** Some API responses send raw error objects instead of user-friendly messages.

**Files:** `controllers/db/reports/publication.report.controller.ts` (line 60)

**Impact:**
- Stack traces exposed to client
- Internal implementation details leaked
- Poor UX (client can't parse error)

**Recommendations:**
1. Catch errors and return `{ statusCode, message: "User-friendly message" }`
2. Log full error server-side for debugging
3. Return HTTP status codes (5xx for server errors, 4xx for client errors)

---

## Missing Critical Features

### No API Rate Limiting

**Issue:** No rate limiting implemented on public API endpoints.

**Files:** All API routes

**Impact:**
- Vulnerable to DDoS/brute force attacks
- Resource exhaustion from heavy queries (getAllIdentity)
- No protection against automated scraping

**Recommendations:**
1. Add rate limiting middleware (express-rate-limit or similar)
2. Implement per-user/per-IP limits
3. Return 429 (Too Many Requests) when exceeded
4. Log rate limit violations

### No Input Validation

**Issue:** Limited validation of API request bodies before processing.

**Files:** Controllers accept request bodies without schema validation

**Impact:**
- SQL injection risk if ORM bypassed
- Invalid data in database
- Unexpected errors from malformed requests

**Recommendations:**
1. Use Zod or similar schema validation library
2. Validate request bodies in middleware or at route entry
3. Return 400 (Bad Request) with detailed errors for validation failures

### Missing CORS Configuration

**Issue:** No explicit CORS policy defined (unclear if restrictive or permissive).

**Files:** `next.config.js`

**Impact:**
- Potential unauthorized cross-origin access if misconfigured
- Or blocked legitimate requests if too restrictive

**Recommendations:**
1. Define explicit allowed origins
2. Limit methods (GET, POST only if needed)
3. Document CORS policy in INTEGRATIONS.md

---

## Fragile Components

### Publication Component (690 lines)

**Files:** `src/components/elements/Publication/Publication.tsx`

**Why Fragile:**
- Largest component in codebase
- Multiple concerns mixed (display, state management, styling)
- Difficult to test or refactor
- Changes risk breaking other features

**Test Coverage:** None

**Safe Modification:**
1. Break into smaller sub-components (PublicationHeader, EvidenceSection, ActionButtons)
2. Extract state management to custom hook
3. Add unit tests for each sub-component
4. Use React.memo() to prevent unnecessary re-renders

### TabAddPublication Component (576 lines)

**Files:** `src/components/elements/TabAddPublication/TabAddPublication.tsx`

**Why Fragile:**
- Second largest component
- Complex state management
- Manual publication object manipulation

**Safe Modification:**
- Similar approach to Publication component
- Extract form state to separate hook or Formik

### Middleware Authorization (72 lines of conditionals)

**Files:** `src/middleware.ts` (lines 36-102)

**Why Fragile:**
- See "Overly Complex Middleware Authorization Logic" above
- One bug in condition affects multiple routes
- Adding roles requires careful testing

**Test Coverage:** None

**Safe Modification:**
- Refactor to matrix-based permission model

---

## Database & ORM Concerns

### Missing Indexes on Frequently Queried Columns

**Issue:** Sequelize model definitions don't specify database indexes explicitly.

**Files:** `src/db/models/*.ts`

**Impact:**
- Slow queries on filtered searches (person, journal, author filters)
- Inefficient joins in publication.report.controller.ts
- Performance degrades as datasets grow

**Recommendations:**
1. Audit query patterns in controller files
2. Add indexes on frequently filtered columns:
   - `person.personIdentifier`
   - `analysis_summary_article.journalTitleVerbose`
   - `analysis_summary_author.authorPosition`
   - `analysis_summary_article.datePublicationAddedToEntrez`
3. Profile slow queries in production

### Raw SQL String Concatenation Risk

**Issue:** Some queries concatenate user input directly into SQL.

**Files:** `controllers/db/reports/publication.report.controller.ts` (line 38, 48)

**Impact:**
- Potential SQL injection if input not sanitized
- Risk is lower because Sequelize parameterized queries used elsewhere

**Current Mitigation:** Using `replacements` parameter in `sequelize.query()` (safe)

**Recommendations:**
- Ensure all raw queries use parameterized replacements
- Add query audit in code review checklist

---

## Scaling Limits

### Single-Instance Deployment

**Issue:** Current K8s deployment has HPA min=1, max=2 (minimal scaling).

**Files:** `kubernetes/k8-deployment.yaml`

**Impact:**
- Scales only from 1 to 2 replicas
- Database connection pool maxes at 40 (2 instances × 20)
- Load balancer session affinity issues

**Scaling Path:**
1. Increase max replicas based on load testing (suggest 5-10)
2. Implement session persistence (Redis or database-backed sessions)
3. Load test to determine connection pool sizing
4. Monitor CPU/memory metrics under load

### Database Connection Pool Exhaustion

**Issue:** Connection pool max is 20 with idle timeout 10s.

**Files:** `src/db/db.ts` (lines 11-16)

**Impact:**
- With 2 replicas × 2 concurrent requests each = 4 connections
- Limited headroom before pool exhaustion
- Long-running queries tie up connections

**Recommendations:**
1. Add connection pool monitoring/alerting
2. Reduce `acquire` timeout to fail faster if pool full
3. Profile query execution times
4. Consider connection pooling proxy (PgBouncer for MySQL: ProxySQL)

---

## Security Best Practices

### Insufficient Logging for Compliance

**Issue:** No audit trail for sensitive operations (accept/reject publications, user permission changes).

**Files:** All controllers

**Impact:**
- Cannot audit who made what changes
- Fails compliance requirements (HIPAA, etc. if PII involved)
- Incident response difficult

**Recommendations:**
1. Log all permission changes with user, timestamp, before/after values
2. Log publication accept/reject with reasoning
3. Implement centralized audit log (separate table or service)

### Missing Security Headers

**Issue:** No explicit security headers configured (CSP, X-Frame-Options, etc.).

**Files:** `next.config.js`

**Impact:**
- Vulnerable to clickjacking if embedded in iframe
- No protection against XSS injection
- No referrer policy

**Recommendations:**
1. Add `next.config.js` security headers:
   ```javascript
   headers: [
     {
       source: '/(.*)',
       headers: [
         { key: 'X-Frame-Options', value: 'DENY' },
         { key: 'X-Content-Type-Options', value: 'nosniff' },
         { key: 'Content-Security-Policy', value: "..." }
       ]
     }
   ]
   ```

---

## Summary by Priority

| Priority | Count | Issues |
|----------|-------|--------|
| Critical | 3 | Hardcoded credentials, JWT validation gaps, hardcoded emails |
| High | 4 | No tests, incomplete features, outdated dependencies, rate limiting |
| Medium | 6 | Performance (caching, pagination), complex middleware, type safety |
| Low | 8 | Logging, error handling, documentation, scaling optimizations |

**Next Steps:**
1. Immediately: Rotate email service credentials, audit git history
2. This Sprint: Add input validation, implement rate limiting, basic unit tests
3. This Quarter: Upgrade React/Next.js, refactor middleware, improve error handling
4. This Year: Migrate to modern stack, implement comprehensive tests, optimize database

---

*Concerns audit: 2026-03-15*
