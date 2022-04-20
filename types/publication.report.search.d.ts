export type PublicationSearchFilter = {
    filters?: {
        personIdentifers?: Array<string>,
        orgUnits?: Array<string>,
        institutions?: Array<string>,
        personTypes?: Array<string>,
        authorPosition?: Array<AuthorPosition>
        datePublicationAddedToEntrezLowerBound?: string,
        datePublicationAddedToEntrezUpperBound?: string,
        publicationTypeCanonical?: Array<string>,
        journalTitleVerbose?: Array<string>,
        journalImpactScoreLowerBound?: number,
        journalImpactScoreUpperBound?: number
    },
    sort?: PublicationSort,
    limit: number,
    offset: number
}
export enum AuthorPosition {
    first,
    last
}

export type PublicationAuthorSearchFilter = {
    pmids: Array<number>,
    personIdentifers?: Array<string>
}

export type PublicationSort = {
    datePublicationAddedToEntrez?: boolean
    journalImpactScore1?: boolean
    percentileNIH?: boolean
    citationCountNIH?: boolean
    trendingPubsScore?: boolean
    readersMendeley?: boolean
    publicationDateStandarized?: boolean
}