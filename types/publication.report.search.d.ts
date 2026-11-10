export type PublicationSearchFilter = {
    filters?: {
        personIdentifers?: Array<string>,
        orgUnits?: Array<string>,
        institutions?: Array<string>,
        personTypes?: Array<string>,
        // 'first' | 'middle' | 'last' (middle = NULL in analysis_summary_author)
        authorPosition?: Array<string>
        // analysis_summary_article.source_type values: PUBMED, SCOPUS, OPENALEX, CROSSREF, WOS
        sourceTypes?: Array<string>
        datePublicationAddedToEntrezLowerBound?: string, // format: YYYY-MM-DD
        datePublicationAddedToEntrezUpperBound?: string, // format: YYYY-MM-DD
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
    // datePublicationAddedToEntrez?: boolean
    // journalImpactScore1?: boolean
    // percentileNIH?: boolean
    // citationCountNIH?: boolean
    // trendingPubsScore?: boolean
    // readersMendeley?: boolean
    // publicationDateStandardized?: boolean
    type: string,
    order: string
}

export type ReporstResultId = {
  personIdentifiers: string[],
  pmids: string[]
}