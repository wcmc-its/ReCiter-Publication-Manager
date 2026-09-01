// Node-only counterpart to viewAs.js -- looks up a "View as" target from the DB. Not
// importable from Edge middleware (Sequelize models + findUserPermissions pull in Node-only
// deps), unlike viewAs.js.

import models from '../db/sequelize'
import { findUserPermissions } from '../../services/db/userroles.service'
import { getCapabilities } from './constants'
import { parseJsonColumn } from './viewAs'

const MINIMAL_ATTRIBUTES = [
  'userID',
  'personIdentifier',
  'nameFirst',
  'nameLast',
  'email',
  'status',
  'scope_person_types',
  'scope_org_units',
  'proxy_person_ids',
]

// Resolves a candidate "View as" target by CWID. Down-only guard (SPS R2): a target who is
// themself a Superuser is refused, since impersonation must never be used to reach equal or
// greater privilege than the initiating Superuser already has.
export async function resolveViewAsTarget(cwid) {
  const row = await models.AdminUser.findOne({
    where: { personIdentifier: cwid, status: 1 },
    attributes: MINIMAL_ATTRIBUTES,
  })
  if (!row) return { ok: false, reason: 'not_found' }

  const plain = row.get({ plain: true })
  const databaseUser = {
    userID: plain.userID,
    personIdentifier: plain.personIdentifier,
    nameFirst: plain.nameFirst,
    nameLast: plain.nameLast,
    email: plain.email,
    status: plain.status,
    // Sequelize may hand these back as JSON text depending on the column's declared type --
    // run them through parseJsonColumn so the stored overlay holds arrays/null, not strings.
    scope_person_types: parseJsonColumn(plain.scope_person_types),
    scope_org_units: parseJsonColumn(plain.scope_org_units),
    proxy_person_ids: parseJsonColumn(plain.proxy_person_ids),
  }

  const userRoles = await findUserPermissions(['personIdentifier', 'email'], [cwid, plain.email || ''])
  const parsed = parseJsonColumn(userRoles) || []
  if (getCapabilities(parsed).canManageUsers) {
    return { ok: false, reason: 'target_is_superuser' }
  }

  const name = [plain.nameFirst, plain.nameLast].filter(Boolean).join(' ') || cwid
  const roleLabels = parsed.map((r) => r.roleLabel)

  // Cookie-size finding (scripts/check-view-as.mjs section 9): findUserPermissions() repeats
  // the per-user scope_person_types/scope_org_units/proxy_person_ids columns on EVERY role
  // row (they're per-user, not per-role -- see the comment in [...nextauth].jsx), so storing
  // that raw string a second time inside the overlay roughly doubles the token's role-data
  // cost for no benefit: every consumer of a userRoles row (getCapabilities, canCurate,
  // middleware.ts, SideNavbar.tsx) reads only .roleLabel and .personIdentifier off it --
  // scope/proxy data is read from token.scopeData/token.proxyPersonIds instead, which
  // effectiveToken() rebuilds from databaseUser above regardless. Trim the overlay's copy to
  // just the two fields every consumer actually reads; still the same JSON-string-of-role-
  // objects type real code parses everywhere else.
  const trimmedUserRoles = JSON.stringify(parsed.map((r) => ({ roleLabel: r.roleLabel, personIdentifier: r.personIdentifier })))

  return {
    ok: true,
    target: {
      personIdentifier: plain.personIdentifier,
      name,
      databaseUser,
      userRoles: trimmedUserRoles,
      roleLabels,
    },
  }
}
