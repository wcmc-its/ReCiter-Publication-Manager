// Unit tests for src/utils/allSources.ts (Curate's All sources tab: one row per work, status and
// source of a row) and routeAddQuery in src/utils/externalAddSearch.ts (the Add publication
// dialog's routing). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// allSources.ts imports pubTypes without an extension, as Next resolves it; let node do the same.
registerHooks({
    resolve(spec, ctx, next) {
        try { return next(spec, ctx) } catch (e) {
            if (spec.startsWith('.') && !/\.[cm]?[jt]s$/.test(spec)) return next(spec + '.ts', ctx)
            throw e
        }
    },
})
const {
    extStatusOf, extSourceOf, normDoi, groupExternalWorks, workMatches, workHasSource, countWorks,
    storeTargetOf, storeStatusText, rowHidden, workHidden, EXT_SOURCE_NAMES, EXT_SOURCES_IF_PRESENT,
} = await import('../src/utils/allSources.ts')
const { routeAddQuery } = await import('../src/utils/externalAddSearch.ts')

const row = (articleId, extra = {}) => ({ articleId, sourceType: articleId.split(':')[0], title: 'T ' + articleId, ...extra })

test('extStatusOf: today a row is Accepted unless suppressed; a status field wins', () => {
    assert.equal(extStatusOf(row('SCOPUS:1')), 'ACCEPTED')
    assert.equal(extStatusOf(row('SCOPUS:1', { suppressed: true })), 'REJECTED')
    assert.equal(extStatusOf(row('SCOPUS:1', { suppressed: false, status: 'pending' })), 'PENDING')
    assert.equal(extStatusOf(row('SCOPUS:1', { suppressed: true, status: 'bogus' })), 'REJECTED')
})

test('extSourceOf: sourceType, else the articleId prefix, else Manual', () => {
    assert.equal(extSourceOf(row('OPENALEX:W1')), 'OpenAlex')
    assert.equal(extSourceOf({ articleId: 'CROSSREF:10.1/x' }), 'Crossref')
    assert.equal(extSourceOf({ articleId: 'scopus:2-s2.0-1' }), 'Scopus')
    assert.equal(extSourceOf({ articleId: 'WOS:1', sourceType: 'WOS' }), 'Manual')
    assert.equal(extSourceOf({}), 'Manual')
})

test('normDoi: case and doi.org / doi: prefixes ignored', () => {
    assert.equal(normDoi('https://doi.org/10.1/ABC'), '10.1/abc')
    assert.equal(normDoi('doi: 10.1/abc'), '10.1/abc')
    assert.equal(normDoi(null), '')
})

test('groupExternalWorks: one work per DOI across sources, rows without a DOI stand alone', () => {
    const works = groupExternalWorks([
        row('SCOPUS:1', { doi: '10.1/ABC' }),
        row('OPENALEX:W1', { doi: 'https://doi.org/10.1/abc', authors: ['A Smith'] }),
        row('CROSSREF:10.2/x'),
        row('SCOPUS:2'),
    ])
    assert.equal(works.length, 3)
    assert.deepEqual(works[0].sources, ['Scopus', 'OpenAlex'])
    assert.equal(works[0].lead.articleId, 'OPENALEX:W1', 'prefers the row with authors')
    assert.deepEqual(works.map((w) => w.rows.length), [2, 1, 1])
})

test('groupExternalWorks: work status is Pending > Accepted > Rejected across its rows', () => {
    const [a] = groupExternalWorks([row('SCOPUS:1', { doi: '10.1/a', suppressed: true }), row('OPENALEX:W1', { doi: '10.1/a' })])
    assert.equal(a.status, 'ACCEPTED')
    assert.equal(a.lead.articleId, 'OPENALEX:W1', 'lead is a row in the work status')
    const [r] = groupExternalWorks([row('SCOPUS:1', { doi: '10.1/a', suppressed: true }), row('OPENALEX:W1', { doi: '10.1/a', suppressed: true })])
    assert.equal(r.status, 'REJECTED')
    const [p] = groupExternalWorks([row('SCOPUS:1', { doi: '10.1/a' }), row('OPENALEX:W1', { doi: '10.1/a', status: 'PENDING' })])
    assert.equal(p.status, 'PENDING')
})

test('countWorks / workHasSource / workMatches', () => {
    const works = groupExternalWorks([
        row('SCOPUS:1', { doi: '10.1/a', journal: 'Lancet' }),
        row('OPENALEX:W1', { doi: '10.1/a' }),
        row('CROSSREF:10.2/x', { suppressed: true, authors: 'B Jones, C Lee' }),
    ])
    assert.deepEqual(countWorks(works), { PENDING: 0, ACCEPTED: 1, REJECTED: 1 })
    assert.equal(workHasSource(works[0], 'OpenAlex'), true)
    assert.equal(workHasSource(works[0], 'Crossref'), false)
    assert.equal(workHasSource(works[0], 'all'), true)
    assert.equal(workMatches(works[0], 'lancet'), true)
    assert.equal(workMatches(works[0], 'w1'), true, 'matches any row id in the work')
    assert.equal(workMatches(works[1], 'jones'), true)
    assert.equal(workMatches(works[1], 'lancet'), false)
    assert.equal(workMatches(works[1], '  '), true)
})

test('routeAddQuery: a PMID always goes to PubMed', () => {
    assert.deepEqual(routeAddQuery('31234567', 'SCOPUS'), { kind: 'pubmed', query: '31234567' })
    assert.deepEqual(routeAddQuery(' PMID: 31234567 ', 'CROSSREF'), { kind: 'pubmed', query: '31234567' })
})

test('routeAddQuery: a DOI goes to the picked external source, or Scopus when PubMed is picked', () => {
    assert.deepEqual(routeAddQuery('10.1038/s41586-020-2649-2', 'PUBMED'), { kind: 'external', source: 'SCOPUS', query: '10.1038/s41586-020-2649-2' })
    assert.deepEqual(routeAddQuery('https://doi.org/10.1/x', 'OPENALEX'), { kind: 'external', source: 'OPENALEX', query: 'https://doi.org/10.1/x' })
})

test('routeAddQuery: an ISBN with PubMed picked goes to Crossref; keywords follow the pick', () => {
    assert.deepEqual(routeAddQuery('978-0-306-40615-7', 'PUBMED'), { kind: 'external', source: 'CROSSREF', query: '978-0-306-40615-7' })
    assert.deepEqual(routeAddQuery('Bales M', 'PUBMED'), { kind: 'pubmed', query: 'Bales M' })
    assert.deepEqual(routeAddQuery('nail melanoma', 'OPENALEX'), { kind: 'external', source: 'OPENALEX', query: 'nail melanoma' })
    assert.equal(routeAddQuery('   ', 'PUBMED'), null)
    assert.equal(routeAddQuery(undefined, 'PUBMED'), null)
})

test('storeTargetOf: the All sources actions as lifecycle targets (EXTERNAL_STORE=mysql)', () => {
    const all = ['PENDING', 'ACCEPTED', 'REJECTED', 'REMOVED', 'MERGED', 'AUTOMERGED', 'SUPERSEDED']
    const table = (intent) => Object.fromEntries(all.map((s) => [s, storeTargetOf(s, intent)]))
    assert.deepEqual(table('accept'), { PENDING: 'ACCEPTED', ACCEPTED: null, REJECTED: 'ACCEPTED', REMOVED: 'ACCEPTED', MERGED: null, AUTOMERGED: null, SUPERSEDED: null })
    assert.deepEqual(table('reject'), { PENDING: 'REJECTED', ACCEPTED: null, REJECTED: null, REMOVED: null, MERGED: null, AUTOMERGED: null, SUPERSEDED: null })
    assert.deepEqual(table('remove'), { PENDING: null, ACCEPTED: 'REMOVED', REJECTED: null, REMOVED: null, MERGED: null, AUTOMERGED: null, SUPERSEDED: null })
    assert.equal(storeTargetOf('accepted', 'remove'), 'REMOVED')
    assert.equal(storeTargetOf(undefined, 'accept'), null)
})

test('storeStatusText: why a store row sits in the Rejected view', () => {
    assert.equal(storeStatusText({ status: 'SUPERSEDED', supersededByPmid: 123 }), 'Superseded by PMID 123')
    assert.equal(storeStatusText({ status: 'MERGED', mergedIntoPmid: 9 }), 'Same work as PMID 9')
    assert.equal(storeStatusText({ status: 'MERGED', mergedIntoId: 4 }), 'Same work as another record')
    assert.equal(storeStatusText({ status: 'REMOVED', statusBy: 'abc1234' }), 'Removed by abc1234')
    assert.equal(storeStatusText({ status: 'REJECTED' }), 'Rejected')
    // A store row out of ACCEPTED is suppressed, so the 3a grouping already puts it in Rejected.
    assert.equal(extStatusOf({ status: 'REMOVED', suppressed: true }), 'REJECTED')
    assert.equal(extStatusOf({ status: 'SUPERSEDED', suppressed: true }), 'REJECTED')
})

// Plan 3f-3h, 3h data model (P7).

test('extSourceOf: ORCID by sourceType or articleId prefix; WOS and MANUAL stay Manual', () => {
    assert.equal(extSourceOf({ articleId: 'ORCID:12345' }), 'ORCID')
    assert.equal(extSourceOf({ articleId: 'ORCID:12345', sourceType: 'ORCID' }), 'ORCID')
    assert.equal(extSourceOf({ articleId: 'orcid:1' }), 'ORCID')
    assert.equal(extSourceOf({ articleId: 'MANUAL:abc', sourceType: 'MANUAL' }), 'Manual')
    assert.deepEqual(EXT_SOURCE_NAMES, ['Scopus', 'OpenAlex', 'Crossref', 'ORCID', 'Manual'])
    assert.deepEqual(EXT_SOURCES_IF_PRESENT, ['ORCID', 'Manual'])
})

test('extStatusOf: the 3b states that are not a live decision read as Rejected, whatever suppressed says', () => {
    for (const s of ['REMOVED', 'SUPERSEDED', 'MERGED', 'AUTOMERGED', 'automerged']) {
        assert.equal(extStatusOf({ status: s }), 'REJECTED', s)
        assert.equal(extStatusOf({ status: s, suppressed: false }), 'REJECTED', s)
    }
    assert.equal(extStatusOf({ status: 'ACCEPTED', suppressed: true }), 'ACCEPTED', 'status wins over suppressed')
    assert.equal(extStatusOf({ suppressed: false }), 'ACCEPTED', 'no status: suppressed fallback')
    assert.equal(extStatusOf({ suppressed: 1 }), 'REJECTED')
})

const rec = (id, articleId, status, extra = {}) => ({ id, articleId, sourceType: articleId.split(':')[0], status, title: 'T ' + articleId, ...extra })

test('groupExternalWorks: an AUTOMERGED row sits under its live record by mergedIntoId, even without a DOI', () => {
    const works = groupExternalWorks([
        rec(1, 'SCOPUS:1', 'PENDING'),
        rec(2, 'ORCID:9', 'AUTOMERGED', { mergedIntoId: 1, authors: ['A Smith'] }),
        rec(3, 'OPENALEX:W3', 'PENDING', { doi: '10.1/other' }),
        rec(4, 'ORCID:10', 'AUTOMERGED', { mergedIntoId: 3, doi: '10.9/different' }),
    ])
    assert.equal(works.length, 2)
    assert.deepEqual(works.map((w) => w.rows.map((r) => r.id)), [[1, 2], [3, 4]])
    assert.deepEqual(works.map((w) => w.attached.map((r) => r.id)), [[2], [4]])
    assert.equal(works[0].status, 'PENDING', 'the child does not pull the work into Rejected')
    assert.equal(works[0].lead.id, 1, 'the lead is the live row, not the child that has authors')
    assert.deepEqual(works[0].sources, ['Scopus', 'ORCID'], 'the child still lists its source')
    assert.equal(works[1].key, 'doi:10.1/other', "the work keeps its live record's key")
})

test('groupExternalWorks: merge chains follow to the root; MERGED counts as a child; a missing parent stands alone', () => {
    const works = groupExternalWorks([
        rec(1, 'SCOPUS:1', 'ACCEPTED', { doi: '10.1/a' }),
        rec(2, 'OPENALEX:W2', 'MERGED', { mergedIntoId: 1 }),
        rec(3, 'ORCID:3', 'AUTOMERGED', { mergedIntoId: 2 }),
        rec(4, 'ORCID:4', 'AUTOMERGED', { mergedIntoId: 999 }),
        rec(5, 'CROSSREF:10.5/x', 'MERGED', { mergedIntoPmid: 123 }),
    ])
    assert.deepEqual(works.map((w) => w.rows.map((r) => r.id)), [[1, 2, 3], [4], [5]])
    assert.equal(works[0].status, 'ACCEPTED')
    assert.equal(works[1].status, 'REJECTED', 'an AUTOMERGED row with no listed parent sits in Rejected')
    assert.deepEqual(works[1].attached, [])
    assert.equal(works[2].status, 'REJECTED')
    assert.equal(storeStatusText(works[2].lead), 'Same work as PMID 123')
})

test('groupExternalWorks: a mergedIntoId on a row that is not MERGED/AUTOMERGED is ignored; cycles end', () => {
    const works = groupExternalWorks([
        rec(1, 'SCOPUS:1', 'ACCEPTED', { mergedIntoId: 2 }),
        rec(2, 'SCOPUS:2', 'ACCEPTED'),
        rec(3, 'ORCID:3', 'AUTOMERGED', { mergedIntoId: 4 }),
        rec(4, 'ORCID:4', 'AUTOMERGED', { mergedIntoId: 3 }),
    ])
    assert.equal(works.length, 3)
    assert.deepEqual(works.map((w) => w.rows.length).sort(), [1, 1, 2])
    assert.equal(works.flatMap((w) => w.rows).length, 4, 'every row lands in exactly one work')
})

test('groupExternalWorks: rows without status or id (EXTERNAL_STORE=reciter) group exactly as before', () => {
    const rows = [
        { articleId: 'SCOPUS:1', sourceType: 'SCOPUS', doi: '10.1/A', mergedIntoId: 5 },
        { articleId: 'OPENALEX:W1', sourceType: 'OPENALEX', doi: '10.1/a', suppressed: true },
        { articleId: 'SCOPUS:2', sourceType: 'SCOPUS' },
    ]
    const works = groupExternalWorks(rows)
    assert.deepEqual(works.map((w) => [w.key, w.rows.length, w.status, w.attached.length]),
        [['doi:10.1/a', 2, 'ACCEPTED', 0], ['id:SCOPUS:2', 1, 'ACCEPTED', 0]])
})

test('rowHidden / workHidden: talks, posters and out-of-scope types hide; curator type, Manual or no type do not', () => {
    assert.equal(rowHidden({ articleId: 'ORCID:1', publicationType: 'conference-poster' }), true)
    assert.equal(rowHidden({ articleId: 'ORCID:1', publicationType: 'lecture-speech' }), true)
    assert.equal(rowHidden({ articleId: 'ORCID:1', publicationType: 'patent' }), true)
    assert.equal(rowHidden({ articleId: 'ORCID:1', publicationType: 'journal-article' }), false)
    assert.equal(rowHidden({ articleId: 'ORCID:1', publicationType: 'other' }), false, 'unmapped is shown for a curator to type')
    assert.equal(rowHidden({ articleId: 'ORCID:1', publicationType: 'conference-poster', pubType: 'Conference Abstract' }), false)
    assert.equal(rowHidden({ articleId: 'ORCID:1' }), false)
    assert.equal(rowHidden({ articleId: 'MANUAL:x', sourceType: 'MANUAL', publicationType: 'conference-poster' }), false)
    assert.equal(rowHidden({ articleId: 'OPENALEX:W1', publicationType: 'peer-review' }), true)
    assert.equal(rowHidden({ articleId: 'OPENALEX:W1', publicationType: 'conference-abstract' }), false)
    const [mixed, poster] = groupExternalWorks([
        rec(1, 'ORCID:1', 'PENDING', { doi: '10.1/a', publicationType: 'conference-poster' }),
        rec(2, 'OPENALEX:W2', 'PENDING', { doi: '10.1/a', publicationType: 'article' }),
        rec(3, 'ORCID:3', 'PENDING', { publicationType: 'conference-presentation' }),
        rec(4, 'SCOPUS:4', 'AUTOMERGED', { mergedIntoId: 3, publicationType: 'Article' }),
    ])
    assert.equal(workHidden(mixed), false, 'hidden only when every own row is')
    assert.equal(workHidden(poster), true, 'an attached child does not unhide its live record')
})

test('countWorks: with workHidden, hidden works leave the Pending count only', () => {
    const works = groupExternalWorks([
        rec(1, 'ORCID:1', 'PENDING', { publicationType: 'journal-article' }),
        rec(2, 'ORCID:2', 'PENDING', { publicationType: 'conference-poster' }),
        rec(3, 'ORCID:3', 'PENDING', { publicationType: 'lecture-speech' }),
        rec(4, 'SCOPUS:4', 'ACCEPTED', { publicationType: 'Erratum' }),
        rec(5, 'ORCID:5', 'REJECTED', { publicationType: 'conference-poster' }),
        rec(6, 'ORCID:6', 'AUTOMERGED', { mergedIntoId: 1, publicationType: 'journal-article' }),
    ])
    assert.deepEqual(countWorks(works), { PENDING: 3, ACCEPTED: 1, REJECTED: 1 })
    assert.deepEqual(countWorks(works, workHidden), { PENDING: 1, ACCEPTED: 1, REJECTED: 1 })
})

test('countWorks: today\'s rows (no status) count the same with or without workHidden', () => {
    const works = groupExternalWorks([
        { articleId: 'SCOPUS:1', sourceType: 'SCOPUS', publicationType: 'Erratum' },
        { articleId: 'OPENALEX:W1', sourceType: 'OPENALEX', publicationType: 'conference-abstract', suppressed: true },
        { articleId: 'CROSSREF:10.1/b', sourceType: 'CROSSREF', publicationType: 'book' },
    ])
    assert.deepEqual(countWorks(works, workHidden), countWorks(works))
    assert.deepEqual(countWorks(works), { PENDING: 0, ACCEPTED: 2, REJECTED: 1 })
})
