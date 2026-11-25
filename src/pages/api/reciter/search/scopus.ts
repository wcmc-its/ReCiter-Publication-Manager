import type { NextApiRequest, NextApiResponse } from 'next'
import { searchScopusAuthors, searchScopusDocuments, scopusConfigured } from '../../../../../controllers/scopusSearch.controller'
import { reciterConfig } from '../../../../../config/local'

type Resp = {
    statusCode: number,
    authors?: any,
    results?: any,
    total?: number,
    fetched?: number,
    capped?: boolean,
    partial?: boolean,
    message?: any,
}

// PM#772 — POST { mode:'authors', lastName, firstName }        -> candidate Scopus Author IDs
//          POST { mode:'documents', by:'author'|'keyword'|'doi', term } -> matching documents + total
//          (R2: + fetched/capped/partial, passed through from searchScopusDocuments untouched)
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Resp>
) {
    if (req.method !== "POST") {
        res.status(400).send({ statusCode: 400, message: "HTTP Method supported is POST" })
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
    if (!scopusConfigured()) {
        res.status(503).send({ statusCode: 503, message: "Scopus credentials are not configured on this server." })
        return
    }
    const { mode, lastName, firstName, by, term } = req.body || {}
    try {
        if (mode === "authors") {
            const authors = await searchScopusAuthors(lastName, firstName)
            res.status(200).send({ statusCode: 200, authors })
        } else {
            const { results, total, fetched, capped, partial } = await searchScopusDocuments(by, term)
            res.status(200).send({ statusCode: 200, results, total, fetched, capped, partial })
        }
    } catch (err: any) {
        res.status(502).send({ statusCode: 502, message: "Scopus search is temporarily unavailable." })
    }
}
