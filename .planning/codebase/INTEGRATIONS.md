# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**ReCiter Core APIs:**
- **Identity Service** - Fetches author/person profile data
  - SDK/Client: `fetch` (native HTTP)
  - Endpoints:
    - `RECITER_IDENITY_BY_UID` - Single identity lookup (`controllers/identity.controller.ts`)
    - `RECITER_GET_ALL_IDENTITY` - All identities (resource-intensive)
  - Auth: Header `api-key: NEXT_PUBLIC_RECITER_API_KEY`
  - Controller: `controllers/identity.controller.ts` (lines 4-49)

- **Feature Generator / Scoring Service** - Retrieves scored publications
  - SDK/Client: `fetch` (native HTTP)
  - Endpoints:
    - `RECITER_FEATURE_GENERATOR_ENDPOINT` - Single person scoring
    - `RECITER_FEATURE_GENERATOR_GROUP_ENDPOINT` - Batch scoring (up to 4 articles per person)
  - Auth: Header `api-key: NEXT_PUBLIC_RECITER_API_KEY`
  - Params: `totalStandardizedArticleScore: 3`, `useGoldStandard: "AS_EVIDENCE"`, `analysisRefreshFlag: false`, `retrievalRefreshFlag: false`, `filterByFeedback: "ALL"`
  - Controller: `controllers/featuregenerator.controller.ts` (lines 1-100)

- **User Feedback Service** - Stores accept/reject decisions
  - SDK/Client: `fetch` (native HTTP)
  - Endpoints:
    - `RECITER_SAVE_USER_FEEDBACK` - Save accepted/rejected PMIDs
    - `RECITER_DELETE_USER_FEEDBACK` - Clear all feedback
    - `RECITER_FIND_USER_FEEDBACK` - Retrieve saved feedback
  - Auth: Header `api-key: NEXT_PUBLIC_RECITER_API_KEY`
  - Controller: `controllers/userfeedback.controller.ts`

- **Gold Standard Service** - Updates training data
  - SDK/Client: `fetch` (native HTTP)
  - Endpoint: `RECITER_GOLD_STANDARD_ENDPOINT`
  - Auth: Header `api-key: NEXT_PUBLIC_RECITER_API_KEY`
  - Controller: `controllers/goldstandard.controller.ts`

**PubMed Retrieval:**
- **PubMed Search Service** - Article search via ReCiter-PubMed-Retrieval-Tool microservice
  - SDK/Client: `fetch` (native HTTP)
  - Endpoints:
    - `RECITER_SEARCH_PUBMED` - Full article data for search query
    - `RECITER_SEARCH_COUNT_PUBMED` - Count articles for search query (pre-check, limit 1000)
  - Method: POST with JSON body
  - Headers: `Content-Type: application/json`
  - Controller: `controllers/pubmed.controller.ts` (lines 1-85)
  - Note: Limits results to 1000 articles per search; returns error if exceeded

**Cornell Directory API:**
- **Profile Image Endpoint** - Fetches person photos
  - URL: `https://directory.weill.cornell.edu/api/v1/person/profile/{uid}.png?returnGenericOn404=true`
  - Auth: None (public endpoint)
  - Config: `config/local.js` (line 29)
  - Used in: `controllers/identity.controller.ts` (lines 23-30)

## Data Storage

**Primary Database:**
- **MySQL 5.7+** (via Sequelize ORM)
  - Connection: `RECITER_DB_HOST`, `RECITER_DB_NAME`, `RECITER_DB_USERNAME`, `RECITER_DB_PASSWORD`
  - Default name: `reciterPublicationManager`
  - Pool config: `src/db/db.ts` (max 20 connections, 30s acquire timeout, 10s idle)
  - Tables:
    - `admin_users` - User accounts
    - `admin_users_roles` - User role assignments
    - `admin_users_departments` - User department assignments
    - `admin_roles` - Role definitions
    - `admin_departments` - Department definitions
    - `admin_feedbacklog` - User feedback history
    - `admin_settings` - UI configuration (JSON viewAttributes)
    - `admin_notification_preferences` - User notification settings
    - `admin_notification_logs` - Email delivery tracking
    - `person` - Identity records
    - `person_person_type` - Person type classifications
    - `person_article` - Article-person relationships with scoring
    - `analysis_summary_article` - Article metadata
    - `analysis_summary_person` - Bibliometric aggregations (h-index, citation counts)
    - `journal_impact_*` - Journal metrics tables

**File Storage:**
- Local filesystem only (config files, certificates)
- SAML certificates: `config/certs/reciter-saml.{key,crt}`, `config/certs/idp.crt`
  - In production: Downloaded from S3 (`reciter-config/config/dev/saml/`) during CodeBuild pre-build phase
  - Config: `k8-buildspec.yml` (lines 15-17)

**Caching:**
- None detected (no Redis/Memcached integration)
- Admin settings loaded fresh on every login (`controllers/db/admin.settings.controller.ts`, line 110)

## Authentication & Identity

**Primary Auth Provider:**
- **SAML 2.0** (Shibboleth-compatible)
  - Library: `saml2-js 3.0.1`
  - Configuration: `config/saml.ts`
  - SP Config: Entity ID, certificate, private key, ACS endpoint, force authentication, encrypted assertions required
  - IdP Config: SSO login/logout URLs, certificate, transient nameid format
  - Attributes extracted: `CWID` (user ID), `user.email` (email address)
  - Callbacks: `src/pages/api/auth/[...nextauth].jsx` (lines 38-100)

**Secondary Auth (Local):**
- **Credential-based login** - Direct username/password authentication
  - Endpoint: `RECITER_AUTHENTICATION_ENDPOINT` (ReCiter backend)
  - Controller: `controllers/authentication.controller.ts`
  - Fallback if SAML unavailable
  - Callback: `src/pages/api/auth/[...nextauth].jsx` (lines 19-34)

**Session Management:**
- **JWT (JSON Web Token)**
  - Secret: `NEXT_PUBLIC_RECITER_TOKEN_SECRET`
  - Library: `jsonwebtoken 8.5.1` (encoding), `jose 4.14.4` (validation in edge middleware)
  - Max age: 7200 seconds (2 hours)
  - Storage: HTTP-only cookie `next-auth.session-token`
  - Payload: Includes `userRoles` array, `personIdentifier`, database user object

**User Roles:**
- Roles stored in database and injected into JWT token
- Available roles:
  - `Superuser` - Full access
  - `Curator_All` - Can curate all identities
  - `Reporter_All` - Can generate reports
  - `Curator_Self` - Can curate own publications only
- Role validation: `src/middleware.ts` (Edge middleware on protected routes)

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, DataDog, or CloudWatch integration)
- Errors logged to console via `console.log()` and `console.error()` calls

**Logs:**
- Console output only (captured by container runtime)
- Kubernetes logs: `kubectl logs -f <pod-name> -n reciter`
- No centralized logging aggregation (ELK, CloudWatch, etc.)

**Health Checks:**
- Liveness probe: GET `/api/healthcheck` (initialDelay 10s, period 5s, failureThreshold 3)
- Readiness probe: GET `/api/healthcheck` (initialDelay 10s, period 5s, failureThreshold 3)
- File: `src/pages/api/healthcheck.ts`

## CI/CD & Deployment

**Hosting:**
- AWS EKS (Elastic Kubernetes Service)
- Namespace: `reciter`
- Deployment names: `reciter-pm-dev` (dev) and `reciter-pm-prod` (prod)

**Container Registry:**
- AWS ECR (Elastic Container Registry)
- Image naming: `$REPOSITORY_URI:$TAG`
- Tag format: `{branch}-{buildnumber}.{date}.{time}.{commit-short}`

**CI Pipeline:**
- AWS CodeBuild
- Buildspec: `k8-buildspec.yml`
- Triggers: Webhook on push to `dev*` and `master` branches
- Build command: `docker build --build-arg ... -t $REPOSITORY_URI:$TAG .`
- Push: `docker push $REPOSITORY_URI:$TAG`
- Deploy: `kubectl set image deployment/...` (in-place rolling update)

**Infrastructure as Code:**
- Kubernetes manifests: `kubernetes/k8-deployment.yaml`, `kubernetes/k8-service.yaml`, `kubernetes/k8-secrets.yaml`
- Service type: NodePort (port 80 → 3000 via ALB)
- HPA: Auto-scales 1-2 replicas based on CPU (80%) or memory (85%)

## Environment Configuration

**Secrets Management:**
- Kubernetes Secrets (`reciter-pm-dev-secrets`, `reciter-pm-prod-secrets`)
- Secrets injected as environment variables at pod startup
- Template: `kubernetes/k8-secrets.yaml` (placeholders for actual values)
- Build args in Docker: `--build-arg NEXT_PUBLIC_RECITER_API_KEY=$ADMIN_API_KEY --build-arg NEXT_PUBLIC_RECITER_TOKEN_SECRET=$TOKEN_SECRET`

**Configuration Files:**
- API endpoints: `config/local.js` (branch-substituted during pre-build)
- Report settings: `config/report.js` (filter options, sort options, metrics)
- SAML: `config/saml.ts` (certificates loaded at startup)

**S3 Integration (Build-time only):**
- CodeBuild downloads SAML certificates from S3
- Bucket: `reciter-config/config/{dev|prod}/saml/`
- Files: `idp.crt`, `reciter-saml.crt`, `reciter-saml.key`
- Command: `aws s3 cp s3://reciter-config/config/dev/saml/... ./config/certs/`
- Config: `k8-buildspec.yml` (lines 15-17)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- **SAML ACS (Assertion Consumer Service)** - Receives SAML assertions from IdP
  - Endpoint: `ASSERT_ENDPOINT` environment variable
  - Method: POST
  - Handled by: `src/pages/api/auth/[...nextauth].jsx` (saml2-js callback)

- **Email Notifications** - Sends publication notifications via SMTP
  - SMTP server: `smtp.med.cornell.edu:587`
  - Port: 587 (TLS)
  - Auth: Hardcoded service account (see CONCERNS.md)
  - Library: `nodemailer 6.9.1`
  - Controller: `controllers/sendNotifications.controller.ts` (lines 1-52)
  - Note: Currently hardcoded test credentials; not production-ready

## API Rate Limiting

- Not detected (no rate limiting middleware or configuration)

---

*Integration audit: 2026-03-15*
