// "Import a list" (plan 2026-11-20-import-a-list-plan.md): pure helpers shared by the
// extract/resolve routes and ImportListDialog. Free of imports so `node --test` loads it directly.
//
// Flow: paste -> chunks (client) -> citations (structured parse, else Bedrock) -> dedupe ->
// resolve each to a DOI / PMID / OpenAlex id (server) -> group against the person's loaded record
// (client) -> the person checks rows -> existing add paths write them.

export type Citation = {
    title: string,
    year?: number | null,
    venue?: string | null,
    first_author?: string | null,
    doi?: string | null,
    type?: string | null,
}

// What resolve found for a citation. `record` is the external-article POST body (the Crossref or
// OpenAlex search row) for a work that is not in PubMed.
export type Match = {
    title: string,
    year?: number | null,
    doi?: string | null,
    pmid?: number | null,
    articleId?: string | null,
    venue?: string | null,
    record?: Record<string, any> | null,
}

export type Resolved = Citation & { score: number, match: Match | null, error?: string }

export const MAX_PASTE_CHARS = 300_000
export const MAX_ITEMS = 300
export const CHUNK_CHARS = 12_000
const CHUNK_OVERLAP = 600

// Title similarity bands (plan, Step 3).
export const MATCHED = 0.9
export const POSSIBLE = 0.75

const ELLIPSIS = /(…|\.\.\.)\s*$/

export function normTitle(s: unknown): string {
    return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

// Sørensen–Dice over character bigrams; 1 when either title is a "…"-truncated prefix of the
// other (Google Scholar cuts long titles that way).
export function titleSim(a: unknown, b: unknown): number {
    const ra = String(a ?? ''), rb = String(b ?? '')
    const na = normTitle(ra), nb = normTitle(rb)
    if (!na || !nb) return 0
    if (na === nb) return 1
    const truncA = ELLIPSIS.test(ra), truncB = ELLIPSIS.test(rb)
    if (truncA && na.length >= 30 && nb.startsWith(na)) return 1
    if (truncB && nb.length >= 30 && na.startsWith(nb)) return 1
    const grams = (s: string) => {
        const m = new Map<string, number>()
        for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1) }
        return m
    }
    const ga = grams(na), gb = grams(nb)
    let inter = 0
    ga.forEach((n, g) => { inter += Math.min(n, gb.get(g) || 0) })
    return (2 * inter) / (na.length - 1 + nb.length - 1)
}

// Score a candidate: title similarity, less 0.2 when both years are known and more than a year
// apart (a preprint and its article are often a year apart).
export function matchScore(c: { title: string, year?: number | null }, cand: { title: string, year?: number | null }): number {
    let s = titleSim(c.title, cand.title)
    if (c.year && cand.year && Math.abs(Number(c.year) - Number(cand.year)) > 1) s -= 0.2
    return s
}

// A Crossref erratum / correction / retraction notice carries the work's own title and
// `update-to` pointing at it. Matching one by title adds the notice, not the paper (seen in the
// Nov 20 test: Neuron 2010 "The science of stroke" matched its erratum 10.1016/j.neuron.2010.08.019).
export function isUpdateNotice(row: { rawRecord?: unknown }): boolean {
    if (typeof row?.rawRecord !== 'string' || !row.rawRecord.includes('update-to')) return false
    try {
        const u = JSON.parse(row.rawRecord)['update-to']
        return Array.isArray(u) && u.length > 0
    } catch { return false }
}

export function bestMatch<T extends { title: string, year?: number | null }>(c: Citation, cands: T[]): { score: number, cand: T | null } {
    let out: { score: number, cand: T | null } = { score: 0, cand: null }
    for (const cand of cands) {
        const s = matchScore(c, cand)
        if (s > out.score) out = { score: s, cand }
    }
    return out
}

// Split a paste on line boundaries into pieces of about CHUNK_CHARS, overlapping a little so a
// citation cut at a boundary is whole in one of them (dedupePaste drops the repeat).
export function chunkText(text: string, size = CHUNK_CHARS, overlap = CHUNK_OVERLAP): string[] {
    const t = String(text || '')
    if (t.length <= size) return t.trim() ? [t] : []
    const out: string[] = []
    let start = 0
    while (start < t.length) {
        let end = Math.min(t.length, start + size)
        if (end < t.length) {
            const nl = t.lastIndexOf('\n', end)
            if (nl > start + size / 2) end = nl
        }
        out.push(t.slice(start, end))
        if (end >= t.length) break
        const back = t.lastIndexOf('\n', end - overlap)
        start = back > start ? back + 1 : end
    }
    return out
}

// The hallucination guard: keep an extracted title only if (the start of) it is in the pasted
// text. The first 50 normalized characters must appear; a model that completes a "…"-cut title
// still passes, one that invents a title does not.
export function groundedInSource(title: unknown, normalizedSource: string): boolean {
    const n = normTitle(title)
    if (n.length < 8) return false
    return normalizedSource.includes(n.slice(0, 50))
}

const DOI_IN = /10\.\d{4,9}\/[^\s"'<>]+/i
export function cleanDoi(raw: unknown): string | null {
    const m = DOI_IN.exec(String(raw ?? ''))
    return m ? m[0].replace(/[.,;)\]]+$/, '').toLowerCase() : null
}

// Validate and tidy what the model (or a parser) returned. Drops non-objects and titles that are
// not in the source. No cap here: the dialog caps at MAX_ITEMS after dedupe and tells the person.
export function sanitizeCitations(raw: unknown, sourceText: string): { items: Citation[], dropped: number } {
    const src = normTitle(sourceText)
    const srcLower = String(sourceText || '').toLowerCase()
    const arr = Array.isArray(raw) ? raw : []
    const items: Citation[] = []
    let dropped = 0
    for (const r of arr) {
        if (!r || typeof r !== 'object' || typeof (r as any).title !== 'string') { dropped++; continue }
        const title = (r as any).title.replace(/\s+/g, ' ').trim()
        if (!groundedInSource(title, src)) { dropped++; continue }
        const y = Number((r as any).year)
        items.push({
            title,
            year: Number.isInteger(y) && y > 1800 && y < 2100 ? y : null,
            venue: typeof (r as any).venue === 'string' ? (r as any).venue.trim() || null : null,
            first_author: typeof (r as any).first_author === 'string' ? (r as any).first_author.trim() || null : null,
            // Only a DOI that is in the pasted text: a model can fill one in from memory, wrongly.
            doi: ((d) => (d && srcLower.includes(d) ? d : null))(cleanDoi((r as any).doi)),
            type: typeof (r as any).type === 'string' ? (r as any).type : null,
        })
    }
    return { items, dropped }
}

// Remove duplicates inside one paste: same DOI, or same title (a preprint and its article). The
// kept row is the one with a venue, then the longer title. Scholar's junk twins (a committee list
// with the same venue and pages) are NOT merged here: a venue+pages key also matches different
// article-number papers ("Scientific reports 9 (1), 1-10"). The twin resolves to nothing and shows
// as Not found, or to the same work and shows as "Listed twice in the paste".
export function dedupePaste(items: Citation[]): { items: Citation[], deduped: number } {
    const kept: Citation[] = []
    const byKey = new Map<string, number>()
    const better = (a: Citation, b: Citation) => (!!b.venue && !a.venue) || (!!b.venue === !!a.venue && b.title.length > a.title.length)
    for (const c of items) {
        const keys = [c.doi ? 'doi:' + c.doi : '', 't:' + normTitle(c.title).replace(/ /g, '')].filter(Boolean)
        // A DOI hit counts only if the titles agree: a DOI attached to the wrong line must not
        // merge two different works.
        const hit = keys.map((k) => byKey.get(k))
            .find((i) => i !== undefined && (titleSim(kept[i].title, c.title) >= MATCHED || normTitle(kept[i].title).replace(/ /g, '') === normTitle(c.title).replace(/ /g, '')))
        if (hit === undefined) {
            kept.push(c)
            keys.forEach((k) => byKey.set(k, kept.length - 1))
            continue
        }
        const merged = better(kept[hit], c) ? { ...c, doi: c.doi || kept[hit].doi, year: c.year ?? kept[hit].year } : { ...kept[hit], doi: kept[hit].doi || c.doi }
        kept[hit] = merged
        keys.forEach((k) => byKey.set(k, hit))
    }
    return { items: kept, deduped: items.length - kept.length }
}

// ---- Structured formats (no model needed) ----

export function detectFormat(text: string): 'bibtex' | 'ris' | 'csv' | 'text' {
    const t = String(text || '').trimStart()
    if (/^@\w+\s*\{/m.test(t) && /\btitle\s*=/i.test(t)) return 'bibtex'
    if (/^TY {2}- /m.test(t) && /^(TI|T1) {2}- /m.test(t)) return 'ris'
    const first = t.split(/\r?\n/, 1)[0] || ''
    if (/(^|,)"?title"?(,|$)/i.test(first) && first.includes(',')) return 'csv'
    return 'text'
}

const bibField = (entry: string, name: string): string | null => {
    const m = new RegExp(`\\b${name}\\s*=\\s*`, 'i').exec(entry)
    if (!m) return null
    let i = m.index + m[0].length
    const open = entry[i]
    if (open === '{') {
        let depth = 0, out = ''
        for (; i < entry.length; i++) {
            const ch = entry[i]
            if (ch === '{') { if (depth++ === 0) continue }
            else if (ch === '}') { if (--depth === 0) break }
            out += ch
        }
        return out.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
    }
    if (open === '"') {
        const end = entry.indexOf('"', i + 1)
        return entry.slice(i + 1, end < 0 ? undefined : end).replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
    }
    const bare = /^[^,}\s]+/.exec(entry.slice(i))
    return bare ? bare[0] : null
}

function parseBibtex(text: string): any[] {
    return text.split(/(?=^\s*@\w+\s*\{)/m).filter((e) => /^\s*@\w+\s*\{/.test(e)).map((e) => ({
        title: bibField(e, 'title'),
        year: bibField(e, 'year'),
        venue: bibField(e, 'journal') || bibField(e, 'booktitle') || bibField(e, 'publisher'),
        first_author: (bibField(e, 'author') || '').split(/\s+and\s+/i)[0] || null,
        doi: bibField(e, 'doi'),
        type: (/^\s*@(\w+)/.exec(e) || [])[1] || null,
    }))
}

function parseRis(text: string): any[] {
    const out: any[] = []
    let cur: any = null
    for (const line of text.split(/\r?\n/)) {
        const m = /^([A-Z][A-Z0-9]) {2}- ?(.*)$/.exec(line)
        if (!m) continue
        const [, tag, val] = m
        if (tag === 'TY') { cur = { type: val.trim() }; continue }
        if (!cur) continue
        if (tag === 'ER') { out.push(cur); cur = null; continue }
        if ((tag === 'TI' || tag === 'T1') && !cur.title) cur.title = val.trim()
        else if ((tag === 'PY' || tag === 'Y1' || tag === 'DA') && !cur.year) cur.year = (/\d{4}/.exec(val) || [])[0]
        else if ((tag === 'JO' || tag === 'JF' || tag === 'T2') && !cur.venue) cur.venue = val.trim()
        else if (tag === 'DO' && !cur.doi) cur.doi = val.trim()
        else if ((tag === 'AU' || tag === 'A1') && !cur.first_author) cur.first_author = val.trim()
    }
    if (cur) out.push(cur)
    return out
}

export function parseCsvRows(text: string): string[][] {
    const rows: string[][] = []
    let row: string[] = [], field = '', q = false
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (q) {
            if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
            else field += ch
        } else if (ch === '"') q = true
        else if (ch === ',') { row.push(field); field = '' }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++
            row.push(field); rows.push(row); row = []; field = ''
        } else field += ch
    }
    if (field || row.length) { row.push(field); rows.push(row) }
    return rows.filter((r) => r.some((c) => c.trim()))
}

function parseCsv(text: string): any[] {
    const [head, ...rows] = parseCsvRows(text)
    if (!head) return []
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h.trim().toLowerCase()))
    const ti = col('title'), yi = col('year', 'publication year'), vi = col('publication', 'journal', 'source title', 'venue')
    const di = col('doi'), ai = col('authors', 'author')
    return rows.map((r) => ({
        title: r[ti], year: yi >= 0 ? r[yi] : null, venue: vi >= 0 ? r[vi] : null,
        doi: di >= 0 ? r[di] : null, first_author: ai >= 0 ? (r[ai] || '').split(/;|,(?= ?[A-Z])/)[0] : null,
    }))
}

// A BibTeX, RIS or CSV export parsed without the model; null for free text.
export function parseStructured(text: string): any[] | null {
    const f = detectFormat(text)
    if (f === 'bibtex') return parseBibtex(text)
    if (f === 'ris') return parseRis(text)
    if (f === 'csv') return parseCsv(text)
    return null
}

// ---- Grouping against the person's loaded record (client) ----

export type RecordPub = { pmid: number, title?: string, doi?: string | null, year?: number | null, status: 'ACCEPTED' | 'PENDING' | 'REJECTED' }
export type RecordExt = { articleId: string, title?: string, doi?: string | null, year?: number | null, state: 'accepted' | 'rejected' | 'pending' }

export type Group = 'in_profile' | 'suggestion' | 'pubmed_new' | 'rejected' | 'external' | 'not_found' | 'error'

export type Row = Resolved & {
    group: Group,
    possible: boolean, // matched in the 0.75–0.9 band: shown unchecked, "is this it?"
    pmid: number | null,
    note?: string,
    checkable: boolean,
    checkedByDefault: boolean,
}

// Preprint servers: a preprint and its journal article have different DOIs but are one work.
const PREPRINT_DOI = /^10\.(1101|21203|2139|48550|20944|31234|31219|31223|36227|22541|26434|1590\/scielopreprints|5281\/zenodo)\//
export const isPreprintDoi = (d: unknown): boolean => PREPRINT_DOI.test(normDoi(d))

const normDoi = (d: unknown): string => String(d ?? '').trim().toLowerCase().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/, '')

// Numbers in a title tell series papers apart ("part 2", "Part II", "Part Two", "Part B", "2019
// update"). Written forms differ between PubMed, Crossref and CVs ("COVID-19"/"COVID19",
// "(18)F"/"18F"/"¹⁸F", "Type 2"/"Type II"), so numbers are compared as digit runs after removing
// spaces and punctuation, with roman numerals and number words turned into digits first.
const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10', xi: '11', xii: '12' }
const WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', first: '1', second: '2', third: '3', fourth: '4' }
const SERIES = new Set(['part', 'phase', 'type', 'stage', 'study', 'section', 'volume', 'vol', 'trial', 'cohort'])
export function titleNumbers(t: unknown): string[] {
    const toks = normTitle(t).split(' ').filter(Boolean)
    const out: string[] = []
    toks.forEach((w, i) => {
        const prevSeries = i > 0 && SERIES.has(toks[i - 1])
        // Roman numerals and number words only count after a series word ("part ii"), so a
        // pronoun "I" or "first-line therapy" is left alone.
        const n = prevSeries ? (ROMAN[w] || WORDS[w]) : undefined
        if (prevSeries && !n && /^[a-z]$/.test(w)) { out.push('#' + w); return }
        // Each digit run is one number: "h 2 o 2" and "h2o2" both give 2,2; "1 42" and "1-42" give 1,42.
        out.push(...(n || w).replace(/[^0-9]+/g, ' ').trim().split(' ').filter(Boolean))
    })
    return out
}

// The numbers in two titles agree. A "…"-cut title only has to agree as far as it goes.
const numbersAgree = (a: unknown, b: unknown): boolean => {
    const na = titleNumbers(String(a ?? '').replace(ELLIPSIS, '')), nb = titleNumbers(String(b ?? '').replace(ELLIPSIS, ''))
    const cut = ELLIPSIS.test(String(a ?? '')) || ELLIPSIS.test(String(b ?? ''))
    const n = cut ? Math.min(na.length, nb.length) : Math.max(na.length, nb.length)
    for (let i = 0; i < n; i++) if (na[i] !== nb[i]) return false
    return true
}

// Same work by title and year (±1): the fallback for a PMID PubMed's DOI search misses.
// "Type II" -> "Type 2", "Part One" -> "Part 1": series numerals as digits, for the similarity test.
const SERIES_NUMERAL = /\b(part|phase|type|stage|study|section|volume|vol|trial|cohort)\s+(xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth)\b/gi
const digitsForNumerals = (t: unknown): string => String(t ?? '').replace(SERIES_NUMERAL, (_m, w, n) => `${w} ${ROMAN[n.toLowerCase()] || WORDS[n.toLowerCase()]}`)

export const sameWork = (aTitle: unknown, aYear: unknown, bTitle: unknown, bYear: unknown): boolean =>
    Math.max(titleSim(aTitle, bTitle), titleSim(digitsForNumerals(aTitle), digitsForNumerals(bTitle))) >= 0.95
    && numbersAgree(aTitle, bTitle)
    && (!aYear || !bYear || Math.abs(Number(aYear) - Number(bYear)) <= 1)

export function groupAgainstRecord(items: Resolved[], pubs: RecordPub[], exts: RecordExt[]): Row[] {
    const byPmid = new Map(pubs.map((p) => [Number(p.pmid), p]))
    const pubByDoi = new Map(pubs.filter((p) => p.doi).map((p) => [normDoi(p.doi), p]))
    const extById = new Map(exts.map((e) => [e.articleId, e]))
    const extByDoi = new Map(exts.filter((e) => e.doi).map((e) => [normDoi(e.doi), e]))
    const seen = new Set<string>()

    return items.map((it): Row => {
        // A candidate below the POSSIBLE band is not this work: none of its ids are used, anywhere.
        const m = it.match && it.score >= POSSIBLE ? it.match : null
        const possible = !!m && it.score < MATCHED
        const base = { ...it, match: m, possible, pmid: m?.pmid ?? null }
        if (it.error) return { ...base, group: 'error', checkable: false, checkedByDefault: false }
        const possibleNote = possible ? `Possibly this one: “${m!.title}”` : undefined

        // The person's PubMed record: by PMID, then DOI, then title + year. The title fallback is
        // for a PMID PubMed's DOI search missed; it never overrides a different PMID or DOI that
        // resolve found.
        // Only the DOI of the match resolve accepted: a pasted DOI it rejected must not pick a record entry.
        const doi = normDoi(m?.doi)
        const titleHit = (p: { title?: string, year?: number | null, doi?: string | null }, pmid?: number) =>
            !(m?.pmid && pmid && Number(m.pmid) !== Number(pmid))
            // Two different DOIs are two works, unless one is a preprint of the other.
            && !(doi && p.doi && normDoi(p.doi) !== doi && !isPreprintDoi(doi) && !isPreprintDoi(p.doi))
            && (sameWork(it.title, it.year, p.title, p.year) || (!!m && sameWork(m.title, m.year, p.title, p.year)))
        const pub = (m?.pmid && byPmid.get(Number(m.pmid)))
            || (doi && pubByDoi.get(doi))
            || pubs.find((p) => titleHit(p, p.pmid))
        if (pub) {
            const row = { ...base, pmid: Number(pub.pmid) }
            if (pub.status === 'ACCEPTED') return { ...row, group: 'in_profile', note: possibleNote, checkable: false, checkedByDefault: false }
            if (pub.status === 'PENDING') return { ...row, group: 'suggestion', checkable: true, checkedByDefault: !possible }
            return { ...row, group: 'rejected', note: 'Rejected earlier in PubMed', checkable: true, checkedByDefault: false }
        }

        // The person's external works.
        const ext = (m?.articleId && extById.get(m.articleId)) || (doi && extByDoi.get(doi))
            || exts.find((e) => titleHit(e))
        if (ext) {
            const note = ext.state === 'rejected' ? 'Rejected earlier in All sources' : ext.state === 'pending' ? 'Waiting for review in All sources' : possibleNote
            return { ...base, group: 'in_profile', note, checkable: false, checkedByDefault: false }
        }

        if (!m) return { ...base, group: 'not_found', checkable: false, checkedByDefault: false }

        // Within one paste, the second row that resolves to the same work adds nothing.
        const key = m.pmid ? 'p' + m.pmid : m.articleId || doi
        if (key && seen.has(key)) return { ...base, group: 'in_profile', note: 'Listed twice in the paste', checkable: false, checkedByDefault: false }
        if (key) seen.add(key)

        if (m.pmid) return { ...base, group: 'pubmed_new', checkable: true, checkedByDefault: !possible }
        if (m.record && !m.record.notAddable) return { ...base, group: 'external', checkable: true, checkedByDefault: !possible }
        return { ...base, group: 'not_found', note: m.record?.notAddable, checkable: false, checkedByDefault: false }
    })
}

export const GROUP_LABEL: Record<Group, string> = {
    in_profile: 'Already in profile',
    suggestion: 'ReCiter suggestion',
    pubmed_new: 'In PubMed, new',
    rejected: 'Previously rejected',
    external: 'Not in PubMed',
    not_found: 'Not found',
    error: 'Lookup failed',
}
