// Unit tests for the 5h bibliometric metrics (controllers/db/reports/bibliometrics.ts): h/h5 with
// reciterdb's STEP 6 rule, the year axis and its 30-year collapse, type and position matrices,
// percentile bins, the RTF's lists and the 5/10 peer thresholds. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    hIndex, hIndexes, resolveHIndexes, minusYears, isoDate, isExternal, isCounted,
    workYear, yearAxis, yearIndex, typeByYear, typeBreakdown, groupOf,
    positionOf, positionsByYear, positionCounts, percentileBins,
    mostCited, mostInfluential, recentArticles, olderArticles, daysSinceAdded,
    journals, summaryStats, summaryProse, median, round1, peerComparison, peerIntro,
} from '../controllers/db/reports/bibliometrics.ts'

let nextPmid = 1000
const w = (o = {}) => ({ pmid: nextPmid++, sourceType: 'PUBMED', ...o })
const ext = (o = {}) => ({ pmid: -(nextPmid++), sourceType: 'SCOPUS', ...o })

test('hIndex: empty, zeros, all equal, ties, unsorted', () => {
    assert.equal(hIndex([]), 0)
    assert.equal(hIndex([0, 0, null, undefined, -3]), 0)
    assert.equal(hIndex([1]), 1)
    assert.equal(hIndex([5, 5, 5, 5, 5]), 5)
    assert.equal(hIndex([3, 3, 3, 3, 3]), 3)
    assert.equal(hIndex([10, 8, 5, 4, 3]), 4)
    assert.equal(hIndex([3, 0, 6, 1, 5]), 3)
    assert.equal(hIndex([100]), 1)
    assert.equal(hIndex([4, 4, 4, 4]), 4)
    assert.equal(hIndex(['7', '7', 2]), 2, 'numeric strings from the driver count')
})

test('minusYears matches MySQL DATE_SUB(INTERVAL n YEAR), including Feb 29', () => {
    assert.equal(minusYears('2026-11-11', 5), '2021-11-11')
    assert.equal(minusYears('2028-02-29', 5), '2023-02-28')
    assert.equal(minusYears('2028-02-29', 4), '2024-02-29')
    assert.throws(() => minusYears('11/11/2026', 5))
})

test('isoDate: Date objects (mysql2) and strings (sequelize)', () => {
    assert.equal(isoDate(new Date(Date.UTC(2020, 4, 6))), '2020-05-06')
    assert.equal(isoDate('2020-05-06 00:00:00'), '2020-05-06')
    assert.equal(isoDate(''), '')
    assert.equal(isoDate(null), '')
    assert.equal(isoDate(new Date('x')), '')
})

test('hIndexes: external rows and pmid < 0 never count; uncounted PubMed rows still do (STEP 6)', () => {
    const works = [
        w({ citationCountNIH: 10, citationCountScopus: 12, datePublicationAddedToEntrez: '2024-01-01' }),
        w({ citationCountNIH: 9, citationCountScopus: 1, datePublicationAddedToEntrez: '2019-01-01' }),
        w({ citationCountNIH: 2, citationCountScopus: 30, datePublicationAddedToEntrez: '2025-06-01', pubTypeCounted: 0 }),
        ext({ citationCountNIH: 50, citationCountScopus: 50, datePublicationAddedToEntrez: '2025-01-01' }),
        { pmid: -5, sourceType: null, citationCountNIH: 40, citationCountScopus: 40 },
        { pmid: 7, sourceType: 'OPENALEX', citationCountNIH: 40, citationCountScopus: 40 },
    ]
    assert.deepEqual(hIndexes(works, '2026-11-11'), { hindexNIH: 2, h5indexNIH: 2, hindexScopus: 2, h5indexScopus: 2 })
})

test('hIndexes: h5 window is strictly after asOf - 5 years and skips empty dates', () => {
    const works = [
        w({ citationCountNIH: 5, datePublicationAddedToEntrez: '2021-11-11' }), // on the cutoff: out
        w({ citationCountNIH: 5, datePublicationAddedToEntrez: '2021-11-12' }), // in
        w({ citationCountNIH: 5, datePublicationAddedToEntrez: '' }), // out
        w({ citationCountNIH: 5, datePublicationAddedToEntrez: null }), // out
        w({ citationCountNIH: 5, datePublicationAddedToEntrez: '2026-01-01' }), // in
    ]
    const h = hIndexes(works, '2026-11-11')
    assert.equal(h.hindexNIH, 5)
    assert.equal(h.h5indexNIH, 2)
    assert.equal(h.hindexScopus, 0)
})

test('resolveHIndexes: stored wins, NULL stored means 0; computed when no person row', () => {
    const computed = { hindexNIH: 9, h5indexNIH: 4, hindexScopus: 10, h5indexScopus: 5 }
    assert.deepEqual(resolveHIndexes(null, computed), { ...computed, source: 'computed' })
    assert.deepEqual(resolveHIndexes({ hindexNIH: 8, h5indexNIH: null, hindexScopus: 11, h5indexScopus: 5 }, computed),
        { hindexNIH: 8, h5indexNIH: 0, hindexScopus: 11, h5indexScopus: 5, source: 'stored' })
})

test('isExternal / isCounted', () => {
    assert.equal(isExternal({ pmid: 123 }), false)
    assert.equal(isExternal({ pmid: 123, sourceType: 'PUBMED' }), false)
    assert.equal(isExternal({ pmid: -2, sourceType: 'OPENALEX' }), true)
    assert.equal(isExternal({ pmid: -1 }), true)
    assert.equal(isCounted({ pmid: 1 }), true, 'pre-v3.7: no column, counts')
    assert.equal(isCounted({ pmid: 1, pubTypeCounted: null }), true)
    assert.equal(isCounted({ pmid: 1, pubTypeCounted: 1 }), true)
    assert.equal(isCounted({ pmid: 1, pubTypeCounted: 0 }), false)
    assert.equal(isCounted({ pmid: 1, pubTypeCounted: '0' }), false)
})

test('workYear: pubDate (Date or string) first, else articleYear', () => {
    assert.equal(workYear({ pmid: 1, pubDate: new Date(Date.UTC(2019, 0, 1)), articleYear: 2018 }), 2019)
    assert.equal(workYear({ pmid: 1, pubDate: '2017-03-04', articleYear: 2018 }), 2017)
    assert.equal(workYear({ pmid: 1, articleYear: 2018 }), 2018)
    assert.equal(workYear({ pmid: 1, articleYear: 0 }), null)
    assert.equal(workYear({ pmid: 1 }), null)
})

test('yearAxis: zero-filled to the current year, no collapse at exactly 30 years', () => {
    const a = yearAxis([2020, 2022], 2026)
    assert.deepEqual(a.categories, ['2020', '2021', '2022', '2023', '2024', '2025', '2026'])
    assert.equal(a.collapsed, false)
    assert.equal(yearIndex(a, 2022), 2)
    assert.equal(yearIndex(a, 2019), -1)
    assert.equal(yearIndex(a, null), -1)
    const thirty = yearAxis([1997], 2026)
    assert.equal(thirty.categories.length, 30)
    assert.equal(thirty.collapsed, false)
    assert.deepEqual(yearAxis([], 2026).categories, [])
    assert.equal(yearAxis([2027], 2026).end, 2027, 'a future pubDate extends the axis')
})

test('yearAxis: more than 30 years collapses into "Before YYYY" (31 categories)', () => {
    const a = yearAxis([1975, 2000, null], 2026)
    assert.equal(a.collapsed, true)
    assert.equal(a.categories.length, 31)
    assert.equal(a.categories[0], 'Before 1997')
    assert.equal(a.categories[1], '1997')
    assert.equal(a.categories[30], '2026')
    assert.equal(yearIndex(a, 1975), 0)
    assert.equal(yearIndex(a, 1996), 0)
    assert.equal(yearIndex(a, 1997), 1)
    assert.equal(yearIndex(a, 2026), 30)
})

test('groupOf: v3.7 group, NULL group is other, canonical fallback only when the column is absent', () => {
    assert.equal(groupOf({ pmid: 1, pubTypeGroup: 'book' }), 'book')
    assert.equal(groupOf({ pmid: 1, pubTypeGroup: null, publicationTypeCanonical: 'Academic Article' }), 'other')
    assert.equal(groupOf({ pmid: 1, publicationTypeCanonical: 'Academic Article' }), 'journal')
    assert.equal(groupOf({ pmid: 1, publicationTypeCanonical: 'Book Chapter' }), 'book')
    assert.equal(groupOf({ pmid: 1, publicationTypeCanonical: 'Erratum' }), 'other')
})

test('typeByYear + typeBreakdown: uncounted rows dropped, undated tallied, peer-review split', () => {
    const works = [
        w({ articleYear: 2024, pubTypeGroup: 'journal', pubType: 'Academic Article', peerReviewed: 1 }),
        w({ articleYear: 2024, pubTypeGroup: 'journal', pubType: 'Letter', peerReviewed: 0 }),
        w({ articleYear: 2025, pubTypeGroup: 'book', pubType: 'Book Chapter', peerReviewed: 0 }),
        w({ articleYear: 2025, pubTypeGroup: null, pubType: null, publicationTypeCanonical: 'Erratum', pubTypeCounted: 0 }),
        w({ articleYear: 2025, pubTypeGroup: null, pubType: null, publicationTypeCanonical: 'Note', pubTypeCounted: 1 }),
        ext({ pubDate: '2026-02-01', pubTypeGroup: 'other', pubType: 'Preprint', peerReviewed: 0 }),
        w({ pubTypeGroup: 'journal', pubType: 'Review', peerReviewed: 1 }),
    ]
    const axis = yearAxis(works.map(workYear), 2026)
    const m = typeByYear(works, axis)
    assert.deepEqual(m.categories, ['2024', '2025', '2026'])
    assert.deepEqual(m.series.map((s) => s.key), ['journal', 'conf', 'book', 'other'])
    assert.deepEqual(m.series.find((s) => s.key === 'journal').values, [2, 0, 0])
    assert.deepEqual(m.series.find((s) => s.key === 'book').values, [0, 1, 0])
    assert.deepEqual(m.series.find((s) => s.key === 'other').values, [0, 1, 1])
    assert.deepEqual(m.totals, [2, 2, 1])
    assert.equal(m.undated, 1)

    const rows = typeBreakdown(works, true)
    assert.deepEqual(rows.map((r) => [r.group, r.pubType, r.peerReviewed, r.notPeerReviewed, r.total]), [
        ['journal', 'Academic Article', 1, 0, 1],
        ['journal', 'Letter', 0, 1, 1],
        ['journal', 'Review', 1, 0, 1],
        ['book', 'Book Chapter', 0, 1, 1],
        ['other', 'Note', 0, 1, 1],
        ['other', 'Preprint', 0, 1, 1],
    ])
    const noPr = typeBreakdown(works, false)
    assert.ok(noPr.every((r) => r.peerReviewed === 0 && r.notPeerReviewed === 0))
    assert.equal(noPr.reduce((t, r) => t + r.total, 0), 6)
})

test('positions: NULL on PubMed is middle, NULL on external is "not set" (own series only when present)', () => {
    assert.equal(positionOf(w({ authorPosition: null })), 'middle')
    assert.equal(positionOf(w({ authorPosition: 'FIRST' })), 'first')
    assert.equal(positionOf(ext({ authorPosition: null })), 'notSet')
    assert.equal(positionOf(ext({ authorPosition: 'last' })), 'last')

    const pubmedOnly = [w({ articleYear: 2025, authorPosition: 'first' }), w({ articleYear: 2026 })]
    const a1 = yearAxis(pubmedOnly.map(workYear), 2026)
    assert.deepEqual(positionsByYear(pubmedOnly, a1).series.map((s) => s.key), ['first', 'middle', 'last'])

    const mixed = [...pubmedOnly, ext({ articleYear: 2026 }), w({ articleYear: 2026, authorPosition: 'last', pubTypeCounted: 0 })]
    const m = positionsByYear(mixed, a1)
    assert.deepEqual(m.series.map((s) => s.key), ['first', 'middle', 'last', 'notSet'])
    assert.deepEqual(m.series.find((s) => s.key === 'notSet').values, [0, 1])
    assert.deepEqual(m.series.find((s) => s.key === 'last').values, [0, 0], 'uncounted row dropped')
    assert.deepEqual(positionCounts(mixed), { first: 1, middle: 1, last: 0, notSet: 1 })
})

test('percentileBins: research articles with a percentile, 100 in the top bin, externals skipped', () => {
    const ra = (p) => w({ publicationTypeNIH: 'Research Article', percentileNIH: p })
    const works = [ra(0), ra(9.99), ra(10), ra(50), ra(89.9), ra(90), ra(100), ra(null),
        w({ publicationTypeNIH: 'Other', percentileNIH: 70 }),
        ext({ publicationTypeNIH: 'Research Article', percentileNIH: 95 })]
    const b = percentileBins(works)
    assert.equal(b.labels.length, 10)
    assert.deepEqual(b.counts, [2, 1, 0, 0, 0, 1, 0, 0, 1, 2])
    assert.equal(b.total, 7)
})

test('mostCited: PubMed only, citations desc, RCR breaks ties, capped', () => {
    const a = w({ citationCountNIH: 50, relativeCitationRatioNIH: 1 })
    const b = w({ citationCountNIH: 50, relativeCitationRatioNIH: 3 })
    const c = w({ citationCountNIH: 80, relativeCitationRatioNIH: null })
    const zero = w({ citationCountNIH: 0 })
    const e = ext({ citationCountNIH: 999 })
    const errata = w({ citationCountNIH: 500, pubTypeCounted: 0 })
    assert.deepEqual(mostCited([a, b, c, zero, e, errata]).map((x) => x.pmid), [c.pmid, b.pmid, a.pmid])
    assert.equal(mostCited([a, b, c], 2).length, 2)
})

test('mostInfluential: percentile desc then RCR, NULL percentile last; first/last filter', () => {
    const ra = (o) => w({ publicationTypeNIH: 'Research Article', ...o })
    const p1 = ra({ percentileNIH: 95, relativeCitationRatioNIH: 2, authorPosition: 'first' })
    const p2 = ra({ percentileNIH: 95, relativeCitationRatioNIH: 4, authorPosition: null })
    const p3 = ra({ percentileNIH: 99, relativeCitationRatioNIH: 1, authorPosition: 'last' })
    const p4 = ra({ percentileNIH: null, relativeCitationRatioNIH: 9, authorPosition: 'last' })
    const notRa = w({ publicationTypeNIH: 'Other', percentileNIH: 100 })
    const all = [p1, p2, p3, p4, notRa]
    assert.deepEqual(mostInfluential(all).map((x) => x.pmid), [p3.pmid, p2.pmid, p1.pmid, p4.pmid])
    assert.deepEqual(mostInfluential(all, { firstOrLast: true }).map((x) => x.pmid), [p3.pmid, p1.pmid, p4.pmid])
    assert.equal(mostInfluential(all, { n: 1 }).length, 1)
})

test('recentArticles: 730-day window, no percentile (NULL or 0), last/first first', () => {
    const ra = (o) => w({ publicationTypeNIH: 'Research Article', ...o })
    const asOf = '2026-11-11'
    const r1 = ra({ datePublicationAddedToEntrez: '2026-01-01', percentileNIH: null, authorPosition: null })
    const r2 = ra({ datePublicationAddedToEntrez: '2025-06-01', percentileNIH: 0, authorPosition: 'last' })
    const r3 = ra({ datePublicationAddedToEntrez: '2025-06-01', percentileNIH: 0, authorPosition: 'first' })
    const old = ra({ datePublicationAddedToEntrez: '2024-11-11', percentileNIH: null }) // 730 days: out
    const has = ra({ datePublicationAddedToEntrez: '2026-01-01', percentileNIH: 40 })
    assert.equal(daysSinceAdded(old, asOf), 730)
    assert.deepEqual(recentArticles([r1, r2, r3, old, has], asOf).map((x) => x.pmid), [r2.pmid, r3.pmid, r1.pmid])
})

test('olderArticles: before 1980, no percentile, by position then citations', () => {
    const ra = (o) => w({ publicationTypeNIH: 'Research Article', percentileNIH: null, ...o })
    const o1 = ra({ articleYear: 1975, citationCountNIH: 10 })
    const o2 = ra({ articleYear: 1978, citationCountNIH: 30 })
    const o3 = ra({ articleYear: 1979, authorPosition: 'first', citationCountNIH: 1 })
    const late = ra({ articleYear: 1980 })
    const pct = ra({ articleYear: 1975, percentileNIH: 50 })
    assert.deepEqual(olderArticles([o1, o2, o3, late, pct]).map((x) => x.pmid), [o3.pmid, o2.pmid, o1.pmid])
})

test('journals: case-insensitive grouping, publisher fallback, newest SJR, top N', () => {
    const works = [
        w({ journalTitleVerbose: 'Cell', articleYear: 2010, journalImpactScore1: 20 }),
        w({ journalTitleVerbose: 'cell', articleYear: 2020, journalImpactScore1: 25 }),
        w({ journalTitleVerbose: 'Cell', articleYear: 2015, journalImpactScore1: null }),
        w({ journalTitleVerbose: '', publisher: 'Springer', articleYear: 2021 }),
        w({ journalTitleVerbose: 'Nature', articleYear: 2019, journalImpactScore1: 30, pubTypeCounted: 0 }),
        w({ journalTitleVerbose: null, publisher: null }),
    ]
    assert.deepEqual(journals(works), [
        { title: 'Cell', count: 3, firstYear: 2010, lastYear: 2020, sjr: 25 },
        { title: 'Springer', count: 1, firstYear: 2021, lastYear: 2021, sjr: null },
    ])
    assert.equal(journals(works, 1).length, 1)
})

test('summaryStats: counts, external by source, citations PubMed-only, RCR and top-10% share', () => {
    const ra = (o) => w({ publicationTypeNIH: 'Research Article', ...o })
    const works = [
        ra({ articleYear: 2001, authorPosition: 'first', citationCountNIH: 10, percentileNIH: 95, relativeCitationRatioNIH: 3, peerReviewed: 1 }),
        ra({ articleYear: 2010, authorPosition: 'last', citationCountNIH: 5, percentileNIH: 50, relativeCitationRatioNIH: 1, peerReviewed: 1 }),
        ra({ articleYear: 2012, citationCountNIH: 2, percentileNIH: null, peerReviewed: 1 }),
        w({ articleYear: 2013, citationCountNIH: 100, pubTypeCounted: 0 }),
        ext({ sourceType: 'OPENALEX', pubDate: '2024-03-01', citationCountNIH: 77, peerReviewed: 0 }),
        ext({ sourceType: 'SCOPUS', articleYear: 2020, peerReviewed: 1 }),
    ]
    const s = summaryStats(works, { hasPeerReviewed: true })
    assert.equal(s.counted, 5)
    assert.equal(s.pubmed, 3)
    assert.equal(s.external, 2)
    assert.deepEqual(s.externalBySource, { OPENALEX: 1, SCOPUS: 1 })
    assert.equal(s.firstYear, 2001)
    assert.equal(s.lastYear, 2024)
    assert.equal(s.peerReviewed, 4)
    assert.deepEqual(s.positions, { first: 1, middle: 1, last: 1, notSet: 2 })
    assert.equal(s.totalCitationsNIH, 17)
    assert.equal(s.researchWithPercentile, 2)
    assert.equal(s.medianRCR, 2)
    assert.equal(s.meanRCR, 2)
    assert.equal(s.shareTop10, 0.5)
    assert.equal(summaryStats(works, { hasPeerReviewed: false }).peerReviewed, null)
    assert.equal(median([3, 1, 2]), 2)
    assert.equal(median([]), null)

    const h = { hindexNIH: 2, h5indexNIH: 0, hindexScopus: 0, h5indexScopus: 0 }
    const prose = summaryProse('Jane Doe', s, h)
    assert.match(prose, /^Jane Doe has 5 accepted publications between 2001 and 2024: 3 indexed in PubMed and 2 from other sources\./)
    assert.match(prose, /1 is first-authored and 1 last-authored\./)
    assert.match(prose, /17 citations in NIH iCite, for an h-index of 2 \(h5-index 0\)\./)
    assert.match(prose, /Of 2 research articles with an NIH percentile, 50% are at the 90th percentile or above\./)
    assert.doesNotMatch(prose, /undefined|NaN/)
    assert.equal(summaryProse('X', summaryStats([], { hasPeerReviewed: false }), h), 'X has no accepted publications in ReCiter.')
})

test('round1 mirrors MySQL concat(round(x,1)) on FLOAT columns', () => {
    assert.equal(round1(85), '85.0')
    assert.equal(round1(85.04), '85.0')
    assert.equal(round1(29.95), '30.0')
    assert.equal(round1(85.05000001), '85.1')
    assert.equal(round1(null), 'N/A')
    // values read back from FLOAT(7,3), with MySQL's output on dev (2026-11-11)
    assert.equal(round1(99.95), '99.9')
    assert.equal(round1(99.05), '99.1')
    assert.equal(round1(96.15), '96.2')
    assert.equal(round1(25.65), '25.6')
    assert.equal(round1(8.15), '8.1')
    assert.equal(round1(87.25), '87.2', 'exact half: to even')
    assert.equal(round1(87.75), '87.8', 'exact half: to even')
    assert.equal(round1(42.35), '42.3', 'float 42.3499...')
})

const person = (o) => ({
    nameLast: 'Doe', facultyRank: 'Full',
    top5PercentileFirstSenior: 91.23, top10PercentileFirstSenior: 85.0, top5DenominatorFirstSenior: 300, top10DenominatorFirstSenior: 250, top5RankFirstSenior: 12, top10RankFirstSenior: 40,
    top5PercentileSenior: 90, top10PercentileSenior: 80, top5DenominatorSenior: 280, top10DenominatorSenior: 200, top5RankSenior: 15, top10RankSenior: 60,
    top5PercentileFirst: 70, top10PercentileFirst: 60, top5DenominatorFirst: 260, top10DenominatorFirst: 150, top5RankFirst: 100, top10RankFirst: 90,
    top5PercentileAll: 95.55, top10PercentileAll: 92.1, top5DenominatorAll: 380, top10DenominatorAll: 370, top5RankAll: 5, top10RankAll: 7,
    ...o,
})

test('peerComparison: >= 10 gives top 5 and top 10, >= 5 top 5 only, < 5 the fallback sentence', () => {
    const b = peerComparison(person({ countAll: 40, countFirst: 4, countSenior: 6 }))
    assert.deepEqual(b.map((x) => x.key), ['FirstSenior', 'Senior', 'First', 'All'])
    assert.deepEqual(b.map((x) => x.label), ['First or senior', 'Senior', 'First', 'Any position'])
    // first + senior = 10 -> both
    assert.equal(b[0].text, 'The five and ten most influential first- or senior-authored research articles have an average NIH percentile of 91.2 and 85.0, respectively (higher is better). '
        + 'There are 300 WCM-employed full-time faculty at the full level with five or more first- or senior-authored research articles, and 250 who have written ten or more. '
        + "Within these groups, Doe's percentiles rank at #12 and #40, respectively (lower is better).")
    // senior = 6 -> top 5 only
    assert.equal(b[1].text, 'The five most influential senior-authored research articles have an average NIH percentile of 90.0 (higher is better). '
        + 'There are 280 WCM-employed full-time faculty at the full level with five or more senior-authored research articles. '
        + 'Within this group, this percentile ranks at #15 (lower is better).')
    // first = 4 -> fallback
    assert.equal(b[2].text, 'Doe has fewer than five first-authored research articles, so the average NIH percentile is not provided.')
    // any position = 40: "most influential research articles", denominators say "authored research articles"
    assert.match(b[3].text, /^The five and ten most influential research articles have an average NIH percentile of 95\.6 and 92\.1/)
    assert.match(b[3].text, /with five or more authored research articles, and 370 who have written ten or more/)
    for (const x of b) assert.doesNotMatch(x.text, /undefined|NaN|null/)
})

test('peerComparison: exact thresholds 5 and 9, the any-position fallback, and the intro', () => {
    const at5 = peerComparison(person({ countAll: 5, countFirst: 5, countSenior: 0 }))
    assert.match(at5[0].text, /^The five most influential first- or senior-authored/)
    assert.equal(at5[1].text, 'Doe has fewer than five senior-authored research articles, so the average NIH percentile is not provided.')
    assert.match(at5[2].text, /^The five most influential first-authored/)
    assert.match(at5[3].text, /^The five most influential research articles/)
    const at9 = peerComparison(person({ countAll: 9, countFirst: 9, countSenior: 0 }))
    assert.match(at9[3].text, /^The five most influential/)
    const few = peerComparison(person({ countAll: 4, countFirst: 1, countSenior: 1 }))
    assert.equal(few[3].text, 'Individual has fewer than five research articles, so the average NIH percentile is not provided.')
    assert.equal(few[0].text, 'Doe has fewer than five first- or senior-authored research articles, so the average NIH percentile is not provided.')
    assert.match(peerIntro(person({ countAll: 40, countFirst: 4, countSenior: 6 })),
        /^For the purpose of this analysis, Doe has authored 40 research articles appearing in PubMed, 4 of which were written as a first author and 6 as a senior author\./)
})
