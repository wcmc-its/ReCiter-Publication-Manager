// Records layer of Literature Search — the fetch/shape/evidence-tier half: it retrieves records
// (Mode 1's seeds, Mode 2's hits), normalises them into PubRecord, and classifies study design.
// Split out of literatureSearch.controller.ts (now the barrel); the design contract lives there.
import { reciterConfig } from '../config/local'
import {
    Line, Db, Concept, Rendering, Strategy, LimitOption, SeedKind, Seed, Dialect, Row, Pico,
    conceptsOf, parseSeeds, DIALECTS, buildLimits, dateLimits, pubTypes, assembleQuery, conceptQuery,
    numberStrategy, RECORD_CAP, MAX_CONCEPTS, MAX_LINES, MAX_TERMS, PICO_FIELDS, picoQuestion,
    picoComplete, NARROW_ABOVE,
} from './literatureSearch.strategy'

// ---------------------------------------------------------------------------
// Seed records — the ONE place Mode 1 fetches records instead of counting.
//
// A deliberate exception, not an accident, and it earns its keep twice:
//
//   1. It names the paper. "Nikolova (2023)" instead of a naked 8-digit number — a librarian
//      who listed four seeds cannot otherwise tell WHICH one missed, and the miss is the most
//      valuable thing on the screen.
//   2. IT IS WHAT MAKES THE SUGGESTED FIX POSSIBLE. The model cannot propose terms that would
//      retrieve a paper it has never seen. Asked to widen a block for a bare PMID it guesses,
//      and it guesses badly — in a live run it proposed "Bipolar Disorder"[MeSH] to fix a
//      DEPRESSION miss. Handed the paper's title and MeSH descriptors (Sarkar 2016 is indexed
//      under *Emotions*, not *Depression*) it can see the actual gap. Never ask it blind.
//
// Bounded to the seeds (3-5 of them) and done in a SINGLE call, so it cannot grow with the
// yield. Never fatal: a missing record costs us the label and the fix, not the strategy.
export type SeedRecord = { label: string; title: string; mesh: string[] }

// The ONE place we call /pubmed/query-complex/. Everything that needs a record — Mode 1's seed
// labels, Mode 2's candidates, and the re-fetch before screening and synthesis — comes through
// here, so there is one HTTP shape to get right and one place that knows the JSON.
//
// NEVER FATAL, on purpose, and the callers differ on what that means: a missing seed record
// costs Mode 1 a label and a suggested fix (the strategy still stands), whereas Mode 2 has
// nothing to show without records — so the ROUTE decides what an empty array means, not this.
//
// `retmax` and `sort` are sent to the retrieval tool, which resolves them onto the esearch call.
// A tool that predates those fields ignores them (Spring's Jackson does not fail on unknown
// properties), which is why the cap is ALSO enforced here with a slice: the 50 is a promise about
// what enters the context window, and it cannot depend on the far side of an HTTP call honouring
// a field. Against an old tool a 1,200-hit query downloads 1,200 records and we keep 50 — slow,
// but never wrong, and never over budget.
// AN EMPTY RECORD SET IS NOT TO BE TRUSTED ON SIGHT — the same lie as countPubmed's zero, one
// layer down, and this one we can see happening in the retrieval tool's own source.
//
// The tool counts before it fetches, and then: `if (numberOfPubmedArticles == 0) return new
// ArrayList<>()`. So a THROTTLED esearch — which comes back as a well-formed 0, not an error —
// makes the tool skip the EFetch entirely and hand us a perfectly well-formed EMPTY LIST. It is
// indistinguishable from "your search found nothing", and Modes 2-3 fire more calls in a burst
// than Mode 1 ever did (a count, then a fetch, then a re-fetch to screen, then a re-fetch to
// synthesize) against an unkeyed NCBI that allows 3 requests/second.
//
// Observed for real while verifying the retmax carve-out: the same too-broad query returned a
// 500 refusal on one call and a well-formed `[]` on another, a minute apart. The 500 is the
// honest answer; the `[]` is a throttled esearch wearing the mask of a genuine zero.
//
// So we retry an empty once, exactly as countPubmed retries a zero. A genuinely empty query
// reproduces; a throttled one almost never does. This is belt-and-braces, not the real fix: set
// PUBMED_API_KEY on the retrieval tool (free, lifts the limit to 10/s).
//
// ponytail: retry-once, not an expected-count parameter. The caller usually knows the true count
// (Mode 2 counts before it fetches), so we COULD assert against it — but that threads a number
// through three call sites to catch a case the retry already catches, and seedRecords has no
// count to hand us anyway. Upgrade path if a single retry proves too weak: pass the known count
// and loop until records.length > 0 || attempts exhausted.
// A TOOL TOO OLD TO RANK. Not a fetch failure — a truth failure, so it must never be swallowed into
// an empty list the way a network error is.
class StalePubmedTool extends Error {}

async function fetchArticles(query: string, cap: number, sort: Sort, retryOnEmpty = true): Promise<any[]> {
    if (!query.trim()) return []
    try {
        const res = await fetch(reciterConfig.reciterPubmed.searchPubmedEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'reciter-pub-manager-server' },
            body: JSON.stringify({ 'strategy-query': query, retmax: cap, sort }),
        })
        if (!res.ok) throw new Error(`pubmed retrieval tool HTTP ${res.status}`)
        const data: any = await res.json()

        // THE CAPABILITY SIGNAL WE WERE THROWING AWAY.
        //
        // `retmax` and `sort` are sent as JSON fields. Against a retrieval tool that predates them,
        // Jackson drops both SILENTLY (FAIL_ON_UNKNOWN_PROPERTIES is off) — no 4xx, no warning — and
        // the tool runs its own default esearch. The old code then `.slice(0, cap)`d the result and
        // handed back an UNRANKED slice, while the UI and the exported methods table went on
        // asserting "the top 50, ranked by most relevant" as fact. That is the cardinal sin with a
        // deploy-ordering trigger: it looks perfect on a laptop running the new jar.
        //
        // But the response tells us. If the tool honoured `retmax` it cannot return more than `cap`;
        // if it ignored `retmax` it ignored `sort` too, because they arrive in the same object. So a
        // long list is proof the ranking claim is false — and a false claim is worse than no answer.
        // Fail loudly (502) rather than degrade, because there is no honest degraded mode here: the
        // whole promise of Modes 2/3 is that the 50 are the TOP 50.
        //
        // ponytail: a free signal already in the response, not a version probe. Ceiling — it only
        // fires when the tool's own default retmax exceeds `cap`; an old jar that happens to default
        // BELOW the cap returns a short list and slips through. Upgrade path if that ever bites: have
        // the tool echo the applied retmax/sort in its response and assert on it. A seed fetch cannot
        // false-positive: a uid query cannot return more records than it names.
        if (Array.isArray(data) && data.length > cap) {
            throw new StalePubmedTool(
                `The PubMed retrieval tool ignored the ranking request (it returned ${data.length} records for a cap of ${cap}), `
                + 'so "the top 50, by most relevant" would not be true of them. Deploy the sort/retmax build of the tool before using this mode.',
            )
        }
        const list = Array.isArray(data) ? data.slice(0, cap) : []

        if (!list.length && retryOnEmpty) {
            await new Promise(r => setTimeout(r, 400))
            const again = await fetchArticles(query, cap, sort, false)
            if (again.length) {
                console.log(JSON.stringify({
                    tag: 'literature-fetch-empty-retry',
                    recovered: again.length,
                    query: query.slice(0, 120),
                }))
            }
            return again
        }
        return list
    } catch (e) {
        // The stale-tool verdict is the one thing here that must NOT become an empty list: an empty
        // list reads as "no records matched", which is a different lie.
        if (e instanceof StalePubmedTool) throw e
        // Loud, not silent. A silent degradation here is how a page that quietly shows nothing
        // goes unnoticed for a year.
        console.error('[literature] record fetch failed:', query.slice(0, 120), e)
        return []
    }
}

// Keyed by SEED ID, and PubMed-only.
//
// ponytail: PMID seeds only. A DOI seed is perfectly checkable — `10.x/y[aid]` counts fine, and
// validateSeeds uses it — but matching the RETURNED record back to the DOI that asked for it means
// digging the DOI out of PubMed's articleid list, and all this buys is a prettier label and a
// suggested fix. A DOI seed keeps its own DOI as its label and gets no auto-widening; the diagnosis
// (which block excluded it, or that the database does not have it) is unaffected, and that is the
// part that matters. Upgrade when a librarian actually seeds by DOI and misses the label.
export async function seedRecords(seeds: Seed[]): Promise<Record<string, SeedRecord>> {
    const ids = seeds.filter(s => s.kind === 'pmid').map(s => s.id)
    if (!ids.length) return {}

    const out: Record<string, SeedRecord> = {}
    for (const a of await fetchArticles(uidQuery(ids), ids.length, 'relevance')) {
        const cit = a?.medlinecitation
        const pmid = cit?.medlinecitationpmid?.pmid
        if (!pmid) continue
        const first = cit?.article?.authorlist?.[0]?.lastname
        const year = cit?.article?.journal?.journalissue?.pubdate?.year
        out[String(pmid)] = {
            label: first ? (year ? `${first} (${year})` : String(first)) : `PMID ${pmid}`,
            title: plainText(cit?.article?.articletitle),
            mesh: (cit?.meshheadinglist || [])
                .map((m: any) => m?.descriptorname?.descriptorname)
                .filter(Boolean),
        }
    }
    return out
}

// ---------------------------------------------------------------------------
// Mode 2's records.

export type Sort = 'relevance' | 'date'

// RECORD_CAP and NARROW_ABOVE now live in literatureSearch.strategy.ts (re-exported above), because
// the browser needs their VALUES and that file is the only one it can take a value import from.

export type PubRecord = {
    pmid: string
    title: string
    journal: string
    year: string
    authors: string      // "Nikolova et al."
    design: string       // derived — see designOf(). Same string as tier.label.
    // The evidence tier, derived from `types` below. Mode 3 SORTS on rank; Mode 2 just shows the
    // label. Never asked of the model — see tierOf().
    tier: Tier
    // The RAW publication types PubMed indexed, kept so the tier is AUDITABLE. `design` collapses
    // them to one word; when someone asks "why is this a Guideline?", this is the answer. It used
    // to be thrown away at parse time.
    types: string[]
    abstract: string
    mesh: string[]
    // NIH percentile from iCite. DISPLAY ONLY — see withCitationMetrics(). Often absent, by design.
    nihPercentile?: number
    // Mode 4 Phase 3 only — see flagProbableCaseSeries() in literatureSearch.corpus.ts. PubMed has
    // no [pt] tag for case series, so this is a best-effort MeSH/text heuristic, never a tier.
    // Undefined everywhere else; never excludes a record on its own.
    caseSeriesProbable?: boolean
}

// ---------------------------------------------------------------------------
// iCite — the NIH's own citation metrics. A CONTEXT SIGNAL FOR THE HUMAN, AND NOTHING ELSE.
//
// Three hard rules, and they are the whole reason this is safe to show:
//
//   1. IT NEVER SORTS. PubMed's Best Match already ranks the 50, and it blends relevance with
//      recency and publication type. A citation metric ranks by ACCUMULATED ATTENTION, which is
//      a function of age — and which, in any clinical literature, favours REVIEWS. Sorting on it
//      would reintroduce the exact bias we just spent a day removing from the retrieval, and it
//      would bury the recent trials a rapid review exists to find.
//   2. IT NEVER FILTERS. Nothing is hidden or dropped because it is uncited.
//   3. IT NEVER REACHES THE MODEL. The screening prompt must not see it. "This paper is famous"
//      is not evidence that it meets the inclusion criteria, and a model handed a percentile will
//      quietly start treating popularity as quality. The abstract is what gets screened.
//
// So it is fetched on the RETRIEVAL path only — not on the screen/synthesize re-fetches, which
// exist to feed the model.
//
// ponytail: nih_percentile, not RCR. Both are on the response, and the percentile is the one a
// human can read without a footnote — "97th percentile" needs no explanation, "RCR 14.06" needs a
// paragraph. Free, keyless, one bulk call for all 50 PMIDs.
//
// IT IS ROUTINELY ABSENT, AND THAT IS CORRECT, NOT BROKEN. The percentile is field- and
// year-normalised, so it needs citation history: a 2025 trial comes back `nih_percentile: null`
// (verified live — that same paper has an RCR, but no percentile). Our top-50 skews recent by
// design, so expect blanks and render them as nothing at all — never "N/A", never a zero, and
// above all never treat a missing percentile as a low one.
export async function withCitationMetrics(records: PubRecord[]): Promise<PubRecord[]> {
    const pmids = records.map(r => r.pmid).filter(p => /^\d+$/.test(p))
    if (!pmids.length) return records

    try {
        const res = await fetch(`https://icite.od.nih.gov/api/pubs?pmids=${pmids.join(',')}`, {
            headers: { 'User-Agent': 'reciter-pub-manager-server' },
        })
        if (!res.ok) throw new Error(`icite HTTP ${res.status}`)
        const body: any = await res.json()

        const pct = new Map<string, number>()
        for (const p of (Array.isArray(body?.data) ? body.data : [])) {
            const raw = p?.nih_percentile
            // REJECT null BEFORE COERCING, and never the other way round. `Number(null)` is `0`,
            // and `0` is finite — so a finiteness check applied to the coerced value cannot tell
            // "not scored yet" from "bottom of its field". It shipped that way for one run, and
            // 14 of 50 records — every 2024-2026 trial in the set, the papers iCite has not scored
            // yet — rendered as a confident "NIH 0th pct". That is the worst kind of wrong: a
            // missing value wearing the face of a real one, and a scarlet letter on exactly the
            // recent trials a rapid review is looking for.
            //
            // 0 IS a legitimate percentile, so it must still survive. Hence: reject the absent
            // values explicitly, then test what remains.
            if (raw === null || raw === undefined || raw === '') continue
            const n = Number(raw)
            if (Number.isFinite(n)) pct.set(String(p?.pmid), n)
        }
        return records.map(r => (pct.has(r.pmid) ? { ...r, nihPercentile: pct.get(r.pmid) } : r))
    } catch (e) {
        // Never fatal. This is a garnish on a row; the records, the screening and the synthesis are
        // the deliverable. Loud in the log, invisible on the page — the same contract as the WCM
        // expert panel.
        console.error('[literature] icite lookup failed (records still returned):', e)
        return records
    }
}

// DESIGN IS DERIVED FROM PUBMED'S OWN INDEXING, NEVER FROM THE MODEL'S READ OF THE ABSTRACT.
// The chip that says "RCT" next to a paper is a claim about the evidence hierarchy, and it is a
// claim PubMed's indexers already adjudicated. Asking the model to restate it buys nothing and
// costs the one thing this feature is for: a design it cannot substantiate is a fabrication with
// a coloured badge on it.
//
// Order is the evidence hierarchy, highest first, because the types overlap by design: a
// meta-analysis is ALSO tagged "Systematic Review" and "Review"; an RCT is ALSO tagged "Journal
// Article". First match wins, so the strongest true label is the one that shows.
//
// startsWith, not equality, because PubMed has qualified variants ("Randomized Controlled Trial,
// Veterinary"). "Other" is honest: PubMed tags a great many real observational studies as nothing
// but "Journal Article", and inventing "Observational" for them would be exactly the lie above.
//
// THE TIER IS THE MODE-3 PRODUCT. In Mode 2 the design chip is informational and a wrong rung is
// cosmetic. In Mode 3 the ORDER IS THE ANSWER, so the rungs are spelled out and ordered here, once,
// derived from NLM's indexing and nothing else.
//
// Tiers, strongest first. Every entry is a real PubMed [pt] that arrives on the record:
//
//   1  Practice Guideline / Guideline / Consensus Development Conference
//   2  Meta-Analysis / Systematic Review
//   3  Randomized Controlled Trial
//   4  Clinical Trial (incl. phases) / Controlled Clinical Trial   -- interventional, not randomized
//   5  Observational Study
//   6  Case Reports
//   7  Review (narrative) / Editorial / Comment / Letter           -- near expert opinion
//   8  Other
//
// TWO THINGS THIS FIXES, both of which were harmless in Mode 2 and are not in Mode 3:
//   - There was NO GUIDELINE TIER. A practice guideline landed in "Review" or "Other" — while the
//     spec's one substantive sentence about this mode is "Guidelines and SRs before primary trials".
//   - `any('systematic review') || any('review')` was ONE bucket, tested AFTER RCT. So a systematic
//     review sorted BELOW an RCT, and a narrative review sorted EQUAL to a systematic one. Both are
//     inversions of the hierarchy, and in a clinical answer they are the whole ballgame.
//
// NOT DERIVED HERE, on purpose: cohort / case-control / case-series. Those are MeSH headings, not
// publication types. We hold the MeSH, so it could be done — but it is a second, weaker source, and
// coarse-and-honest beats granular-and-wrong. "Other" stays honest.
export type Tier = { rank: number; label: string; phrase: string }

// `phrase` is how the tier reads inside a sentence — the evidence floor is prose, not a chip.
const TIERS: Array<{ rank: number; label: string; phrase: string; pts: string[] }> = [
    { rank: 1, label: 'Guideline',         phrase: 'a clinical guideline',           pts: ['practice guideline', 'guideline', 'consensus development conference'] },
    { rank: 2, label: 'Meta-analysis',     phrase: 'a meta-analysis',                pts: ['meta-analysis'] },
    { rank: 2, label: 'Systematic review', phrase: 'a systematic review',            pts: ['systematic review'] },
    { rank: 3, label: 'RCT',               phrase: 'a randomized controlled trial',  pts: ['randomized controlled trial'] },
    { rank: 4, label: 'Clinical trial',    phrase: 'a non-randomized clinical trial', pts: ['controlled clinical trial', 'clinical trial'] },
    { rank: 5, label: 'Observational',     phrase: 'an observational study',         pts: ['observational study'] },
    { rank: 6, label: 'Case report',       phrase: 'a case report',                  pts: ['case reports'] },
    { rank: 7, label: 'Review',            phrase: 'a narrative review',             pts: ['review', 'editorial', 'comment', 'letter'] },
]

const OTHER: Tier = { rank: 8, label: 'Other', phrase: 'not indexed with a study design' }

// TWO TYPES THAT OVERRIDE EVERY OTHER TYPE ON THE RECORD, and so must be tested BEFORE the table.
//
// A RETRACTED TRIAL IS STILL TAGGED "Randomized Controlled Trial". PubMed adds "Retracted
// Publication" alongside the original types rather than replacing them — so first-match-wins found
// the RCT, ranked it 3, and sorted a withdrawn paper to the TOP of a clinical answer, where Mode 3
// then led with it. That is the worst output this feature can produce: not a wrong number, a
// retracted one, presented as the strongest evidence available.
const RETRACTED: Tier = { rank: 9, label: 'RETRACTED', phrase: 'a RETRACTED publication, which must not be relied on' }

// A PROTOCOL REPORTS NO RESULTS AT ALL. "Clinical Trial Protocol" startsWith "clinical trial", so it
// matched the rank-4 interventional tier and could set the evidence floor — announcing "the strongest
// evidence retrieved is a non-randomized clinical trial" on the strength of a paper describing a
// trial that has not happened yet.
const PROTOCOL: Tier = { rank: 8, label: 'Protocol', phrase: 'a trial protocol, which reports no results' }

// First match wins, and the table is ordered strongest-first, because the types OVERLAP by design:
// a meta-analysis is also tagged "Systematic Review" and "Review"; an RCT is also tagged "Clinical
// Trial" and "Journal Article". The strongest TRUE label is the one that shows.
export function tierOf(types: string[]): Tier {
    const t = (types || []).map(x => String(x || '').trim().toLowerCase())

    // The two overrides, strongest claim first: retraction beats everything, including a protocol.
    if (t.some(x => x.startsWith('retracted publication'))) return RETRACTED
    if (t.some(x => x.startsWith('clinical trial protocol'))) return PROTOCOL

    for (const tier of TIERS) {
        if (tier.pts.some(p => t.some(x => x.startsWith(p)))) {
            return { rank: tier.rank, label: tier.label, phrase: tier.phrase }
        }
    }
    return OTHER
}

// The label Mode 2 has always shown. Unchanged in meaning for the chip; now sourced from the tiers
// so there is exactly one place where a publication type becomes a claim about evidence.
export function designOf(types: string[]): string {
    return tierOf(types).label
}

// THE EVIDENCE FLOOR — derived, free, and often the true clinical answer.
//
// A clinician reading a confident synthesis has no way to know the whole thing rests on case
// series. This says so, in one sentence, computed from the tier of the strongest record retrieved.
// It costs no inference and it cannot be wrong.
export function evidenceFloor(records: PubRecord[]): string {
    if (!records.length) return 'No records were retrieved, so there is no evidence to weigh.'

    const best = records.reduce((a, r) => (r.tier.rank < a.rank ? r.tier : a), OTHER)
    const has = (rank: number) => records.some(r => r.tier.rank === rank)

    // Name what is ABSENT, not just what is present: "there is no RCT here" is the sentence that
    // changes what a clinician does next.
    const missing: string[] = []
    if (!has(1)) missing.push('no clinical guideline')
    if (!has(2)) missing.push('no systematic review or meta-analysis')
    if (!has(3)) missing.push('no randomized trial')

    const lead = best.rank >= 8
        ? 'PubMed does not index a study design for any of the records retrieved'
        : `The strongest evidence retrieved is ${best.phrase}`

    return missing.length
        ? `${lead}. In this set there is ${missing.join(', and ')}.`
        : `${lead}.`
}

// THE FIELD PATH THAT COST AN AFTERNOON. The abstract is at
//   medlinecitation.article.publicationAbstract.abstractTexts[]   <- camelCase, both of them
// and NOT at article.abstract, article.abstracttext, or publicationabstract. Its siblings on
// `article` ARE lowercase (articletitle, authorlist, publicationtypelist, journal) because the
// Java field names are lowercase and no Jackson naming strategy is in play — so the casing here
// is not a convention you can reason about, it is a fact you have to copy. The obvious guess
// parses cleanly, throws nothing, and yields 50 records with 0 abstracts: a screening pass over
// nothing but titles, which reads plausible and is worthless.
//
// PubMed abstracts are STRUCTURED — IMPORTANCE / OBJECTIVE / DESIGN / RESULTS / CONCLUSIONS as
// separate segments. Keep the labels. They are how the model tells a stated result from a stated
// aim, which is precisely the distinction the synthesis prompt is built to enforce.
// PubMed text carries inline markup, and it is NOT just italics. Titles and abstracts both ship
// <i> <b> <u> <sub> <sup>, and MathML (<mml:math>...) turns up in chemistry and dosing text. It
// arrives in the JSON as literal tag text, so rendering it raw puts "Psychobiotic <i>Lactobacillus
// plantarum</i> JYLP-326..." on the screen — which is exactly what the first browser run showed.
//
// This runs over TITLES AND ABSTRACTS ALIKE. The abstract never reaches the DOM, so the tags there
// are not a rendering bug — they are a TOKEN bug: markup in an abstract is paid for on the way into
// the context window, 50 abstracts at a time, and buys the model nothing.
//
// ponytail: STRIP the tags, don't render them. Rendering would mean dangerouslySetInnerHTML on a
// string this app did not author — an XSS sink fed by an external API — to buy italic species names.
// Not a trade worth making. The regex is deliberately generic (<...>) rather than an allowlist of the
// tags we happen to have seen, because the next surprise tag should also vanish rather than surface.
// Ceiling: species names lose their italics. If a librarian asks for them back, the upgrade is a tiny
// allowlist renderer (<i>/<b>/<sub>/<sup> -> React elements), never raw HTML.
//
// Entities are decoded after the strip, NAMED and NUMERIC both: PubMed escapes them, and "&amp;" or
// a minus sign written "&#x2212;" (common in effect sizes — "&#x2212;0.44") is the same class of bug
// one layer down, where it lands in the model's context as noise instead of a number.
export function plainText(raw: any): string {
    return String(raw ?? '')
        .replace(/<[^>]+>/g, '')                                     // any tag, not just the ones we've met
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')             // &amp; LAST, or "&amp;lt;" double-decodes into "<"
        .replace(/\s+/g, ' ')
        .trim()
}

// A malformed entity must not blow up a record parse, and must not smuggle a control character in.
const safeChar = (code: number) =>
    Number.isFinite(code) && code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : ''

export function joinAbstract(texts: any): string {
    return (Array.isArray(texts) ? texts : [])
        .map((t: any) => {
            // plainText, not String(): abstracts carry the same <i>/<sub>/<sup>/MathML markup as
            // titles. It never reaches the DOM here, so it is not a rendering bug — it is 50
            // abstracts' worth of tags billed into the context window for nothing.
            const body = plainText(t?.abstractText)
            if (!body) return ''
            const label = plainText(t?.abstractTextLabel)
            return label ? `${label}: ${body}` : body
        })
        .filter(Boolean)
        .join('\n')
}

function toRecord(a: any): PubRecord | null {
    const cit = a?.medlinecitation
    const pmid = cit?.medlinecitationpmid?.pmid
    if (!pmid) return null

    const art = cit?.article || {}
    const authors: any[] = Array.isArray(art.authorlist) ? art.authorlist : []
    const first = authors[0]?.lastname

    // Keep the raw list. Collapsing it straight to a `design` string threw away the evidence for
    // the claim the chip makes — and Mode 3 needs to sort on it, not just print it.
    const types: string[] = (Array.isArray(art.publicationtypelist) ? art.publicationtypelist : [])
        .map((p: any) => p?.publicationtype)
        .filter(Boolean)
        .map(String)
    const tier = tierOf(types)

    return {
        pmid: String(pmid),
        title: plainText(art.articletitle),
        // The ISO abbreviation is what a citation prints ("JAMA Psychiatry"); `title` is the
        // MEDLINE form, which is lowercased ("JAMA psychiatry"). Prefer the former, fall back.
        journal: String(art.journal?.isoAbbreviation || art.journal?.title || ''),
        year: String(art.journal?.journalissue?.pubdate?.year || ''),
        authors: first ? (authors.length > 1 ? `${first} et al.` : String(first)) : '',
        design: tier.label,
        tier,
        types,
        abstract: joinAbstract(art.publicationAbstract?.abstractTexts),
        mesh: (Array.isArray(cit.meshheadinglist) ? cit.meshheadinglist : [])
            .map((m: any) => m?.descriptorname?.descriptorname)
            .filter(Boolean),
    }
}

// `<pmid>[uid] OR <pmid>[uid] …` — [uid] is the correct tag (PubMed normalizes [pmid] -> [UID]),
// verified against live PubMed 2026-07-12. This is how phases 2 and 3 re-fetch: the server never
// accepts abstract text from the client.
const uidQuery = (pmids: string[]) => pmids.map(p => `${p}[uid]`).join(' OR ')

export async function fetchRecords(query: string, cap = RECORD_CAP, sort: Sort = 'relevance'): Promise<PubRecord[]> {
    const out: PubRecord[] = []
    for (const a of await fetchArticles(query, cap, sort)) {
        const r = toRecord(a)
        if (r) out.push(r)
    }
    return out
}

export const fetchByPmids = (pmids: string[]) => fetchRecords(uidQuery(pmids), pmids.length, 'relevance')

