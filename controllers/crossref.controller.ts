import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'
import { crossrefExternalArticleFrom, crossrefWorkPath, normalizeDoiInput } from '../src/utils/externalAddSearch'

// PM#1060 — server-side Crossref search for the Add tab. A DOI query looks the DOI up
// (/works/{doi}, 0 or 1 result); anything else is a keyword search (query.bibliographic, 10
// rows). Results are normalized into the external-article POST body, as the OpenAlex route
// does. No key needed; the mailto in the User-Agent puts us in Crossref's polite pool.
export async function searchCrossref(req: NextApiRequest) {
    const rawQuery: string = (req.body && (req.body.query || req.body.doi) || '').toString().trim()
    if (!rawQuery) return { statusCode: 400, statusText: { message: 'A search query (title or DOI) is required.' } }

    const doi = normalizeDoiInput(rawQuery)
    const { host, mailto } = reciterConfig.crossref
    const uri = doi
        ? host + crossrefWorkPath(doi)
        : `${host}/works?query.bibliographic=${encodeURIComponent(rawQuery)}&rows=10`

    return fetch(uri, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'User-Agent': `ReCiter-Publication-Manager (mailto:${mailto})`,
        },
    })
        .then(async (res) => {
            // An unknown DOI is a 404 from /works/{doi}: zero results, not an error.
            if (doi && res.status === 404) return { statusCode: 200, statusText: [] }
            if (res.status !== 200) {
                let responseText: any
                try { responseText = await res.json() } catch (e) { responseText = { message: `Crossref returned HTTP ${res.status}.` } }
                return { statusCode: res.status, statusText: responseText }
            }
            const data: any = await res.json()
            const message = data && data.message
            const works = doi ? [message] : (message && Array.isArray(message.items) ? message.items : [])
            return { statusCode: 200, statusText: works.map(crossrefExternalArticleFrom).filter(Boolean) }
        })
        .catch((error) => {
            console.log('Crossref api is not reachable: ' + error)
            return { statusCode: 502, statusText: { message: 'Crossref is temporarily unavailable.' } }
        })
}
