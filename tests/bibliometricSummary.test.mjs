// Unit tests for the bibliometric report v2 summary (controllers/db/reports/bibliometricSummary.ts):
// templates S1-S7, the phrase tables, the headline-cell order and the writing rules. The three
// reference people are the P1 dev row fixtures (stale January 2026 iCite; NOT prod acceptance
// values, which the plan's Steps A and B freeze later). Peer ranks are stored-cell inputs taken from
// the plan's dev table. No database. `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
    keyFigures, peerTable, ratedAtHighest, recentSeniorYears, displaySurname,
} from '../controllers/db/reports/bibliometrics.ts'
import {
    buildSummary, summaryText, ratioPhrase, multiplePhrase, numberWord, startNumber, times, pctWords,
    rankPlural, listYears, headlineCell, possessive, HEADLINE_ORDER, ROLE_SET_PHRASE,
} from '../controllers/db/reports/bibliometricSummary.ts'

const FIX = JSON.parse(readFileSync(new URL('./fixtures/bibliometrics-v2-dev-2026-11-11.json', import.meta.url), 'utf8'))
const RUN = FIX.runDate

// ISO abbreviations from dev person_article.journalTitleISOabbreviation (read-only, 2026-11-12);
// the controller's works query (P4) selects that column.
const ISO = {
    24586151: 'PLoS Pathog', 34341117: 'Proc Natl Acad Sci U S A', 24077180: 'Nat Chem Biol',
    35459278: 'Nat Commun', 32127458: 'mBio', 34818059: 'Sci Transl Med', 24957090: 'Future Microbiol',
}
const gouzy = FIX.people.alg2053.map((x) => (ISO[x.pmid] ? { ...x, journalTitleISOabbreviation: ISO[x.pmid] } : x))
const nathan = FIX.people.cnathan
const mirza = FIX.people.aah2003

const ROLE_SETS = ['any', 'first_or_senior', 'first', 'senior']
const cell = (roleSet, topN, avgTop, cohortRank = null, cohortM = null, o = {}) => ({
    personIdentifier: 'x', facultyRank: 'Assistant Professor', cohortEligible: 1, roleSet, topN, ratedCount: 0, recentCount: 0,
    avgTop, cohortRank, cohortM, runDate: RUN, ...o,
})
/** All 8 cells, as STEP 5v2 writes them; `set` overrides by "roleSet:N". */
const cells8 = (set = {}, o = {}) => ROLE_SETS.flatMap((rs) => [5, 10].map((n) => {
    const v = set[`${rs}:${n}`] ?? [null, null, null]
    return cell(rs, n, ...v, o)
}))

const summarize = (works, cells, o = {}) => buildSummary({
    surname: o.surname ?? 'Doe',
    key: keyFigures(works, RUN),
    peer: peerTable(works, cells, { eligible: o.eligible }),
    atHighest: ratedAtHighest(works),
    recentSeniorYears: recentSeniorYears(works),
})
const sentences = (s) => s.paragraphs.flat().map((x) => x.text)

// Synthetic rows (same shape as tests/bibliometrics.test.mjs).
let nextPmid = 60000000
const V2 = { provisionalNIH: 0, hasPercentileNIH: 1, pctExact: null, researchArticleV2: 0, ratedV2: 0, recentV2: 0, authorRoleV2: 'middle', soleAuthor: 0 }
const w = (o = {}) => ({ pmid: nextPmid++, sourceType: 'PUBMED', pubTypeCounted: 1, publicationTypeCanonical: 'Academic Article', pubDate: '2015-06-01', citationCountNIH: 10, relativeCitationRatioNIH: '1.00', datePublicationAddedToEntrez: '2015-06-02', journalTitleVerbose: 'Journal of Tests', ...V2, ...o })
const rated = (pct, o = {}) => w({ researchArticleV2: 1, ratedV2: 1, pctExact: pct, ...o })
const ext = (o = {}) => ({ pmid: -(nextPmid++), sourceType: 'OPENALEX', pubTypeCounted: 1, publicationTypeCanonical: 'Academic Article', pubDate: '2026-01-01', ...V2, hasPercentileNIH: null, provisionalNIH: null, authorRoleV2: 'not_set', ...o })
/** n rated research articles at `pct` with `role` and RCR `rcr`. */
const many = (n, pct, o = {}) => Array.from({ length: n }, () => rated(pct, o))

// ---------------------------------------------------------------------------------------------
// Words and phrase tables

test('numberWord, startNumber, times', () => {
    assert.deepEqual([0, 1, 13, 20, 28, 40, 99, 100, 105, 342, 1000, 2026].map(numberWord), [
        'zero', 'one', 'thirteen', 'twenty', 'twenty-eight', 'forty', 'ninety-nine', 'one hundred', 'one hundred five',
        'three hundred forty-two', 'one thousand', 'two thousand twenty-six',
    ])
    assert.equal(numberWord(10000), '10000')
    assert.equal(startNumber(28), 'Twenty-eight')
    assert.equal(times(2), 'twice')
    assert.equal(times(3), 'three times')
    assert.equal(times(10), 'ten times')
})

test('ratio phrase: every band edge on the exact median (medianX2 = 2 x hundredths)', () => {
    const m = (x) => Math.round(x * 200)
    assert.equal(ratioPhrase(m(0.79)), 'less often than')
    assert.equal(ratioPhrase(m(0.795)), 'less often than', 'the unrounded median decides, not its display')
    assert.equal(ratioPhrase(m(0.8)), 'about as often as')
    assert.equal(ratioPhrase(m(0.995)), 'about as often as', 'Mirza')
    assert.equal(ratioPhrase(m(1.245)), 'about as often as')
    assert.equal(ratioPhrase(m(1.25)), 'about 1.5 times as often as')
    assert.equal(ratioPhrase(m(1.745)), 'about 1.5 times as often as')
    assert.equal(ratioPhrase(m(1.75)), 'about twice as often as')
    assert.equal(ratioPhrase(m(2.035)), 'about twice as often as', 'Nathan')
    assert.equal(ratioPhrase(m(2.21)), 'about twice as often as', 'Gouzy')
    assert.equal(ratioPhrase(m(2.495)), 'about twice as often as')
    assert.equal(ratioPhrase(m(2.5)), 'about three times as often as', 'round(2.5) half-up')
    assert.equal(ratioPhrase(m(3.495)), 'about three times as often as')
    assert.equal(ratioPhrase(m(3.5)), 'about four times as often as')
    assert.equal(ratioPhrase(m(12.4)), 'about twelve times as often as')
})

test('multiple phrase: every band edge on the exact share (r = 10k/n)', () => {
    assert.equal(multiplePhrase(1, 20), 'below', 'r 0.5')
    assert.equal(multiplePhrase(3, 38), 'below', 'r 0.789')
    assert.equal(multiplePhrase(2, 25), 'in line with', 'r 0.8 exactly')
    assert.equal(multiplePhrase(4, 33), 'in line with', 'r 1.212 (Mirza under the pct-only rule)')
    assert.equal(multiplePhrase(4, 32), 'about 1.5 times', 'r 1.25 exactly: Mirza under the final rule')
    assert.equal(multiplePhrase(7, 40), 'nearly twice', 'r 1.75 exactly: X = 2, r < X')
    assert.equal(multiplePhrase(1, 5), 'about twice', 'r 2 exactly')
    assert.equal(multiplePhrase(11, 50), 'more than twice', 'r 2.2')
    assert.equal(multiplePhrase(1, 4), 'nearly three times', 'r 2.5 rounds half-up to 3')
    assert.equal(multiplePhrase(86, 302), 'nearly three times', 'Nathan, r 2.848')
    assert.equal(multiplePhrase(87, 309), 'nearly three times', 'spec example, r 2.816')
    assert.equal(multiplePhrase(3, 10), 'about three times')
    assert.equal(multiplePhrase(32, 100), 'more than three times')
    assert.equal(multiplePhrase(20, 20), 'about ten times', 'every article at or above the 90th')
})

test('pctWords: half-up to 1 decimal, never "90.0" below the 90th', () => {
    assert.equal(pctWords(8960), '89.6')
    assert.equal(pctWords(8500), '85.0')
    assert.equal(pctWords(8994), '89.9')
    assert.equal(pctWords(8995), '89.95')
    assert.equal(pctWords(8996), '89.96')
    assert.equal(pctWords(9000), '90.0')
    assert.equal(pctWords(6105), '61.1')
    assert.equal(pctWords(0), '0.0')
})

test('rankPlural, listYears, possessive', () => {
    assert.equal(rankPlural('Assistant Professor'), 'assistant professors')
    assert.equal(rankPlural('Associate Professor'), 'associate professors')
    assert.equal(rankPlural('Full Professor'), 'full professors')
    assert.equal(rankPlural('Instructor or Lecturer'), 'instructors and lecturers')
    assert.equal(rankPlural('academic-faculty-fullprofessor'), 'full professors')
    assert.equal(rankPlural('Visiting Scholar'), 'faculty at the rank of Visiting Scholar')
    assert.equal(rankPlural(null), 'faculty at the same rank')
    assert.equal(listYears([2025]), '2025')
    assert.equal(listYears([2025, 2024]), '2024 and 2025')
    assert.equal(listYears([2025, 2022, 2024, 2025]), '2022, 2024 and 2025')
    assert.equal(possessive('Jones'), "Jones's")
})

test('headline cell order: FS10, FS5, Any10, Any5; skips unranked, small and mismatched cells', () => {
    assert.deepEqual(HEADLINE_ORDER, [['first_or_senior', 10], ['first_or_senior', 5], ['any', 10], ['any', 5]])
    assert.equal(ROLE_SET_PHRASE.any, '')
    const works = [...many(10, '80.00', { authorRoleV2: 'first' }), ...many(10, '70.00')]
    const all = { 'any:5': ['80.000', 4, 100], 'any:10': ['80.000', 5, 100], 'first_or_senior:5': ['80.000', 6, 100], 'first_or_senior:10': ['80.000', 7, 100] }
    const pick = (set) => { const h = headlineCell(peerTable(works, cells8(set))); return h && [h.roleSet, h.cell.topN, h.cell.rank.R] }
    assert.deepEqual(pick(all), ['first_or_senior', 10, 7])
    assert.deepEqual(pick({ ...all, 'first_or_senior:10': ['80.000', 7, 19] }), ['first_or_senior', 5, 6], 'M 19 is not rankable')
    assert.deepEqual(pick({ ...all, 'first_or_senior:10': ['80.000', null, null], 'first_or_senior:5': ['80.100', 6, 100] }), ['any', 10, 5], 'a mismatched cell is skipped')
    assert.deepEqual(pick({ 'any:5': ['80.000', 4, 100] }), ['any', 5, 4])
    assert.equal(pick({}), null)
    assert.equal(headlineCell(peerTable(works, cells8(all, { cohortEligible: 0 }))), null, 'not eligible')
})

// ---------------------------------------------------------------------------------------------
// Reference people (dev fixtures)

const GOUZY_CELLS = cells8({ 'any:5': ['83.640', 244, 660] }, { personIdentifier: 'alg2053' })

test('Gouzy (alg2053, dev): S1, S2c, S3 (Any top 5), S4, S5 with the spec wording', () => {
    const s = summarize(gouzy, GOUZY_CELLS, { surname: displaySurname({ lastName: 'Gouzy' }) })
    assert.equal(s.available, true)
    assert.deepEqual(s.fired, ['S1', 'S2c', 'S3', 'S4', 'S5'])
    assert.deepEqual(s.paragraphs.map((p) => p.map((x) => x.id)), [['S1'], ['S2c', 'S2c', 'S3'], ['S4', 'S4', 'S5']])
    assert.equal(summaryText(s), [
        "Gouzy's typical research article is cited about twice as often as a typical NIH R01-funded paper of the same field and year. Across 7 rated research articles, the median Relative Citation Ratio is 2.21.",
        "Gouzy's most influential work sits just below the 90th NIH percentile. Two first-authored articles, in PLoS Pathog (2014) and Proc Natl Acad Sci U S A (2021), are both at the 89.6th. Among 660 WCM assistant professors with 5 or more rated research articles, Gouzy's 5 most influential rank #244, in the top 37%.",
        'Gouzy is first author on 4 rated research articles. With fewer than 5 rated first- or senior-authored articles, rankings by author role are not shown yet. Gouzy is senior author on 2 research articles from 2024 and 2025, which are too recent to rate.',
    ].join('\n\n'))
    const s2c = s.paragraphs[1][1]
    assert.deepEqual(s2c.runs.filter((r) => r.italic).map((r) => r.text), ['PLoS Pathog', 'Proc Natl Acad Sci U S A'], 'journal names italic')
    const text = summaryText(s)
    for (const v1 of ['73.7', '85.2', '62.2']) assert.ok(!text.includes(v1), `v1 value ${v1} must not appear`)
})

test('Gouzy on fresh iCite (prod: 34341117 at 91.40): S2b singular replaces S2c; S5 holds', () => {
    const fresh = gouzy.map((x) => (x.pmid === 34341117 ? { ...x, pctExact: '91.40' } : x))
    const s = summarize(fresh, cells8({ 'any:5': ['84.000', 200, 660] }), { surname: 'Gouzy' })
    assert.deepEqual(s.fired, ['S1', 'S2b', 'S3', 'S4', 'S5'])
    assert.equal(s.paragraphs[1][0].text, "One of Gouzy's 7 rated research articles is at or above the 90th NIH percentile.")
    assert.ok(!summaryText(s).includes('89.6th'))
})

test('Gouzy without ISO abbreviations: S2c falls back to the venue name', () => {
    const s = summarize(FIX.people.alg2053, GOUZY_CELLS, { surname: 'Gouzy' })
    assert.equal(s.paragraphs[1][1].text, 'Two first-authored articles, in PLoS pathogens (2014) and Proceedings of the National Academy of Sciences of the United States of America (2021), are both at the 89.6th.')
})

// Ranks are the plan's dev values for cnathan; averages equal the recomputed ones (no mismatch).
const NATHAN_CELLS = cells8({
    'any:5': ['99.920', 13, 378], 'any:10': ['99.810', 8, 369],
    'first_or_senior:5': ['99.900', 3, 364], 'first_or_senior:10': ['99.740', 3, 336],
    'first:5': ['98.700', 40, 300], 'first:10': ['95.610', 60, 250],
    'senior:5': ['99.860', 3, 331], 'senior:10': ['99.670', 2, 279],
}, { personIdentifier: 'cnathan', facultyRank: 'Full Professor' })

test('Nathan (cnathan, dev): S1, S2a, S3 (first or senior, top 10)', () => {
    const s = summarize(nathan, NATHAN_CELLS, { surname: 'Nathan' })
    assert.deepEqual(s.fired, ['S1', 'S2a', 'S3'])
    assert.equal(summaryText(s), [
        "Nathan's typical research article is cited about twice as often as a typical NIH R01-funded paper of the same field and year. Across 302 rated research articles, the median Relative Citation Ratio is 2.04.",
        "Twenty-eight percent of Nathan's 302 rated research articles are at or above the 90th NIH percentile, nearly three times the 10% expected. Among 336 WCM full professors with 10 or more rated first- or senior-authored research articles, Nathan's 10 most influential rank #3, in the top 1%.",
    ].join('\n\n'))
})

test('Mirza (aah2003, dev, courtesy instructor): S1, S2a, S7; no peer rank', () => {
    const s = summarize(mirza, cells8({ 'any:5': ['91.160', null, null] }, { personIdentifier: 'aah2003', facultyRank: 'Instructor or Lecturer', cohortEligible: 0 }), { surname: 'Mirza' })
    assert.deepEqual(s.fired, ['S1', 'S2a', 'S7'])
    assert.equal(summaryText(s), [
        "Mirza's typical research article is cited about as often as a typical NIH R01-funded paper of the same field and year. Across 32 rated research articles, the median Relative Citation Ratio is 1.00.",
        "Thirteen percent of Mirza's 32 rated research articles are at or above the 90th NIH percentile, about 1.5 times the 10% expected.",
        'Peer comparison covers WCM-employed full-time faculty with a faculty rank, so it is not shown.',
    ].join('\n\n'))
    assert.ok(!/#\d/.test(summaryText(s)), 'no peer rank')
})

test('writing rules: no pronouns for people, no evaluative adjectives, S7 last', () => {
    const all = [
        summarize(gouzy, GOUZY_CELLS, { surname: 'Gouzy' }),
        summarize(nathan, NATHAN_CELLS, { surname: 'Nathan' }),
        summarize(mirza, [], { surname: 'Mirza' }),
        summarize([rated('50.00')], [], { surname: 'Doe', eligible: true }),
    ]
    for (const s of all) {
        const t = summaryText(s)
        assert.ok(!/\b(he|she|his|her|hers|him|himself|herself)\b/i.test(t), t)
        assert.ok(!/\b(strong|excellent|modest|outstanding|impressive|weak|poor|exceptional)\b/i.test(t), t)
        const ids = s.paragraphs.flat().map((x) => x.id)
        if (ids.includes('S7')) assert.equal(ids.at(-1), 'S7')
    }
})

test('v3.11 columns missing: no sentence is written', () => {
    const old = gouzy.map(({ researchArticleV2, ratedV2, recentV2, authorRoleV2, soleAuthor, provisionalNIH, hasPercentileNIH, pctExact, ...rest }) => rest)
    assert.deepEqual(summarize(old, [], { eligible: true }), { available: false, fired: [], paragraphs: [] })
})

// ---------------------------------------------------------------------------------------------
// Templates one by one

test('S2a: 20 or more rated; starts with the share spelled out', () => {
    const s = summarize([...many(4, '95.00'), ...many(16, '50.00')], [], { eligible: false })
    assert.equal(s.paragraphs[1][0].text, "Twenty percent of Doe's 20 rated research articles are at or above the 90th NIH percentile, about twice the 10% expected.")
})

test('S2b: under 20 rated; k = 1 singular, k > 1 plural, n = 1', () => {
    assert.equal(sentences(summarize([rated('91.00'), ...many(5, '50.00')], [], { eligible: false }))[1], "One of Doe's 6 rated research articles is at or above the 90th NIH percentile.")
    assert.equal(sentences(summarize([...many(3, '91.00'), ...many(5, '50.00')], [], { eligible: false }))[1], "Three of Doe's 8 rated research articles are at or above the 90th NIH percentile.")
    assert.equal(sentences(summarize([rated('91.00')], [], { eligible: false }))[1], "Doe's 1 rated research article is at or above the 90th NIH percentile.")
})

test('S2c: one article, two with different roles, three or more at the highest value', () => {
    const one = [rated('88.00', { authorRoleV2: 'senior', journalTitleISOabbreviation: 'Cell', pubDate: '2019-03-01' }), ...many(5, '50.00')]
    assert.deepEqual(sentences(summarize(one, [], { eligible: false })).slice(1, 3), [
        "Doe's most influential work sits just below the 90th NIH percentile.",
        'A senior-authored article, in Cell (2019), is at the 88.0th.',
    ])
    const two = [
        rated('86.50', { authorRoleV2: 'first', journalTitleISOabbreviation: 'Nature', pubDate: '2018-01-01', relativeCitationRatioNIH: '3.00' }),
        rated('86.50', { authorRoleV2: 'middle', journalTitleISOabbreviation: 'Science', pubDate: '2020-01-01', relativeCitationRatioNIH: '2.00' }),
        ...many(5, '50.00'),
    ]
    assert.equal(sentences(summarize(two, [], { eligible: false }))[2], 'A first-authored article in Nature (2018) and a middle-authored article in Science (2020) are both at the 86.5th.')
    const three = [...two, rated('86.50', { authorRoleV2: 'senior', journalTitleISOabbreviation: 'Lancet', relativeCitationRatioNIH: '1.00' })]
    assert.equal(sentences(summarize(three, [], { eligible: false }))[2], 'Three rated research articles are at the 86.5th, among them a first-authored article in Nature (2018) and a middle-authored article in Science (2020).')
})

test('S2c threshold is 85.00 on the exact value; 89.96 never prints as 90.0', () => {
    const at85 = summarize([rated('85.00'), ...many(5, '10.00')], [], { eligible: false })
    assert.ok(at85.fired.includes('S2c'))
    const below = summarize([rated('84.99'), ...many(5, '10.00')], [], { eligible: false })
    assert.deepEqual(below.fired, ['S1', 'S2d', 'S7'])
    assert.equal(sentences(below)[1], "None of Doe's 6 rated research articles reaches the 90th NIH percentile; the highest is at the 85.0th.")
    const edge = summarize([rated('89.96', { journalTitleISOabbreviation: 'Cell', pubDate: '2019-01-01' }), ...many(5, '10.00')], [], { eligible: false })
    assert.equal(sentences(edge)[2], 'A middle-authored article, in Cell (2019), is at the 89.96th.')
})

test('S2d: n = 1 reads naturally; no S2 without rated articles', () => {
    assert.equal(sentences(summarize([rated('40.00')], [], { eligible: false }))[1], "Doe's 1 rated research article is below the 90th NIH percentile, at the 40.0th.")
    assert.ok(!summarize([w()], [], { eligible: false }).fired.some((id) => id.startsWith('S2')))
})

test('S3: "top X%" only when X <= 50; otherwise "#R" alone', () => {
    const works = many(5, '70.00')
    const at = (R, M) => sentences(summarize(works, cells8({ 'any:5': ['70.000', R, M] }), { eligible: true })).find((t) => t.startsWith('Among'))
    assert.equal(at(50, 100), "Among 100 WCM assistant professors with 5 or more rated research articles, Doe's 5 most influential rank #50, in the top 50%.")
    assert.equal(at(51, 100), "Among 100 WCM assistant professors with 5 or more rated research articles, Doe's 5 most influential rank #51.")
    assert.equal(at(1, 20), "Among 20 WCM assistant professors with 5 or more rated research articles, Doe's 5 most influential rank #1, in the top 5%.")
})

test('S4: zero parts dropped, both parts, none; S5 singular', () => {
    const fs = (f, s, o = {}) => [...many(f, '60.00', { authorRoleV2: 'first' }), ...many(s, '60.00', { authorRoleV2: 'senior' }), ...many(6, '50.00'), ...(o.recent ?? [])]
    const p3 = (works) => summarize(works, [], { eligible: true }).paragraphs.find((p) => p[0].id === 'S4').map((x) => x.text)
    assert.equal(p3(fs(0, 3))[0], 'Doe is senior author on 3 rated research articles.')
    assert.equal(p3(fs(2, 1))[0], 'Doe is first author on 2 and senior author on 1 rated research article.')
    assert.equal(p3(fs(0, 0))[0], 'Doe is not first or senior author on any rated research article.')
    const recent = [w({ researchArticleV2: 1, recentV2: 1, provisionalNIH: 1, authorRoleV2: 'senior', pubDate: '2026-02-01' })]
    assert.equal(p3(fs(1, 0, { recent }))[2], 'Doe is senior author on 1 research article from 2026, which is too recent to rate.')
    assert.ok(!summarize(fs(3, 2), [], { eligible: true }).fired.includes('S4'), '5 first or senior: no S4')
    assert.ok(!summarize(fs(3, 2, { recent }), [], { eligible: true }).fired.includes('S5'), 'S5 only with S4')
})

test('S6: fewer than 5 rated; n = 0 and n = 1', () => {
    assert.equal(sentences(summarize(many(3, '50.00'), [], { eligible: false }))[0], 'Doe has 3 rated research articles, too few for the measures in this report. They are listed below.')
    assert.equal(sentences(summarize([rated('50.00')], [], { eligible: false }))[0], 'Doe has 1 rated research article, too few for the measures in this report. It is listed below.')
    assert.equal(sentences(summarize([w()], [], { eligible: false }))[0], 'Doe has no rated research articles, too few for the measures in this report.')
})

// ---------------------------------------------------------------------------------------------
// Spec edge cases that reach the summary

test('edge 1: not full-time faculty -> S7 last, no S3, S4 or S5', () => {
    const works = [...many(3, '60.00', { authorRoleV2: 'first' }), ...many(5, '50.00')]
    const s = summarize(works, cells8({ 'any:5': ['56.000', 1, 100] }, { cohortEligible: 0 }))
    assert.deepEqual(s.fired, ['S1', 'S2d', 'S7'])
})

test('edge 2: fewer than 5 rated -> S6 replaces S1', () => {
    const s = summarize([rated('95.00', { authorRoleV2: 'first' }), rated('50.00'), rated('20.00')], cells8({}), { eligible: true })
    assert.deepEqual(s.fired, ['S6', 'S2b', 'S4'])
    assert.equal(sentences(s)[0], 'Doe has 3 rated research articles, too few for the measures in this report. They are listed below.')
})

test('edge 3: every work too recent (new appointee) -> S6, then S4 and S5', () => {
    const works = [
        w({ researchArticleV2: 1, recentV2: 1, provisionalNIH: 1, pctExact: '80.20', authorRoleV2: 'senior', pubDate: '2025-07-01' }),
        w({ researchArticleV2: 1, recentV2: 1, hasPercentileNIH: 0, pctExact: '0.00', authorRoleV2: 'first', pubDate: '2026-01-01' }),
    ]
    const s = summarize(works, [], { eligible: true })
    assert.deepEqual(s.fired, ['S6', 'S4', 'S5'])
    assert.equal(sentences(s)[0], 'Doe has no rated research articles, too few for the measures in this report.')
    assert.equal(sentences(s).at(-1), 'Doe is senior author on 1 research article from 2025, which is too recent to rate.')
})

test('edge 4 and 5: only external or only pre-1980 works -> S6 only (plus S7)', () => {
    assert.deepEqual(summarize([ext({ recentV2: 1 }), ext()], [], { eligible: false }).fired, ['S6', 'S7'])
    const old = [1975, 1979].map((y) => w({ researchArticleV2: 1, pubDate: `${y}-01-01` }))
    assert.deepEqual(summarize(old, [], { eligible: false }).fired, ['S6', 'S7'])
})

test('edge 7: sole author counts as Senior in S4', () => {
    const works = [rated('91.00', { authorRoleV2: 'senior', soleAuthor: 1 }), ...many(5, '40.00')]
    assert.equal(sentences(summarize(works, [], { eligible: true })).find((t) => t.includes('author on')), 'Doe is senior author on 1 rated research article.')
})

test('edge 9: percentile exactly 90.00 counts at the 90th (S2a, not S2c)', () => {
    const s = summarize([rated('90.00'), ...many(19, '89.99')], [], { eligible: false })
    assert.deepEqual(s.fired, ['S1', 'S2a', 'S7'])
    assert.equal(sentences(s)[1], "Five percent of Doe's 20 rated research articles are at or above the 90th NIH percentile, below the 10% expected.")
})

test('edge 10: tied top-N averages share the stored rank in S3', () => {
    const a = ['89.60', '89.60', '84.30', '77.40', '77.30'].map((p) => rated(p))
    const b = ['88.20', '86.60', '84.00', '80.00', '79.40'].map((p) => rated(p))
    const texts = [a, b].map((x) => sentences(summarize(x, cells8({ 'any:5': ['83.640', 244, 660] }))).find((t) => t.startsWith('Among')))
    assert.equal(texts[0], texts[1])
    assert.ok(texts[0].endsWith('rank #244, in the top 37%.'))
})

test('edge 11: qualifying cohort under 20 -> no S3 from that cell; next cell or none', () => {
    const works = many(10, '80.00', { authorRoleV2: 'senior' })
    const small = cells8({ 'first_or_senior:10': ['80.000', 1, 5], 'first_or_senior:5': ['80.000', 1, 19], 'any:10': ['80.000', 2, 20] })
    const t = sentences(summarize(works, small)).find((x) => x.startsWith('Among'))
    assert.equal(t, "Among 20 WCM assistant professors with 10 or more rated research articles, Doe's 10 most influential rank #2, in the top 10%.")
    const none = cells8({ 'first_or_senior:10': ['80.000', 1, 5], 'any:5': ['80.000', 1, 19] })
    assert.ok(!summarize(works, none).fired.includes('S3'))
})

test('edge 12: rank changed since the nightly -> S3 names the rank stored with the cells', () => {
    const works = many(5, '70.00')
    const t = sentences(summarize(works, cells8({ 'any:5': ['70.000', 10, 120] }, { facultyRank: 'Associate Professor' }))).find((x) => x.startsWith('Among'))
    assert.ok(t.startsWith('Among 120 WCM associate professors'))
})

test('edge 15: surname with a particle or hyphen is used as stored; capitalized only to start a sentence', () => {
    const works = [...many(5, '70.00'), ...many(2, '60.00', { authorRoleV2: 'first' })]
    const s = summarize(works, cells8({ 'any:5': ['70.000', 10, 120] }), { surname: displaySurname({ lastName: 'van der Berg' }) })
    const t = sentences(s)
    assert.ok(t[0].startsWith("Van der Berg's typical research article"))
    assert.ok(t.find((x) => x.startsWith('Among')).includes(", van der Berg's 5 most influential rank #10"))
    assert.equal(t.find((x) => x.includes('author on')), 'Van der Berg is first author on 2 rated research articles.')
    const h = summarize(works, [], { surname: displaySurname({ lastName: ' Smith-Jones ' }), eligible: false })
    assert.ok(sentences(h)[0].startsWith("Smith-Jones's typical"))
})

test('summary inputs: ratedAtHighest best first with ISO venue; recentSeniorYears sorted', () => {
    assert.deepEqual(ratedAtHighest(gouzy), [
        { pmid: 24586151, role: 'first', venue: 'PLoS Pathog', year: 2014, pct: 8960 },
        { pmid: 34341117, role: 'first', venue: 'Proc Natl Acad Sci U S A', year: 2021, pct: 8960 },
    ], 'tie at 89.60 ordered by RCR (3.88, then 3.86)')
    assert.deepEqual(ratedAtHighest([]), [])
    assert.deepEqual(ratedAtHighest([w()]), [], 'unrated rows are not candidates')
    assert.deepEqual(recentSeniorYears(gouzy), [2024, 2025])
})

test('S2c without a venue: year only, no dangling commas', () => {
    const one = [rated('88.00', { authorRoleV2: 'first', journalTitleVerbose: null, pubDate: '2019-03-01' }), ...many(5, '50.00')]
    assert.equal(sentences(summarize(one, [], { eligible: false }))[2], 'A first-authored article (2019) is at the 88.0th.')
    const two = [
        rated('88.00', { authorRoleV2: 'first', journalTitleVerbose: null, relativeCitationRatioNIH: '2.00' }),
        rated('88.00', { authorRoleV2: 'first', journalTitleISOabbreviation: 'Cell', relativeCitationRatioNIH: '1.00' }),
        ...many(5, '50.00'),
    ]
    assert.equal(sentences(summarize(two, [], { eligible: false }))[2], 'Two first-authored articles are both at the 88.0th.')
})
