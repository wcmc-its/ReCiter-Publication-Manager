/*
 * MODE 4 of the Literature Search check — Phases 2-4 (fetchCorpus, excludeCaseReports,
 * flagProbableCaseSeries, the Phase 4 aggregations). Same rules as Mode 1-3's checks: live
 * PubMed, NO LLM (Phases 2-4 never call Bedrock — Phase 1 is Mode 1's buildStrategy(), already
 * checked, reused verbatim), assertions are RELATIONAL/BEHAVIOURAL rather than pinned to an exact
 * yield that PubMed indexing will rot.
 *
 * Two fixtures, not one, because the two things worth proving need different shapes:
 *   - NARROW: a real 2-year pull, deliberately over PubMed's own 50-record UI cap (Mode 2/3's
 *     RECORD_CAP) so a shard that returns more than 50 records actually exercises "the cap is
 *     hits, not RECORD_CAP" rather than coincidentally matching it.
 *   - BROAD: one single, deliberately huge MeSH term for one year, to prove a hot shard is
 *     reported (not silently truncated, not silently sub-sharded — decision 4 is deferred) without
 *     needing a real pilot topic to happen to trip it.
 */
const assert = require('node:assert')

const NARROW = {
    db: 'pubmed',
    concepts: [
        {
            label: 'Probiotics / microbiome',
            lines: [{ terms: '"Gastrointestinal Microbiome"[MeSH] OR probiotic*[tiab]', on: true }],
        },
        {
            label: 'Depression',
            lines: [{ terms: '"Depressive Disorder"[MeSH] OR depress*[tiab]', on: true }],
        },
    ],
    limits: '', // no date/type limit here on purpose — fetchCorpus supplies the [dp] shard itself
}

const BROAD = {
    db: 'pubmed',
    concepts: [{ label: 'Neoplasms', lines: [{ terms: 'Neoplasms[MeSH]', on: true }] }],
    limits: '',
}

const run = async (lit) => {
    // ---- Phase 2: the normal path — two real shards, neither hot. --------------------------
    const corpus = await lit.fetchCorpus(NARROW, 2023, 2024)
    assert.strictEqual(corpus.shards.length, 2, 'one shard per year in [fromYear, toYear]')
    assert.ok(corpus.shards.every(s => s.ok), 'neither test year is anywhere near the 2,000 threshold')
    assert.ok(corpus.shards[0].year === 2023 && corpus.shards[1].year === 2024, 'shards stay in year order')

    // THE ONE THAT MATTERS FOR THIS PHASE. Mode 2/3 cap at 50 by design; Mode 4 must not, or it
    // silently reinherits the exact recall-collapse RECALL-STUDY.md measured. At least one real
    // year here has to clear 50 or this assertion cannot tell "uncapped" from "coincidentally
    // small this year".
    const bigShard = corpus.shards.find(s => s.hits > 50)
    assert.ok(bigShard, 'fixture sanity: at least one test year must exceed RECORD_CAP for the next line to mean anything')
    assert.strictEqual(bigShard.records.length, bigShard.hits, `shard ${bigShard.year} returned all ${bigShard.hits} hits, not truncated at 50`)

    assert.strictEqual(
        corpus.records.length,
        corpus.shards.reduce((n, s) => n + (s.ok ? s.records.length : 0), 0) - corpus.duplicates,
        'deduped corpus size = sum of shard records minus duplicates',
    )
    assert.ok(new Set(corpus.records.map(r => r.pmid)).size === corpus.records.length, 'no duplicate PMIDs survive dedup')

    // ---- Phase 2: the hot-shard path — reported, not truncated or auto-sub-sharded. --------
    const hot = await lit.fetchCorpus(BROAD, 2024, 2024)
    assert.strictEqual(hot.shards.length, 1)
    assert.strictEqual(hot.shards[0].ok, false, 'Neoplasms[MeSH] for one year is well over the threshold')
    assert.ok(hot.shards[0].hits > lit.RETRIEVAL_THRESHOLD, 'the reported hit count is the real, over-threshold count')
    assert.ok(/threshold/i.test(hot.shards[0].error), 'the error names the reason, not just a bare failure')
    assert.strictEqual(hot.records.length, 0, 'a hot year contributes nothing rather than a silent partial pull')

    // ---- Phase 3: evidence-type filtering. --------------------------------------------------
    const withoutCaseReports = lit.excludeCaseReports(corpus.records)
    assert.ok(withoutCaseReports.every(r => r.tier.label !== 'Case report'), 'every Case Report is gone')
    assert.ok(withoutCaseReports.length <= corpus.records.length, 'filtering only ever removes records')
    const removedCount = corpus.records.length - withoutCaseReports.length
    const actualCaseReports = corpus.records.filter(r => r.tier.label === 'Case report').length
    assert.strictEqual(removedCount, actualCaseReports, 'exactly the Case Reports were dropped, nothing else')

    const flagged = lit.flagProbableCaseSeries(withoutCaseReports)
    assert.strictEqual(flagged.length, withoutCaseReports.length, 'flagging never excludes — every record stays')
    assert.ok(flagged.every(r => r.caseSeriesProbable === true || r.caseSeriesProbable === undefined),
        'the flag is present-and-true or absent, never present-and-false')
    assert.ok(flagged.filter(r => r.caseSeriesProbable).every(r => r.tier.label === 'Other'),
        'only records with no recognised study-design [pt] are ever flagged')

    // ---- Phase 4: pure aggregation — every record counts once, in every stat. --------------
    const byYear = lit.publicationsPerYear(flagged)
    assert.strictEqual(byYear.reduce((n, y) => n + y.count, 0), flagged.length, 'publicationsPerYear accounts for every record')
    assert.deepStrictEqual(byYear.map(y => y.year), [...byYear.map(y => y.year)].sort(), 'years are in ascending order')

    const mix = lit.evidenceMixByYear(flagged)
    for (const y of Object.keys(mix)) {
        const sum = Object.values(mix[y]).reduce((a, b) => a + b, 0)
        const expected = byYear.find(x => x.year === y).count
        assert.strictEqual(sum, expected, `evidence mix for ${y} accounts for every record that year`)
    }

    const journals = lit.journalDistribution(flagged, 5)
    assert.ok(journals.length <= 5, 'respects the top-N cap')
    assert.ok(journals.every((j, i) => i === 0 || journals[i - 1].count >= j.count), 'sorted by count, descending')

    const pct = lit.percentileTrend(flagged)
    assert.strictEqual(pct.reduce((n, p) => n + p.n, 0), flagged.length, 'percentileTrend also accounts for every record')
    assert.ok(pct.every(p => p.scored <= p.n), 'scored (has a real percentile) never exceeds n (records that year)')
    assert.ok(pct.every(p => p.median === null || (p.median >= 0 && p.median <= 100)), 'a real median is a real percentile')

    console.log(`  Mode 4 fixture: ${corpus.records.length} records across ${corpus.shards.length} years `
        + `(${corpus.duplicates} cross-shard duplicates), ${removedCount} Case Reports dropped, `
        + `${flagged.filter(r => r.caseSeriesProbable).length} probable case series flagged`)

    return { corpus, flagged }
}

module.exports = { run }
