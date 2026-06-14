<!-- Generated review of dev_Upd_NextJS14SNode18 June arc (PRs #720-732). Scope: 5bab940..d52254a + master-replacement diff. 37-agent adversarial review. -->

# Review — dev_Upd_NextJS14SNode18 (June feature arc)

## 1. Executive summary

The June arc (PRs #720–732) delivers two things: a substantial **Authorships tab redesign** (rolling review queue, keyboard triage, filters/date presets, summary header) and a **flag-gated "View as" impersonation** feature for Superusers, plus a data-driven RBAC middleware rewrite. The authorships UI work is solid in its core data-correctness (gold-standard writes are server-validated, actioned rows can't resurrect) but carries a cluster of un-sequenced fetch/refill races and small UX/labeling defects that are transient and self-healing. The impersonation feature is correctly designed to be **off by default** and is not exploitable for privilege escalation, but its audit-attribution contract diverges from the Curate path and several session-integrity edges (stale overlay across re-auth, missing real-user re-guard) need hardening before the flag is ever turned on.

The headline risks are **not in the new feature code** — they are in what this 646-commits-ahead branch **replaces in production**. The RBAC middleware rewrite makes route authorization depend on three new permission tables that **have no provisioning/seed migration anywhere in the repo**; on an unseeded ReCiterDB this deterministically locks every user — including Superuser — out of `/curate`, `/manageusers`, and `/configuration`. A second middleware regression hard-gates `/manageprofile` and `/notifications` on permission keys that most roles never receive. And the new `impersonatedByUserID` column the curation write path references unconditionally is missing from the canonical ReCiterDB schema and depends on out-of-band migration ordering. These are merge-blocking, but they are deploy/data prerequisites with concrete fixes rather than logic bugs.

## 2. Merge-to-production risk verdict

**Verdict: HOLD — do not merge until the conditions below are met.**

This branch **REPLACES** 10 live production files (not just adds new ones). The single most dangerous replacement is `src/middleware.ts`, which flips route authorization from permissive role-label checks (always present in the JWT) to **deny-by-default, data-driven permission checks** sourced from tables the repo never creates or seeds. On a fresh/unseeded ReCiterDB this is a deterministic lockout of privileged roles from the core curation and admin routes — a worse-than-production-today outcome.

**Conditions to clear before merge (all required):**

1. **Provision + seed the three RBAC tables, OR add a role-label fallback in middleware.** Either (a) create and seed `admin_permissions`, `admin_role_permissions`, `admin_permission_resources` in dev **and** prod ReCiterDB with `permissionKey` values matching `ROUTE_PERMISSIONS` exactly, checked into the ReCiterDB repo and a repo migration; **or** (b) make the middleware derive `canCurate`/`canManageUsers`/`canConfigure` from `Superuser`/`Curator_All` role labels as a guaranteed fallback so an empty permission set can never strip access. (Finding C1)
2. **Fix or seed `/manageprofile` and `/notifications` gating** so Curator_All / Curator_Self / Department_user / Reporter_All retain the access they have in master. The self-only-redirect block already implements the real intent; the `ROUTE_PERMISSIONS` entries for these two routes are destructive. (Finding H1)
3. **Apply `add-impersonated-by-feedbacklog.sql` to dev AND prod ReCiterDB before/atomically with deploy, and mirror the column into the canonical `createDatabaseTableReciterDb.sql`.** The Curate feedbacklog INSERT names this column on every write; if the column is absent the entire accept/reject flow 500s for all users regardless of the feature flag. Add it as a blocking runbook step. (Findings H2, H3)
4. **Confirm `NEXTAUTH_SECRET` is set and stable across pods in prod**, and schedule the merge for a low-traffic window — the (pre-existing, already-on-dev) explicit-secret addition will force a one-time re-login of all active sessions. This is a rollout note, not a code defect. (Finding L-secret)
5. **Keep impersonation OFF in prod** until the audit-attribution and session-integrity hardening below is done. As shipped (flag off) it is dark and safe; do not flip `IMPERSONATION_ENABLED` until M1/M2/L-impersonation items are addressed.

With conditions 1–4 satisfied and the flag kept off, the arc is mergeable. Without them, this is a hold.

## 3. Findings by severity

### Critical

**C1 — Route authorization now depends on permission tables with no seed/migration; empty tables lock everyone out of `/curate`, `/manageusers`, `/configuration`**
`src/middleware.ts:52-81`
- **What's wrong:** The middleware was rewritten to gate routes on `decoded.permissions` via `ROUTE_PERMISSIONS` (`/curate`→`canCurate`, `/manageusers`→`canManageUsers`, `/configuration`→`canConfigure`). Those permissions come only from `findUserPermissionsEnriched` (`controllers/db/userroles.controller.ts:120-132`), which INNER-JOINs three brand-new tables (`admin_permissions`, `admin_role_permissions`, `admin_permission_resources`). No SQL anywhere in the repo CREATEs or SEEDs them — the seed exists only as a markdown table in `docs/superpowers/specs/2026-04-14-data-driven-rbac-design.md`. Empty/missing tables → `permissions=[]` → the fallback at `middleware.ts:55-57` sets only `['canSearch','canReport']` → `hasPermission(...)` is false for all three keys → **every user, including Superuser and Curator_All, is redirected away** from those routes. Master gated the same routes on `isSuperUser`/`isCuratorAll` role labels, which are always in the JWT.
- **Why it matters:** Deterministic, total lockout of privileged roles from the core curation and admin surfaces on any ReCiterDB that wasn't manually seeded (DR rebuild, fresh dev/QA/prod stand-up, or simply an un-run migration). This is strictly worse than production today, which needs no new table.
- **Fix:** Either provision+seed the three tables in dev/prod ReCiterDB (keys exactly `canCurate`/`canManageUsers`/`canConfigure`/`canReport`/`canSearch`) with the seed checked into the ReCiterDB repo + a repo migration, **or** add a guaranteed role-label fallback (Superuser/Curator_All → the three keys) so an empty set can't strip access. Add the missing DDL/seed migration regardless.

### High

**H1 — `/manageprofile` and `/notifications` hard-gated on permission keys most roles never receive**
`src/middleware.ts:13-14, 68-81`
- **What's wrong:** `ROUTE_PERMISSIONS` maps `/notifications`→`canManageNotifications` and `/manageprofile`→`canManageProfile`. The canonical Phase-14 seed grants these two keys to **Superuser only** — Curator_All/Curator_Self/Department_user/Reporter_All get none of them. The `ROUTE_PERMISSIONS` gate (lines 73-81) runs *before* the self-only-redirect block (lines 104-112), so for these roles it is a hard redirect; the self-only block is dead code for these two routes. `SideNavbar.tsx:262,272` still renders these links by **role label** for `["Department_user","Curator_Self","Superuser","Curator_All"]`, so those users click a visible link and get bounced to their landing page. In master, Superuser and Curator_All fell through to `NextResponse.next()` and could reach these pages freely.
- **Why it matters:** Real access regression vs. master for every non-Superuser role that the sidebar still advertises the links to. Blast radius depends on whether the DB was seeded: if seeded per the migration, only the non-Superuser roles regress; if never seeded, even Superuser loses access. (Note: the seed migration file was reverted out of the repo in commit `b7210e6`, and the middleware tests hard-code a more-permissive mapping that masks this — so green tests do not prove the routes work.)
- **Fix:** Remove the `/notifications` and `/manageprofile` entries from `ROUTE_PERMISSIONS` (restoring the self-only-redirect-only behavior already reimplemented at lines 104-112), or seed these two keys for the appropriate roles.

**H2 / H3 — `impersonatedByUserID` is referenced unconditionally on every feedbacklog write, but its column is missing from migration ordering and from the canonical schema**
`controllers/db/admin.feedbacklog.controller.ts:30,45,52` · `scripts/migrations/add-impersonated-by-feedbacklog.sql:17-18` · `ReCiterDB/setup/createDatabaseTableReciterDb.sql`
- **What's wrong:** `createFeedbackLog` always puts `impersonatedByUserID: impersonatedByUserID ?? null` into the `bulkCreate` payload, and `bulkCreate` derives its INSERT column list from **all** model `rawAttributes` (verified in installed Sequelize 6.37.8) — so the generated INSERT names the column on **every** curate accept/reject, even when the feature is off and the value is null. The column is created only by the PM-repo migration, whose own header **defers** the prod apply ("after the feature is verified on dev"). That deferral window is exactly when prod runs the new controller against a table lacking the column → MySQL error 1054 "Unknown column" → caught and returned as a **500 from `/api/db/admin/feedbacklog/create`**, breaking the core accept/reject flow for all users. Separately, the canonical `ReCiterDB/setup/createDatabaseTableReciterDb.sql` was never updated — `grep -rni impersonat` over the entire ReCiterDB repo returns zero — violating the project's three-places rule, so any schema rebuilt from canonical will be missing the column.
- **Why it matters:** Opaque 500 on the entire curation hot path for **all** users, independent of `IMPERSONATION_ENABLED`. The feature flag does not protect this because the column is written unconditionally. Nothing in CI/runbook/tooling enforces the migration ordering.
- **Fix:** Treat the DDL as a hard, blocking prerequisite: apply `add-impersonated-by-feedbacklog.sql` to dev AND prod ReCiterDB before (or atomically with) deploy, mirror `impersonatedByUserID INT DEFAULT NULL` (with matching FK — see M3) into `createDatabaseTableReciterDb.sql`, update the ReCiterDB repo per the three-places rule, and add it to the deploy runbook. Defense-in-depth: omit the column from `bulkCreate` when null.

### Medium

**M1 — Authorships gold-standard writes attribute the action to the REAL superuser and never set `impersonatedByUserID` — the opposite convention from the Curate path**
`controllers/db/authorships.controller.ts:190-210, 242-250, 277-349`
- **What's wrong:** Under impersonation, the Curate path writes `userID = target`, `impersonatedByUserID = real superuser`. The Authorships path's `resolveCurator()` deliberately reads `token.databaseUser?.userID` (the real superuser, since the JWT is never overlaid server-side) and calls `appendFeedbackLog(...)` which never sets `impersonatedByUserID` at all → `userID = real superuser`, `impersonatedByUserID = NULL`. The same loss applies to `AuthorshipReview.reviewer` (real superuser cwid) and the `writeGoldStandard` `curatedBy`/`entryPath=PM_AUTHOR` write. So the **same logical accept** by the same superuser-while-impersonating produces Curate and Authorships rows that disagree on **both** columns.
- **Why it matters:** "What did user X review" (filtered on `userID`) returns mutually contradictory results across the two tabs, and on the Authorships path a real superuser action is indistinguishable from one performed while impersonating. Bounded to audit-trail consistency, and only manifests once the flag is on (gold-standard correctness and authorization are unaffected — authz uses `getEffectiveRolesScope` correctly).
- **Fix:** Make Authorships use the same attribution contract as Curate: when impersonating, set `userID = target` and pass `impersonatedByUserID = real superuser` into `appendFeedbackLog` (add the column to the create call), and plumb the marker through `writeGoldStandard`/`AuthorshipReview`. Pick one convention and apply it to both paths — today they are mutually contradictory.

**M2 — Impersonation overlay survives a real sign-out/sign-in within TTL (stale "View as" resumes silently)**
`src/utils/impersonation.ts:86-108`
- **What's wrong:** The overlay binds to the real user only by `realPersonIdentifier === token.username` plus a wall-clock TTL window; it embeds no `jti`/`iat`/nonce and is not bound to the next-auth session instance. `signOut` and `/api/auth/saml-logout` never clear the separate `pm_impersonation` cookie, and the jwt/session callbacks never touch it. So a superuser who starts "View as," logs out, and logs back in within the 30-min TTL silently resumes acting-as the previous target on a session they believe is clean. Stop conditions are only TTL expiry, explicit DELETE, or the flag off. (`maxAge` 7200s > default overlay TTL 1800s.)
- **Why it matters:** Real identity and effective identity disagree without the user re-consenting. Not privilege escalation (start/read-time Superuser guards hold), but a genuine session-integrity defect.
- **Fix:** Bind the overlay to the issuing session (embed `jti`/`iat`/a per-login nonce and require a match in `getEffectiveIdentity`/`readOverlay`), or clear `pm_impersonation` on sign-in and saml-logout. At minimum, have the logout button also DELETE the impersonation cookie and document that re-auth does not clear it.

**M3 — `add-impersonated-by-feedbacklog.sql` adds a plain column, not the FK it documents; the model `references` is inert**
`scripts/migrations/add-impersonated-by-feedbacklog.sql:18`
- **What's wrong:** The migration comment and `AdminFeedbackLog.ts:53-59` both describe `impersonatedByUserID` as a "nullable FK → admin_users.userID," but the ALTER adds a bare column with no `FOREIGN KEY`, and PM never calls `sequelize.sync()` (grep `.sync(` in `src/db` → nothing), so `references` materializes no constraint at runtime. The existing `userID` column is backed by a real `admin_feedback_log_ibfk_1` constraint; the new column has nothing analogous.
- **Why it matters:** Unenforced pseudo-FK on an attribution/audit table — `impersonatedByUserID` can hold a non-existent `userID`, and deleting an admin_user leaves dangling references. Real-world corruption probability is low (the written value is the authenticated superuser's own valid id), but the documentation-vs-reality mismatch degrades the "logged to you" honesty the feature exists for.
- **Fix:** Either add `ADD CONSTRAINT admin_feedback_log_ibfk_2 FOREIGN KEY (impersonatedByUserID) REFERENCES admin_users (userID)` (and mirror in the canonical schema), or drop the "FK" wording from the comment and the `references` from the model.

### Low

**L1 — Filter change on page>0 fires two concurrent list fetches with no last-write-wins guard**
`src/components/elements/Authorships/AuthorshipsTabs.tsx:250-264, 309-312`
- **What's wrong:** A filter change while `page>0` issues fetch #1 at the stale offset (effect 309 runs before `setPage(0)`) and fetch #2 at offset 0, with no `AbortController` or sequence token; both `.then` handlers call `setRows`/`setCount` unconditionally. An out-of-range offset returns `{rows: [], count: N}`, so if the stale response lands last it wipes the correct page-0 rows and shows the empty state. (Two findings flagged the same mechanism.)
- **Why it matters:** Deterministic wasted round-trip + loading flash on every paged filter change; the wrong-data clobber needs out-of-order resolution (lower probability) and self-heals on the next action. Transient, no data corruption.
- **Fix:** Use a single source of truth — reset page synchronously in the filter handler (so only the offset-0 fetch runs), or stamp each fetch with a monotonic request id (a `useRef` counter) and ignore non-latest responses; or add an `AbortController`. Apply to `fetchData` and `topUp`.

**L2 — `topUp` refill is not request-sequenced and can additively merge stale-filter rows**
`src/components/elements/Authorships/AuthorshipsTabs.tsx:274-293, 322-354`
- **What's wrong:** `topUp` captures the current `filterBody` in its closure and does an additive `[...current, ...additions].slice(0, PAGE_SIZE)`. If an action fires `topUp`, the curator immediately changes a filter (firing a full-replace `fetchData` with the new filter), and the stale-filter `topUp` lands last, it appends old-filter rows onto the new-filtered list. (The finding's flagship "resurrect/drop actioned rows" scenario is refuted — the server-side `status != open` filter guarantees actioned rows can't reappear from either fetch.)
- **Why it matters:** Transient visual mix of rows across filters until the next fetch; self-healing, zero data-integrity impact (every GS write is independently server-validated).
- **Fix:** Share one request-sequence ref across `fetchData` and `topUp` and bail in `.then` if a newer request started, or never run `topUp` while a `fetchData` is pending.

**L3 — Keyboard focus is not advanced after an action, stalling the J/K/Y/N/S triage queue**
`src/components/elements/Authorships/AuthorshipsTabs.tsx:436-461, 322-354`
- **What's wrong:** After Y/N/S removes the focused row, `doAction`/`doActionAsync` never update `focusedId`, so the next Y/N/S resolves `visible.find(r => r.id === focusedId)` to undefined and is swallowed by `if (!row) return`. The replacement card sliding into the slot is never auto-focused (`focus(i)` only `scrollIntoView`s, never `.focus()`). The curator must press J between every action.
- **Why it matters:** Defeats the rapid single-key triage that is the headline of the redesign. Fail-safe (no wrong-row action, no data impact) and trivially worked around by pressing J or moving the mouse.
- **Fix:** In `doAction`/`doActionAsync`'s optimistic `setRows`, advance `focusedId` to the row now occupying the same index (computed from the pre-removal index before filtering), or the first row.

**L4 — List/summary error handlers `send(e)` a raw Error, which serializes to `{}`**
`controllers/db/authorships.controller.ts:138-141, 180-183`
- **What's wrong:** `listAuthorships` and `authorshipSummary` do `res.status(500).send(e)`; an Error serializes to `{}` (verified). The client `.then(r => r.json())` parses `{}` as valid JSON, so `.catch` never fires — `fetchData` silently sets `rows=[]/count=0` and `fetchSummary` sets `summary={}` (not null) with no console log. The failure is even more invisible than described. The action handler correctly uses `String(e)`.
- **Why it matters:** On any server exception the queue silently empties with no diagnosable signal — observability gap, not a correctness bug.
- **Fix:** Use `res.status(500).send(String(e))` or `res.status(500).json({ error: (e as Error)?.message })` consistently across all three handlers.

**L5 — Summary header always labels the count "unassigned," even in Snoozed/Dismissed views**
`src/components/elements/Authorships/AuthorshipsTabs.tsx:295-301, 496-497`
- **What's wrong:** `fetchSummary` posts the active `statusView` and the controller scopes `summary.total`/`single_candidate` to that view, but the header renders the static labels "unassigned" / "single-candidate" regardless of `statusView`. In the Dismissed tab it reads e.g. "512 unassigned" where 512 is the dismissed count.
- **Why it matters:** Misreports the queue size in non-Open views. Numbers are correctly scoped; only the noun is wrong.
- **Fix:** Either compute the summary against the open feed regardless of `statusView`, or make the header labels reflect `statusView` ("dismissed"/"snoozed").

**L6 — Effective-authz path lacks the Superuser re-guard the session-overlay path has (latent TOCTOU)**
`src/utils/effectiveSession.ts:284-342 vs. 165`
- **What's wrong:** `resolveEffectiveSessionData` returns null for a Superuser target at read time (line 165); `getEffectiveRolesScope` (the path that drives server-side authz in `checkCurationScope`) resolves and returns the target's roles unconditionally with no equivalent guard. If a target is granted Superuser/Curator_All after the overlay starts, the two paths diverge.
- **Why it matters:** **Not exploitable in this arc** — the unguarded branch only runs when the real user is a Superuser (start-time gate), and the sole consumer's only elevation (`canCurate.all`) the real Superuser already holds. Latent hardening gap: a future non-superuser-startable impersonation, or any out-ranking target, would leak elevated rights. (The finding miscites `authorships resolveCurator` as a second consumer; only `checkCurationScope` calls it.)
- **Fix:** Apply the same fail-closed `isSuperuser` guard in the impersonating branch of `getEffectiveRolesScope`, and factor the resolve-and-guard into one shared helper so the two resolvers can't disagree.

**L7 — Stale-JWT window lets a revoked Superuser keep an active impersonation**
`src/utils/impersonation.ts:97-115`
- **What's wrong:** The overlay only checks `realPersonIdentifier === token.username`; neither `getEffectiveIdentity` nor `getEffectiveRolesScope` re-verifies the real user is still a Superuser. JWT roles are frozen at login for up to `maxAge` 7200s, so a Superuser who starts "View as" and then has the role revoked in the DB keeps the impersonation functional until JWT expiry or re-login.
- **Why it matters:** Inherits the app's pre-existing "role changes need re-login" model rather than widening it (a revoked Superuser already keeps all Superuser caps until JWT expiry regardless of impersonation), and is bounded by the tighter 30-min overlay TTL. Defense-in-depth, not escalation.
- **Fix:** Before honoring the overlay, require the real token to still be Superuser (`if (!isSuperuser(token?.userRoles)) return real-identity`); for a true guarantee, resolve the real user's roles from the DB when an overlay is present.

**L8 — Page middleware gates on REAL JWT while APIs authorize on EFFECTIVE identity (render-vs-data asymmetry)**
`src/middleware.ts:19, 46-94`
- **What's wrong:** Middleware never reads the overlay, so it gates pages on the real superuser's roles while `checkCurationScope`/`resolveCurator` authorize on the effective target. Under impersonation: (1) the `/authorships` page renders (real role Superuser) but actions 403 (effective Curator_Self lacks Curator_All); (2) `isSelfOnly` is computed from real roles, so a superuser impersonating a Curator_Self can browse to `/curate/<anyone>` though the real target would be self-redirected.
- **Why it matters:** "View as" is not a faithful page-level mirror of the target's navigation. No escalation (data is gated on effective/lesser roles) and gated behind the off-by-default flag — a fidelity/consistency gap.
- **Fix:** Decide and document whether page-level mirroring is in scope. If yes, resolve the effective identity in middleware (or move the gate server-side). If intentionally out of scope, surface the effective-role 403 in the Authorships UI and note the asymmetry in the impersonation doc.

**L9 — AppLayout drops the master `/_error` redirect on Redux fetch failures**
`src/components/layouts/AppLayout.jsx:13-24`
- **What's wrong:** Master's AppLayout redirected to `/_error` whenever `state.errors.length` was non-zero (after any `dispatch(addError(...))`, wired across ~30 fetch `.catch` sites). The replacement removes the `errors` selector and both redirects; on a fetch failure the user now stays on-page (toast only). (The finding's two sub-claims are wrong: `src/pages/_error.js` does exist and rendered a custom `<Error/>` component, not Next's default.)
- **Why it matters:** Lost production behavior — but the old behavior was arguably itself buggy (`state.errors` is append-only and effectively never cleared, so one fetch failure could bounce the user to `/_error` and risk getting stuck). Removal is plausibly an intentional UX fix.
- **Fix:** Confirm the removal is deliberate; if hard-failure redirect is still wanted, reintroduce a guarded `errors.length` check; otherwise document so support knows users now stay on-page after fetch errors.

### Nit

- **Date presets 6m/12m overflow on long months** — `AuthorshipsTabs.tsx:425-432`: `setMonth(-6)`/`setFullYear(-1)` without day clamping rolls e.g. Aug 31 − 6mo into Mar 3. Clamp the day (set date to 1, shift, re-apply `min(day, daysInMonth)`) or subtract days. Reachable only on the 29th–31st; UX filter only.
- **Global keydown listener re-attaches on every refill/action** — `AuthorshipsTabs.tsx:436-461`: `rows` in the dep array churns on every optimistic action and `topUp`, swapping the `window` keydown listener on the hot path. (The finding's "`doAction` also churns" claim is wrong — only `rows` does.) Correctness-safe, O(1) per render, dwarfed by the list re-render. Optionally move latest values into refs and register once.
- **Migration not idempotent / not transactional** — `add-impersonated-by-feedbacklog.sql:13-18`: bare `ADD COLUMN` with no `IF NOT EXISTS`; re-run errors "Duplicate column name." Intentional, documented, matches the sibling migration, never executed by app code. Optionally use MariaDB `ADD COLUMN IF NOT EXISTS`; otherwise just run once per environment.
- **`articleIdentifier` is INT(11) but stores PMIDs from a BIGINT source** — `src/db/models/AdminFeedbackLog.ts:65-68`: pre-existing ceiling (~2.1B) inherited by the new authorships writes; current max PMID ~40M, so latent only. Track separately (widen to BIGINT).
- **`feedbacklog/create` now runs `getToken()` on every POST** — `src/pages/api/db/admin/feedbacklog/create/index.ts:44`: ungated by the feature flag, but try/caught and returns null off-path; one symmetric HMAC decode per write, additive nullable contract. No functional fix; just confirm `NEXTAUTH_SECRET` is set in prod (overlaps with the secret rollout note).

*(For transparency: 6 additional raised items were refuted/invalidated during adversarial verification and are not listed here. The `NEXTAUTH_SECRET` forced-logout item was confirmed in mechanism but down-scoped — it was introduced ~6 weeks before this arc in commit `03fca3c` and has been live on dev for over a month, so it is a rollout-coordination note (condition 4 above), not a June-arc defect.)*

## 4. Strengths / done well

- **Impersonation is correctly dark by default.** `IMPERSONATION_ENABLED` gates the entire feature off; start-time (`canViewAs` = Superuser only, reject Superuser targets) and read-time (`isSuperuser → null`) guards are layered and hold, so even the latent TOCTOU/stale-JWT findings produce **zero** privilege escalation in the code as written.
- **Server-side authz uses the effective identity correctly.** `checkCurationScope` and `resolveCurator` authorize on `getEffectiveRolesScope`, and scope/proxy axes can only ever narrow, never escalate.
- **Gold-standard write integrity is solid.** Every GS/feedbacklog write is independently server-validated; actioned rows are committed to a non-open status *before* the action POST resolves, so the unsequenced `topUp` race provably **cannot** resurrect or drop actioned rows — the worst case is a transient cross-filter visual mix.
- **The authorships races are all transient and self-healing** — no data corruption, no wrong-target writes; subsequent actions/fetches correct the view.
- **The `impersonatedByUserID` contract is additive and backward-compatible** (nullable column, defaults null), so existing/server-to-server callers are unaffected once the column exists.
- **Migration conventions are consistent** with the sibling `add-scope-proxy-columns.sql` (which was correctly mirrored into ReCiterDB — the gap is that the impersonation column wasn't).

## 5. Prioritized fix list

**Before merge (blocking):**
1. **[C1]** Provision+seed `admin_permissions`/`admin_role_permissions`/`admin_permission_resources` in dev+prod ReCiterDB with a checked-in repo migration, **or** add a Superuser/Curator_All → permission-key fallback in `src/middleware.ts`. Verify by direct query.
2. **[H1]** Remove `/manageprofile` + `/notifications` from `ROUTE_PERMISSIONS` (restore self-only behavior), or seed those keys for the roles the sidebar links them to.
3. **[H2/H3]** Apply `add-impersonated-by-feedbacklog.sql` to dev+prod ReCiterDB before/with deploy; mirror the column into `createDatabaseTableReciterDb.sql`; add to the deploy runbook as a blocking step. Optionally omit the null column from `bulkCreate` as defense-in-depth.
4. **[secret]** Confirm `NEXTAUTH_SECRET` is set + stable across pods in prod; schedule merge for a low-traffic window; communicate the one-time forced re-login.

**Before flipping `IMPERSONATION_ENABLED` on (blocking the feature, not the merge):**
5. **[M1]** Reconcile the Authorships vs. Curate audit-attribution contract — pick one convention and stamp `impersonatedByUserID` consistently on both paths (incl. `writeGoldStandard`/`AuthorshipReview`).
6. **[M2]** Bind the overlay to the issuing session (jti/nonce) or clear `pm_impersonation` on sign-in and saml-logout.
7. **[M3]** Add the real FK constraint (and mirror it canonically), or drop the FK wording/`references`.
8. **[L6/L7/L8]** Hardening: shared Superuser re-guard in `getEffectiveRolesScope`; re-check real-user Superuser status (DB-sourced) when an overlay is present; decide+document page-level mirroring (or surface the effective-role 403 in the UI).

**Follow-up (non-blocking):**
9. **[L1/L2]** Add a monotonic request-id/AbortController guard shared by `fetchData` and `topUp`; collapse the page-reset + refetch into a single offset-0 fetch.
10. **[L3]** Advance `focusedId` after an action so the keyboard queue keeps moving.
11. **[L4]** Use `send(String(e))`/`json({error})` consistently in the three authorships handlers.
12. **[L5]** Fix the summary header label for Snoozed/Dismissed views.
13. **[L9]** Confirm the `/_error` redirect removal is intentional; document or reinstate guarded.
14. **[Nits]** Date-preset day clamping; keydown-listener ref pattern; migration `IF NOT EXISTS`; track `articleIdentifier` BIGINT widening separately.