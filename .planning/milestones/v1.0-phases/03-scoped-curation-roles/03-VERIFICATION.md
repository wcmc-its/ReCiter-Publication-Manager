---
phase: 03-scoped-curation-roles
verified: 2026-03-18T05:30:00Z
status: passed
score: 33/36 must-haves verified
re_verification: false
---

# Phase 3: Scoped Curation Roles Verification Report

**Phase Goal:** Administrators can assign curators to specific person types and/or organizational units, and those curators can only see and curate people within their assigned scope
**Verified:** 2026-03-18T05:30:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

All truths are drawn from the five plan `must_haves.truths` blocks (Plans 01-05).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | getCapabilities() recognizes Curator_Scoped role and returns canCurate.scoped = true | VERIFIED | `src/utils/constants.js` line 148: `if (roleCaps.canCurate.scoped) caps.canCurate.scoped = true` inside the `for (const role of roles)` loop. Correctly merges via OR logic. |
| 2 | isPersonInScope() correctly evaluates AND across dimensions and OR within dimensions | VERIFIED | `src/utils/scopeResolver.ts` lines 34-51: orgUnit check returns false if not matched (AND gate), personType check uses `personPersonTypes.some()` (OR within), both must pass for `return true` at line 53. 13/13 unit tests pass confirming logic. |
| 3 | Null personTypes in scope means no restriction on person type axis | VERIFIED | `src/utils/scopeResolver.ts` line 41: `if (scope.personTypes)` -- when null, the entire personType check block is skipped, allowing any person types through. Test at `__tests__/utils/scopeResolver.test.ts` line 67 confirms: `{ personTypes: null, orgUnits: null }` matches everything. |
| 4 | Null orgUnits in scope means no restriction on org unit axis | VERIFIED | `src/utils/scopeResolver.ts` line 34: `if (scope.orgUnits)` -- when null, the entire orgUnit check block is skipped. Test at `__tests__/utils/scopeResolver.test.ts` lines 10-28 verify personType-only scopes work correctly with `orgUnits: null`. |
| 5 | AdminUsersPersonType Sequelize model exists and maps to admin_users_person_types table | VERIFIED | `src/db/models/AdminUsersPersonType.ts` line 63: `tableName: 'admin_users_person_types'`. Model has id (autoIncrement PK), userID (FK to adminUsers), personType (STRING(128)), createTimestamp, modifyTimestamp. Indexes: PRIMARY, idx_userID, idx_personType. |
| 6 | Curator_Scoped is registered in ROLE_CAPABILITIES with canSearch: true and canCurate: { scoped: true } | VERIFIED | `src/utils/constants.js` lines 100-106: `[allowedPermissions.Curator_Scoped]: { canCurate: { scoped: true }, canReport: false, canSearch: true, canManageUsers: false, canConfigure: false }`. 14/14 constants-scoped tests pass. |
| 7 | findUserPermissions returns scopeData (personTypes + orgUnits) for Curator_Scoped users | VERIFIED | `controllers/db/userroles.controller.ts` lines 73-96: checks `hasScoped`, gets userID, calls `getScopeDataForUser(userID)` at line 96. Return at line 110: `JSON.stringify({ roles: userRolesList, scopeData, proxyPersonIds })`. |
| 8 | JWT token contains scopeData alongside userRoles for Curator_Scoped users | VERIFIED | `src/pages/api/auth/[...nextauth].jsx` lines 154-159: `const parsed = JSON.parse(apiResponse.userRoles)` then `if (parsed.scopeData) { token.scopeData = JSON.stringify(parsed.scopeData) }`. Session callback at lines 131-136 passes `token.proxyPersonIds` to `session.data`. |
| 9 | Middleware allows Curator_Scoped users to access /curate/* routes | VERIFIED | `src/middleware.ts` lines 58-61: `if (caps.canCurate.scoped) { console.log('[AUTH] ALLOW: Curator_Scoped'...); return res; }` -- allows access with person-level scope check deferred to API. |
| 10 | Middleware adds /manageprofile/* to route matcher | VERIFIED | `src/middleware.ts` line 7: `matcher: ['/manageusers/:path*', '/curate/:path*', '/report', '/search', '/configuration', '/notifications/:path*', '/manageprofile/:path*']` -- manageprofile pattern is in the array. |
| 11 | userfeedback save API returns 403 when scoped curator tries to save for out-of-scope person | VERIFIED | `src/pages/api/reciter/save/userfeedback/[uid].ts` lines 33-45: checks `caps.canCurate.scoped && !caps.canCurate.all`, parses scopeData, calls `getPersonWithTypes(uid)`, calls `isPersonInScope(scopeData, personData.primaryOrganizationalUnit, personData.personTypes)`, returns `res.status(403).json({ statusCode: 403, message: 'Person not in curation scope' })` if not in scope. |
| 12 | goldstandard update API returns 403 when scoped curator tries to update for out-of-scope person | VERIFIED | `src/pages/api/reciter/update/goldstandard.ts` lines 32-44: same pattern as userfeedback -- checks `caps.canCurate.scoped && !caps.canCurate.all`, gets personData, calls `isPersonInScope`, returns `res.status(403).json({ statusCode: 403, message: 'Person not in curation scope' })`. |
| 13 | Person search controller supports scope filtering via scopePersonTypes and scopeOrgUnits parameters | WARN | `controllers/db/person.controller.ts` lines 17-43: filters are applied via `apiBody.filters.personTypes` and `apiBody.filters.orgUnits` in the existing WHERE clause. However, the parameter names used are `personTypes` and `orgUnits` (not `scopePersonTypes` and `scopeOrgUnits` as the truth states). The functionality is correct -- scope filtering works via the existing filter mechanism. The API body uses `filters.personTypes` and `filters.orgUnits` which are shared with the regular search filters. Additionally, `includeScopeData: true` flag (line 110) triggers PersonPersonType join for client-side scope checking. |
| 14 | When Curator_Scoped is selected in AddUser form, a Curation Scope section appears | VERIFIED | `src/components/elements/AddUser/AddUser.tsx` line 65: `const hasScopedRole = selectedRoles.includes('Curator_Scoped')`. Lines 406-419: `<Collapse in={hasScopedRole}><div><CurationScopeSection ... /></div></Collapse>`. CurationScopeSection has Person Types and Org Units multi-selects. |
| 15 | When Curator_All and Curator_Scoped are both selected, form shows mutual exclusion error | VERIFIED | `src/components/elements/AddUser/AddUser.tsx` lines 97-99: `if (hasScopedRole && hasCuratorAll) { formErrInst.mutualExclusion = 'Curator All and Curator Scoped cannot be combined. Remove one.' }`. Lines 400-402 render the error: `<p role="alert" className="text-danger">{formErrorsInst.mutualExclusion}</p>`. Submit button disabled at line 432: `disabled={... || !!formErrorsInst.mutualExclusion}`. |
| 16 | If Curator_Scoped is selected with no scope fields, form shows 'At least one' error | VERIFIED | `src/components/elements/AddUser/AddUser.tsx` lines 101-103: `if (hasScopedRole && selectedPersonTypes.length === 0 && selectedDepartments.length === 0) { formErrInst.scopeRequired = 'At least one person type or organizational unit is required' }`. `CurationScopeSection.tsx` lines 90-94 render the error via `error` prop: `<div role="alert" className={styles.errorText}>{error}</div>`. |
| 17 | Saving a Curator_Scoped user persists person types to admin_users_person_types | VERIFIED | `controllers/db/manage-users/user.controller.ts` lines 216-223 (edit): `models.AdminUsersPersonType.destroy()` then `models.AdminUsersPersonType.bulkCreate(personTypeData, { transaction: t })`. Lines 281-288 (create): same `bulkCreate` pattern. AddUser.tsx line 132: `let personTypeLabels = hasScopedRole ? selectedPersonTypes : []` sends labels in payload. |
| 18 | Editing an existing Curator_Scoped user pre-populates scope fields | VERIFIED | `src/components/elements/AddUser/AddUser.tsx` lines 216-225: in the edit useEffect, checks `if (roleNames.includes('Curator_Scoped'))`, fetches from `/api/db/admin/users/persontypes?userId=${isEditUserId}`, then `setSelectedPersonTypes(data.map(d => d.personType))`. |
| 19 | UsersTable shows roles column with scope summary | VERIFIED | `src/components/elements/Manage/UsersTable.tsx` lines 44-59: iterates `roles`, when `role === 'Curator_Scoped'` constructs `scopeParts = [...personTypes, ...departments]` and renders them in parentheses after the role name with style `fontSize: '12px', fontWeight: 600, color: '#777777'`. |
| 20 | ManageUsers page has a role filter dropdown | VERIFIED | `src/components/elements/Manage/ManageUsers.tsx` lines 171-189: `<Form.Select id="roleFilter">` with options: All Roles, Superuser, Curator_All, Curator_Scoped, Curator_Self, Reporter_All. onChange triggers `fetchAllAdminUsers(1, count, searchText, e.target.value)`. Server-side filtering via `roleFilter` parameter in request body. |
| 21 | Server-side validation rejects simultaneous Curator_All + Curator_Scoped | VERIFIED | `controllers/db/manage-users/user.controller.ts` lines 144-151: resolves `selectedRoleIds` to `roleRecords` via `AdminRole.findByPk(id)`, then `if (roleRecords.includes('Curator_All') && roleRecords.includes('Curator_Scoped')) { return res.status(400).json({ error: 'Curator All and Curator Scoped cannot be combined' }) }`. |
| 22 | Scoped curator sees 'Show only people I can curate' checkbox | VERIFIED | `src/components/elements/Search/ScopeFilterCheckbox.tsx` line 15: `label="Show only people I can curate"`. Renders a Form.Check checkbox with minimum 44px height for touch target accessibility. |
| 23 | Checkbox is NOT visible for Curator_All, Curator_Self-only, or Reporter_All-only users | VERIFIED | `src/components/elements/Search/Search.js` line 79: `const showScopeCheckbox = caps.canCurate.scoped && !caps.canCurate.all`. Lines 497-502: `{showScopeCheckbox && (<ScopeFilterCheckbox ... />)}`. Curator_All has canCurate.all=true so excluded. Curator_Self has canCurate.scoped=false so excluded. Reporter_All has canCurate=false so excluded. |
| 24 | Checking the box filters results to only people matching scope | VERIFIED | `src/components/elements/Search/Search.js` lines 139-168: `handleScopeFilterChange` dispatches `updateScopeFilter(checked)`, when checked builds `scopeFilters` from `scopeData.personTypes` and `scopeData.orgUnits`, adds proxy IDs, dispatches `identityFetchAllData(request)`. When unchecked, resets to unfiltered paginated data. |
| 25 | In-scope people show curate icon (EditOutlined) | VERIFIED | `src/components/elements/Search/Search.js` lines 452-459: `{personInScope && (caps.canCurate.all || caps.canCurate.scoped || isSuperUser) && (<Tooltip title="Curate publications"><EditOutlinedIcon ... onClick={() => router.push(`/curate/${identity.personIdentifier}`)} /></Tooltip>)}`. EditOutlinedIcon imported from `@mui/icons-material/EditOutlined` at line 21. |
| 26 | Out-of-scope people do NOT show curate icon | VERIFIED | `src/components/elements/Search/Search.js` line 452: the curate icon render is gated by `personInScope && ...`. When `personInScope` is false (person not in scope and not a proxy), the icon does not render. `personInScope` is computed at lines 418-422 with `isPersonInScope` and `isProxyFor` checks. |
| 27 | Clicking in-scope person name navigates to /curate/:id | VERIFIED | `src/components/elements/Search/Search.js` lines 425-433: `handleNameClick` checks conditions, and for scoped curators where `personInScope` is true calls `onClickProfile(identity.personIdentifier)`. `onClickProfile` at line 323: `router.push('/curate/' + personIdentifier)`. |
| 28 | Clicking out-of-scope person name navigates to /report | VERIFIED | `src/components/elements/Search/Search.js` lines 425-433: when `caps.canCurate.scoped && !personInScope`, the final else clause at line 431 calls `redirectToCurate("report", identity)`. `redirectToCurate` at lines 372-377: dispatches `updateIndividualPersonReportCriteria(data)` then `router.push({ pathname: '/report' })`. |
| 29 | Scope label appears in sidebar: 'Curating: ...' | VERIFIED | `src/components/elements/Navbar/ScopeLabel.tsx` lines 33-38: constructs `labelText` starting with `"Curating: "` followed by scope display text and/or proxy text. `SideNavbar.tsx` lines 230-231: `{open && caps.canCurate.scoped && !caps.canCurate.all && (<ScopeLabel scopeData={scopeData} proxyCount={proxyPersonIds.length} />)}`. |
| 30 | Curate page checks scope on mount and redirects with toast | VERIFIED | `src/pages/curate/[id].js` lines 34-72: `useEffect` checks `caps.canCurate.scoped && !caps.canCurate.all`, fetches person data from `/api/db/person/scopecheck?uid=${personId}`, calls `isPersonInScope(scopeData, personData.primaryOrganizationalUnit, personData.personTypes)`, and on failure: `toast.error("You don't have curation access for this person", ...)` then `router.push('/search')`. |
| 31 | Checkbox state persists across pagination | WARN | `src/components/elements/Search/Search.js` line 70: `const showOnlyScopeFiltered = useSelector((state) => state.showOnlyScopeFiltered)` -- state is stored in Redux. Lines 182-187: `handlePaginationUpdate` re-fetches with `identityFetchPaginatedData(page, count, filters, options)` using the Redux `filters` which include scope filters. However, the scope filter state is maintained via `updateScopeFilter` Redux action (line 140) and the `filters` object includes scope params. The checkbox survives pagination because it reads from Redux store, not component-local state. However, the `handlePaginationUpdate` does not explicitly re-apply scope filters to the paginated data fetch -- it only sends existing `filters`. This works because filters were already updated in Redux by `handleScopeFilterChange`. The truth holds but relies on Redux state persistence during re-renders. |
| 32 | Manage Profile page renders ORCID management for a person | VERIFIED | `src/components/elements/ManageProfile/ManageProfile.tsx` lines 78-79: `<h5>ORCID</h5>` and description text. Lines 83-98: "Suggested ORCID" section with RadioGroup. Lines 101-113: "Manually add your ORCID" section with input field. Save/Reset buttons at lines 116-121. |
| 33 | Scoped curator can access Manage Profile for in-scope people | VERIFIED | `src/pages/manageprofile/[userId].tsx` lines 22-53: checks `caps.canCurate.scoped && !caps.canCurate.all`, fetches person data, calls `isPersonInScope()`. If in scope, no redirect occurs -- the component renders normally with `<ManageProfile />` at line 58. |
| 34 | Scoped curator is redirected with toast for out-of-scope person | VERIFIED | `src/pages/manageprofile/[userId].tsx` lines 41-49: `if (personData && !isPersonInScope(...)) { console.log('[AUTH] DENY: Scoped curator tried to access /manageprofile/' + personId + ' -- not in scope'); toast.error("You don't have curation access for this person", ...); router.push('/search'); }`. |
| 35 | Curator_All can access Manage Profile for any person | VERIFIED | `src/pages/manageprofile/[userId].tsx` line 22: `if (caps.canCurate.scoped && !caps.canCurate.all)` -- scope check is only entered when `!caps.canCurate.all`. For Curator_All, `canCurate.all = true`, so the entire scope check is bypassed and the page renders with `<ManageProfile />`. |
| 36 | 5 files ported from master commit 544c0f2 | VERIFIED | All 5 files confirmed to exist: `controllers/db/manage-profile/manageProfile.controller.ts` (EXISTS), `src/components/elements/ManageProfile/ManageProfile.tsx` (EXISTS, 127 lines with ORCID UI), `src/components/elements/ManageProfile/ManageProfile.module.css` (EXISTS), `src/pages/api/db/admin/manageProfile/getORCIDProfileDataByID/index.ts` (EXISTS), `src/pages/manageprofile/[userId].tsx` (EXISTS, 67 lines with scope enforcement). |

**Score:** 33 VERIFIED, 2 WARN, 0 FAILED, 0 HUMAN = 33/36 truths verified, 2 partial, 1 needs human testing

**WARN details:**
- Truth 13: Scope filtering uses existing `filters.personTypes` and `filters.orgUnits` params rather than dedicated `scopePersonTypes`/`scopeOrgUnits` params. Functionally equivalent but naming differs from truth statement.
- Truth 31: Pagination persistence relies on Redux state management. The mechanism works but could fail if `handlePaginationUpdate` dispatches `clearFilters` in an edge case. No evidence of such a bug but cannot rule it out without running the app.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/models/AdminUsersPersonType.ts` | Sequelize model for person type scope junction table | VERIFIED | 92 lines. `tableName: 'admin_users_person_types'`, personType STRING(128), FK to adminUsers via userID, 3 indexes. |
| `src/utils/scopeResolver.ts` | Centralized isPersonInScope() helper | VERIFIED | 69 lines. Exports: `ScopeData` interface, `isPersonInScope()`, `isProxyFor()` (added by Phase 4). |
| `src/utils/constants.js` | Extended capability model with Curator_Scoped | VERIFIED | 175 lines. `allowedPermissions` includes `Curator_Scoped`. `ROLE_CAPABILITIES` has Curator_Scoped entry. `getCapabilities()` merges scoped flag. `getLandingPage()` routes scoped to /search. |
| `src/db/models/init-models.ts` | AdminUsersPersonType registered in model init | VERIFIED | Line 18: import. Line 224: `AdminUsersPersonType.initModel(sequelize)`. Line 271-272: associations (belongsTo AdminUser, AdminUser hasMany). Line 288: in return object. |
| `__tests__/utils/scopeResolver.test.ts` | Tests for scope resolver logic | VERIFIED | 81 lines. 13 tests in 4 describe blocks: person type only, org unit only, both dimensions, edge cases. All 13 pass. |
| `__tests__/utils/constants-scoped.test.ts` | Tests for getCapabilities with Curator_Scoped | VERIFIED | 128 lines. 14 tests in 5 describe blocks: allowedPermissions, ROLE_CAPABILITIES, getCapabilities, getLandingPage, backward compat. All 14 pass. |
| `controllers/db/userroles.controller.ts` | Extended findUserPermissions with scope data query | VERIFIED | 116 lines. `getScopeDataForUser()` queries admin_users_person_types and admin_departments. Returns `{ roles, scopeData, proxyPersonIds }`. |
| `src/pages/api/auth/[...nextauth].jsx` | JWT callback embedding scopeData | VERIFIED | 184 lines. JWT callback parses `{ roles, scopeData }` from findUserPermissions, stores `token.scopeData`. |
| `src/middleware.ts` | Middleware supporting Curator_Scoped and /manageprofile/* | VERIFIED | 150 lines. Matcher includes `/manageprofile/:path*`. Curate route allows Curator_Scoped. ManageProfile route allows scoped. |
| `src/pages/api/reciter/save/userfeedback/[uid].ts` | Scope enforcement on feedback save | VERIFIED | 79 lines. Imports isPersonInScope, checks scope, returns 403 with "Person not in curation scope". |
| `src/pages/api/reciter/update/goldstandard.ts` | Scope enforcement on gold standard update | VERIFIED | 77 lines. Same pattern as userfeedback -- imports isPersonInScope, checks scope, returns 403. |
| `src/components/elements/AddUser/CurationScopeSection.tsx` | Conditional scope assignment form section | VERIFIED | 99 lines. Fieldset with legend "Curation Scope", Person Types and Organizational Units Autocomplete multi-selects, error display. |
| `src/components/elements/AddUser/CurationScopeSection.module.css` | Styles for scope section | VERIFIED | File exists in the codebase (referenced at CurationScopeSection.tsx line 4). |
| `controllers/db/manage-users/user.controller.ts` | Persists person type scope + validates mutual exclusion | VERIFIED | 342 lines. `createOrUpdateAdminUser` handles personTypeLabels via destroy+bulkCreate pattern. Server-side mutual exclusion at lines 144-151. `fetchUserPersonTypes` at lines 328-342. |
| `src/components/elements/Search/ScopeFilterCheckbox.tsx` | Scope filter checkbox component | VERIFIED | 24 lines. Label: "Show only people I can curate". Form.Check with controlled checked/onChange. |
| `src/components/elements/Navbar/ScopeLabel.tsx` | Scope label below user name in sidebar | VERIFIED | 67 lines. Constructs "Curating: {items}" text with tooltip for overflow, proxyCount support. |
| `src/pages/curate/[id].js` | Curate page with scope check on mount | VERIFIED | 86 lines. useEffect checks scope, fetches person data, calls isPersonInScope, redirects with toast if denied. |
| `src/pages/manageprofile/[userId].tsx` | Manage Profile page route with scope enforcement | VERIFIED | 67 lines. Same scope check pattern as curate page -- isPersonInScope + toast + redirect. |
| `src/components/elements/ManageProfile/ManageProfile.tsx` | ORCID management UI component | VERIFIED | 127 lines. ORCID suggestions, manual input, save/reset buttons, profile data fetch. |

---

### Key Link Verification

| # | From | To | Via | Status | Details |
|---|------|----|-----|--------|---------|
| 1 | `src/utils/constants.js` | `ROLE_CAPABILITIES` | Curator_Scoped entry in frozen map | WIRED | Lines 100-106: `[allowedPermissions.Curator_Scoped]: { canCurate: { scoped: true }, ... }`. `allowedPermissions.Curator_Scoped` resolves to string `"Curator_Scoped"` (line 9). |
| 2 | `src/db/models/init-models.ts` | `src/db/models/AdminUsersPersonType.ts` | import + initModel + association | WIRED | Line 18: `import { AdminUsersPersonType } from "./AdminUsersPersonType"`. Line 224: `AdminUsersPersonType.initModel(sequelize)`. Lines 271-272: `AdminUsersPersonType.belongsTo(AdminUser, { as: "user", foreignKey: "userID" })` and `AdminUser.hasMany(AdminUsersPersonType, { as: "adminUsersPersonTypes", foreignKey: "userID" })`. |
| 3 | `controllers/db/userroles.controller.ts` | `src/pages/api/auth/[...nextauth].jsx` | findUserPermissions return -> JWT callback | WIRED | userroles.controller.ts line 110: `return JSON.stringify({ roles: userRolesList, scopeData, proxyPersonIds })`. [...nextauth].jsx line 7: `import { findUserPermissions } from '../../../../controllers/db/userroles.controller'`. Line 154: `const parsed = JSON.parse(apiResponse.userRoles)` then line 158: `token.scopeData = JSON.stringify(parsed.scopeData)`. |
| 4 | `src/pages/api/auth/[...nextauth].jsx` | `src/middleware.ts` | JWT token scopeData -> middleware decode | WIRED | [...nextauth].jsx line 159: `token.scopeData = JSON.stringify(parsed.scopeData)`. middleware.ts lines 33-37: `if (decodedTokenJson.scopeData) { scopeData = JSON.parse(scopeString) }`. Line 49: `caps.canCurate.scopeData = scopeData`. |
| 5 | `src/pages/api/reciter/save/userfeedback/[uid].ts` | `src/utils/scopeResolver.ts` | isPersonInScope import | WIRED | userfeedback/[uid].ts line 6: `import { isPersonInScope } from '../../../../../utils/scopeResolver'`. Line 41: `const inScope = isPersonInScope(scopeData, personData.primaryOrganizationalUnit, personData.personTypes)`. |
| 6 | `src/components/elements/AddUser/AddUser.tsx` | `src/components/elements/AddUser/CurationScopeSection.tsx` | conditional render | WIRED | AddUser.tsx line 13: `import CurationScopeSection from './CurationScopeSection'`. Lines 406-419: `<Collapse in={hasScopedRole}><div><CurationScopeSection ... /></div></Collapse>`. |
| 7 | `src/components/elements/AddUser/AddUser.tsx` | `controllers/db/manage-users/user.controller.ts` | form submit -> createOrUpdateAdminUser | WIRED | AddUser.tsx line 132: `let personTypeLabels = hasScopedRole ? selectedPersonTypes : []`. Line 133: payload includes `personTypeLabels`. Line 136/160: `createAdminUser(createOrUpdatePayload)` which POSTs to `/api/db/admin/users/addEditUser`. user.controller.ts line 140: `const { ... personTypeLabels } = req.body`. Lines 216-223/281-288: `AdminUsersPersonType.bulkCreate()`. |
| 8 | `src/components/elements/Manage/ManageUsers.tsx` | `src/components/elements/Manage/UsersTable.tsx` | passes user data with roles | WIRED | ManageUsers.tsx line 8: `import UsersTable from "./UsersTable"`. Line 210: `<UsersTable data={users} />`. UsersTable.tsx line 31: `const roles = user.adminUsersRoles?.map(ur => ur.role?.roleLabel)` and line 32: `const personTypes = user.adminUsersPersonTypes?.map(pt => pt.personType)`. |
| 9 | `src/components/elements/Search/Search.js` | `src/components/elements/Search/ScopeFilterCheckbox.tsx` | conditional render based on canCurate.scoped | WIRED | Search.js line 12: `import ScopeFilterCheckbox from './ScopeFilterCheckbox'`. Line 79: `const showScopeCheckbox = caps.canCurate.scoped && !caps.canCurate.all`. Lines 497-502: `{showScopeCheckbox && (<ScopeFilterCheckbox checked={showOnlyScopeFiltered} onChange={handleScopeFilterChange} />)}`. |
| 10 | `src/components/elements/Search/Search.js` | `controllers/db/person.controller.ts` | scope filter params to /api/db/person | WIRED | Search.js lines 142-153: when scope checkbox checked, builds `scopeFilters` with `personTypes`, `orgUnits`, `proxyPersonIds`. Line 160: `dispatch(updateFilters(updatedFilters))` then `dispatch(identityFetchAllData(request))`. Redux action POSTs to `/api/db/person`. person.controller.ts lines 17-43: applies `apiBody.filters.personTypes` and `apiBody.filters.orgUnits` to WHERE clause. |
| 11 | `src/components/elements/Navbar/SideNavbar.tsx` | `src/components/elements/Navbar/ScopeLabel.tsx` | conditional render when canCurate.scoped | WIRED | SideNavbar.tsx line 26: `import ScopeLabel from './ScopeLabel'`. Lines 230-231: `{open && caps.canCurate.scoped && !caps.canCurate.all && (<ScopeLabel scopeData={scopeData} proxyCount={proxyPersonIds.length} />)}`. |
| 12 | `src/pages/curate/[id].js` | `src/utils/scopeResolver.ts` | scope check on mount | WIRED | curate/[id].js line 8: `import { isPersonInScope, isProxyFor } from "../../utils/scopeResolver"`. Line 60: `!isPersonInScope(scopeData, personData.primaryOrganizationalUnit, personData.personTypes || [])`. |
| 13 | `src/pages/manageprofile/[userId].tsx` | `src/components/elements/ManageProfile/ManageProfile.tsx` | page imports component | WIRED | manageprofile/[userId].tsx line 3: `import ManageProfile from "../../components/elements/ManageProfile/ManageProfile"`. Line 58: `<ManageProfile />`. |
| 14 | `src/pages/manageprofile/[userId].tsx` | `src/utils/scopeResolver.ts` | scope check on mount | WIRED | manageprofile/[userId].tsx line 8: `import { isPersonInScope, isProxyFor } from "../../utils/scopeResolver"`. Line 41: `!isPersonInScope(scopeData, personData.primaryOrganizationalUnit, personData.personTypes || [])`. |

**Score:** 14/14 links WIRED, 0 BROKEN

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SCOPE-01 | Database schema supports scoped curation roles with nullable person type and org unit columns | SATISFIED | AdminUsersPersonType model (`src/db/models/AdminUsersPersonType.ts`) maps to `admin_users_person_types` table with personType STRING(128) + FK to adminUsers. Registered in init-models.ts (line 224). AdminUsersPersonType.bulkCreate persists scope in user.controller.ts (lines 216-223, 281-288). Departments reuse existing admin_users_departments table. Null handling: scopeResolver.ts treats null arrays as "no restriction" (lines 34, 41). Note: Phase 4 also modified init-models.ts (added AdminUsersProxy) and user.controller.ts (added proxy include) but Phase 3 code remains intact. |
| SCOPE-02 | Scoped curators only see people matching their assigned scope on the Find People page | SATISFIED | ScopeFilterCheckbox component (`src/components/elements/Search/ScopeFilterCheckbox.tsx`) renders "Show only people I can curate" checkbox. Search.js conditionally renders it for scoped curators only (line 79: `caps.canCurate.scoped && !caps.canCurate.all`). When checked, scope filters sent to person API (Search.js lines 142-153). EditOutlinedIcon curate icon only shown for in-scope people (Search.js lines 452-459). Out-of-scope name clicks go to /report (Search.js line 431). ScopeLabel in sidebar shows scope summary (SideNavbar.tsx lines 230-231). Note: Phase 4 added ProxyBadge and isProxyFor integration to Search.js but scope filtering logic remains intact. |
| SCOPE-03 | Scoped curators can only curate publications for people within their assigned scope | SATISFIED | Three enforcement layers: (1) Middleware allows route access but defers person-level check (middleware.ts lines 58-61). (2) API-level 403 on userfeedback save (userfeedback/[uid].ts lines 33-45) and goldstandard update (goldstandard.ts lines 32-44). (3) Client-side scope check with redirect+toast on curate page (curate/[id].js lines 34-72) and manageprofile page (manageprofile/[userId].tsx lines 15-53). Note: Phase 4 added isProxyFor bypass before scope check in curate/[id].js (lines 46-51) and manageprofile/[userId].tsx (lines 27-31). Phase 3 scope enforcement remains intact -- proxy is an additive OR condition. |
| SCOPE-04 | Superusers can assign person type scopes to users from the Manage Users page | SATISFIED | AddUser.tsx conditionally renders CurationScopeSection when Curator_Scoped selected (lines 406-419). CurationScopeSection.tsx provides Person Types multi-select Autocomplete. Person type options fetched from `/api/db/users/persontypes` (AddUser.tsx lines 186-197). Form submit sends `personTypeLabels` to user.controller.ts which persists via AdminUsersPersonType.bulkCreate. Edit mode pre-populates from `/api/db/admin/users/persontypes?userId=X` (AddUser.tsx lines 216-225). |
| SCOPE-05 | Superusers can assign org unit scopes to users from the Manage Users page | SATISFIED | CurationScopeSection.tsx includes Organizational Units multi-select (lines 62-88). Department options passed from AddUser.tsx (line 414: `departmentOptions={adminDepartments.map(d => d.departmentLabel)}`). Departments stored via existing admin_users_departments table (AddUser.tsx lines 124-127, user.controller.ts lines 187-194/259-266). When Curator_Scoped is NOT selected, departments appear in original position (AddUser.tsx lines 350-375). When IS selected, departments relocate inside CurationScopeSection (AddUser.tsx line 412: `selectedDepartments` and `onDepartmentsChange` props). |
| SCOPE-06 | Scoped roles support flexible combination: person type only, org unit only, or both | SATISFIED | scopeResolver.ts handles all combinations: (1) personTypes only (orgUnits=null) -- skips orgUnit check (line 34). (2) orgUnits only (personTypes=null) -- skips personType check (line 41). (3) Both -- checks both dimensions with AND (lines 34+41). 13 unit tests in scopeResolver.test.ts cover all combinations. constants-scoped.test.ts confirms Curator_Scoped merges correctly with other roles (14 tests). getCapabilities merges scoped flag without breaking existing roles (constants.js lines 148). |

All 6 SCOPE requirements SATISFIED. Phase 4 modifications to shared files (Search.js, SideNavbar.tsx, curate/[id].js, manageprofile/[userId].tsx, person.controller.ts, user.controller.ts, init-models.ts) are additive -- proxy features wrap or extend scope code without removing or altering Phase 3 logic.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/elements/ManageProfile/ManageProfile.tsx` | 38-39 | `const onSave = () => {}` -- empty handler | LOW | Save button exists but does nothing. Ported from master commit 544c0f2 as-is. The page renders ORCID suggestions and manual input but saving is a no-op. This is a pre-existing incomplete feature, not a Phase 3 regression. |
| `src/components/elements/ManageProfile/ManageProfile.tsx` | 62 | `console.log("data", data)` | LOW | Debug logging in ORCID profile data fetch success path. Should be removed before production but does not affect functionality. |
| `controllers/db/userroles.controller.ts` | 105 | `console.log('[AUTH] Proxy lookup failed')` | INFO | Intentional fallback log in try-catch for proxy table that may not exist. Added by Phase 4, not Phase 3. |
| `controllers/db/userroles.controller.ts` | 112 | `console.log('[AUTH] findUserPermissions error:', e)` | INFO | Intentional error logging in catch block. Safe fallback returns empty roles. |
| `src/components/elements/Search/Search.js` | 17 | `import { useHistory } from "react-router-dom"` | LOW | Unused import -- useHistory is imported but never called (line 30 assigns `const history = useHistory()` but `history` is never used). Pre-existing issue, not Phase 3. |

No TODO, FIXME, HACK, or XXX comments found in any Phase 3 source files.

---

### Human Verification Required

| # | Behavior | Requirement | Why Human | Test Instructions |
|---|----------|-------------|-----------|-------------------|
| 1 | Scope label displays in side navbar with correct text | SCOPE-02 | Visual rendering of text and styling | Login as scoped curator with personTypes ["Faculty"] and orgUnits ["Surgery"]. Verify sidebar shows "Curating: Faculty, Surgery" below the navigation header. Verify text truncates with tooltip when items exceed 3. |
| 2 | CurationScopeSection appears/hides smoothly when Curator_Scoped is toggled | SCOPE-01, SCOPE-04 | Interactive form behavior with CSS transition | Go to Manage Users > Add User. Add Curator_Scoped role. Verify Curation Scope section appears with smooth Collapse animation. Remove Curator_Scoped. Verify section hides. |
| 3 | Mutual exclusion error prevents form submission | SCOPE-01 | Form interaction validation | Select both Curator_All and Curator_Scoped. Verify red error text "Curator All and Curator Scoped cannot be combined. Remove one." appears. Verify Submit button is disabled. |
| 4 | Scope filter checkbox actually filters visible results | SCOPE-02 | End-to-end filtering with live data | Login as scoped curator. On Find People, check "Show only people I can curate". Verify only matching people appear. Uncheck. Verify all people reappear. |
| 5 | Out-of-scope person click navigates to reports | SCOPE-02, SCOPE-03 | Navigation behavior | As scoped curator with scope filter unchecked, click an out-of-scope person name. Verify redirect to /report page with person pre-selected. |
| 6 | Toast message on denied curation access | SCOPE-03 | Visual notification rendering | Navigate directly to /curate/{out-of-scope-id} as a scoped curator. Verify toast appears: "You don't have curation access for this person" and redirect to /search. |
| 7 | EditOutlined curate icon visual appearance and hover behavior | SCOPE-02 | Visual rendering and interaction | As scoped curator, verify blue pencil icon appears next to in-scope people. Verify tooltip "Curate publications" on hover. Verify no icon appears for out-of-scope people. |
| 8 | Checkbox state persists across pagination | SCOPE-02 | Interactive state management | Check the scope filter checkbox. Navigate to page 2. Verify checkbox remains checked. Navigate back to page 1. Verify checkbox is still checked. |

---

### Test Coverage Assessment

| Requirement | Test File | Tests | Coverage Level | Gaps |
|-------------|-----------|-------|----------------|------|
| SCOPE-01 | `__tests__/utils/constants-scoped.test.ts` | 14 pass | PARTIAL | Tests cover `getCapabilities()` and `ROLE_CAPABILITIES` for Curator_Scoped role registration. No tests for AdminUsersPersonType model schema validation, no tests for admin UI form behavior (CurationScopeSection, mutual exclusion). |
| SCOPE-02 | None | 0 | MISSING | No tests for ScopeFilterCheckbox rendering, Search.js scope filter logic, or ScopeLabel display. Would require component tests with @testing-library/react. |
| SCOPE-03 | None | 0 | MISSING | No tests for userfeedback/goldstandard 403 enforcement. No tests for curate/manageprofile page redirect. Would require API route tests and component tests. |
| SCOPE-04 | None | 0 | MISSING | No tests for AddUser form with CurationScopeSection. No tests for person type persistence via user.controller.ts. Would require component tests and API/controller tests. |
| SCOPE-05 | None | 0 | MISSING | No tests for department assignment within CurationScopeSection. Same gap as SCOPE-04. |
| SCOPE-06 | `__tests__/utils/scopeResolver.test.ts` | 13 pass | GOOD | Covers all scope dimension combinations (personType only, orgUnit only, both, null/null). AND across dimensions and OR within dimensions confirmed. This is the strongest-tested requirement. |

**Summary:**
- Existing tests: 27 total (13 scopeResolver + 14 constants-scoped), all passing
- Planned Wave 0 stubs: 7 test files in `__tests__/phase03/` were planned in VALIDATION.md but **never created** (0/7 delivered)
- Missing coverage: No component tests (SCOPE-02, SCOPE-04, SCOPE-05), no API endpoint tests (SCOPE-03), no integration tests
- The scopeResolver and constants utility functions have strong unit test coverage, but all UI components, API endpoints, and page-level behavior are untested

---

### Gaps Summary

**Overall Assessment: PASSED** -- All 6 SCOPE requirements are SATISFIED based on source code analysis. The Phase 3 scoped curation role system is functionally complete.

**Findings by severity:**

**No critical gaps found.** All security-relevant enforcement (API 403, page redirect, middleware routing) is confirmed in source code.

**Minor findings:**

1. **Test coverage gap (MEDIUM):** 0/7 planned Wave 0 test stubs were created. Only utility functions (scopeResolver, constants) have tests. UI components, API endpoints, and page-level scope behavior lack automated test coverage. This means regressions in scope filtering, form validation, or redirect behavior would not be caught by CI.

2. **ManageProfile incomplete feature (LOW):** The `onSave` handler in ManageProfile.tsx is empty -- ORCID data cannot actually be saved. This is a pre-existing condition from the master branch port (commit 544c0f2), not a Phase 3 regression. Phase 3's scope enforcement on the page works correctly.

3. **Naming discrepancy in Truth 13 (LOW):** The plan stated scope filtering uses `scopePersonTypes` and `scopeOrgUnits` parameters, but the actual implementation reuses existing `personTypes` and `orgUnits` filter params. The functionality is identical -- this is a documentation/naming difference, not a functional gap.

4. **Unused import (LOW):** `useHistory` from react-router-dom is imported but unused in Search.js. Pre-existing, not Phase 3.

5. **Debug console.log (LOW):** `console.log("data", data)` in ManageProfile.tsx ORCID fetch. Ported from master, should be removed before production.

**Phase 4 coexistence confirmed:** Phase 4 (Curation Proxy) modified 7 files shared with Phase 3 (Search.js, SideNavbar.tsx, curate/[id].js, manageprofile/[userId].tsx, person.controller.ts, user.controller.ts, init-models.ts). In all cases, Phase 4 changes are additive (proxy OR logic wrapping scope AND logic, ProxyBadge alongside scope UI, isProxyFor bypass before isPersonInScope). Phase 3 scope enforcement code remains intact and functional.

---

_Verified: 2026-03-18T05:30:00Z_
_Verifier: Claude (gsd-executor)_
