/**
 * Scope resolver for Curator_Scoped role.
 * Determines whether a person falls within a curator's assigned scope.
 *
 * Scope logic: AND across dimensions, OR within dimensions.
 * - personTypes: person matches if ANY of their types is in the scope's list
 * - orgUnits: person matches if their primaryOrganizationalUnit is in the scope's list
 * - institutions: person matches if their primaryInstitution is in the scope's list
 * - null dimension = no restriction on that axis
 */

export interface ScopeData {
  personTypes: string[] | null;
  orgUnits: string[] | null;
  institutions?: string[] | null;
}

/** True if at least one dimension is restricted. Shared by canCurate, Search.js and middleware. */
export function hasConfiguredScope(scope: any): boolean {
  return !!scope && ['personTypes', 'orgUnits', 'institutions'].some(
    (k) => Array.isArray(scope[k]) && scope[k].length > 0
  );
}

/**
 * Check if a person is within a curator's scope.
 *
 * @param scope - The curator's scope configuration
 * @param personOrgUnit - The person's primaryOrganizationalUnit (may be null)
 * @param personPersonTypes - Array of the person's person types (from person_person_type table)
 * @param personInstitution - The person's primaryInstitution (may be null)
 * @returns true if the person is within scope
 */
export function isPersonInScope(
  scope: ScopeData,
  personOrgUnit: string | null,
  personPersonTypes: string[],
  personInstitution: string | null = null
): boolean {
  // If scope is null or has no restrictions, everything is in scope
  if (!scope) return true;
  if (!scope.personTypes && !scope.orgUnits && !scope.institutions) return true;

  // Check org unit dimension (if restricted)
  if (scope.orgUnits) {
    if (!personOrgUnit || !scope.orgUnits.includes(personOrgUnit)) {
      return false;
    }
  }

  // Check institution dimension (if restricted)
  if (scope.institutions) {
    if (!personInstitution || !scope.institutions.includes(personInstitution)) {
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
 * The keys applyScopeFilters (Search.js) stamps onto every list request for a scoped
 * curator. They are implicit, not user-chosen, so any UI asking "are filters on?" must ignore them.
 */
export function withoutScopeKeys(filters: any): Record<string, unknown> {
  const { scopeOrgUnits, scopePersonTypes, scopeInstitutions, proxyPersonIds, ...rest } = filters || {};
  return rest;
}

/**
 * The scope Find People should flag rows against, or null when no flag is wanted. Mirrors the
 * scoped branch of authorization.controller.ts canCurate: a configured scope applies to anyone
 * without curate-all, with or without the Curator_Scoped role. Curate-all viewers, and viewers
 * with no configured scope, get null (Search.js keeps its role logic for them).
 */
export function inScopeFlagScope(canCurateAll: boolean, scope: any): ScopeData | null {
  if (canCurateAll || !hasConfiguredScope(scope)) return null;
  return scope as ScopeData;
}

/**
 * SQL that is 1 when the person row `alias` is inside `scope` and 0 otherwise, for the
 * `inScope` column on Find People rows. Same rule as isPersonInScope (AND across dimensions,
 * OR within one; person types read from person_person_type) and the same dimensions the
 * findAll scope filter uses. `quote` must SQL-quote one string value (the caller passes
 * sequelize.escape). Returns null when no dimension is configured.
 */
export function inScopeSql(alias: string, scope: ScopeData | null, quote: (v: string) => string): string | null {
  if (!hasConfiguredScope(scope)) return null;
  const list = (vals: string[]) => vals.map((v) => quote(String(v))).join(', ');
  // isPersonInScope restricts on any present array, including an empty one (which then matches
  // nobody), once some other dimension is configured. An empty list can't go into IN (), so it
  // becomes a clause that is never true.
  const has = (vals: any) => Array.isArray(vals);
  const inList = (col: string, vals: string[]) => (vals.length > 0 ? `${col} IN (${list(vals)})` : '0 = 1');
  const parts: string[] = [];
  if (has(scope!.orgUnits)) parts.push(inList(`\`${alias}\`.\`primaryOrganizationalUnit\``, scope!.orgUnits!));
  if (has(scope!.institutions)) parts.push(inList(`\`${alias}\`.\`primaryInstitution\``, scope!.institutions!));
  if (has(scope!.personTypes) && scope!.personTypes!.length === 0) parts.push('0 = 1');
  else if (has(scope!.personTypes)) {
    parts.push(
      `EXISTS (SELECT 1 FROM \`person_person_type\` \`scopePpt\`` +
      ` WHERE \`scopePpt\`.\`personIdentifier\` = \`${alias}\`.\`personIdentifier\`` +
      ` AND \`scopePpt\`.\`personType\` IN (${list(scope!.personTypes!)}))`
    );
  }
  return `(CASE WHEN ${parts.join(' AND ')} THEN 1 ELSE 0 END)`;
}

/**
 * Find People row: may a scoped curator curate this person? `inScope` is the server's flag
 * (1/0, or "1"/"0" from MySQL). Proxy and own-row access hold regardless of scope, as in canCurate.
 */
export function rowInScopeCanCurate(inScope: any, isProxy: boolean, isOwnRow: boolean): boolean {
  return Number(inScope) === 1 || isProxy || isOwnRow;
}
