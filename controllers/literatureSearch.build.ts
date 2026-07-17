// Mode 1 ("Search strategy") build orchestration — one strategy per requested database, sharing
// only the concept labels as a spine. Split out of the API route (src/pages/api/literature/search.ts)
// so the route handles request/response and this multi-database business logic lives in the service
// layer. Behavior-neutral extraction of what was an inline loop.
import { Db, Strategy, Concept, Seed, conceptsOf, buildLimits, DIALECTS } from './literatureSearch.strategy'
import { UsageLog } from './literatureSearch.llm'
import { runStrategy } from './literatureSearch.counting'
import { seedRecords } from './literatureSearch.records'
import { buildStrategy, suggestFixes } from './literatureSearch.llm'

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
}): Promise<{ results: any[]; pubmedStrategy?: Strategy }> {
    const { question, criteria, seedList, dbs, dateId, typeId, usage } = args
        const results: any[] = []
        let spine: Concept[] | undefined
        let pubmedStrategy: Strategy | undefined
        let pubmedRecords: Record<string, any> = {}

        for (const db of dbs) {
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
                results.push({
                    db,
                    failed: true,
                    error: `${DIALECTS[db].name} was not searched: its strategy is drafted to cover the same concepts as the PubMed one, and the PubMed strategy failed. Built without it, it would cover different ideas than the panel beside it.`,
                })
                continue
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

                const built = await buildStrategy(String(question), limits, criteria, 'recall', undefined, db, spine)
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
                results.push(degraded ? { ...result, degraded } : result)
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
                // WRITTEN FOR A LIBRARIAN, never lifted from the exception. The throws underneath here
                // read "scopus retrieval tool HTTP 404" and "unexpected count payload: {...}" and carry
                // hostnames, ports and payload fragments — none of which belongs on a librarian's page,
                // and none of which tells them what to do next. This does.
                //
                // It is pushed IN PLACE, so the failure occupies the slot its panel would have. An
                // absent entry would read as a database nobody ticked; a zero would read as a database
                // that found nothing, which is a wrong number and the one thing this feature must never
                // print.
                results.push({
                    db,
                    failed: true,
                    error: `${DIALECTS[db].name} could not be searched — its strategy could not be built or run. That is a fault in the service behind it, not in your question. Try again; if it keeps failing, tell the ReCiter team.`,
                })
            }
        }
    return { results, pubmedStrategy }
}
