export type GeneratePubsApiBody = {
    personIdentifiers: Array<string>,
    pmids: Array<number>,
    limit: number
}

export type GeneratePubsPeopleOnlyApiBody = {
    personIdentifiers: Array<string>,
    limit: number
}