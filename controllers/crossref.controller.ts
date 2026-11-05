import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'
import { crossrefCardFrom, crossrefWorkPath, normalizeDoiInput } from '../src/utils/externalAddSearch'

// PM#1060 — server-side Crossref DOI lookup for the Add tab (read-only card). DOI only; keyword
// search stays on Scopus/OpenAlex. No key needed; the mailto puts us in Crossref's polite pool.
export async function lookupCrossrefDoi(req: NextApiRequest) {
    const doi = normalizeDoiInput(req.body && req.body.doi)
    if (!doi) return { statusCode: 400, statusText: { message: 'A DOI is required.' } }

    const { host, mailto } = reciterConfig.crossref
    return fetch(host + crossrefWorkPath(doi), {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'User-Agent': `ReCiter-Publication-Manager (mailto:${mailto})`,
        },
    })
        .then(async (res) => {
            if (res.status !== 200) return { statusCode: res.status, statusText: { message: `Crossref returned HTTP ${res.status}.` } }
            const data: any = await res.json()
            const card = crossrefCardFrom(data && data.message)
            return card ? { statusCode: 200, statusText: card } : { statusCode: 404, statusText: { message: 'No usable Crossref record.' } }
        })
        .catch((error) => {
            console.log('Crossref api is not reachable: ' + error)
            return { statusCode: 502, statusText: { message: 'Crossref is temporarily unavailable.' } }
        })
}
