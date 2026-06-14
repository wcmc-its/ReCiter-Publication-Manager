/**
 * Permission utility functions for data-driven RBAC.
 *
 * These functions coexist alongside getCapabilities()/getLandingPage() in constants.js
 * until Phase 18 cleanup removes the old functions (per D-08).
 *
 * Isomorphic: safe for Edge middleware, Node.js API routes, and React components.
 * No browser-only or server-only imports.
 */

/**
 * Check if a permission key exists in the user's permission array.
 * Per D-05.
 *
 * @param permissions - Array of permission key strings (e.g., ['canCurate', 'canSearch'])
 * @param key - Permission key to check for
 * @returns true if the key exists in the permissions array
 */
export function hasPermission(
  permissions: string[] | null | undefined,
  key: string
): boolean {
  if (!permissions || !Array.isArray(permissions)) return false
  return permissions.indexOf(key) !== -1
}

/**
 * Parse a JWT-stringified permissions array into a string[].
 * Handles null, undefined, empty string, and invalid JSON gracefully.
 * Per D-06.
 *
 * @param rawPermissions - JSON-encoded string from JWT claim (e.g., '["canCurate","canSearch"]')
 * @returns Parsed array of permission key strings, or empty array on any error
 */
export function getPermissionsFromRaw(
  rawPermissions: string | null | undefined
): string[] {
  if (!rawPermissions) return []
  try {
    const parsed = JSON.parse(rawPermissions)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

/**
 * Canonical role-label → permission-key matrix.
 *
 * This MUST stay in exact sync with the RBAC seed in
 * docs/superpowers/plans/2026-04-14-data-driven-rbac.md (admin_role_permissions).
 * It is used ONLY as a safety fallback by getPermissionsFromRoles() when the
 * data-driven permission set is empty — e.g. the permission tables have not
 * been seeded in this environment, or the login-time permission lookup failed —
 * so that privileged roles are never locked out of routes they are entitled to.
 */
const ROLE_PERMISSION_FALLBACK: Record<string, string[]> = {
  Superuser: [
    'canCurate', 'canSearch', 'canReport',
    'canManageUsers', 'canConfigure',
    'canManageNotifications', 'canManageProfile',
  ],
  Curator_All: ['canCurate', 'canSearch'],
  Curator_Self: ['canCurate'],
  Curator_Scoped: ['canCurate', 'canSearch'],
  Curator_Department: ['canCurate', 'canSearch'],
  Curator_Department_Delegate: ['canCurate', 'canSearch'],
  Reporter_All: ['canReport', 'canSearch'],
}

/**
 * Derive a permission-key array from a user's role labels using the canonical
 * seed matrix (ROLE_PERMISSION_FALLBACK).
 *
 * Safety fallback only — see the MW-03 fallback in src/middleware.ts. Returns
 * the de-duplicated union of every matched role's permissions, or an empty
 * array if no role matches (the caller then applies the baseline set).
 *
 * @param roles - User's roles array with { roleLabel }
 * @returns De-duplicated permission key array
 */
export function getPermissionsFromRoles(
  roles: Array<{ roleLabel?: string | null }> | null | undefined
): string[] {
  if (!roles || !Array.isArray(roles)) return []
  const set = new Set<string>()
  for (const role of roles) {
    const keys = role && role.roleLabel ? ROLE_PERMISSION_FALLBACK[role.roleLabel] : undefined
    if (keys) {
      for (const key of keys) set.add(key)
    }
  }
  return Array.from(set)
}

/**
 * Broader curate roles that override self-only detection.
 * A user with any of these roles is NOT a self-only curator,
 * even if they also have Curator_Self.
 */
const BROADER_CURATE_ROLES = [
  'Superuser',
  'Curator_All',
  'Curator_Scoped',
  'Curator_Department',
  'Curator_Department_Delegate',
]

/**
 * Determine the landing page from a permission set and roles array.
 * Mirrors getLandingPage(caps) behavior from constants.js exactly.
 * Per D-07.
 *
 * CRITICAL: Self-only detection checks ROLES, not just the permission set.
 * A Curator_Self + Reporter_All user has {canCurate, canReport, canSearch}
 * in their permission set, but should still land on /curate/:id because
 * they have no broader curate role.
 *
 * @param permissions - Resolved permission key array (e.g., ['canCurate', 'canSearch'])
 * @param roles - User's roles array with { roleLabel, personIdentifier }
 * @returns Landing page path string
 */
export function getLandingPageFromPermissions(
  permissions: string[],
  roles: Array<{ roleLabel: string; personIdentifier?: string }>
): string {
  const permSet = new Set(permissions)
  const hasCurate = permSet.has('canCurate')
  const hasSearch = permSet.has('canSearch')
  const hasReport = permSet.has('canReport')

  // Self-only detection: check roles, not permissions (per RESEARCH.md Pitfall 1)
  const hasSelfRole =
    roles?.some((r) => r.roleLabel === 'Curator_Self') ?? false
  const hasBroaderRole =
    roles?.some((r) => BROADER_CURATE_ROLES.includes(r.roleLabel)) ?? false

  // Find personIdentifier from the Curator_Self role entry
  const selfRole = roles?.find((r) => r.roleLabel === 'Curator_Self')
  const personIdentifier = selfRole?.personIdentifier || null

  // Self-only curators always land on their curate page
  if (hasCurate && hasSelfRole && !hasBroaderRole && personIdentifier) {
    return '/curate/' + personIdentifier
  }

  // Anyone with search or report goes to search
  if (hasSearch || hasReport) {
    return '/search'
  }

  return '/noaccess'
}
