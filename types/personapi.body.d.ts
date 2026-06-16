export type PersonApiBody = {
    filters?: {
        nameOrUids?: Array<string>,
        orgUnits?: Array<string>,
        institutions?: Array<string>,
        personTypes?: Array<string>,
        showOnlyPending: boolean,
        // Phase 9: Scope filtering (D-11 through D-14)
        scopeOrgUnits?: Array<string>,
        scopePersonTypes?: Array<string>,
        proxyPersonIds?: Array<string>,
    },
    limit?: number,
    offset?: number
}