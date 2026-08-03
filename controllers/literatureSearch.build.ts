// Mode 1 ("Search strategy") build orchestration — one strategy per requested database, sharing
// only the concept labels as a spine. Split out of the API route (src/pages/api/literature/search.ts)
// so the route handles request/response and this multi-database business logic lives in the service
// layer. Behavior-neutral extraction of what was an inline loop.
import { Db, Strategy, Concept, Seed, conceptsOf, buildLimits, DIALECTS } from './literatureSearch.strategy'
import { UsageLog } from './literatureSearch.llm'
import { runStrategy, StrategyResult } from './literatureSearch.counting'
import { seedRecords, SeedRecord } from './literatureSearch.records'
import { buildStrategy, suggestFixes } from './literatureSearch.llm'

// ONE DATABASE'S PANEL — the element type of the array this file returns, which the route sends to
// the browser as `databases`. It was `any[]`, and `any` is the wrong shape for the most-read object
// in this feature: every count on the screen, every seed verdict and every export is taken off one
// of these, so a mistyped field name would have compiled and rendered as a blank.
//
// It is a UNION because a panel is one of exactly two things and they share almost nothing. A
// database that was searched carries the whole StrategyResult. One that failed carries the reason
// and NOTHING ELSE — no `hits`, no `seeds`, no `concepts` — and that absence is deliberate: there is
// no count to render and no strategy to export, so nothing in a failed panel can be mistaken for a
// search that found zero records.
export type DbPanelSearched = StrategyResult & {
    failed?: false
    // The search stands and only the ADVICE on top of it did not — see the enrichment catch below.
    // A note that rides beside a good panel, never a substitute for one.
    degraded?: string
}

export type DbPanelFailed = {
    db: Db
    failed: true
    error: string
}

export type DbPanel = DbPanelSearched | DbPanelFailed

// `!p.failed` inside a filter() tells a READER which half of the union survived; it tells the
// COMPILER nothing, so reading `.hits` off the result would still be an error. These say the same
// thing in the one form TypeScript narrows on, which is what lets the route's cost log read `hits`
// and `seeds` off the survivors and be sure by construction that they are there — that log is the
// one place in the route a throw must never reach.
export const wasSearched = (p: DbPanel): p is DbPanelSearched => p.failed !== true
export const hasFailed = (p: DbPanel): p is DbPanelFailed => p.failed === true

// EVERY MODEL CALL NEEDS A CEILING. Without one a Bedrock invoke that never answers holds its socket
// open forever, and with it the Next worker awaiting it: the request does not fail, it simply never
// returns, and the pod quietly loses a worker for every call that hangs. A request that dies with a
// message is recoverable; one that hangs is not visible to anybody until the pod stops serving.
//
// 120 SECONDS, AND THE NUMBER IS THE WHOLE POINT. A real build is Bedrock Opus writing a full
// multi-block Boolean and it MEASURABLY TAKES 30-60 SECONDS, so the reflexive 30s would not be a
// safety net, it would be an outage — the feature would time out on its healthy path. The real
// ceiling above is the ALB idle timeout, live-verified at 500s (documented at the top of
// search.ts), so 120s sits clear of a slow-but-working build and well under the point at which the
// load balancer would cut the request out from under us anyway.
export const MODEL_TIMEOUT_MS = 120000

// Races a promise against the clock and rejects with a sentence that says what did not answer.
//
// The loser is left alone rather than cancelled, because there is no cancellation to have: an
// in-flight Bedrock call is billed whether or not anyone is still listening. That is safe here and
// not merely tolerable — Promise.race has ALREADY attached its handlers to `p`, so a late rejection
// arriving after the timeout won is a handled rejection that goes nowhere, not an unhandled one that
// would take the process down with it.
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    return Promise.race([
        p,
        new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
                () => reject(new Error(`${what} did not come back within ${Math.round(ms / 1000)} seconds. The service behind it is slow or stuck — try again.`)),
                ms,
            )
        }),
    ]).finally(() => { if (timer) clearTimeout(timer) })
}

export async function buildSearchStrategy(args: {
    question: string
    criteria: string
    seedList: Seed[]
    dbs: Db[]
    dateId: string
    typeId: string
    // Mutated IN PLACE, not reassigned, so the caller's cost log survives a throw: Bedrock bills for
    // a call that preceded a throw, and the route hoists this same object above its try so an
    // unforeseen mid-loop throw is still attributable. Reassigning would rebind the local and lose it.
    usage: UsageLog
}): Promise<{ results: DbPanel[]; pubmedStrategy?: Strategy }> {
    const { question, criteria, seedList, dbs, dateId, typeId, usage } = args
    let spine: Concept[] | undefined
    let pubmedStrategy: Strategy | undefined
    let pubmedRecords: Record<string, SeedRecord> = {}

    // WRITTEN FOR A LIBRARIAN, never lifted from the exception. The throws underneath here
    // read "scopus retrieval tool HTTP 404" and "unexpected count payload: {...}" and carry
    // hostnames, ports and payload fragments — none of which belongs on a librarian's page,
    // and none of which tells them what to do next. This does.
    //
    // It occupies the slot its panel would have. An absent entry would read as a database nobody
    // ticked; a zero would read as a database that found nothing, which is a wrong number and the one
    // thing this feature must never print.
    const failedPanel = (db: Db): DbPanelFailed => ({
        db,
        failed: true,
        error: `${DIALECTS[db].name} could not be searched — its strategy could not be built or run. That is a fault in the service behind it, not in your question. Try again; if it keeps failing, tell the ReCiter team.`,
    })

    // ONE DATABASE, START TO FINISH. Lifted out of the loop body so the databases that do not depend
    // on each other can run at the same time (see below), and it NEVER THROWS: every failure it can
    // have is already a panel, which is exactly what makes it safe to hand to Promise.allSettled.
    const runDb = async (db: Db): Promise<DbPanel> => {
        // PUBMED'S FAILURE IS NOT ONLY PUBMED'S. It goes first because its concept LABELS become
        // the spine every later database is drafted against — that is what makes two panels two
        // renderings of ONE search rather than two unrelated searches. If PubMed never reached a
        // strategy there IS no spine, and drafting Scopus without one does not fail: it succeeds,
        // and hands back a Scopus panel decomposed into DIFFERENT ideas. Plausible on screen,
        // paid for, and impossible to spot. So a database queued behind a spine-less PubMed fails
        // loudly instead of quietly answering a different question.
        //
        // A PubMed that failed AFTER its strategy was drafted — on the count, the seed check or
        // the fixes — still leaves a good spine, and the databases behind it go ahead on it. The
        // spine is what they need, not PubMed's numbers.
        if (db !== 'pubmed' && !spine) {
            return {
                db,
                failed: true,
                error: `${DIALECTS[db].name} was not searched: its strategy is drafted to cover the same concepts as the PubMed one, and the PubMed strategy failed. Built without it, it would cover different ideas than the panel beside it.`,
            }
        }

        // ONE DATABASE'S FAILURE IS ONE DATABASE'S FAILURE — and it used not to be. This loop was
        // a single unguarded await chain in one try, so ANY throw (a 404 from a Scopus tool older
        // than POST /scopus/search/query, an NCBI blip, a Bedrock throttle) flew past `results`,
        // past logCost, and out to a 502. Tick Scopus with a stale tool behind it and the PubMed
        // strategy the librarian actually came for — its counts, its seed check, its fixes — all
        // evaporated, and the tokens burned building them were never even logged.
        try {
            // The limits are OURS, not the model's: resolved from the two dropdown ids into THIS
            // database's syntax by the dialect table. A limit this database cannot express comes
            // back named in `unsupported` — never silently dropped, because a Scopus count run
            // without the "RCT only" the librarian asked for answers a broader question than the
            // PubMed count printed beside it.
            const { terms: limits, unsupported } = buildLimits(db, String(dateId ?? ''), String(typeId ?? ''))

            // The one model call on this path, and therefore the one that gets the clock put on it.
            // A build that never answers must become a failure PANEL — which is what a rejection
            // here turns into, three lines down — rather than a request that hangs until the load
            // balancer gives up on it 500 seconds later with nothing on the screen to explain why.
            const built = await withTimeout(
                buildStrategy(String(question), limits, criteria, 'recall', undefined, db, spine),
                MODEL_TIMEOUT_MS,
                `The ${DIALECTS[db].name} strategy build`,
            )
            usage.inputTokens += built.usage.inputTokens
            usage.outputTokens += built.usage.outputTokens
            if (!spine) spine = conceptsOf(built.strategy)

            // Counts + known-item validation. No records are retrieved, so this is cheap and
            // scales to a 15,000-hit strategy — in either database.
            let result = await runStrategy(built.strategy, seedList, unsupported)
            let degraded: string | undefined

            if (db === 'pubmed') {
                // Recorded BEFORE the enrichment below and outside its try, because the expert panel
                // is drawn from the strategy's MeSH and has nothing to do with seeds or fixes. Set
                // after them, as it was, a seed fetch that threw also cost the librarian the panel.
                pubmedStrategy = built.strategy

                // SEEDS AND FIXES ARE ENRICHMENT, AND ENRICHMENT DEGRADES — it does not destroy.
                // Both of these ran inside the per-database try, so a Bedrock throttle in
                // suggestFixes — one Opus invoke per missed seed plus two counts per proposal, the
                // flakiest link in the whole chain — threw away a strategy that had already been
                // built, already been counted and already been PAID FOR, and replaced it with a
                // failure panel that said the database could not be searched. It could: the search
                // succeeded, and only the advice on top of it did not. The strategy and its count
                // are the deliverable; everything in here is a bonus, and a bonus fails quietly.
                try {
                    // Fetch the seed records themselves — one bounded call. This buys the
                    // author+year label AND the title/MeSH the fix model needs in order to see the paper
                    // it is being asked to widen for. PubMed-only: it is a PubMed record fetch, and the
                    // label it produces is reused on the Scopus panel below rather than fetched twice.
                    pubmedRecords = await seedRecords(seedList)

                    // For anything it missed: ask the model for the terms that would retrieve it, VERIFY
                    // that they do, PRICE what they cost, and hand the result back as an unticked line in
                    // the block it belongs to. Advice the librarian can inspect and reject, not a paragraph.
                    const fixed = await suggestFixes(built.strategy, result, pubmedRecords)
                    usage.inputTokens += fixed.usage.inputTokens
                    usage.outputTokens += fixed.usage.outputTokens
                    result = { ...result, concepts: fixed.strategy.concepts }
                } catch (err: any) {
                    console.error('[literature] pubmed enrichment failed:', err)
                    usage.inputTokens += err?.usage?.inputTokens || 0
                    usage.outputTokens += err?.usage?.outputTokens || 0
                    // `degraded` IS NOT `failed`, and the difference is the whole point: the panel,
                    // the strategy, the count and the exports all stand, and this note rides beside
                    // them. It says only what is actually missing — the seed CHECK itself is run by
                    // runStrategy above and survives, so claiming the seeds went unvalidated would be
                    // the same species of false statement this fix exists to delete.
                    degraded = 'Suggested fixes for the seeds this strategy missed could not be produced, so no widening terms are proposed below. The strategy, its count and the seed check itself are unaffected.'
                }
            }

            // The label is a property of the PAPER, not of the database that found it, so a seed
            // shows the same name on both panels.
            result = { ...result, seeds: result.seeds.map(s => ({ ...s, label: pubmedRecords[s.id]?.label })) }
            return degraded ? { ...result, degraded } : result
        } catch (err: any) {
            console.error(`[literature] ${db} failed:`, err)
            // BEDROCK BILLS FOR THE CALL THAT THREW. invoke() hangs the tokens it has already been
            // charged for on the error it raises — a body that arrived, was billed, and was then
            // rejected for stopping at max_tokens is spend like any other — so a database that
            // failed after its model call is still money out of the account. Dropping it wrote a
            // ZERO into logCost for a run that really cost something, which is the one number in
            // this file nobody would ever go back and question.
            usage.inputTokens += err?.usage?.inputTokens || 0
            usage.outputTokens += err?.usage?.outputTokens || 0
            return failedPanel(db)
        }
    }

    // WRITTEN BY INDEX, NOT APPENDED. `dbs` order is the order of the panels on the screen, a human
    // reads them left to right comparing two renderings of one search, and completion order is an
    // accident of how fast each service answered today. Promise.allSettled does preserve input
    // order, but the array is filled by position anyway so the guarantee is visible here rather than
    // inherited from somebody else's fine print.
    const results: DbPanel[] = new Array<DbPanel>(dbs.length)

    // PUBMED CANNOT JOIN THE PARALLEL BATCH, and that is not a shortcut, it is what the spine means.
    // Every other database is drafted AGAINST PubMed's concept labels, and the seed LABELS on every
    // panel come out of the PubMed record fetch inside PubMed's own enrichment. Start Scopus
    // alongside PubMed and it drafts against no spine — a panel about different ideas, which is the
    // failure this file exists to prevent — and renders its seeds unlabelled. So PubMed goes first,
    // alone, exactly as it always did.
    //
    // Everything at or before PubMed's slot runs in order for the same reason: a database AHEAD of
    // PubMed in the list has no spine to draft against and fails loudly (see runDb). That is the
    // sequential behaviour and it must stay the behaviour, whatever order a future caller passes.
    const pubmedAt = dbs.indexOf('pubmed')
    for (let i = 0; i <= pubmedAt; i++) {
        results[i] = await runDb(dbs[i])
    }

    // THE DATABASES BEHIND PUBMED ARE INDEPENDENT OF EACH OTHER, so they run at the same time.
    // Sequentially, a librarian who ticked Scopus and Embase waited for PubMed's build, then all of
    // Scopus's, then all of Embase's, end to end — ~8s each stacked up in the wall clock for no
    // reason, because nothing in a Scopus build reads anything an Embase build produces. The one
    // thing they do share, the spine, is already in hand by the time this line runs.
    //
    // allSettled, NOT all. `all` rejects the whole batch on the first throw and would take the
    // panels of every sibling down with it — the per-database failure isolation above, undone by the
    // very thing meant to speed it up. runDb already turns its own failures into panels, so a
    // rejected settle here means something unforeseen escaped it, and it gets the SAME panel the
    // sequential version produced rather than leaving a hole in the array.
    const rest = dbs.slice(pubmedAt + 1)
    const settled = await Promise.allSettled(rest.map(db => runDb(db)))
    settled.forEach((outcome, i) => {
        results[pubmedAt + 1 + i] = outcome.status === 'fulfilled' ? outcome.value : failedPanel(rest[i])
    })

    return { results, pubmedStrategy }
}
