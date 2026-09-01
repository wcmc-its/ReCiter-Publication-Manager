// Pure mapping from a formatted PubMed article (the shape formatPubmedSearch() in
// controllers/pubmed.controller.ts produces — pmid/authors/title/journal/displayDate/
// greaterThan100) to the reCiterArticleFeatures item TabAddPublication.tsx's
// acceptPublication pushes into reciterData.reciter.reCiterArticleFeatures. Extracted so
// the Scopus tab's direct "Add" (ReciterTabs.tsx handleAcceptPmid) can build the exact
// same item without going through the Add tab's UI state.
//
// Kept side-effect free: acceptPublication mutated the pubmedData article object in
// place (`publication.evidence = []` + `Object.assign(publication, {...})`); this
// returns a new object with the same fields instead, so callers with no `pubmedData`
// array of their own (handleAcceptPmid) have nothing to mutate.

const mapPubMedAuthorsToReciterAuthors = (authorsList: any[]) => {
    const authorsPrepared: any[] = []
    authorsList && authorsList.map((author: any) => {
        authorsPrepared.push({
            firstName: author.authorName,
            initials: "",
            lastName: "",
            rank: author.rank,
            targetAuthor: false
        })
    })
    return authorsPrepared
}

export const toReciterArticle = (article: any, userAssertion: string = 'ACCEPTED') => {
    return Object.assign({}, article, {
        evidence: [],
        userAssertion,
        articleTitle: article.title,
        reCiterArticleAuthorFeatures: mapPubMedAuthorsToReciterAuthors(article.authors)
    })
}

export default toReciterArticle
