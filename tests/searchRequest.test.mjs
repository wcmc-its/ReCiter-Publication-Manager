// Unit tests for src/utils/searchRequest.ts (Find People request and the hand-off to /report).
// Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    searchTokens, newSearchRequest, matchedPersonIds, freshPubSearchFilter, reportFiltersFromSearch,
    reportHandoffCapped, REPORT_HANDOFF_CAP,
} from '../src/utils/searchRequest.ts'

// Same shape as initialStatePubSearchFilter in src/redux/reducers/reducers.js.
const initial = () => ({
    filters: {
        personIdentifers: [], personTypes: [], institutions: [], orgUnits: [],
        datePublicationAddedToEntrezLowerBound: '', datePublicationAddedToEntrezUpperBound: '',
        pubDateLowerBound: '', pubDateUpperBound: '', pubTypes: [], peerReview: [],
        publicationTypeCanonical: [], authorPosition: [], sourceTypes: [], journalTitleVerbose: [],
    },
    limit: 20,
    offset: 0,
    sort: { type: 'datePublicationAddedToEntrez', order: 'DESC' },
})

test('searchTokens: commas, spaces and new lines', () => {
    assert.deepEqual(searchTokens(' abc1234,\nxyz9999  def5678\r\n'), ['abc1234', 'xyz9999', 'def5678'])
    assert.deepEqual(searchTokens(''), [])
    assert.deepEqual(searchTokens(undefined), [])
})

test('newSearchRequest: always offset 0, whatever page was showing (bug 1)', () => {
    const filters = { nameOrUids: ['a'] }
    const req = newSearchRequest(filters, 100)
    assert.deepEqual(req, { filters: { nameOrUids: ['a'] }, limit: 100, offset: 0 })
    assert.notEqual(req.filters, filters) // a copy, not the redux object
})

test('matchedPersonIds: every matched CWID from the grouped count, deduped', () => {
    assert.deepEqual(matchedPersonIds([{ personIdentifier: 'a1', count: 1 }, { personIdentifier: 'b2', count: 2 }, { personIdentifier: 'a1', count: 1 }]), ['a1', 'b2'])
    assert.deepEqual(matchedPersonIds(undefined), [])
    assert.deepEqual(matchedPersonIds(24390), [])
    assert.deepEqual(matchedPersonIds([{ count: 1 }, null]), [])
})

test('reportFiltersFromSearch: a name search carries matched CWIDs, never the typed words (bug 2)', () => {
    const { pubSearchFilter, capped } = reportFiltersFromSearch(initial(), { nameOrUids: ['smith'] }, ['js1001', 'ms2002'])
    assert.deepEqual(pubSearchFilter.filters.personIdentifers, ['js1001', 'ms2002'])
    assert.ok(!pubSearchFilter.filters.personIdentifers.includes('smith'))
    assert.equal(capped, false)
})

test('reportFiltersFromSearch: a name search above the cap carries only the facet filters', () => {
    const ids = Array.from({ length: REPORT_HANDOFF_CAP + 1 }, (_, i) => `p${i}`)
    const { pubSearchFilter, capped } = reportFiltersFromSearch(initial(), { nameOrUids: ['a'], orgUnits: ['Medicine'] }, ids)
    assert.deepEqual(pubSearchFilter.filters.personIdentifers, [])
    assert.deepEqual(pubSearchFilter.filters.orgUnits, ['Medicine'])
    assert.equal(capped, true)
    // exactly at the cap is still carried
    const atCap = reportFiltersFromSearch(initial(), { nameOrUids: ['a'] }, ids.slice(0, REPORT_HANDOFF_CAP))
    assert.equal(atCap.pubSearchFilter.filters.personIdentifers.length, REPORT_HANDOFF_CAP)
    assert.equal(atCap.capped, false)
})

test('reportFiltersFromSearch: a CWID list carries only the CWIDs that matched, uncapped', () => {
    const pasted = ['aaa1001', 'bbb2002', 'ccc3003', 'zzz9999']
    const { pubSearchFilter } = reportFiltersFromSearch(initial(), { nameOrUids: pasted }, ['aaa1001', 'bbb2002', 'ccc3003'])
    assert.deepEqual(pubSearchFilter.filters.personIdentifers, ['aaa1001', 'bbb2002', 'ccc3003'])
    const many = Array.from({ length: 300 }, (_, i) => `c${i}`)
    const big = reportFiltersFromSearch(initial(), { nameOrUids: many }, many)
    assert.equal(big.pubSearchFilter.filters.personIdentifers.length, 300)
    assert.equal(big.capped, false)
})

test('reportFiltersFromSearch: facets only, no search text; scope and pending keys are not carried', () => {
    const { pubSearchFilter } = reportFiltersFromSearch(initial(),
        { orgUnits: ['Medicine'], institutions: ['WCM'], personTypes: ['academic'], scopePersonTypes: ['x'], showOnlyPending: true },
        ['should-not-be-used'])
    assert.deepEqual(pubSearchFilter.filters.personIdentifers, [])
    assert.deepEqual(pubSearchFilter.filters.orgUnits, ['Medicine'])
    assert.deepEqual(pubSearchFilter.filters.institutions, ['WCM'])
    assert.deepEqual(pubSearchFilter.filters.personTypes, ['academic'])
    assert.equal(pubSearchFilter.filters.scopePersonTypes, undefined)
    assert.equal(pubSearchFilter.filters.showOnlyPending, undefined)
})

test('reportFiltersFromSearch and freshPubSearchFilter never mutate the initial state (bug 3)', () => {
    const init = initial()
    const snapshot = JSON.stringify(init)
    const facets = ['Medicine']
    const { pubSearchFilter } = reportFiltersFromSearch(init, { nameOrUids: ['smith'], orgUnits: facets }, ['js1001'])
    assert.equal(JSON.stringify(init), snapshot)
    assert.notEqual(pubSearchFilter, init)
    assert.notEqual(pubSearchFilter.filters, init.filters)
    pubSearchFilter.filters.orgUnits.push('Surgery')
    assert.deepEqual(facets, ['Medicine']) // the search's array is copied too
    const fresh = freshPubSearchFilter(init)
    fresh.filters.personIdentifers.push('x')
    assert.equal(JSON.stringify(init), snapshot)
    assert.deepEqual(freshPubSearchFilter(init), init)
})

test('reportHandoffCapped: only a name search above the cap', () => {
    assert.equal(reportHandoffCapped({ nameOrUids: ['smith'] }, REPORT_HANDOFF_CAP + 1), true)
    assert.equal(reportHandoffCapped({ nameOrUids: ['smith'] }, REPORT_HANDOFF_CAP), false)
    assert.equal(reportHandoffCapped({ nameOrUids: ['a', 'b', 'c', 'd'] }, 5000), false)
    assert.equal(reportHandoffCapped({ orgUnits: ['Medicine'] }, 5000), false)
    assert.equal(reportHandoffCapped(undefined, 5000), false)
})
