// Unit tests for src/utils/allSources.ts (Curate's All sources tab: one row per work, status and
// source of a row) and routeAddQuery in src/utils/externalAddSearch.ts (the Add publication
// dialog's routing). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    extStatusOf, extSourceOf, normDoi, groupExternalWorks, workMatches, workHasSource, countWorks,
} from '../src/utils/allSources.ts'
import { routeAddQuery } from '../src/utils/externalAddSearch.ts'

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
