import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'

// PM#771 — server-side OpenAlex search. OpenAlex is free + keyless, but per the
// acceptance criteria it MUST be proxied through this PM route and never called
// from the browser. Results are normalized into the same shape the external-article
// POST body expects, so the client can hand a preview row straight back to the
// add route (the PM route injects addedBy from the JWT).

const looksLikeDoi = (q: string): string | null => {
    if (!q) return null
    // Accept raw DOI, doi.org URL, or "doi:10...." forms; extract the 10.xxxx/... part.
    const m = q.match(/10\.\d{4,9}\/[^\s"]+/i)
    return m ? m[0].replace(/[).,;]+$/, '') : null
}

// Map one OpenAlex "work" -> external-article POST body (minus addedBy, set server-side).
function normalizeWork(work: any) {
    if (!work || !work.id) return null
    const openalexId = String(work.id).replace('https://openalex.org/', '')
    const doi = work.doi ? String(work.doi).replace('https://doi.org/', '') : undefined

    let pmid: number | undefined = undefined
    if (work.ids && work.ids.pmid) {
        const digits = String(work.ids.pmid).match(/(\d+)\s*$/)
        if (digits) pmid = Number(digits[1])
    }

    const journalOrVenue = work.primary_location
        && work.primary_location.source
        && work.primary_location.source.display_name
        ? work.primary_location.source.display_name
        : undefined

    const authors = (Array.isArray(work.authorships) ? work.authorships : [])
        .map((a: any) => a && a.author && a.author.display_name)
        .filter(Boolean)

    return {
        articleId: 'OPENALEX:' + openalexId,
        title: work.title || work.display_name || '',
        doi: doi,
        pmid: pmid,
        journalOrVenue: journalOrVenue,
        authors: authors,
        pubDate: work.publication_date,
        publicationType: work.type,
        sourceType: 'OPENALEX',
        method: 'dropdown-search',
        rawRecord: JSON.stringify(work),
    }
}

export async function searchOpenAlex(req: NextApiRequest) {
    const rawQuery: string = (req.body && (req.body.query || req.body.search) || '').toString().trim()
    if (!rawQuery) {
        return { statusCode: 400, statusText: { message: 'A search query (title or DOI) is required.' } }
    }

    const doi = looksLikeDoi(rawQuery)
    const base = reciterConfig.openAlex.searchHost
    const uri = doi
        ? `${base}/works?filter=doi:${encodeURIComponent(doi)}&per_page=10`
        : `${base}/works?search=${encodeURIComponent(rawQuery)}&per_page=10`

    return fetch(uri, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'reciter-pub-manager-server',
        },
    })
        .then(async (res) => {
            if (res.status !== 200) {
                let responseText: any
                try { responseText = await res.json() } catch (e) { responseText = await res.text() }
                return { statusCode: res.status, statusText: responseText }
            }
            const data: any = await res.json()
            const results = (Array.isArray(data.results) ? data.results : [])
                .map(normalizeWork)
                .filter(Boolean)
            return { statusCode: 200, statusText: results }
        })
        .catch((error) => {
            console.log('OpenAlex search api is not reachable: ' + error)
            return { statusCode: 502, statusText: { message: 'OpenAlex search is temporarily unavailable.' } }
        })
}
