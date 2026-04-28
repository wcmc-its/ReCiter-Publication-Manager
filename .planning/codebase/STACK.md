# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**
- TypeScript 4.4.3 - API routes, controllers, database models, utilities
- JavaScript (JSX) - React components, Next.js pages, configuration
- Node.js 14.16.0 - Runtime environment

**Secondary:**
- YAML - Kubernetes manifests, buildspec configuration

## Runtime

**Environment:**
- Node.js 14.16.0 (from Dockerfile and environment setup)

**Package Manager:**
- npm - Package management
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 12.2.5 - Full-stack framework (pages router, API routes, SSR)
- React 16.14.0 - UI component library (pre-v18, no hooks requiring v18)

**State Management:**
- Redux 4.1.1 - Global state
- redux-thunk 2.3.0 - Async action middleware (3-phase pattern: FETCHING → SUCCESS/ERROR)
- next-redux-wrapper 7.0.5 - Redux store persistence across Next.js page transitions

**Authentication & Session:**
- next-auth 3.29.10 - Session management, JWT signing/validation, provider integration
- saml2-js 3.0.1 - SAML 2.0 service provider implementation

**UI & Styling:**
- Bootstrap 5.1.3 - CSS framework
- react-bootstrap 2.0.3 - Bootstrap components for React
- Material-UI (@mui/material) 5.0.6 - Material Design component library
- @mui/icons-material 5.0.5 - Material Design icons
- @emotion/react 11.5.0, @emotion/styled 11.3.0 - CSS-in-JS library (MUI dependency)

**HTTP & Data Fetching:**
- axios 0.25.0 - HTTP client (backup; primary is `fetch`)
- react-query 3.24.4 - Data fetching, caching, synchronization

**Date & Time:**
- dayjs 1.10.7 - Lightweight date library
- moment 2.29.4 - Moment.js for date manipulation (legacy; dayjs preferred)

**Data Export:**
- exceljs 4.3.0 - Excel/CSV file generation

**Email:**
- nodemailer 6.9.1 - SMTP email sending (configured for Cornell SMTP)
- nodemailer-smtp-transport 2.7.4 - SMTP transport layer

**Database ORM:**
- Sequelize 6.9.0 - Node.js ORM for MySQL
- mysql2 2.3.3-rc.0 - MySQL2 driver

**JWT & Cryptography:**
- jsonwebtoken 8.5.1 - JWT encoding/decoding
- jose 4.14.4 - JWT validation in edge middleware

**UI Components & Extensions:**
- react-dates 21.8.0 - Date range picker
- react-dropdown-date 2.2.7 - Dropdown date selector
- react-icons 4.3.1 - Icon library
- react-slidedown 2.4.5 - Collapsible slide-down component
- react-toastify 8.0.3 - Toast notifications
- react-router-dom 5.3.0 - Client-side routing (Note: likely unused with Next.js router)
- react-with-direction 1.4.0 - RTL support utilities

**Utilities:**
- reflect-metadata 0.1.13 - Decorator metadata for TypeScript
- http-build-query 0.7.0 - Query string builder

## Testing & Linting

**Linting:**
- ESLint 7.32.0 - Code quality
- eslint-config-next 11.1.2 - Next.js recommended ESLint config

**Testing:**
- Not detected (no Jest, Vitest, or Cypress configs found)

## Configuration

**TypeScript:**
- `tsconfig.json` - Configured for ES6 target, strict mode disabled, decorators enabled
- Includes paths like `src/redux/store/store.tsx`, `src/pages/`, `src/components/`

**Next.js:**
- `next.config.js` - SWC minification enabled, image domains whitelist: `directory.weill.cornell.edu`

**Build:**
- Multi-stage Docker build (Node 14.16.0-alpine)
  - Stage 1 (deps): Install dependencies
  - Stage 2 (builder): Build Next.js artifacts
  - Stage 3 (runner): Production image with optimized layers

## Platform Requirements

**Development:**
- Node.js 14.16.0+
- npm with `npm-force-resolutions` (preinstall hook applies forced dependency versions)
- MySQL database connection (via Sequelize)
- SAML certificates for authentication: `config/certs/reciter-saml.{key,crt}`, `config/certs/idp.crt`

**Production:**
- Kubernetes 1.19+ (EKS compatible)
- Container registry (AWS ECR)
- MySQL database (managed RDS or external)
- SAML IdP (Shibboleth or equivalent)
- SMTP server access (smtp.med.cornell.edu:587)

**Memory & CPU Allocation:**
- Requests: 1500m memory, 0.7 CPU
- Limits: 2G memory, 0.8 CPU
- HPA: Scales 1-2 replicas based on CPU (80%) or memory (85%) utilization

## Environment Variables

**Authentication & Session:**
- `NEXTAUTH_URL` - Public URL for callbacks (e.g., https://reciter-dev.weill.cornell.edu)
- `NEXTAUTH_URL_INTERNAL` - Internal server URL (http://localhost:3000)
- `LOGIN_PROVIDER` - `SAML` or `LOCAL`
- `NEXT_PUBLIC_RECITER_TOKEN_SECRET` - JWT signing secret
- `NEXT_PUBLIC_RECITER_BACKEND_API_KEY` - Internal API key for route authorization

**Database:**
- `RECITER_DB_HOST` - MySQL hostname
- `RECITER_DB_NAME` - Database name (default: reciterPublicationManager)
- `RECITER_DB_USERNAME` - Database user
- `RECITER_DB_PASSWORD` - Database password

**SAML Configuration:**
- `ENTITY_ID` - SP entity ID
- `ASSERT_ENDPOINT` - ACS endpoint URL
- `SSO_LOGIN_URL` - IdP login URL
- `SSO_LOGOUT_URL` - IdP logout URL

**ReCiter API Endpoints:**
- `NEXT_PUBLIC_RECITER_API_KEY` - Admin key for ReCiter APIs
- `RECITER_IDENITY_BY_UID` - ReCiter identity lookup
- `RECITER_GET_ALL_IDENTITY` - Get all identities
- `RECITER_FEATURE_GENERATOR_ENDPOINT` - Single-person scoring
- `RECITER_FEATURE_GENERATOR_GROUP_ENDPOINT` - Batch scoring
- `RECITER_AUTHENTICATION_ENDPOINT` - Auth verification
- `RECITER_GOLD_STANDARD_ENDPOINT` - Update gold standard
- `RECITER_SAVE_USER_FEEDBACK` - Save feedback
- `RECITER_DELETE_USER_FEEDBACK` - Delete feedback
- `RECITER_FIND_USER_FEEDBACK` - Retrieve feedback

**PubMed Search:**
- `RECITER_SEARCH_PUBMED` - PubMed search endpoint
- `RECITER_SEARCH_COUNT_PUBMED` - PubMed count endpoint

## Build & Deployment

**Local Development:**
```bash
npm install
npm run dev           # Start Next.js dev server on port 3000
npm run build         # Production build
npm run start         # Start production server
npm run lint          # Run ESLint
```

**Docker Build:**
- Multi-stage Node 14.16.0-alpine build
- Build args: `RECITER_DB_HOST`, `RECITER_DB_NAME`, `RECITER_DB_USERNAME`, `RECITER_DB_PASSWORD`, `NEXT_PUBLIC_RECITER_API_KEY`, `NEXT_PUBLIC_RECITER_TOKEN_SECRET`
- Output: Image runs as non-root user `nextjs` (UID 1001)
- Entrypoint: `npm run start`

**CI/CD Pipeline (AWS CodeBuild):**
- File: `k8-buildspec.yml`
- Stages:
  1. Install: `kubectl` version check
  2. Pre-build: Branch-based config substitution, S3 SAML cert download, ECR login
  3. Build: Docker build with ARG injection
  4. Post-build: ECR push, kubectl deployment update
- Branch routing:
  - `dev*` branches → dev config + `reciter-pm-dev` deployment
  - `master` → prod config + `reciter-pm-prod` deployment

**Kubernetes Deployment:**
- Manifest: `kubernetes/k8-deployment.yaml`
- Replicas: 1 (HPA scales to max 2)
- Container port: 3000
- Health checks: GET `/api/healthcheck`
- Node selector: `lifecycle: Ec2Spot`

---

*Stack analysis: 2026-03-15*
