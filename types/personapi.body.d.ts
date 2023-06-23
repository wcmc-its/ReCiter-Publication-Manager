export type PersonApiBody = {
    filters?: {
        nameOrUids?: Array<string>,
        orgUnits?: Array<string>,
        institutions?: Array<string>,
        personTypes?: Array<string>,
        showOnlyPending: boolean
    },
    limit?: number,
    offset?: number
}