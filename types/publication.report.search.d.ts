export type PublicationSearchFilter = {
    filters?: {
        personIdentifers?: Array<string>,
        orgUnits?: Array<string>,
        institutions?: Array<string>,
        personTypes?: Array<string>,
        authorPosition: Array<AuthorPosition>
        datePublicationAddedToEntrezLowerBound: string,
        datePublicationAddedToEntrezUpperBound: string,
        publicationTypeCanonical: Array<string>,
        journalTitleVerbose: Array<string>,
        journalImpactScoreLowerBound: number,
        journalImpactScoreUpperBound: number
    }
}
export enum AuthorPosition {
    first,
    last
}