// WHICH DOCUMENTS THIS PAGE HANDS OVER, and what each of them has to say. Not to be confused with
// download.ts next door, which is the browser plumbing — how a Blob becomes a file in someone's
// Downloads folder. This module is the other half: what goes IN the file.
//
// It is a factory rather than a hook because it holds nothing. Everything it needs is passed in on
// one context object, once per render, exactly as the closures did when they lived in the page —
// so no builder here can read a value the screen is not currently showing.
import { strategyDoc, synthesisDoc, recordSheets, corpusSheet, bibliometricDoc } from '../../../../controllers/literatureExport'
import type { Block, RunFacts } from '../../../../controllers/literatureExport'
// THE CLIPBOARD IS A DOCUMENT TOO. It renders the same Block[] as the .docx — see
// literatureMarkdown.ts for why the hand-built string it replaced was the most dangerous artifact
// on the page. No dependencies, so this is a static import.
import { markdownDoc } from '../../../../controllers/literatureMarkdown'
import type { PubRecord, Screened, Synthesis } from '../../../../controllers/literatureSearch.controller'
import { saveDocx, saveText, saveXlsx, stamp } from './download'
import type { Cluster, CorpusStats, DbResult, M4Record, NarrativeReview } from './LiteratureSearch.types'

export type DownloadContext = {
    results: DbResult[]
    records: PubRecord[]
    flags: Record<string, Screened>
    picked: Record<string, boolean>
    synthesis: Synthesis | null
    included: PubRecord[]
    question: string
    model: string
    isPico: boolean
    sortLabel: string
    provenance: { cwid: string; date: string } | null
    session: any
    setErr: (message: string) => void
    // MODE 4 ONLY. Absent (undefined) on every other mode's render — dlCorpus/dlBibliometricDoc
    // guard on m4Narrative below and are never wired to a button outside that mode's result screen.
    m4Corpus?: M4Record[]
    m4Clusters?: Cluster[]
    m4Narrative?: NarrativeReview | null
    m4Stats?: CorpusStats | null
    m4Query?: string
    m4FromYear?: number
    m4ToYear?: number
    m4Narrowing?: string[]
}

// ---- DOWNLOADS. --------------------------------------------------------------------------
//
// Each section carries its own button, because that is where someone is standing when they
// decide they want it. The FORMAT is chosen per section rather than offered as a menu: a
// strategy destined for a manuscript appendix wants Word; fifty records destined for Covidence
// or a filter want a spreadsheet; the query itself wants to be pasted straight back into
// PubMed, so it wants plain text and nothing else.
//
// EVERY ONE OF THEM CARRIES THE QUERY, THE COUNT AND THE DATE. See literatureExport.ts.
export function makeDownloads(ctx: DownloadContext) {
    const {
        results, records, flags, picked, synthesis, included,
        question, model, isPico, sortLabel, provenance, session, setErr,
        m4Corpus, m4Clusters, m4Narrative, m4Stats, m4Query, m4FromYear, m4ToYear, m4Narrowing,
    } = ctx

    // Built from `result`, NEVER from the live `strategy` — the export must describe the toggled
    // state that produced the count printed beside it.
    // WHO RAN IT. `provenance` is the server's word for it, but it only arrives with the synthesis —
    // so a strategy or a records export taken BEFORE the synthesis would have gone out unattributed,
    // and an export nobody can be traced to is one nobody has to stand behind. The session knows
    // who this is from the moment the page loads.
    const runBy = provenance?.cwid || (session?.data?.username as string | undefined)

    // WHICH MODEL. Carried on the facts so that every builder discloses it without having to be
    // told twice — the synthesis, the strategy appendix and the spreadsheet all read it from here.
    const runFacts = (r: DbResult): RunFacts => ({
        db: r.db,
        query: r.query,
        hits: r.hits,
        // Modes 2/3 only ever pull down a capped, ranked slice, so the export must not print the
        // yield under the word "retrieved". Mode 1 counts and never retrieves — it leaves this unset
        // and keeps its single, correct row.
        retrieved: r.records?.length,
        runDate: r.runDate,
        cwid: runBy,
        limits: r.limits,
        unsupportedLimits: r.unsupportedLimits,
        sort: r.records?.length ? sortLabel : undefined,
        model,
    })

    const docxFailed = () => setErr('Could not build the Word document.')

    // THE FILENAME NAMES THE DATABASE, because the file is downloaded PER DATABASE and the download
    // folder is where provenance goes to die. Every query used to land as `pubmed-query-<date>.txt` —
    // so a Scopus query was saved under PubMed's name, and once Embase (Ovid) shipped there were THREE
    // panels writing one filename, each silently overwriting the last. A librarian ends up with a
    // single file called "pubmed-query" containing an Ovid strategy, and no way to know.
    //
    // `r.db` is right there on the result. Use it.
    const dlStrategy = (r: DbResult) =>
        saveDocx(strategyDoc(r, question, runBy, model), `${stamp(`search-strategy-${r.db}`, r.runDate)}.docx`)
            .catch(docxFailed)

    const dlQuery = (r: DbResult) =>
        saveText(r.query, `${stamp(`${r.db}-query`, r.runDate)}.txt`)

    const dlRecords = (r: DbResult) =>
        saveXlsx(recordSheets(records, flags, picked, runFacts(r)), `${stamp('records', r.runDate)}.xlsx`)
            .catch(() => setErr('Could not build the spreadsheet.'))

    const dlSynthesis = (r: DbResult) => {
        if (!synthesis) return
        saveDocx(
            synthesisDoc(synthesis, runFacts(r), question,
                { pico: isPico, screenedIn: included.length, screenedOf: records.length }),
            `${stamp(isPico ? 'clinical-answer' : 'issue-review', r.runDate)}.docx`,
        ).catch(docxFailed)
    }

    // THE TWO CLIPBOARD ARTIFACTS, AND THEY ARE THE ONES PEOPLE ACTUALLY FORWARD.
    //
    // Both are now THE SAME DOCUMENTS as the .docx files above, rendered as Markdown instead of
    // OOXML — same builders, same blocks, one renderer each. Both used to be strings assembled by
    // hand right here, and being hand-assembled is precisely how each ended up missing the one thing
    // it existed to say.
    //
    // The synthesis went out with no database, no query, no yield, no search date — and no
    // fabricated-citation warning. We detect an invented PMID, shout about it on screen, stamp it
    // into the Word file, and then handed the librarian a clean-looking copy of the contaminated
    // summary to paste into an email.
    //
    // The methods block was worse, because of where it LANDS. It is pasted into a published
    // manuscript as a reproducibility statement, and it did not disclose that the strategy had been
    // DRAFTED BY A MODEL, or which model. Every Block[] export stamps that in ("Strategy drafted by
    // <model>, then reviewed and edited by the person named above"); the one artifact that goes into
    // the literature was the one that left it out. It also called the yield "Records retrieved",
    // which in a PRISMA-S appendix is the number a reader copies into a flow diagram — and it is a
    // count, not a retrieval.
    //
    // There is no hand-built format left on this page. A fact added to a document now arrives in
    // every artifact of it, including these.
    const markdown = (r: DbResult) => (synthesis
        ? markdownDoc(synthesisDoc(synthesis, runFacts(r), question,
            { pico: isPico, screenedIn: included.length, screenedOf: records.length }))
        : '')

    // EVERY database that was searched, in one document, exactly as "Download everything" does it —
    // and a failed database appears in neither, because it is not in `results`. Each database opens
    // its own H1, so a two-database methods section arrives already sectioned. The blocks are built
    // from `result`, never from the live `strategy`: the methods must describe the query that
    // produced the count printed beside it, or a librarian who unticks two bundles publishes a
    // strategy that does not reproduce their own number.
    const prismaBlock = () => markdownDoc(results.flatMap(r => strategyDoc(r, question, runBy, model)))

    // THE PACKET: the whole run as one Word file plus one spreadsheet, for the co-author who was
    // not in the room, or for a manuscript submission where the search has to travel as a single
    // artifact. Same builders, concatenated — there is no second source of truth.
    const dlPacket = (r: DbResult) => {
        const facts = runFacts(r)
        // EVERY database that was searched, not just the first. A methods appendix that reports one
        // of two searches is not a methods appendix — and the two are separate documents inside the
        // one file precisely because they are separate searches, with separate counts that must
        // never be added together.
        const blocks: Block[] = [
            ...results.flatMap(x => strategyDoc(x, question, runBy, model)),
            ...(synthesis
                ? synthesisDoc(synthesis, facts, question,
                    { pico: isPico, screenedIn: included.length, screenedOf: records.length })
                : []),
        ]
        saveDocx(blocks, `${stamp('literature-search', r.runDate)}.docx`).catch(docxFailed)
        if (records.length) {
            saveXlsx(recordSheets(records, flags, picked, facts), `${stamp('literature-search', r.runDate)}.xlsx`)
                .catch(() => setErr('Could not build the spreadsheet.'))
        }
    }

    // ---- MODE 4 EXPORTS. -----------------------------------------------------------------------
    //
    // Same "every artifact carries the query, the count and the date" rule as every export above,
    // adapted for the one fact those don't have: `fromYear`/`toYear` instead of a single `hits`.
    // See corpusSheet.ts's own "RECORDS IN CORPUS IS records.length, NOT facts.hits" for why hits
    // and retrieved are both set to the corpus size here — Mode 4 retrieves EVERY record its
    // per-year queries matched, so unlike Modes 2/3's ranked slice, "hits = retrieved" is true, not
    // a rounding of the truth.
    const m4RunFacts = (): RunFacts & { fromYear: number; toYear: number } => ({
        db: 'pubmed',
        query: m4Query || '',
        hits: m4Corpus?.length ?? 0,
        retrieved: m4Corpus?.length ?? 0,
        runDate: provenance?.date || new Date().toISOString().slice(0, 10),
        cwid: provenance?.cwid || (session?.data?.username as string | undefined),
        model,
        fromYear: m4FromYear ?? new Date().getFullYear() - 10,
        toYear: m4ToYear ?? new Date().getFullYear(),
        narrowing: m4Narrowing,
    })

    const dlCorpus = () => {
        if (!m4Corpus) return
        saveXlsx(corpusSheet(m4Corpus, m4RunFacts()), `${stamp('bibliometric-corpus', provenance?.date || '')}.xlsx`)
            .catch(() => setErr('Could not build the spreadsheet.'))
    }

    const dlBibliometricDoc = () => {
        if (!m4Narrative || !m4Stats || !m4Clusters) return
        saveDocx(
            bibliometricDoc(question, m4RunFacts(), m4Stats, m4Clusters, m4Narrative),
            `${stamp('bibliometric-review', provenance?.date || '')}.docx`,
        ).catch(docxFailed)
    }

    const m4Markdown = () => (
        m4Narrative && m4Stats && m4Clusters
            ? markdownDoc(bibliometricDoc(question, m4RunFacts(), m4Stats, m4Clusters, m4Narrative))
            : ''
    )

    return { dlStrategy, dlQuery, dlRecords, dlSynthesis, markdown, prismaBlock, dlPacket, dlCorpus, dlBibliometricDoc, m4Markdown }
}
