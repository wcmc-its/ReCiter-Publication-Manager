// "View as" overlay -- pure, isomorphic helpers for the Superuser impersonation seam.
//
// Imported by Edge middleware (src/middleware.ts) as well as Node API routes and the
// NextAuth callbacks, so this file must stay free of Node/DB imports (no `fs`, no Sequelize,
// no `next-auth/jwt`) -- same constraint as src/utils/constants.js.
//
// Security property that makes this safe by construction: a raw getToken() always yields the
// REAL user; only consumers that opt in via effectiveToken() see the target. An unconverted
// route therefore acts as the (more privileged) Superuser, never as an escalated target. The
// overlay can only narrow privilege, never grant it.

export const VIEW_AS_TTL_SECONDS = 1800

export const nowSeconds = () => Math.floor(Date.now() / 1000)

// MariaDB JSON-alias-for-LONGTEXT columns come back from a raw (non-Model) query as JSON
// text, not pre-parsed values. Single copy -- both viewAsServer.js and [...nextauth].jsx
// import this one instead of keeping their own.
export function parseJsonColumn(value) {
  if (value == null) return null
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

// Builds the scopeData/proxyPersonIds JSON strings from a target admin_users row exactly the
// way [...nextauth].jsx's jwt() callback does for the real user, so the overlay carries the
// same shape/types as the top-level token fields it swaps in.
export function scopeFieldsFromDbUser(dbUser) {
  const u = dbUser || {}
  const scopeData = JSON.stringify({
    personTypes: parseJsonColumn(u.scope_person_types),
    orgUnits: parseJsonColumn(u.scope_org_units),
  })
  const proxyPersonIds = JSON.stringify(parseJsonColumn(u.proxy_person_ids) || [])
  return { scopeData, proxyPersonIds }
}

export function viewAsActive(token, now = nowSeconds()) {
  const startedAt = token?.viewAs?.startedAt
  return !!token?.viewAs && Number.isFinite(startedAt) && startedAt + VIEW_AS_TTL_SECONDS > now
}

// Returns the token unchanged (same object reference) when the overlay is absent/expired;
// otherwise a shallow copy with the identity-bearing fields swapped to the target. Never
// mutates the input token.
export function effectiveToken(token, now = nowSeconds()) {
  if (!viewAsActive(token, now)) return token

  const v = token.viewAs
  const { scopeData, proxyPersonIds } = scopeFieldsFromDbUser(v.databaseUser)

  return {
    ...token,
    username: v.targetCwid,
    email: v.databaseUser?.email || '',
    databaseUser: v.databaseUser,
    userRoles: v.userRoles,
    scopeData,
    proxyPersonIds,
    name: v.name,
    user: {
      personIdentifier: v.databaseUser?.personIdentifier,
      email: v.databaseUser?.email,
      nameFirst: v.databaseUser?.nameFirst,
      nameLast: v.databaseUser?.nameLast,
      databaseUser: v.databaseUser,
      userRoles: v.userRoles,
    },
  }
}

export function viewAsSummary(token, now = nowSeconds()) {
  if (!viewAsActive(token, now)) return null
  const v = token.viewAs
  return {
    targetCwid: v.targetCwid,
    name: v.name,
    startedAt: v.startedAt,
    expiresAt: v.startedAt + VIEW_AS_TTL_SECONDS,
  }
}
