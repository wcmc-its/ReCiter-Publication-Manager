export type PersonApiBody = {
    filters?: {
        nameOrUids?: Array<string>,
        orgUnits?: Array<string>,
        institutions?: Array<string>,
        personTypes?: Array<string>,
        showOnlyPending: boolean,
        proxyPersonIds?: Array<string>
    },
    limit?: number,
    offset?: number,
    includeScopeData?: boolean
}