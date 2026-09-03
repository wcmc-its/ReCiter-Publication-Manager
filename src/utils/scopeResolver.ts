/**
 * Scope resolver for Curator_Scoped role.
 * Determines whether a person falls within a curator's assigned scope.
 *
 * Scope logic: AND across dimensions, OR within dimensions.
 * - personTypes: person matches if ANY of their types is in the scope's list
 * - orgUnits: person matches if their primaryOrganizationalUnit is in the scope's list
 * - null dimension = no restriction on that axis
 */

export interface ScopeData {
  personTypes: string[] | null;
  orgUnits: string[] | null;
}

/**
 * Check if a person is within a curator's scope.
 *
 * @param scope - The curator's scope configuration
 * @param personOrgUnit - The person's primaryOrganizationalUnit (may be null)
 * @param personPersonTypes - Array of the person's person types (from person_person_type table)
 * @returns true if the person is within scope
 */
export function isPersonInScope(
  scope: ScopeData,
  personOrgUnit: string | null,
  personPersonTypes: string[]
): boolean {
  // If scope is null or has no restrictions, everything is in scope
  if (!scope) return true;
  if (!scope.personTypes && !scope.orgUnits) return true;

  // Check org unit dimension (if restricted)
  if (scope.orgUnits) {
    if (!personOrgUnit || !scope.orgUnits.includes(personOrgUnit)) {
      return false;
    }
  }

  // Check person type dimension (if restricted)
  if (scope.personTypes) {
    if (!personPersonTypes || personPersonTypes.length === 0) {
      return false;
    }
    const hasMatch = personPersonTypes.some((pt) =>
      scope.personTypes!.includes(pt)
    );
    if (!hasMatch) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a user is a proxy for a given person.
 *
 * @param proxyPersonIds - Array of person identifiers the user is a proxy for (from JWT)
 * @param personIdentifier - The person identifier to check against
 * @returns true if the user is a proxy for the given person
 */
export function isProxyFor(
  proxyPersonIds: string[] | null,
  personIdentifier: string
): boolean {
  if (!proxyPersonIds || proxyPersonIds.length === 0) return false;
  return proxyPersonIds.includes(personIdentifier);
}

/**
 * The three keys applyScopeFilters (Search.js) stamps onto every list request for a scoped
 * curator. They are implicit, not user-chosen, so any UI asking "are filters on?" must ignore them.
 */
export function withoutScopeKeys(filters: any): Record<string, unknown> {
  const { scopeOrgUnits, scopePersonTypes, proxyPersonIds, ...rest } = filters || {};
  return rest;
}
