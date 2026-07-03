// PM#772 — Scopus author-search proxy for the Scopus Authorships tab. Two modes:
//   - authors:   resolve a person's Scopus Author ID from their name + WCM affiliation
//   - documents: list a Scopus Author ID's documents (AU-ID query)
// Server-side only; uses the Scopus API key + inst token from the environment (the
// inst token is required — key alone 401s). Docs are normalized into the same shape
// the external-article POST expects, so accept flows reuse the #771 add pipeline.
// ponytail: proxies Scopus directly from PM for the local build; rewire to the Java
// Scopus retrieval tool's author-search endpoint (ScopusTool#26) after the freeze.

const SCOPUS_SEARCH = 'https://api.elsevier.com/content/search/scopus'
const SCOPUS_AUTHOR = 'https://api.elsevier.com/content/search/author'

function scopusHeaders() {
    return {
        'X-ELS-APIKey': process.env.SCOPUS_API_KEY || '',
        'X-ELS-Insttoken': process.env.SCOPUS_INST_TOKEN || '',
        'Accept': 'application/json',
    }
}

export function scopusConfigured(): boolean {
    return !!(process.env.SCOPUS_API_KEY && process.env.SCOPUS_INST_TOKEN)
}

// One Scopus Search entry -> external-article POST body (minus addedBy, set server-side).
function normalizeScopusDoc(entry: any) {
    if (!entry) return null
    const scopusId = String(entry['dc:identifier'] || '').replace(/^SCOPUS_ID:/, '')
    if (!scopusId) return null
    const pmidRaw = entry['pubmed-id']
    const creator = entry['dc:creator']
    return {
        articleId: 'SCOPUS:' + scopusId,
        title: entry['dc:title'] || '',
        doi: entry['prism:doi'] || undefined,
        pmid: pmidRaw ? Number(pmidRaw) : undefined,
        journalOrVenue: entry['prism:publicationName'] || undefined,
        authors: creator ? [creator] : [],   // Scopus search view returns first author only
        pubDate: entry['prism:coverDate'] || undefined,
        publicationType: entry['subtypeDescription'] || undefined,
        sourceType: 'SCOPUS',
        method: 'scopus-authorships-tab',
        rawRecord: JSON.stringify(entry),
    }
}

// Resolve candidate Scopus Author IDs for a person by name + WCM affiliation.
export async function searchScopusAuthors(lastName: string, firstName: string) {
    if (!lastName) return []
    const parts = [`authlast(${lastName})`]
    if (firstName) parts.push(`authfirst(${firstName})`)
    parts.push('affil(Weill Cornell)')
    const q = encodeURIComponent(parts.join(' AND '))
    const res = await fetch(`${SCOPUS_AUTHOR}?query=${q}&count=10`, { headers: scopusHeaders() })
    if (!res.ok) throw new Error(`Scopus author search HTTP ${res.status}`)
    const data: any = await res.json()
    const entries = (data['search-results'] && data['search-results'].entry) || []
    return entries
        .map((e: any) => ({
            authorId: String(e['dc:identifier'] || '').replace(/^AUTHOR_ID:/, ''),
            surname: (e['preferred-name'] || {}).surname,
            givenName: (e['preferred-name'] || {})['given-name'],
            docCount: e['document-count'],
            affiliation: (e['affiliation-current'] || {})['affiliation-name'],
        }))
        .filter((a: any) => a.authorId)
}

// Scopus returns up to this many docs per request; totalResults reports the real count.
const SCOPUS_PAGE_CAP = 200

// Search Scopus documents by author id, keyword, or doi. Returns the normalized page
// plus the true total so the UI can tell the curator when there is more than we fetched.
export async function searchScopusDocuments(by: string, term: string): Promise<{ results: any[], total: number }> {
    const t = (term || '').trim()
    if (!t) return { results: [], total: 0 }
    let query: string
    let sort = '&sort=-coverDate'
    if (by === 'keyword') { query = `TITLE-ABS-KEY(${t})`; sort = '' }            // relevance order
    else if (by === 'doi') { query = `DOI(${t})` }
    else { query = `AU-ID(${t.replace(/^AUTHOR_ID:/i, '')})` }                    // default: author id
    const res = await fetch(`${SCOPUS_SEARCH}?query=${encodeURIComponent(query)}&count=${SCOPUS_PAGE_CAP}${sort}`, { headers: scopusHeaders() })
    if (!res.ok) throw new Error(`Scopus doc search HTTP ${res.status}`)
    const data: any = await res.json()
    const sr = data['search-results'] || {}
    // Scopus returns a single entry carrying an 'error' field (no dc:identifier) on no match.
    const entries = (sr.entry || []).filter((e: any) => e && e['dc:identifier'])
    return {
        results: entries.map(normalizeScopusDoc).filter(Boolean),
        total: Number(sr['opensearch:totalResults'] || 0),
    }
}
