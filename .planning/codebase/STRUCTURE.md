# Codebase Structure

**Analysis Date:** 2026-03-15

## Directory Layout

```
ReCiter-Publication-Manager/
├── src/                        # Frontend application source
│   ├── components/
│   │   ├── elements/           # Reusable React components grouped by feature
│   │   │   ├── CurateIndividual/      # Article curation UI
│   │   │   ├── Search/                # Identity search interface
│   │   │   ├── Report/                # Publication reporting UI
│   │   │   ├── Manage/                # User/settings admin panels
│   │   │   ├── Navbar/                # Navigation sidebar
│   │   │   ├── Profile/               # Person profile modal
│   │   │   ├── Notifications/         # Notification preferences
│   │   │   ├── Common/                # Shared: Loader, Divider, Dropdown
│   │   │   ├── Publication/           # Article card/display
│   │   │   ├── Login/                 # Login form
│   │   │   └── ...
│   │   └── layouts/            # Page layout wrappers
│   │       └── AppLayout.jsx           # Main app layout (navbar, footer, error handling)
│   ├── pages/                  # Next.js page routes and API
│   │   ├── index.js            # Auth redirect home page
│   │   ├── _app.tsx            # App wrapper (Redux, next-auth provider)
│   │   ├── login/              # Login page
│   │   ├── search/             # Identity search page
│   │   ├── curate/[id].tsx     # Individual curation page
│   │   ├── report/             # Publication reporting page
│   │   ├── manageusers/        # User management (Superuser)
│   │   ├── configuration/      # Admin settings (Superuser)
│   │   ├── notifications/      # Notification preferences
│   │   ├── noaccess/           # Access denied page
│   │   ├── api/                # Backend API routes
│   │   │   ├── reciter/        # ReCiter integration endpoints
│   │   │   │   ├── getidentity/[uid].ts
│   │   │   │   ├── getAllIdentity.ts
│   │   │   │   ├── feature-generator/[uid].ts
│   │   │   │   ├── userfeedback/
│   │   │   │   ├── goldstandard.ts
│   │   │   │   └── ...
│   │   │   ├── db/             # Database query endpoints
│   │   │   │   ├── person.ts                  # Identity search queries
│   │   │   │   ├── admin/
│   │   │   │   │   ├── users/
│   │   │   │   │   ├── settings/
│   │   │   │   │   ├── notifications/
│   │   │   │   │   └── ...
│   │   │   │   └── reports/
│   │   │   │       ├── publication/search.ts
│   │   │   │       ├── publication/rtf.ts
│   │   │   │       └── filter/
│   │   │   ├── auth/           # next-auth routes
│   │   │   └── healthcheck.ts
│   ├── db/                     # Database connection and models
│   │   ├── db.ts               # Sequelize connection pool setup
│   │   ├── sequelize.ts        # ORM initialization
│   │   └── models/             # Sequelize model definitions (40+ models)
│   │       ├── AdminUser.ts
│   │       ├── Person.ts
│   │       ├── PersonArticle.ts
│   │       ├── AnalysisSummaryPerson.ts
│   │       ├── AnalysisSummaryArticle.ts
│   │       ├── AdminSettings.ts
│   │       └── ...
│   ├── redux/                  # Client state management
│   │   ├── actions/            # Async thunks and action creators
│   │   │   └── actions.js      # Redux action creators (fetch, filter, curation actions)
│   │   ├── reducers/           # Redux reducers
│   │   │   └── reducers.js     # State shape: fetching, data, errors, filters
│   │   ├── methods/            # Action type constants
│   │   │   └── methods.js      # 100+ action types (RECITER_*, IDENTITY_*, FILTERS_*, etc.)
│   │   └── store/              # Redux store configuration
│   │       ├── store.jsx       # createStore with thunk middleware
│   │       └── auth.js         # Auth reducer
│   ├── hooks/                  # Custom React hooks
│   │   ├── useModal.tsx        # Modal open/close state
│   │   └── usePagination.tsx   # Pagination state management
│   ├── utils/                  # Utility functions
│   │   ├── constants.js        # Role labels, permissions, toast messages
│   │   ├── fullName.js         # Format person name string
│   │   ├── filterPublications.js
│   │   ├── sortPublications.js
│   │   ├── reportFilters.js
│   │   ├── pagination.js
│   │   ├── loginHelper.ts
│   │   └── fetchWithTimeout.js # Fetch wrapper with timeout
│   ├── middleware.ts           # Edge middleware for JWT validation and role routing
│   ├── types/                  # TypeScript type definitions
│   └── styles/                 # Global and module CSS
├── controllers/                # Backend business logic (decoupled from routes)
│   ├── identity.controller.ts           # ReCiter identity + h-index enrichment
│   ├── featuregenerator.controller.ts   # Single publication scoring
│   ├── featuregeneratorbulk.controller.ts # Batch scoring
│   ├── pubmed.controller.ts             # PubMed search proxy
│   ├── userfeedback.controller.ts       # Save/find user feedback
│   ├── goldstandard.controller.ts       # Gold standard updates
│   ├── sendNotifications.controller.ts  # Email sending
│   └── db/                     # Database-specific controllers
│       ├── person.controller.ts
│       ├── userroles.controller.ts
│       ├── admin.settings.controller.ts
│       ├── manage-users/user.controller.ts
│       ├── notifications/notifications.controller.ts
│       └── reports/
│           ├── publication.report.search.controller.ts
│           ├── publication.report.controller.ts  # RTF/CSV export
│           ├── filter.controller.ts
│           └── bibliometric.controller.ts
├── config/                     # Configuration files
│   ├── local.js                # ReCiter endpoints, API keys, auth settings (reads from env vars)
│   ├── report.js               # Report filter options, sort fields, metrics
│   ├── saml.ts                 # SAML SP configuration
│   └── certs/                  # SAML certificates (reciter-saml.crt/key, idp.crt)
├── kubernetes/                 # K8s deployment manifests
│   ├── k8-deployment.yaml      # Deployment, HPA, health checks
│   ├── k8-service.yaml         # NodePort service
│   └── k8-secrets.yaml         # Secret template
├── types/                      # Top-level TypeScript definitions
├── public/                     # Static assets (images, favicon)
├── styles/                     # Global CSS (globals.css, Bootstrap imports)
├── .next/                      # Build output (generated, not committed)
├── .planning/                  # Planning documentation
├── .claude/                    # Claude context files
├── Dockerfile                  # Multi-stage Node build
├── k8-buildspec.yml            # AWS CodeBuild pipeline
├── next.config.js              # Next.js configuration
├── tsconfig.json               # TypeScript compiler options
├── package.json                # Dependencies and npm scripts
└── README.md                   # Project documentation
```

## Directory Purposes

**src/components/elements/:**
- Purpose: Reusable React components organized by feature domain
- Contains: Presentational and stateful components, CSS modules, TypeScript definitions
- Key files: Each subdirectory is a feature component (CurateIndividual.tsx, Search.js, Report.tsx)
- Pattern: Components import from Redux selectors, dispatch actions, fetch from API routes

**src/pages/:**
- Purpose: Next.js page routes and API route handlers
- Contains: Page entry points and API handlers (combined in same directory per Next.js convention)
- Pattern: Page files export default component, optional `getLayout` for layout wrapper; API files export async handler function

**src/pages/api/:**
- Purpose: Backend API endpoints consuming controllers and databases
- Contains: Route handlers that delegate to controllers and models
- Pattern: `[...slug].ts` files match URL patterns; handlers validate Authorization header, call controller, return JSON

**src/db/models/:**
- Purpose: Sequelize ORM model definitions
- Contains: TypeScript class definitions with attributes, associations, timestamps
- Pattern: Each model is a file (e.g., AdminUser.ts, Person.ts, PersonArticle.ts); all imported and initialized by init-models.ts

**controllers/:**
- Purpose: Business logic extraction for testability and reusability
- Contains: Async functions that call ReCiter APIs, databases, external services
- Pattern: Pure functions taking request params, returning normalized {statusCode, statusText/data}
- Usage: API routes call controllers: `const response = await controllerFn(params)`

**src/redux/:**
- Purpose: Client-side state management and async coordination
- Contains: Actions (thunks), reducers, action type constants
- Pattern: Thunks dispatch 3-phase actions (FETCHING → SUCCESS/ERROR); components select with useSelector

**config/:**
- Purpose: Environment-specific configuration
- Contains: Endpoint URLs, feature flags, role mappings, report definitions
- Pattern: Reads from environment variables; imported by controllers, actions, components

**src/middleware.ts:**
- Purpose: Edge middleware for route protection
- Contains: JWT validation, role extraction, role-based redirects
- Pattern: Validates request has session token cookie, decodes JWT, checks roles against route matcher

## Key File Locations

**Entry Points:**
- `src/pages/index.js`: Home page redirects based on role
- `src/pages/_app.tsx`: App wrapper with Redux Provider and next-auth Provider
- `src/pages/login/index.js`: Login form
- `src/middleware.ts`: Route protection middleware

**Configuration:**
- `config/local.js`: ReCiter/PubMed endpoints, API keys, auth settings
- `config/report.js`: Report UI metadata (filters, sorts, column labels)
- `config/saml.ts`: SAML IdP/SP configuration
- `.env` (not in repo, in deployment): DB credentials, API keys, URLs

**Core Logic:**
- `src/redux/`: State management with 100+ action types for data flows
- `controllers/`: Business logic separated from routing (30+ controllers)
- `src/db/models/`: 40+ database model definitions (Sequelize ORM)

**Testing:**
- No test directory detected. Tests would be `.test.ts` or `.spec.ts` files co-located with source

## Naming Conventions

**Files:**

- **Page components:** `CurateIndividual.tsx`, `Search.js`, `Report.tsx` (PascalCase, match URL path)
- **API route handlers:** `[uid].ts`, `[...nextauth].jsx` (square brackets for dynamic segments)
- **Controllers:** `identity.controller.ts`, `user.controller.ts` (camelCase.controller.ts pattern)
- **Utility functions:** `fullName.js`, `filterPublications.js` (camelCase, descriptive)
- **Model definitions:** `AdminUser.ts`, `PersonArticle.ts` (PascalCase, matches table conceptually)
- **Reducers/methods:** `reducers.js`, `methods.js` (camelCase, lowercase)
- **CSS modules:** `CurateIndividual.module.css`, `AppLayout.module.css` (PascalCase.module.css)

**Directories:**

- **Feature components:** `CurateIndividual/`, `Search/`, `Report/` (PascalCase, match domain)
- **API routes:** `reciter/`, `db/`, `auth/` (lowercase, semantic grouping)
- **Database models:** `models/` (lowercase, contains model files)
- **Redux:** `redux/actions/`, `redux/reducers/`, `redux/methods/` (lowercase, standard Redux organization)

**Functions:**

- **Redux thunks:** `identityFetchData()`, `reciterFetchData()`, `reportPublicationSearch()` (camelCase, noun+Verb)
- **Controllers:** `getIdentity()`, `getAllIdentity()`, `searchPublications()` (camelCase, verb+Noun)
- **Utility functions:** `fullName()`, `sortPublications()`, `filterBySearchText()` (camelCase, descriptive)
- **React components:** `CurateIndividual`, `Search`, `SideNavbar` (PascalCase)
- **Hooks:** `useModal()`, `usePagination()` (camelCase, use* prefix)

**Variables:**

- **State:** `identityData`, `reciterFetching`, `adminSettings` (camelCase, semantic)
- **Boolean flags:** `isCuratorSelf`, `isSuperUser`, `displayImage` (camelCase, is*/has* prefix)
- **Redux selectors:** `const identityData = useSelector(state => state.identityData)` (camelCase, match reducer key)

**Types:**

- **TypeScript interfaces:** `PrimaryName`, `Error`, `Data` (PascalCase)
- **Route params:** `[uid]`, `[id]`, `[...nextauth]` (lowercase, matches Next.js convention)
- **Action types:** `IDENTITY_FETCH_DATA`, `FILTERS_CHANGE` (SCREAMING_SNAKE_CASE, matches Redux convention)

## Where to Add New Code

**New Feature (e.g., New Page):**

1. Create page component: `src/pages/newfeature/index.tsx`
   - Export default React component
   - Import AppLayout: `Page.getLayout = (page) => <AppLayout>{page}</AppLayout>`
   - Use Redux selectors with `useSelector()` for state
   - Dispatch actions with `useDispatch()`

2. Create component file(s): `src/components/elements/NewFeature/NewFeature.tsx`
   - Keep components small and focused
   - Import Redux at component level

3. Create API route(s): `src/pages/api/path/to/[endpoint].ts`
   - Validate `Authorization` header matches `reciterConfig.backendApiKey`
   - Delegate logic to controller

4. Create controller (if logic needed): `controllers/db/newfeature.controller.ts`
   - Async function accepting request params
   - Call models or external APIs
   - Return normalized response

5. Add Redux actions/reducers (if state needed):
   - Add action type to `src/redux/methods/methods.js`
   - Add thunk to `src/redux/actions/actions.js`
   - Add reducer cases to `src/redux/reducers/reducers.js`

6. Add middleware matcher if protected route: `src/middleware.ts`
   - Add route pattern to `config.matcher` array
   - Add role check logic

7. Add types: `types/` directory (if using TypeScript)

**New Component/Module:**

- Keep in `src/components/elements/[FeatureName]/`
- Use `.module.css` for local styles (prevents global namespace pollution)
- Export component at directory level (index.ts or directly)
- Import Redux, styles, and child components

**Utilities:**

- Shared helpers → `src/utils/`
- Date formatting, string manipulation, filtering logic
- Keep functions pure and testable

**Database Model:**

- Add to `src/db/models/[TableName].ts`
- Define attributes, types, associations
- Export from `init-models.ts`
- Use in controllers via `models.[TableName].findOne()`

**Adding a New Environment Variable:**

- Add to deployment secrets (K8s secret or .env in dev)
- Reference in `src/db/db.ts` (DB) or `config/local.js` (API)
- Never hardcode; always use `process.env.VAR_NAME`

**Adding a New Report Filter:**

- Define in `config/report.js` (metadata)
- Add filter component to `src/components/elements/Report/FilterSection.tsx`
- Add Redux action/reducer for filter state
- Modify controller to query based on filter
- Modify API payload to include filter

## Special Directories

**src/.next/:**
- Purpose: Next.js build output
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)
- Contains: Compiled pages, server functions, static optimization data

**types/:**
- Purpose: Shared TypeScript type definitions
- Generated: No
- Committed: Yes
- Contains: Global types, page-specific types, API response types

**public/:**
- Purpose: Static assets served directly
- Generated: No
- Committed: Yes
- Contains: Images, favicon, public documents

**kubernetes/:**
- Purpose: Infrastructure-as-code for EKS deployment
- Generated: No
- Committed: Yes
- Contains: Deployment, service, HPA, secret templates

**config/certs/:**
- Purpose: SAML certificates for authentication
- Generated: No (managed separately in deployment)
- Committed: No (security risk)
- Contains: `reciter-saml.crt`, `reciter-saml.key`, `idp.crt`

**Removed/Legacy Code:**

- `src/pages/admin/` and `src/pages/app/` directories appear unused (original architecture, superseded by dev_v2 routes)
- Old Next.js 12 layout in `src/pages/_app.tsx` has commented-out react-query code (React 16 era)

---

*Structure analysis: 2026-03-15*
