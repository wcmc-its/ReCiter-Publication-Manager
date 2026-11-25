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

const nullable = (type: string) => ({ type: [type, 'null'] })
const PUBS_SCHEMA = {
    type: 'object', additionalProperties: false, required: ['pubs'],
    properties: {
        pubs: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false,
                required: ['title', 'year', 'venue', 'first_author', 'doi', 'type'],
                properties: {
                    title: { type: 'string' }, year: nullable('integer'), venue: nullable('string'),
                    first_author: nullable('string'), doi: nullable('string'), type: nullable('string'),
                },
            },
        },
    },
}

async function llmExtract(text: string): Promise<unknown[]> {
    const res = await bedrock().send(new InvokeModelCommand({
        modelId: MODEL_ID(),
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            // A 12k-character chunk needs about 6k output tokens. Thinking is off: Sonnet 5 otherwise
            // spent up to 6.8k of an 8k budget thinking and cut the JSON off (few2001, 11-21).
            max_tokens: 16000,
            thinking: { type: 'disabled' },
            // Schema-constrained output: a title with inner quotes no longer breaks the JSON.
            output_config: { format: { type: 'json_schema', schema: PUBS_SCHEMA } },
            system: PROMPT,
            messages: [{ role: 'user', content: [{ type: 'text', text }] }],
        }),
    }))
    const body = JSON.parse(new TextDecoder().decode(res.body))
    if (body.stop_reason !== 'end_turn') throw new Error(`model stopped early: ${body.stop_reason}`)
    const out = (Array.isArray(body.content) ? body.content : []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
    const pubs = JSON.parse(out).pubs
    if (!Array.isArray(pubs)) throw new Error('model JSON has no pubs list')
    return pubs
}

export async function extractCitations(text: string): Promise<{ items: Citation[], dropped: number, via: 'parser' | 'model' }> {
    const parsed = parseStructured(text)
    const raw = parsed ?? await llmExtract(text)
    return { ...sanitizeCitations(raw, text), via: parsed ? 'parser' : 'model' }
}

// The lookups answer {statusCode, statusText}. Retry a 429 (rate limit) or a 502-504 (the source
// dropped the connection, e.g. ECONNRESET) with backoff (1, 2, 4, 8 s); the error names the source.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const RETRY = new Set([429, 502, 503, 504])
async function search(fn: (req: any) => Promise<any>, query: string): Promise<any[]> {
    const source = fn === searchCrossref ? 'Crossref' : 'OpenAlex'
    for (let i = 0; ; i++) {
        const r = await fn({ body: { query } })
        if (r.statusCode === 200) return Array.isArray(r.statusText) ? r.statusText : []
        if (!RETRY.has(r.statusCode) || i === 4) throw new Error(`${source} HTTP ${r.statusCode}`)
        await sleep(1000 * 2 ** i)
    }
}

const yearOf = (row: any): number | null => {
    const y = Number(String(row?.pubDate || '').slice(0, 4))
    return Number.isInteger(y) && y > 1800 ? y : null
}
// Crossref keeps a subtitle apart from the title (crossrefExternalArticleFrom shows only the title);
// a citation usually has "Title: subtitle", so match on both.
const subtitleOf = (row: any): string => {
    if (row?.sourceType !== 'CROSSREF' || typeof row.rawRecord !== 'string' || !row.rawRecord.includes('"subtitle"')) return ''
    try {
        const sub = JSON.parse(row.rawRecord).subtitle
        return Array.isArray(sub) && typeof sub[0] === 'string' ? sub[0].replace(/<[^>]+>/g, '').trim() : ''
    } catch { return '' }
}
// One candidate per form of the title: the title alone, and with its subtitle when Crossref has
// one. bestMatch keeps the better score, so a citation with or without the subtitle matches.
const asCands = (row: any) => {
    const base = { title: String(row.title || ''), year: yearOf(row), row }
    const sub = subtitleOf(row)
    return sub ? [base, { ...base, title: base.title + ': ' + sub }] : [base]
}

function toMatch(row: any, pmid: number | null): Match {
    return {
        title: row.title, year: yearOf(row), doi: row.doi ? String(row.doi).toLowerCase() : null,
        pmid, articleId: row.articleId, venue: row.journalOrVenue || null, record: row,
    }
}

async function resolveOne(c: Citation): Promise<Resolved> {
    const doi = cleanDoi(c.doi)
    let score = 0, row: any = null
    let doiUnknown = false // the pasted DOI is in neither Crossref nor OpenAlex

    if (doi) {
        // A DOI in the paste: use its record only if the record's title is this citation's title.
        // A DOI attached to the wrong line (or one a model got wrong) falls through to the title search.
        const byDoi = (await search(searchCrossref, doi))[0] || (await search(searchOpenAlex, doi))[0] || null
        doiUnknown = !byDoi
        if (byDoi && !isUpdateNotice(byDoi)) {
            const s = bestMatch(c, asCands(byDoi)).score
            if (s >= MATCHED) { score = s; row = byDoi }
        }
    }
    if (!row) {
        const q = [c.title, c.first_author, c.venue, c.year].filter(Boolean).join(' ')
        const cr = bestMatch(c, (await search(searchCrossref, q)).filter((r) => !isUpdateNotice(r)).flatMap(asCands))
        score = cr.score; row = cr.cand?.row || null
        // Crossref misses preprints, abstracts, theses and odd venues; OpenAlex holds many.
        if (score < MATCHED) {
            const oa = bestMatch(c, (await search(searchOpenAlex, c.title.replace(/(…|\.\.\.)\s*$/, ''))).flatMap(asCands))
            if (oa.score > score) { score = oa.score; row = oa.cand?.row || null }
        }
    }
    if (doiUnknown && score < MATCHED) {
        // A pasted DOI neither source holds can still be in PubMed (its title is then unchecked,
        // so the row is a possible match: shown unchecked, "is this it?").
        const pmid = await findPubmedByDoi(doi!)
        if (pmid) return { ...c, doi, score: 0.8, match: { title: `PMID ${pmid}, found by this DOI (title not checked)`, year: c.year, doi, pmid, record: null } }
    }
    // The pasted DOI stays on the result only if its record was the match; a rejected DOI is dropped.
    const keptDoi = row && doi && String(row.doi || '').toLowerCase() === doi ? doi : null
    if (!row) return { ...c, doi: keptDoi, score, match: null }

    // PMID: OpenAlex's own, else PubMed by DOI (OpenAlex lacks it for ~21% of PubMed works).
    let pmid: number | null = row.pmid ? Number(row.pmid) : null
    if (!pmid && row.doi) pmid = await findPubmedByDoi(String(row.doi))
    return { ...c, doi: keptDoi, score, match: toMatch(row, pmid) }
}

// Serial within a batch; the dialog keeps two batches in flight and backs off when lookups fail.
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
