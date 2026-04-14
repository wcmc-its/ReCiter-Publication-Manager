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
