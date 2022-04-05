export type GeneratePubsApiBody = {
    personIdentifiers: Array<string>,
    pmids: Array<number>
}

export type GeneratePubsPeopleOnlyApiBody = {
    personIdentifiers: Array<string>
}