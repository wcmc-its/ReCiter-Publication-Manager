import type { NextApiRequest, NextApiResponse } from 'next'
import { findPubmedByPmid } from '../../../../../controllers/pubmedLookup.controller'
import { formatPubmedSearch } from '../../../../../controllers/pubmed.controller'
import { reciterConfig } from '../../../../../config/local'

type Resp = {
    statusCode: number,
    article?: any,
    message?: any,
}

// Direct-add — GET a single formatted PubMed article by PMID, for the Scopus tab's
// "Add" button to accept inline without leaving the Scopus tab (which otherwise sends
// the curator to the PubMed Add tab via handleAddViaPubMed). Deliberately skips
// searchPubmed()'s getPublications() call — that's the slow feature-generator fetch,
// not needed for a single known-PMID lookup.
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Resp>
) {
    if (req.method !== "GET") {
        res.status(400).send({ statusCode: 400, message: "HTTP Method supported is GET" })
        return
    }
    if (req.headers.authorization === undefined) {
        res.status(400).send({ statusCode: 400, message: "Authorization header is needed" })
        return
    }
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        res.status(401).send({ statusCode: 401, message: "Authorization header is incorrect" })
        return
    }

    const pmid = Number(req.query.pmid)
    if (!Number.isInteger(pmid) || pmid <= 0) {
        res.status(400).send({ statusCode: 400, message: "pmid must be a positive integer" })
        return
    }

    try {
        const article = await findPubmedByPmid(pmid)
        if (!article) {
            res.status(404).send({ statusCode: 404, message: "PMID not found in PubMed" })
            return
        }
        // Same formatter TabAddPublication's search results are built from — wrap the
        // single article in the {filter100PubMedArticles} shape formatPubmedSearch expects.
        const formatted = formatPubmedSearch({ filter100PubMedArticles: [article] } as any, false)[0]
        if (!formatted || !formatted.pmid) {
            console.error(`pubmed-article/${pmid}: PubMed article lacks the fields the formatter needs`)
            res.status(502).send({ statusCode: 502, message: "Unexpected PubMed article shape" })
            return
        }
        res.status(200).send({ statusCode: 200, article: formatted })
    } catch (err: any) {
        const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
        console.error(`pubmed-article/${pmid}: PubMed lookup ${timedOut ? 'timed out' : 'failed'}`, err)
        res.status(timedOut ? 504 : 502).send({ statusCode: timedOut ? 504 : 502, message: timedOut ? "PubMed lookup timed out" : "PubMed lookup failed" })
    }
}
