export type PersonApiBody = {
    filters?: {
        nameOrUids?: Array<string>,
        orgUnits?: Array<string>,
        institutions?: Array<string>,
        personTypes?: Array<string>,
        showOnlyPending: boolean,
        scopePersonTypes?: Array<string>,
        scopeOrgUnits?: Array<string>
    },
    limit?: number,
    offset?: number
}