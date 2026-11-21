// "Import a list" (plan 2026-11-20-import-a-list-plan.md): server side of the two routes.
//   extractCitations: one chunk of pasted text -> citations (structured parse, else Bedrock).
//   resolveCitations: up to 10 citations -> DOI / PMID / OpenAlex id, using the Add dialog's own
//                     Crossref, OpenAlex and PubMed-by-DOI lookups.
// Writes nothing. Logs counts only, never the pasted text.
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { searchCrossref } from './crossref.controller'
import { searchOpenAlex } from './openalex.controller'
import { findPubmedByDoi } from './pubmedLookup.controller'
import {
    Citation, Match, Resolved, MATCHED, bestMatch, cleanDoi, isUpdateNotice, parseStructured, sanitizeCitations,
} from '../src/lib/listImport'

export const listImportEnabled = (): boolean => process.env.LIST_IMPORT === 'on'

// Sonnet 5 is already allowed by the pod role's ReciterPM-LiteratureSearch-Bedrock policy.
const MODEL_ID = () => process.env.LIST_IMPORT_MODEL_ID || 'us.anthropic.claude-sonnet-5'
let client: BedrockRuntimeClient | null = null
const bedrock = () => (client ||= new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' }))

const PROMPT = `Extract every publication listed in this text copied from a researcher's profile page or CV.
Ignore navigation, metrics, abstracts, view counts, chart labels and "related authors".
Return only JSON: {"pubs":[{"title":str,"year":int|null,"venue":str|null,"first_author":str|null,"doi":str|null,"type":str|null}]}.
Keep each title exactly as written, including a trailing "…" if the text cuts it off.
For "venue", copy the venue line as written, with any volume, issue and pages.
One entry per listed item, even if two items look like the same work.`

async function llmExtract(text: string): Promise<unknown[]> {
    const res = await bedrock().send(new InvokeModelCommand({
        modelId: MODEL_ID(),
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 8000,
            system: PROMPT,
            messages: [{ role: 'user', content: [{ type: 'text', text }] }],
        }),
    }))
    const body = JSON.parse(new TextDecoder().decode(res.body))
    const out = (Array.isArray(body.content) ? body.content : []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
    const a = out.indexOf('{'), b = out.lastIndexOf('}')
    if (a < 0 || b < a) throw new Error('model returned no JSON')
    const pubs = JSON.parse(out.slice(a, b + 1)).pubs
    if (!Array.isArray(pubs)) throw new Error('model JSON has no pubs list')
    return pubs
}

export async function extractCitations(text: string): Promise<{ items: Citation[], dropped: number, via: 'parser' | 'model' }> {
    const parsed = parseStructured(text)
    const raw = parsed ?? await llmExtract(text)
    return { ...sanitizeCitations(raw, text), via: parsed ? 'parser' : 'model' }
}

// The three lookups answer {statusCode, statusText}; retry a 429 with backoff (1, 2, 4, 8 s).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function search(fn: (req: any) => Promise<any>, query: string): Promise<any[]> {
    for (let i = 0; ; i++) {
        const r = await fn({ body: { query } })
        if (r.statusCode === 200) return Array.isArray(r.statusText) ? r.statusText : []
        if (r.statusCode !== 429 || i === 4) throw new Error(`lookup HTTP ${r.statusCode}`)
        await sleep(1000 * 2 ** i)
    }
}

const yearOf = (row: any): number | null => {
    const y = Number(String(row?.pubDate || '').slice(0, 4))
    return Number.isInteger(y) && y > 1800 ? y : null
}
const asCand = (row: any) => ({ title: String(row.title || ''), year: yearOf(row), row })

function toMatch(row: any, pmid: number | null): Match {
    return {
        title: row.title, year: yearOf(row), doi: row.doi ? String(row.doi).toLowerCase() : null,
        pmid, articleId: row.articleId, venue: row.journalOrVenue || null, record: row,
    }
}

async function resolveOne(c: Citation): Promise<Resolved> {
    const doi = cleanDoi(c.doi)
    let score = 0, row: any = null

    if (doi) {
        // A DOI from the paste is taken as given: look up its record (Crossref, then OpenAlex).
        row = (await search(searchCrossref, doi))[0] || (await search(searchOpenAlex, doi))[0] || null
        score = row ? 1 : 0
    } else {
        const q = [c.title, c.first_author, c.venue, c.year].filter(Boolean).join(' ')
        const cr = bestMatch(c, (await search(searchCrossref, q)).filter((r) => !isUpdateNotice(r)).map(asCand))
        score = cr.score; row = cr.cand?.row || null
        // Crossref misses preprints, abstracts, theses and odd venues; OpenAlex holds many.
        if (score < MATCHED) {
            const oa = bestMatch(c, (await search(searchOpenAlex, c.title.replace(/(…|\.\.\.)\s*$/, ''))).map(asCand))
            if (oa.score > score) { score = oa.score; row = oa.cand?.row || null }
        }
    }
    if (!row) {
        // A pasted DOI neither source holds can still be in PubMed.
        const pmid = doi ? await findPubmedByDoi(doi) : null
        return pmid ? { ...c, doi, score: 1, match: { title: c.title, year: c.year, doi, pmid, record: null } } : { ...c, doi, score, match: null }
    }

    // PMID: OpenAlex's own, else PubMed by DOI (OpenAlex lacks it for ~21% of PubMed works).
    let pmid: number | null = row.pmid ? Number(row.pmid) : null
    if (!pmid && row.doi) pmid = await findPubmedByDoi(String(row.doi))
    return { ...c, doi, score, match: toMatch(row, pmid) }
}

// Serial on purpose: one batch in flight per dialog keeps Crossref and OpenAlex under their limits.
export async function resolveCitations(items: Citation[]): Promise<Resolved[]> {
    const out: Resolved[] = []
    for (const c of items) {
        try {
            out.push(await resolveOne(c))
        } catch (e: any) {
            out.push({ ...c, score: 0, match: null, error: String(e?.message || e) })
        }
    }
    return out
}
