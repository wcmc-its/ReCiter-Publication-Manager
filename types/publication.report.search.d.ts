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
        // "Date added" (inclusive). With ReCiterDB v3.7 it reads COALESCE(dateAdded, pubDate, ...)
        datePublicationAddedToEntrezLowerBound?: string, // format: YYYY-MM-DD
        datePublicationAddedToEntrezUpperBound?: string, // format: YYYY-MM-DD
        // "Publication date" (inclusive), 5c
        pubDateLowerBound?: string, // format: YYYY-MM-DD
        pubDateUpperBound?: string, // format: YYYY-MM-DD
        // grouped Type filter (one of the 18 PUB_TYPES), 5c; needs analysis_summary_article.pubType
        pubTypes?: Array<string>,
        // the old flat Type list; still honored for saved settings and links
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