# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** Full-stack Next.js web application with separate frontend rendering layer, backend API routes, and centralized state management via Redux.

**Key Characteristics:**
- Client-side state management (Redux) for async data flows
- Server-side rendering via Next.js pages with `getServerSideProps`
- Edge middleware (jose-based JWT validation) for route protection
- Controller pattern for API logic decoupled from Next.js route handlers
- Database abstraction via Sequelize ORM models
- Role-based access control enforced at middleware, route handler, and component levels

## Layers

**Presentation Layer (Frontend):**
- Purpose: React components for user interface
- Location: `src/components/elements/`
- Contains: Page-specific components (CurateIndividual, Search, Report, ManageUsers, etc.), layout wrappers, reusable UI elements
- Depends on: Redux state (via selectors), API routes (via fetch), next-auth session
- Used by: Next.js pages (`src/pages/`) via getLayout pattern

**Page/Route Layer:**
- Purpose: Next.js page routes and API endpoints
- Location: `src/pages/` (page routes) and `src/pages/api/` (API routes)
- Contains: Route handlers, server-side props fetching, middleware matcher routes
- Depends on: Controllers, models, Redux (for page-level data loading)
- Used by: Middleware, browser navigation, frontend fetch calls

**Application Logic Layer (Controllers):**
- Purpose: Business logic extraction from API routes
- Location: `controllers/`
- Contains: External API integration (ReCiter, PubMed), database operations, data transformation
- Depends on: Models, external configuration (reciterConfig, SAML), axios/fetch for external calls
- Used by: API route handlers

**Data Access Layer (ORM):**
- Purpose: Database abstraction and queries
- Location: `src/db/models/`, `src/db/sequelize.ts`
- Contains: Sequelize model definitions (AdminUser, Person, PersonArticle, AnalysisSummaryPerson, etc.)
- Depends on: Sequelize connection pool (`src/db/db.ts`)
- Used by: Controllers, API routes

**State Management Layer (Redux):**
- Purpose: Client-side async data caching and flow coordination
- Location: `src/redux/`
- Contains: Actions (thunks dispatching FETCHING→SUCCESS/ERROR), reducers, action type constants
- Depends on: API routes, fetchWithTimeout utility
- Used by: Components via `useSelector`, `useDispatch`

**Middleware & Auth Layer:**
- Purpose: Request validation, JWT decoding, role-based routing
- Location: `src/middleware.ts`, `src/pages/api/auth/`, `config/saml.ts`
- Contains: Edge middleware (JWT validation, role checks), next-auth configuration, SAML integration
- Depends on: jose (JWT), next-auth, SAML2-js
- Used by: Every protected route request

**Configuration Layer:**
- Purpose: Environment-based settings and feature toggles
- Location: `config/`
- Contains: `local.js` (ReCiter endpoints, auth settings), `report.js` (report filters/sorts), `saml.ts` (SAML SP config)
- Depends on: Environment variables
- Used by: Controllers, Redux actions, components

## Data Flow

**Authenticated Page Load Flow:**

1. Browser requests protected route (e.g., `/curate/[id]`)
2. Middleware (`src/middleware.ts`) intercepts: decodes JWT from `next-auth.session-token` cookie, extracts `userRoles`, evaluates role-based redirects
3. If authorized, Next.js page renders with `getServerSideProps` or client-side rendering
4. Page component (e.g., CurateIndividual) dispatches Redux thunks on mount
5. Redux action (`identityFetchData`) calls API route (`/api/reciter/getidentity/[uid]`)
6. API route validates authorization header and delegates to controller
7. Controller (`identity.controller.ts`) fetches data from ReCiter Java API + local database
8. Response returned to Redux action, which dispatches SUCCESS/CHANGE actions
9. Component re-renders from Redux state via selectors

**Example: User Curation Flow:**

1. User clicks "Accept" button in CurateIndividual component
2. Component dispatches `acceptPublication()` Redux action
3. Redux action makes POST to `/api/reciter/userfeedback/save/[uid]` with `{acceptedPmids, rejectedPmids}`
4. API route handler calls `userfeedback.controller.ts`
5. Controller calls ReCiter Java API `/userfeedback/save` endpoint
6. Controller also logs feedback to local `admin_feedbacklog` table
7. Response updates Redux state (`ACCEPT_PUBLICATION` action)
8. Component's tab counts and UI update from selector state

**Report Generation Flow:**

1. User applies filters on `/report` page (Report component)
2. Filters stored in Redux state (`FILTERS_CHANGE` action)
3. User clicks "Search" → dispatches `reportPublicationSearch()` Redux thunk
4. Thunk calls `/api/db/reports/publication/search` with filter payload
5. API route calls `publication.report.search.controller.ts`
6. Controller queries local `person_article`, `analysis_summary_article` tables with Sequelize
7. Returns paginated results (50 per page, configurable)
8. User clicks "Export" → calls `/api/db/reports/publication/rtf`
9. Controller uses `exceljs` to generate RTF with configured column labels

## Key Abstractions

**Redux Thunk Pattern:**
- Purpose: Unify async data fetching across components
- Examples: `identityFetchData`, `reciterFetchData`, `reportPublicationSearch`
- Pattern: Thunk dispatches FETCHING action, makes fetch call with Authorization header, dispatches SUCCESS or ERROR
- Usage: Components call `dispatch(thunk(params))` and select state via `useSelector`

**API Controller Pattern:**
- Purpose: Decouple business logic from HTTP routing
- Examples: `controllers/identity.controller.ts`, `controllers/db/reports/publication.report.search.controller.ts`
- Pattern: Pure async functions that take request params, call external APIs/queries, return normalized response
- Usage: Next.js API routes call controllers and return HTTP responses

**Role-Based Access Control (RBAC) Abstraction:**
- Purpose: Enforce permissions at multiple levels
- Roles: Superuser, Curator_All, Curator_Self, Reporter_All
- Implementation levels:
  - Middleware (`src/middleware.ts`): Pre-route validation, redirects non-authorized users
  - API Routes: Validate Authorization header = `backendApiKey`
  - Components: Conditional rendering based on `useSession()` roles
- Examples: Curator_Self can only access `/curate/:own-id`, Reporter_All blocked from `/manageusers`

**Sequelize Model Abstraction:**
- Purpose: Type-safe database access
- Examples: `AdminUser`, `Person`, `PersonArticle`, `AnalysisSummaryPerson`
- Pattern: Model definitions in TypeScript with attributes, associations, timestamps
- Usage: Controllers use `models.TableName.findOne()`, `findAll()`, `create()`, `update()`

## Entry Points

**Web Application Entry:**
- Location: `src/pages/index.js`
- Triggers: Browser navigation to root URL `/`
- Responsibilities: Redirects authenticated users based on roles to `/search`, `/curate/[personId]`, or `/noaccess`; unauthenticated users to `/login`
- Uses: `getSession()` from next-auth, `allowedPermissions` constants

**API Entry Points:**
- Curation: `/api/reciter/getidentity/[uid]` → calls identity.controller.ts
- Publishing: `/api/reciter/feature-generator/[uid]` → calls featuregenerator.controller.ts
- Feedback: `/api/reciter/userfeedback/save/[uid]` → calls userfeedback.controller.ts
- Search: `/api/db/person` → calls person.controller.ts (identity search)
- Reports: `/api/db/reports/publication/search` → calls publication.report.search.controller.ts
- Admin: `/api/db/admin/users` → calls user.controller.ts (user management)
- All API routes require `Authorization` header matching `reciterConfig.backendApiKey`

**Authentication Entry:**
- Location: `src/pages/api/auth/[...nextauth].jsx` (managed by next-auth library)
- Triggers: Login form submission or SAML assertion callback
- Responsibilities: Authenticates user via SAML IdP or local credentials, queries `admin_users` table for roles, returns JWT in `next-auth.session-token` cookie
- Sets session data with `userRoles` array containing role objects with `roleLabel` and `personIdentifier`

## Error Handling

**Strategy:** Multi-level error capture with user feedback via toast notifications and error state tracking.

**Patterns:**

- **Redux Thunks:** Fetch call wrapped in `.catch()` that dispatches `addError()` action, shows toast.error(), and resets fetching state
- **API Routes:** Return HTTP status codes and error messages in response body; clients interpret and display
- **Components:** Error state from Redux selector causes navigation to `/_error` page via AppLayout middleware
- **External API Failures:** Controllers catch fetch errors, return normalized error response with statusCode and statusText; callers retry or display fallback UI
- **Database Errors:** Sequelize errors from controllers are caught and returned as HTTP 500 responses

**Example Error Flow:**
```
Component dispatches identityFetchData(uid)
  → Redux action makes fetch to /api/reciter/getidentity/[uid]
    → Controller calls ReCiter API, network timeout
      → Controller catches error, returns {statusCode: 500, statusText: error}
        → API route returns res.status(500).send()
          → Redux action catches, dispatches addError({...}), shows toast.error("Identity Api failed...")
            → Component selector reads error state, AppLayout redirects to /_error
```

## Cross-Cutting Concerns

**Logging:** Console logs at key points (middleware role validation, controller external API calls, Redux action dispatch). No structured logging configured.

**Validation:**
- API routes check Authorization header presence and value
- Middleware validates JWT claims and role existence
- Controllers validate external API responses (statusCode !== 200 returns error response)
- Components validate required props and state (e.g., router.query.id existence)

**Authentication:** next-auth v3.29.10 with SAML2-js support. Session token stored in secure HTTP-only cookie, validated by middleware on every protected route. Roles embedded in JWT payload.

**Data Caching:** Redis not used; admin settings loaded on every page that calls `fetchUpdatedAdminSettings()`. Sequelize has no query caching layer (could benefit from Redis for slow analytic queries).

**Rate Limiting:** Not implemented. Sequelize pool max=20 limits concurrent connections but not request rate.

**Pagination:** Implemented at component and controller level. Page size defaults: 20/50 (search), 20 (reports). Controlled via query params or state.

---

*Architecture analysis: 2026-03-15*
