// Unit tests for the bibliometric report v2 measures (controllers/db/reports/bibliometrics.ts).
// Three reference people come from frozen row fixtures (tests/fixtures/, dev snapshot, NOT prod
// acceptance values); the 15 spec edge cases use small synthetic rows. No database. `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
    flag, hundredths, thousandths, fixed, missingV2Columns, isExternal, isCounted, isResearchArticle,
    isRated, roleOf, inRoleSet, hIndex, hIndexes, minusYears, isoDate, workYear, medianX2,
    topNAverage, sharePercent, keyFigures, yearAxis, yearIndex, authorshipByYear, percentileBins,
    typeTag, normalizeTitle, supersededPreprints, venueName, venueKey, unratedReason,
    mostInfluential, reviewsAndOther, recentWorks, olderWorks, recentResearchInSet,
    topPercent, peerTable, rankNote, displaySurname, REASONS, ratedInSet,
} from '../controllers/db/reports/bibliometrics.ts'

const FIX = JSON.parse(readFileSync(new URL('./fixtures/bibliometrics-v2-dev-2026-11-11.json', import.meta.url), 'utf8'))
const RUN = FIX.runDate
const gouzy = FIX.people.alg2053
const nathan = FIX.people.cnathan
const mirza = FIX.people.aah2003

// Synthetic rows carry every v3.11 column (as the controller's SELECT will).
let nextPmid = 50000000
const V2 = { provisionalNIH: 0, hasPercentileNIH: 1, pctExact: null, researchArticleV2: 0, ratedV2: 0, recentV2: 0, authorRoleV2: 'middle', soleAuthor: 0 }
const w = (o = {}) => ({ pmid: nextPmid++, sourceType: 'PUBMED', pubTypeCounted: 1, publicationTypeCanonical: 'Academic Article', pubDate: '2015-06-01', citationCountNIH: 10, relativeCitationRatioNIH: '1.00', datePublicationAddedToEntrez: '2015-06-02', ...V2, ...o })
const rated = (pct, o = {}) => w({ researchArticleV2: 1, ratedV2: 1, pctExact: pct, ...o })
const ext = (o = {}) => ({ pmid: -(nextPmid++), sourceType: 'OPENALEX', pubTypeCounted: 1, publicationTypeCanonical: 'Academic Article', pubDate: '2026-01-01', ...V2, hasPercentileNIH: null, provisionalNIH: null, authorRoleV2: 'not_set', ...o })
const cell = (roleSet, topN, avgTop, cohortRank, cohortM, o = {}) => ({ personIdentifier: 'x', facultyRank: 'Assistant Professor', cohortEligible: 1, roleSet, topN, ratedCount: 0, recentCount: 0, avgTop, cohortRank, cohortM, runDate: RUN, ...o })

// ---------------------------------------------------------------------------------------------
// Exact numbers

test('hundredths/thousandths parse DECIMAL strings exactly and driver floats by rounding', () => {
    assert.equal(hundredths('83.64'), 8364)
    assert.equal(hundredths('90.00'), 9000)
    assert.equal(hundredths('0.995'), 100, 'third decimal rounds half-up')
    assert.equal(hundredths(83.63999938964844), 8364, 'FLOAT(5,2) through the driver')
    assert.equal(hundredths(''), null)
    assert.equal(hundredths(null), null)
    assert.equal(thousandths('83.640'), 83640)
    assert.equal(thousandths('99.92'), 99920)
    assert.equal(thousandths(83.640001), 83640)
})

test('fixed: half-up display at any scale', () => {
    assert.equal(fixed(8364, 2, 1), '83.6')
    assert.equal(fixed(8365, 2, 1), '83.7')
    assert.equal(fixed(83640, 3, 1), '83.6')
    assert.equal(fixed(99950, 3, 1), '100.0')
    assert.equal(fixed(100, 2, 2), '1.00')
    assert.equal(fixed(5, 2, 1), '0.1')
    assert.equal(fixed(4, 2, 1), '0.0')
    assert.equal(fixed(1250, 3, 0), '1')
})

test('flag reads TINYINT, boolean and iCite strings; absent is false', () => {
    for (const v of [1, '1', true, 'True', 'true']) assert.equal(flag(v), true)
    for (const v of [0, '0', false, 'False', '', null, undefined]) assert.equal(flag(v), false)
})

test('sharePercent and topPercent are exact half-up and ceiling', () => {
    assert.equal(sharePercent(4, 32), 13, '12.5 -> 13')
    assert.equal(sharePercent(86, 302), 28)
    assert.equal(sharePercent(1, 8), 13)
    assert.equal(sharePercent(1, 200), 1, '0.5 -> 1')
    assert.equal(topPercent(244, 660), 37)
    assert.equal(topPercent(3, 336), 1)
    assert.equal(topPercent(20, 20), 100)
    assert.equal(topPercent(1, 100), 1)
    assert.equal(topPercent(2, 100), 2, 'exact division does not round up')
})

test('medianX2 keeps the half', () => {
    assert.equal(medianX2([]), null)
    assert.equal(medianX2([221]), 442)
    assert.equal(medianX2([99, 100]), 199)
    assert.equal(medianX2([300, 100, 200]), 400)
})

// ---------------------------------------------------------------------------------------------
// h-index

test('hIndex: empty, zeros, all equal, ties, unsorted, strings', () => {
    assert.equal(hIndex([]), 0)
    assert.equal(hIndex([0, 0, null, undefined, -3]), 0)
    assert.equal(hIndex([5, 5, 5, 5, 5]), 5)
    assert.equal(hIndex([10, 8, 5, 4, 3]), 4)
    assert.equal(hIndex([3, 0, 6, 1, 5]), 3)
    assert.equal(hIndex(['7', '7', 2]), 2)
})

test('minusYears matches MySQL DATE_SUB(INTERVAL n YEAR), including Feb 29', () => {
    assert.equal(minusYears('2026-11-11', 5), '2021-11-11')
    assert.equal(minusYears('2028-02-29', 5), '2023-02-28')
    assert.throws(() => minusYears('11/11/2026', 5))
})

test('hIndexes v2: errata excluded (Decision 6), external rows never count; stepSix keeps errata', () => {
    const works = [
        w({ citationCountNIH: 10, datePublicationAddedToEntrez: '2024-01-01' }),
        w({ citationCountNIH: 9, datePublicationAddedToEntrez: '2019-01-01' }),
        w({ citationCountNIH: 3, datePublicationAddedToEntrez: '2025-06-01', pubTypeCounted: 0, publicationTypeCanonical: 'Erratum' }),
        ext({ citationCountNIH: 50 }),
        { pmid: 7, sourceType: 'OPENALEX', citationCountNIH: 40 },
    ]
    assert.deepEqual(hIndexes(works, '2026-11-11'), { hindexNIH: 2, h5indexNIH: 1 })
    assert.deepEqual(hIndexes(works, '2026-11-11', { stepSix: true }), { hindexNIH: 3, h5indexNIH: 2 })
})

test('hIndexes: h5 window is strictly after asOf - 5 years and skips empty dates', () => {
    const works = [
        w({ citationCountNIH: 5, datePublicationAddedToEntrez: '2021-11-11' }),
        w({ citationCountNIH: 5, datePublicationAddedToEntrez: '2021-11-12' }),
        w({ citationCountNIH: 5, datePublicationAddedToEntrez: '' }),
    ]
    assert.equal(hIndexes(works, '2026-11-11').h5indexNIH, 1)
    assert.equal(hIndexes(works, '2026-11-11').hindexNIH, 3)
})

// ---------------------------------------------------------------------------------------------
// Reference people (dev fixtures, rules of plan phase5h-v2-bibliometric.md)

test('Gouzy (alg2053): key figures', () => {
    const k = keyFigures(gouzy, RUN)
    assert.equal(k.available, true)
    assert.deepEqual(k.counts, { counted: 17, pubmed: 16, external: 1, research: 9, rated: 7, recent: 5, notInICite: 0 })
    assert.equal(k.publications.text, '17 (2012 to 2026), including 9 PubMed research articles')
    assert.deepEqual(k.researchByRole.value, { first: 4, senior: 2, middle: 3 }, 'preprint 41040375 is not research')
    assert.equal(k.researchByRole.text, 'First 4 · Senior 2 · Middle 3')
    assert.equal(k.typicalWork.text, '2.21')
    assert.equal(k.typicalWork.value.n, 7)
    assert.deepEqual(k.highlyInfluential.value, { k: 0, n: 7, percent: null, maxPct: 8960 })
    assert.equal(k.highlyInfluential.text, '0 of 7')
    assert.equal(k.mostInfluentialWork.value.avgThousandths, 83640)
    assert.equal(k.mostInfluentialWork.text, '83.6')
    assert.equal(k.hIndex.text, '9 (h5 4)')
})

test('Gouzy: role-set cells, recent senior work, no v1 values', () => {
    assert.equal(topNAverage(gouzy, 'any', 10).text, 'Needs 10 rated')
    assert.equal(topNAverage(gouzy, 'first_or_senior', 5).text, 'Needs 5 rated')
    assert.equal(topNAverage(gouzy, 'first_or_senior', 5).ratedCount, 4)
    assert.equal(ratedInSet(gouzy, 'senior').length, 0)
    assert.deepEqual(recentResearchInSet(gouzy, 'senior').map((x) => x.pmid).sort(), [39611843, 40643003])
    const shown = JSON.stringify([keyFigures(gouzy, RUN), [5, 10].map((n) => ['any', 'first_or_senior', 'first', 'senior'].map((s) => topNAverage(gouzy, s, n).text))])
    for (const v1 of ['73.7', '85.2', '62.2']) assert.ok(!shown.includes(`"${v1}"`), `v1 value ${v1} must not appear`)
})

test('Gouzy: sections and tags', () => {
    assert.deepEqual(mostInfluential(gouzy).map((r) => [r.work.pmid, r.marked]), [
        [24586151, false], [34341117, false], [35459278, false], [24077180, false], [32127458, false], [34818059, false], [24957090, false],
    ])
    assert.deepEqual(reviewsAndOther(gouzy).map((r) => [r.work.pmid, r.tag, r.role]), [
        [25244084, 'Review', 'first'], [24187657, 'Comment', 'first'], [23266372, 'Conference paper', 'first'],
        [39995204, 'Review', 'middle'], [24685210, 'Other', 'first'],
    ])
    assert.equal(typeTag(gouzy.find((x) => x.pmid === 37787569)), 'Comment', 'never Letter')
    assert.equal(typeTag(gouzy.find((x) => x.pmid === 40643003)), 'Research article')
    assert.deepEqual(recentWorks(gouzy).map((r) => [r.work.pmid, r.role, r.tag]), [
        [40643003, 'senior', 'Research article'], [39611843, 'senior', 'Research article'], [-439, 'first', 'Preprint'],
        [41040375, 'middle', 'Preprint'], [39995204, 'middle', 'Review'],
    ])
    assert.deepEqual(olderWorks(gouzy), [])
    for (const r of recentWorks(gouzy)) assert.equal(unratedReason(r.work), REASONS.tooRecent)
})

test('Gouzy: authorship chart 2013 to 2025 with gaps 2015–2019 and 2023; no distribution chart', () => {
    const c = authorshipByYear(gouzy)
    assert.equal(c.axis.binned, false)
    assert.equal(c.axis.categories[0], '2013')
    assert.equal(c.axis.categories.at(-1), '2025')
    assert.deepEqual(c.gaps, ['2015–2019', '2023'])
    assert.equal(c.totals.reduce((a, b) => a + b, 0), 9)
    assert.deepEqual(percentileBins(gouzy), { shown: false, reason: 'Needs 20 rated' })
})

test('Nathan (cnathan): key figures (sole author = Senior; iCite-research letters excluded)', () => {
    const k = keyFigures(nathan, RUN)
    assert.equal(k.counts.research, 332)
    assert.deepEqual(k.researchByRole.value, { first: 32, senior: 156, middle: 144 }, 'parts sum to the total')
    assert.equal(k.counts.rated, 302)
    assert.equal(k.typicalWork.value.medianX2, 407)
    assert.equal(k.typicalWork.text, '2.04', 'median 2.035, half-up')
    assert.deepEqual(k.highlyInfluential.value, { k: 86, n: 302, percent: 28, maxPct: 10000 })
    assert.equal(k.highlyInfluential.text, '28% (86 of 302)')
    assert.equal(k.mostInfluentialWork.text, '99.9')
    assert.equal(k.hIndex.text, '132 (h5 9)')
    const sole = nathan.filter((x) => isResearchArticle(x) && flag(x.soleAuthor))
    assert.equal(sole.length, 11)
    assert.ok(sole.every((x) => roleOf(x) === 'senior'))
    assert.equal(sole.filter(isRated).length, 10)
})

test('Nathan: top-N by role set on exact hundredths', () => {
    const got = Object.fromEntries(['any', 'first_or_senior', 'first', 'senior'].map((s) => [s, [5, 10].map((n) => topNAverage(nathan, s, n).avgThousandths)]))
    assert.deepEqual(got, {
        any: [99920, 99810], first_or_senior: [99900, 99740], first: [98700, 95610], senior: [99860, 99670],
    })
})

test('Nathan: older work led by the 610-citation paper (fix 5); binned chart; distribution shown', () => {
    assert.deepEqual(olderWorks(nathan).map((r) => [r.work.pmid, r.work.citationCountNIH]), [
        [216763, 610], [5576335, 549], [925614, 505], [368287, 468], [512587, 244],
    ])
    for (const r of olderWorks(nathan)) assert.ok(unratedReason(r.work) !== null)
    const c = authorshipByYear(nathan)
    assert.equal(c.axis.binned, true)
    assert.equal(c.axis.categories[0], '1971–1974')
    assert.equal(c.axis.categories.at(-1), '2025–2026')
    assert.equal(c.totals.reduce((a, b) => a + b, 0), 332)
    const b = percentileBins(nathan)
    assert.equal(b.shown, true)
    assert.deepEqual(b.value.counts, [15, 14, 19, 16, 21, 23, 28, 31, 49, 86])
    assert.equal(b.value.counts[9], keyFigures(nathan, RUN).highlyInfluential.value.k, 'last bin = k at 90 or more')
})

test('Mirza (aah2003): key figures, phrase-boundary values', () => {
    const k = keyFigures(mirza, RUN)
    assert.deepEqual(k.researchByRole.value, { first: 5, senior: 0, middle: 28 })
    assert.equal(k.counts.rated, 32, 'provisional 38190635 is never rated')
    assert.equal(k.typicalWork.value.median, 0.995)
    assert.equal(k.typicalWork.text, '1.00')
    assert.equal(k.highlyInfluential.text, '13% (4 of 32)')
    assert.equal(k.mostInfluentialWork.value.avgThousandths, 91160)
    assert.equal(k.hIndex.text, '20 (h5 7)')
    assert.equal(k.counts.counted, 38, '2 errata excluded')
    const c = authorshipByYear(mirza)
    assert.equal(c.axis.categories.length, 11)
    assert.deepEqual(c.gaps, [])
    assert.equal(percentileBins(mirza).shown, true)
})

// ---------------------------------------------------------------------------------------------
// Missing v3.11 columns (R2 not applied): no throw, no wrong number

test('missing v3.11 columns degrade to reasons', () => {
    const old = gouzy.map(({ researchArticleV2, ratedV2, recentV2, authorRoleV2, soleAuthor, provisionalNIH, hasPercentileNIH, pctExact, ...rest }) => rest)
    assert.deepEqual(missingV2Columns(old), ['provisionalNIH', 'hasPercentileNIH', 'pctExact', 'researchArticleV2', 'ratedV2', 'recentV2', 'authorRoleV2', 'soleAuthor'])
    assert.deepEqual(missingV2Columns(gouzy), [])
    assert.deepEqual(missingV2Columns([]), [])
    const k = keyFigures(old, RUN)
    assert.equal(k.available, false)
    for (const key of ['researchByRole', 'typicalWork', 'highlyInfluential', 'mostInfluentialWork']) {
        assert.deepEqual(k[key], { shown: false, reason: REASONS.v2Unavailable })
    }
    assert.equal(k.counts.notInICite, null)
    assert.equal(k.publications.text, '17 (2012 to 2026)')
    assert.equal(k.hIndex.text, '9 (h5 4)', 'h-index needs no v3.11 column')
    assert.equal(authorshipByYear(old), null)
    assert.equal(percentileBins(old).shown, false)
    assert.deepEqual(recentWorks(old), [])
    const p = peerTable(old, [], { eligible: true })
    assert.equal(p.rows[0].cells[0].rankText, REASONS.v2Unavailable)
})

test('peer table without stored cells (table absent) shows averages and "Peer data not available yet"', () => {
    const p = peerTable(gouzy, [], { eligible: true })
    assert.equal(p.eligible, true)
    assert.equal(p.cellsAvailable, false)
    assert.equal(p.rows[0].cells[0].average.text, '83.6')
    assert.equal(p.rows[0].cells[0].rankText, REASONS.peerUnavailable)
    assert.equal(peerTable(gouzy, []).eligible, false, 'no cell rows and no override: not eligible')
})

// ---------------------------------------------------------------------------------------------
// Peer table from stored cells

test('Gouzy peer table: Any top 5 ranked, Senior row shows the recent count', () => {
    const cells = [cell('any', 5, '83.640', 244, 660, { personIdentifier: 'alg2053' })]
    const p = peerTable(gouzy, cells)
    const any = p.rows.find((r) => r.roleSet === 'any')
    assert.equal(any.ratedText, '7')
    assert.equal(any.cells[0].average.text, '83.6')
    assert.equal(any.cells[0].mismatch, false)
    assert.equal(any.cells[0].rankText, '#244 of 660 (top 37%)')
    assert.equal(any.cells[1].rankText, 'Needs 10 rated')
    const fs = p.rows.find((r) => r.roleSet === 'first_or_senior')
    assert.equal(fs.cells[0].average.text, 'Needs 5 rated')
    const senior = p.rows.find((r) => r.roleSet === 'senior')
    assert.equal(senior.ratedText, '0 (2 too recent to rate)')
    assert.equal(p.rows.find((r) => r.roleSet === 'first').ratedText, '4')
})

test('stored average that differs from the recomputed one is flagged', () => {
    const p = peerTable(gouzy, [cell('any', 5, '83.642', 244, 660)])
    assert.equal(p.rows[0].cells[0].mismatch, true)
})

test('stored cell with no average while PM computes one is a mismatch, not "Cohort too small to rank"', () => {
    const p = peerTable(gouzy, [cell('any', 5, null, null, null, { personIdentifier: 'alg2053' })])
    const c = p.rows[0].cells[0]
    assert.equal(c.average.text, '83.6')
    assert.equal(c.mismatch, true)
    assert.equal(c.rank, null)
    assert.equal(c.rankText, 'Peer data not available yet')
    // agreeing NULLs (Needs 10 rated on both sides) are not a mismatch
    const q = peerTable(gouzy, [cell('any', 10, null, null, null, { personIdentifier: 'alg2053' })])
    assert.equal(q.rows[0].cells[1].mismatch, false)
    assert.equal(q.rows[0].cells[1].rankText, 'Needs 10 rated')
})

// ---------------------------------------------------------------------------------------------
// Spec edge cases (each with a fixture)

test('edge 1: not full-time faculty -> peer section not eligible, measures still computed', () => {
    const p = peerTable(mirza, [cell('any', 5, '91.160', null, null, { cohortEligible: 0 })])
    assert.equal(p.eligible, false)
    assert.equal(keyFigures(mirza, RUN).typicalWork.shown, true)
})

test('edge 2: fewer than 5 rated -> reasons, lists still list what exists', () => {
    const works = [rated('95.00', { authorRoleV2: 'first' }), rated('50.00'), rated('20.00'), w({ publicationTypeCanonical: 'Review', citationCountNIH: 3 })]
    const k = keyFigures(works, RUN)
    assert.deepEqual(k.typicalWork, { shown: false, reason: 'Needs 5 rated' })
    assert.deepEqual(k.mostInfluentialWork, { shown: false, reason: 'Needs 5 rated' })
    assert.equal(k.highlyInfluential.text, '1 of 3')
    assert.equal(mostInfluential(works).length, 3)
    assert.equal(reviewsAndOther(works).length, 1)
})

test('edge 3: every work too recent -> nothing rated, Recent work carries the report', () => {
    const works = [
        w({ researchArticleV2: 1, recentV2: 1, provisionalNIH: 1, pctExact: '80.20', authorRoleV2: 'senior', pubDate: '2025-07-01' }),
        w({ researchArticleV2: 1, recentV2: 1, hasPercentileNIH: 0, pctExact: '0.00', authorRoleV2: 'first', pubDate: '2026-01-01' }),
        ext({ recentV2: 1, publicationTypeCanonical: 'preprint', pubDate: '2026-05-01' }),
    ]
    const k = keyFigures(works, RUN)
    assert.equal(k.counts.rated, 0)
    assert.equal(k.counts.recent, 3)
    assert.deepEqual(k.highlyInfluential, { shown: false, reason: 'No rated research articles' })
    assert.deepEqual(recentWorks(works).map((r) => r.role), ['senior', 'first', 'notSet'])
    assert.equal(unratedReason(works[0]), 'Too recent to rate', 'a provisional percentile is never printed')
})

test('edge 4: only external works -> total and Recent work only; h-index reads "No PubMed works"', () => {
    const works = [ext({ recentV2: 1 }), ext({ pubDate: '2010-01-01' })]
    const k = keyFigures(works, RUN)
    assert.equal(k.publications.text, '2 (2010 to 2026), including 0 PubMed research articles')
    assert.deepEqual(k.hIndex, { shown: false, reason: 'No PubMed works' })
    assert.deepEqual(k.researchByRole, { shown: false, reason: 'No research articles' })
    assert.equal(recentWorks(works).length, 1)
    assert.equal(roleOf(works[0]), 'notSet')
    assert.equal(isExternal(works[0]), true)
    assert.deepEqual(reviewsAndOther(works), [])
    assert.deepEqual(olderWorks(works), [])
})

test('edge 5: only pre-1980 works -> Older work only, none rated', () => {
    const works = [1975, 1978, 1979].map((y, i) => w({ researchArticleV2: 1, pubDate: `${y}-01-01`, citationCountNIH: 10 * (i + 1) }))
    const k = keyFigures(works, RUN)
    assert.equal(k.counts.rated, 0)
    assert.deepEqual(olderWorks(works).map((r) => r.work.citationCountNIH), [30, 20, 10])
    assert.equal(unratedReason(works[0]), 'Published before 1980')
    assert.deepEqual(mostInfluential(works), [])
})

test('edge 6: PubMed work with no iCite record -> unrated; counted for Methods unless recent', () => {
    const works = [
        w({ hasPercentileNIH: null, provisionalNIH: null, pctExact: null, pubDate: '2019-01-01' }),
        w({ hasPercentileNIH: null, provisionalNIH: null, pctExact: null, recentV2: 1, pubDate: '2026-02-01' }),
        rated('70.00'),
    ]
    const k = keyFigures(works, RUN)
    assert.equal(k.counts.notInICite, 1)
    assert.equal(k.counts.rated, 1)
    assert.equal(recentWorks(works).length, 1)
})

test('edge 7: sole author counts as Senior only', () => {
    const works = [rated('91.00', { authorRoleV2: 'senior', soleAuthor: 1 })]
    assert.deepEqual(keyFigures(works, RUN).researchByRole.value, { first: 0, senior: 1, middle: 0 })
    assert.equal(inRoleSet(works[0], 'first'), false)
    assert.equal(inRoleSet(works[0], 'senior'), true)
    assert.equal(inRoleSet(works[0], 'first_or_senior'), true)
})

test('edge 8: shared first / co-senior (STEP 2b) is read as written, not recomputed', () => {
    const works = [rated('60.00', { authorRoleV2: 'first' }), rated('61.00', { authorRoleV2: 'senior' })]
    assert.deepEqual(keyFigures(works, RUN).researchByRole.value, { first: 1, senior: 1, middle: 0 })
})

test('edge 9: percentile exactly 90.00 is at or above the 90th and in the last bin', () => {
    const works = [rated('90.00'), ...Array.from({ length: 19 }, () => rated('89.99'))]
    const k = keyFigures(works, RUN)
    assert.equal(k.highlyInfluential.value.k, 1)
    assert.equal(k.highlyInfluential.text, '5% (1 of 20)')
    const b = percentileBins(works)
    assert.deepEqual(b.value.counts, [0, 0, 0, 0, 0, 0, 0, 0, 19, 1])
})

test('edge 10: tied top-N averages are exactly equal and share the stored rank', () => {
    // 83.64 three ways (alg2053, lct4001, rom2043 on dev); FLOAT summation splits them, hundredths do not.
    const a = ['89.60', '89.60', '84.30', '77.40', '77.30'].map((p) => rated(p))
    const b = ['88.20', '86.60', '84.00', '80.00', '79.40'].map((p) => rated(p))
    const c = ['91.00', '85.00', '84.00', '80.10', '78.10'].map((p) => rated(p))
    const t = [a, b, c].map((x) => topNAverage(x, 'any', 5).avgThousandths)
    assert.deepEqual(t, [83640, 83640, 83640])
    assert.notEqual([89.6, 89.6, 84.3, 77.4, 77.3].reduce((x, y) => x + y) / 5, [88.2, 86.6, 84.0, 80.0, 79.4].reduce((x, y) => x + y) / 5, 'floats would split this tie')
    for (const x of [a, b, c]) assert.equal(peerTable(x, [cell('any', 5, '83.640', 244, 660)]).rows[0].cells[0].rankText, '#244 of 660 (top 37%)')
})

test('edge 11: qualifying cohort under 20 -> average shown, "Cohort too small to rank"', () => {
    const works = Array.from({ length: 10 }, (_, i) => rated(`${90 + i}.00`, { authorRoleV2: 'senior' }))
    const p = peerTable(works, [cell('senior', 10, '94.500', 1, 5), cell('senior', 5, '97.000', 3, 19), cell('any', 5, '97.000', 3, 20)])
    const senior = p.rows.find((r) => r.roleSet === 'senior')
    assert.equal(senior.cells[1].average.text, '94.5')
    assert.equal(senior.cells[1].rankText, 'Cohort too small to rank')
    assert.equal(senior.cells[0].rankText, 'Cohort too small to rank', 'M = 19')
    assert.equal(p.rows[0].cells[0].rankText, '#3 of 20 (top 15%)', 'M = 20 ranks')
})

test('edge 12: rank changed since the nightly -> header note names the rank used', () => {
    assert.equal(rankNote('Assistant Professor', 'Associate Professor', '2026-11-11'), 'Ranked as Assistant Professor, the rank held at the 2026-11-11 nightly run.')
    assert.equal(rankNote('Full Professor', 'full professor', '2026-11-11'), null)
    assert.equal(rankNote(null, 'Full Professor', '2026-11-11'), null)
    const p = peerTable(gouzy, [cell('any', 5, '83.640', 244, 660)])
    assert.equal(p.facultyRank, 'Assistant Professor')
})

test('edge 13: preprint with an accepted published version is left out of Recent work', () => {
    const pub = w({ researchArticleV2: 1, recentV2: 1, articleTitle: 'Growth of <i>M. tuberculosis</i> at acidic pH.', pubDate: '2026-03-01' })
    const pre = w({ publicationTypeCanonical: 'Preprint', recentV2: 1, articleTitle: 'Growth of M. Tuberculosis at Acidic pH', pubDate: '2025-09-01' })
    const preExt = ext({ publicationTypeCanonical: 'preprint', recentV2: 1, articleTitle: 'growth of m tuberculosis at acidic ph' })
    const lone = ext({ publicationTypeCanonical: 'preprint', recentV2: 1, articleTitle: 'Something else entirely' })
    const works = [pub, pre, preExt, lone]
    assert.equal(normalizeTitle(pub.articleTitle), 'growth of m tuberculosis at acidic ph')
    assert.deepEqual([...supersededPreprints(works)], [pre, preExt])
    assert.deepEqual(recentWorks(works).map((r) => r.work), [pub, lone])
    assert.equal(supersededPreprints(gouzy).size, 0, 'Gouzy has no published version of either preprint')
})

test('edge 14: erratum or retraction excluded everywhere', () => {
    const err = w({ pubTypeCounted: 0, publicationTypeCanonical: 'Erratum', researchArticleV2: 0, citationCountNIH: 99, recentV2: 0, pubDate: '1975-01-01' })
    const works = [err, rated('50.00', { citationCountNIH: 1 })]
    assert.equal(isCounted(err), false)
    const k = keyFigures(works, RUN)
    assert.equal(k.counts.counted, 1)
    assert.equal(k.hIndex.value.hindexNIH, 1)
    assert.deepEqual(reviewsAndOther(works), [])
    assert.deepEqual(olderWorks(works), [])
    assert.deepEqual(recentWorks([{ ...err, recentV2: 1 }]), [])
})

test('edge 15: surname with a particle or hyphen comes from faculty data as is', () => {
    assert.equal(displaySurname({ lastName: 'van der Berg' }), 'van der Berg')
    assert.equal(displaySurname({ lastName: ' Smith-Jones ' }), 'Smith-Jones')
    assert.equal(displaySurname(null), '')
})

// ---------------------------------------------------------------------------------------------
// Pieces

test('yearAxis: every year up to 25, 5-year bins aligned to multiples of 5 beyond', () => {
    assert.deepEqual(yearAxis([]).categories, [])
    assert.deepEqual(yearAxis([2001, 2003]).categories, ['2001', '2002', '2003'])
    assert.equal(yearAxis([2000, 2024]).binned, false, '25 years')
    const a = yearAxis([2000, 2025])
    assert.equal(a.binned, true, '26 years')
    assert.deepEqual(a.categories, ['2000–2004', '2005–2009', '2010–2014', '2015–2019', '2020–2024', '2025'])
    assert.equal(yearIndex(a, 2012), 2)
    assert.equal(yearIndex(a, 1999), -1)
    assert.equal(yearIndex(a, null), -1)
})

test('workYear / isoDate: pubDate first, then articleYear', () => {
    assert.equal(workYear({ pubDate: '2014-02-20', articleYear: 2013 }), 2014)
    assert.equal(workYear({ pubDate: null, articleYear: 1978 }), 1978)
    assert.equal(workYear({}), null)
    assert.equal(isoDate(new Date(Date.UTC(2020, 4, 6))), '2020-05-06')
})

test('typeTag maps canonical types; venue names collapse preprint servers and group by ISSN', () => {
    assert.equal(typeTag(w({ publicationTypeCanonical: 'Editorial Article' })), 'Editorial')
    assert.equal(typeTag(w({ publicationTypeCanonical: 'Book Chapter' })), 'Book chapter')
    assert.equal(typeTag(w({ publicationTypeCanonical: 'Case Report' })), 'Other')
    assert.equal(typeTag(rated('50.00', { publicationTypeCanonical: 'Case Report' })), 'Research article')
    assert.equal(venueName({ journalTitleVerbose: 'bioRxiv : the preprint server for biology' }), 'bioRxiv')
    assert.equal(venueName({ journalTitleVerbose: 'bioRxiv (Cold Spring Harbor Laboratory)' }), 'bioRxiv')
    assert.equal(venueName({ journalTitleVerbose: 'PLoS pathogens' }), 'PLoS pathogens')
    assert.equal(venueKey({ issn: '1553-7374', journalTitleVerbose: 'PLoS pathogens' }), venueKey({ issn: '15537374', journalTitleVerbose: 'PLOS Pathogens' }))
    assert.equal(venueKey({ journalTitleVerbose: 'bioRxiv : x' }), venueKey({ journalTitleVerbose: 'bioRxiv (Cold Spring Harbor Laboratory)' }))
})

test('mostInfluential: top 10 then marked first-or-senior top 5 not already shown', () => {
    const mids = Array.from({ length: 10 }, (_, i) => rated(`${99 - i}.00`, { authorRoleV2: 'middle' }))
    const fs = [rated('50.00', { authorRoleV2: 'first' }), rated('40.00', { authorRoleV2: 'senior' }), rated('45.00', { authorRoleV2: 'senior', relativeCitationRatioNIH: '2.00' }), rated('45.00', { authorRoleV2: 'senior', relativeCitationRatioNIH: '3.00' })]
    const rows = mostInfluential([...mids, ...fs, rated('30.00', { authorRoleV2: 'first' }), rated('10.00', { authorRoleV2: 'first' })])
    assert.equal(rows.length, 15)
    assert.equal(rows.filter((r) => r.marked).length, 5)
    assert.deepEqual(rows.slice(10).map((r) => r.work.pctExact), ['50.00', '45.00', '45.00', '40.00', '30.00'])
    assert.equal(rows[11].work.relativeCitationRatioNIH, '3.00', 'ties broken by RCR')
})
