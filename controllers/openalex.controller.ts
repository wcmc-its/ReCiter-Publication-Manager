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

// PM curate-iteration: OpenAlex often returns the same paper as two "works" — one
// carrying a PMID (flagged "in PubMed") and one without (offered as a fresh "Add"),
// which lets a curator add a duplicate of the PubMed record. Collapse siblings before
// they reach the client: group by DOI, else by a distinctive normalized title, and keep
// the copy that carries a PMID, merging the group's pmid/doi onto the survivor.
const normalizeTitle = (t: string): string =>
    String(t || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

function dedupeWorks(rows: any[]): any[] {
    const groups = new Map<string, any>()
    const order: string[] = []
    for (const row of rows) {
        const title = normalizeTitle(row.title)
        // ponytail: only collapse by title when it's distinctive (>=10 chars) so generic
        // stubs ("Reply", "Correction") don't merge distinct works. DOI match is always safe.
        const key = row.doi
            ? 'doi:' + String(row.doi).toLowerCase().trim()
            : (title.length >= 10 ? 'title:' + title : 'id:' + row.articleId)
        const kept = groups.get(key)
        if (!kept) {
            groups.set(key, row)
            order.push(key)
            continue
        }
        // Prefer the sibling that carries a PMID as the base, then backfill the other's ids.
        const base = kept.pmid !== undefined ? kept : (row.pmid !== undefined ? row : kept)
        const other = base === kept ? row : kept
        base.pmid = base.pmid !== undefined ? base.pmid : other.pmid
        base.doi = base.doi || other.doi
        groups.set(key, base)
    }
    return order.map((k) => groups.get(k))
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
                return { statusCode: res.status, statusText: "An internal server error occurred." }
            }
            const data: any = await res.json()
            const results = dedupeWorks(
                (Array.isArray(data.results) ? data.results : [])
                    .map(normalizeWork)
                    .filter(Boolean)
            )
            return { statusCode: 200, statusText: results }
        })
        .catch((error) => {
            console.log('OpenAlex search api is not reachable: ' + error)
            return { statusCode: 502, statusText: { message: 'OpenAlex search is temporarily unavailable.' } }
        })
}
