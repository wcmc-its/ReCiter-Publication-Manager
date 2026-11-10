// Candidate evidence for an Authorships queue row (UI refresh 4d): the rows of the evidence
// table and the comparison grid, built from the row, one candidate as the list already carries
// it, and that candidate's facts from POST /api/db/authorships/candidate-evidence.
//
// Pure and React-free so tests/candidateEvidence.test.mjs can run it under plain node. The
// server returns facts, not verdicts, because two of the inputs (already_rejected from
// GoldStandard, retired_cwid from the ED census) arrive on the candidate from the list route.

export type EvidenceKind = 'match' | 'partial' | 'mismatch' | 'nodata'

export interface EvidenceRow {
    label: string
    kind: EvidenceKind
    mine?: string        // what this article says (the same for every candidate on the row)
    theirs?: string      // what their record says
    why?: string         // one short reason, shown under the verdict
}

export interface NameForm { first: string; last: string; n: number }

// One candidate's facts, as the endpoint returns them.
export interface CandidateFacts {
    accepted: number                                  // accepted papers in person_article
    forms: NameForm[]                                 // bylines on accepted papers, most used first
    rejectedForms: NameForm[]                         // bylines on rejected papers
    journalHits: number                               // accepted papers in this row's journal
    degreeYear?: number | null                        // earliest degree year on record
    coauthorHits: Array<{ last: string; initial: string; n: number }>  // this paper's co-authors on their accepted papers
}

export interface EvidenceRowInput {
    byline?: string               // wcm_author
    affiliation?: string          // author_affiliation
    journal?: string
    year?: number | null
    source?: string               // pubmed | scopus | openalex
    coauthors?: string[] | null   // this paper's other authors; null = list not available
}

export interface EvidenceCandidate {
    cwid?: string
    name?: string
    dept?: string
    io_score?: number | null
    given_match?: string
    affil_dept_match?: boolean
    already_rejected?: boolean
}

export const WCM_RE = /Weill[ -]Cornell(?:\s+(?:Medicine|Medical College|Medical Cent(?:er|re)))?/i
const CORNELL_RE = /Cornell/i

// Cornell email identifiers off a raw affiliation string (from PR #1004). PubMed writes the
// author's address into the affiliation ("Electronic address: abc1001@med.cornell.edu."), and
// at all three Cornell domains the local part is the person identifier. Anchored on both sides
// so "notcornell.edu" and "cornell.edu.evil.com" never match; the sentence-final period still
// does. Every address is returned, lowercased, de-duplicated, first-seen order.
const CORNELL_EMAIL_RE = /[A-Za-z0-9._%+-]+@(?:med\.|qatar-med\.)?cornell\.edu(?![A-Za-z0-9-])(?!\.[A-Za-z0-9])/gi
export const cornellEmailIds = (aff?: string): string[] =>
    Array.from(new Set((aff?.match(CORNELL_EMAIL_RE) || []).map((a) => a.split('@')[0].toLowerCase())))

export const normName = (s?: string): string =>
    (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim()

const lastToken = (s?: string) => normName(s).split(/[\s-]/).pop() || ''
const firstInitial = (s?: string) => normName(s)[0] || ''
const formName = (f: NameForm) => `${f.first} ${f.last}`.trim()
// "First Last" key on surname + first initial, the same key the co-author query groups on.
export const authorKey = (name: string): string => `${firstInitial(name)} ${lastToken(name)}`

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export const ioBand = (io: number): EvidenceKind => (io >= 90 ? 'match' : io >= 50 ? 'partial' : 'mismatch')

export function buildCandidateEvidence(row: EvidenceRowInput, c: EvidenceCandidate, f?: CandidateFacts): EvidenceRow[] {
    const rows: EvidenceRow[] = []
    const byline = row.byline || ''
    const bl = normName(byline)
    const external = !!row.source && row.source !== 'pubmed'

    // Name: one of the bylines they publish under, or at least surname and initial agree.
    const forms = f?.forms || []
    const exact = forms.find((x) => normName(formName(x)) === bl)
    const ref = forms[0] ? formName(forms[0]) : c.name
    const fits = !!bl && lastToken(ref) === lastToken(byline) && firstInitial(ref) === firstInitial(byline)
    rows.push({
        label: 'Name',
        kind: exact ? 'match' : fits ? 'partial' : bl ? 'mismatch' : 'nodata',
        mine: byline || undefined,
        theirs: forms.length ? forms.slice(0, 3).map(formName).join(' · ') : c.name,
        why: exact ? `Publishes as “${formName(exact)}” (${plural(exact.n, 'paper')})`
            : fits ? 'Surname and initial agree; this exact form is new for them'
            : bl ? "Doesn't fit their name" : '',
    })

    rows.push({
        label: 'Given name',
        kind: c.given_match === 'full' ? 'match' : c.given_match === 'initial' ? 'partial' : 'nodata',
        mine: byline.split(/\s+/)[0] || undefined,
        why: c.given_match === 'full' ? 'Full given name agrees' : c.given_match === 'initial' ? 'Initial only, so many people fit' : '',
    })

    // Email: decisive when the affiliation's Cornell address is theirs.
    const emails = cornellEmailIds(row.affiliation)
    const cw = (c.cwid || '').toLowerCase()
    if (emails.length) {
        const mine = !!cw && emails.includes(cw)
        rows.push({
            label: 'Email',
            kind: mine ? 'match' : 'mismatch',
            mine: emails.map((e) => `${e}@…`).join(', '),
            why: mine ? `The affiliation carries their address (${cw}@…)` : `The affiliation's Cornell address is ${emails.join(', ')}`,
        })
    }

    const aff = row.affiliation || ''
    const inst = WCM_RE.test(aff) || CORNELL_RE.test(aff)
    rows.push({
        label: 'Institution',
        kind: inst ? 'match' : aff.trim() ? 'mismatch' : 'nodata',
        mine: aff.trim() || undefined,
        why: inst ? '' : aff.trim() ? 'No Cornell institution in the affiliation' : 'No affiliation on this byline',
    })

    rows.push({
        label: 'Department',
        kind: c.affil_dept_match ? 'match' : c.dept ? 'mismatch' : 'nodata',
        theirs: c.dept || undefined,
        why: c.affil_dept_match ? 'Named in the affiliation' : c.dept ? 'Not in the affiliation' : '',
    })

    // Co-authors: this paper's other authors who also appear on their accepted papers.
    const accepted = f?.accepted ?? 0
    if (row.coauthors == null) {
        rows.push({ label: 'Co-authors', kind: 'nodata', why: 'Author list not available for this paper' })
    } else if (!row.coauthors.length) {
        rows.push({ label: 'Co-authors', kind: 'nodata', mine: 'No other authors' })
    } else if (!f || !accepted) {
        rows.push({ label: 'Co-authors', kind: 'nodata', mine: plural(row.coauthors.length, 'co-author'), why: 'No accepted papers to compare against' })
    } else {
        const hitN = new Map(f.coauthorHits.map((h) => [`${h.initial.toLowerCase()} ${lastToken(h.last)}`, h.n]))
        const hits = row.coauthors.filter((a) => hitN.has(authorKey(a)))
        rows.push({
            label: 'Co-authors',
            kind: hits.length ? 'match' : 'mismatch',
            mine: plural(row.coauthors.length, 'co-author'),
            theirs: hits.length ? hits.slice(0, 3).map((a) => `${a} (${hitN.get(authorKey(a))})`).join(', ') + (hits.length > 3 ? ` +${hits.length - 3}` : '') : undefined,
            why: hits.length ? `${hits.length} of ${row.coauthors.length} have published with them`
                : `None of the ${plural(row.coauthors.length, 'co-author')} appear on their accepted papers`,
        })
    }

    // Journal: a hit is real support; a miss is weak, so it stays "no data" rather than against.
    if (f && accepted && row.journal) {
        rows.push({
            label: 'Journal',
            kind: f.journalHits ? 'match' : 'nodata', mine: row.journal,
            why: f.journalHits ? `Published here ${plural(f.journalHits, 'time')} before` : 'Not a journal they have published in',
        })
    } else {
        rows.push({ label: 'Journal', kind: 'nodata', mine: row.journal || undefined, why: accepted ? '' : 'No accepted papers to compare against' })
    }

    // Career window: published well before their first degree is a strong mismatch.
    const dy = f?.degreeYear || null
    if (dy && row.year) {
        const early = row.year < dy - 2
        rows.push({
            label: 'Career window', kind: early ? 'mismatch' : 'match', mine: String(row.year), theirs: `First degree ${dy}`,
            why: early ? `Published ${dy - row.year} years before their first degree` : '',
        })
    } else {
        rows.push({ label: 'Career window', kind: 'nodata', mine: row.year ? String(row.year) : undefined, why: dy ? '' : 'No degree year on record' })
    }

    // Prior decisions: only when there is one.
    const acceptedForms = new Set(forms.map((x) => normName(formName(x))))
    const namesake = (f?.rejectedForms || []).find((x) => normName(formName(x)) === bl && !acceptedForms.has(bl))
    if (c.already_rejected) {
        rows.push({ label: 'Prior decisions', kind: 'mismatch', why: 'Already rejected this paper on their own record' })
    } else if (namesake) {
        rows.push({ label: 'Prior decisions', kind: 'mismatch', why: `Rejected ${plural(namesake.n, 'paper')} under this exact byline before` })
    }

    rows.push(external
        ? { label: 'Identity-Only Score', kind: 'nodata', why: 'Scopus and OpenAlex rows are not scored' }
        : c.io_score == null
            ? { label: 'Identity-Only Score', kind: 'nodata', why: 'Not scored: ReCiter never retrieved this paper for them' }
            : { label: 'Identity-Only Score', kind: ioBand(c.io_score), theirs: String(Math.round(c.io_score)) })

    return rows
}

export interface Tally { match: number; partial: number; mismatch: number; nodata: number }

export const tallyOf = (rows: EvidenceRow[]): Tally =>
    rows.reduce((t, r) => ({ ...t, [r.kind]: t[r.kind] + 1 }), { match: 0, partial: 0, mismatch: 0, nodata: 0 })

// Order for the comparison grid: an email match first, then the evidence balance, then IO.
export const evidenceStrength = (rows: EvidenceRow[]): number =>
    (rows.some((r) => r.label === 'Email' && r.kind === 'match') ? 100 : 0) +
    rows.reduce((s, r) => s + ({ match: 1, partial: 0.4, mismatch: -1, nodata: 0 })[r.kind], 0)

// Comparison-grid column order: already-rejected candidates last (never the lead), then the
// evidence balance, then IO.
export const orderByEvidence = <C extends EvidenceCandidate>(cands: C[], rowsOf: (c: C) => EvidenceRow[]) =>
    cands.map((c) => { const rows = rowsOf(c); return { c, rows, s: evidenceStrength(rows) } })
        .sort((a, b) => Number(!!a.c.already_rejected) - Number(!!b.c.already_rejected) || b.s - a.s || (b.c.io_score ?? -1) - (a.c.io_score ?? -1))
