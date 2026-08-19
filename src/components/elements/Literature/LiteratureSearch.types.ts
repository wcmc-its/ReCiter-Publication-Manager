// THE SHAPES THE LITERATURE SEARCH PAGE READS. Lifted out of LiteratureSearch.tsx unchanged, so
// that the page file is about what the screen DOES and this one is about what a result IS. Every
// import here is `import type` and therefore erased at transpile: none of it reaches the browser.
import type { Db, Rendering, SeedKind } from '../../../../controllers/literatureSearch.strategy'
import type { PubRecord, Narrowing } from '../../../../controllers/literatureSearch.controller'

// A KNOWN ITEM, AND IT IS NOT A PMID BY ASSUMPTION. A Scopus-only record — a conference paper, a
// non-MEDLINE journal — has no PMID at all, and those are the records Scopus is here for. So a seed
// is an identifier WITH A KIND, and a DOI is a first-class one.
export type Seed = {
    id: string
    kind: SeedKind
    label?: string
    retrieved: boolean
    notInDatabase?: boolean        // this database does not have the paper. Not a strategy bug.
    failingConcepts?: number[]
    failsLimits?: boolean
}

// THE RESULTS COLUMN. One record count per numbered line — how a search history is actually read:
// line 1 finds 40,000, line 2 finds 9,000, and "3 AND 6" collapses to 122. The funnel IS the
// argument, and without it the panel is a wall of Boolean the librarian has to run in their head.
//
// AN UNTICKED LINE HAS NO NUMBER AND THEREFORE NO COUNT, which is right: it was not searched, so
// there is nothing true to say about it. And a MISSING count renders as nothing at all — never as a
// 0. A throttled esearch comes back as a well-formed zero, so "0" is a value we must be able to
// distinguish from "not counted yet", and the em-dash is how.
//
// BUT "NOT COUNTED YET" AND "WE GAVE UP" ARE NOT THE SAME THING, and for a long time this rendered
// them identically: a failed rows fetch left the column empty, so the em-dash quietly changed meaning
// from "coming in a moment" to "never coming", and a librarian sat waiting for a number that had
// already failed. An em-dash that silently stops meaning what it said is the same family of bug as a
// count beside the wrong line — the screen looks calm and it is lying about its own state.
//
// So there are three states, and they look different:
//   pending  — a soft ellipsis. The column is being counted; it takes ~5s and it IS coming.
//   counted  — the number.
//   failed   — an explicit mark, with a Retry beside the panel. Never an em-dash.
export type RowState = 'pending' | 'done' | 'failed'

export type DbResult = {
    db: Db
    dbName: string
    concepts: Rendering[]          // THIS database's rendering. The labels are shared; the lines are not.
    limits: string
    unsupportedLimits: string[]    // limits this database cannot express — declared, never dropped
    rowCounts: Record<number, number>   // records per PRESS line — the Results column
    query: string
    hits: number
    runDate: string
    seeds: Seed[]
    records?: PubRecord[]
    sort?: string
    // Mode 2, THE NARROWING GATE. Above NARROW_ABOVE the server retrieves nothing and hands back
    // the strategy, the count, and a set of PRICED narrowings instead. It is a 200, not a 4xx:
    // "too many" is a finding, not an error, and the answer to it is the query — which the
    // librarian therefore has to be able to see.
    //
    // There is no `tooBroad` any more. That flag was the retrieval TOOL's 2,000-record fetch
    // limit leaking into the product as a refusal, and the limit is gone: the tool takes a retmax
    // and will return the top 50 of a 184,043-hit query. So there is no technical reason left to
    // refuse — only an honesty reason to warn, which is what the gate does.
    needsNarrowing?: boolean
    narrowings?: Narrowing[]
    // THE SEARCH RAN AND WAS COUNTED; SOMETHING AFTER IT DID NOT. Seed validation or the suggested
    // widenings can fail on their own — they are extra count calls, and NCBI can throttle them long
    // after the yield has landed. That is NOT a failed database: the query is real, the count is
    // real, and we were BILLED for it. So it renders as a quiet note on a normal panel, never as a
    // failure and never as a suppressed count — a degraded panel that hid its own number would
    // throw away the one thing the librarian paid for.
    degraded?: string
}

// A DATABASE THAT FAILED. The build loop no longer throws the whole run away when one database
// dies — it pushes this into the results array, in the position that database would have occupied,
// so a dead Scopus tool costs the librarian Scopus and nothing else.
//
// It is a DIFFERENT SHAPE, deliberately, and not a `hits: 0` or an empty panel on the normal one.
// Every field a strategy panel reads — the query, the count, the lines, the seeds — is missing here
// because none of them exist, and a type that pretended otherwise would let one of them render as a
// zero. A zero beside a database name is a librarian reading "this database found nothing."
export type DbFailure = { db: Db; failed: true; error: string }
export const isFailure = (x: DbResult | DbFailure): x is DbFailure => (x as DbFailure).failed === true

export type Expert = {
    personIdentifier: string
    firstName: string
    lastName: string
    primaryOrganizationalUnit: string | null
    pubs: number
}

// The expert panel arrives as one object — the top few and the total behind them — because the
// count is what makes the list readable: "top 8 of 412" is a fact about the field, "8 names" is not.
export type ExpertList = { experts: Expert[]; total: number }

// WHAT THE SERVER IS DOING RIGHT NOW, as opposed to where the librarian is standing (that is
// `phase`). Named here only so the presentational panels can be handed it without re-typing the
// union in four places and letting one of them drift.
export type Stage = 'idle' | 'fetching' | 'screening' | 'synthesizing'
