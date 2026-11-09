// Unit tests for src/utils/idList.ts (Curate filter's PMID / DOI list). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseIdList, matchesIdList, normalizeDoi } from '../src/utils/idList.ts'

test('parseIdList: PMIDs, DOIs and URLs, any separator', () => {
    const ids = parseIdList('33534808, https://pubmed.ncbi.nlm.nih.gov/24694772/\nhttps://doi.org/10.1093/JAMIAOPEN/ooac041;doi:10.1000/X 10.5860/crl.83.4.612.')
    assert.deepEqual([...ids.pmids], [33534808, 24694772])
    assert.deepEqual([...ids.dois], ['10.1093/jamiaopen/ooac041', '10.1000/x', '10.5860/crl.83.4.612'])
})

test('parseIdList: any non-id token means ordinary text search', () => {
    assert.equal(parseIdList('Albert 33534808'), null)
    assert.equal(parseIdList('immunology'), null)
    assert.equal(parseIdList('   '), null)
    assert.equal(parseIdList('10.1/x'), null) // registrant must be 4+ digits
})

test('matchesIdList', () => {
    const ids = parseIdList('33534808 10.1093/jamiaopen/ooac041')
    assert.ok(matchesIdList({ pmid: 33534808 }, ids))
    assert.ok(matchesIdList({ pmid: 1, doi: 'https://doi.org/10.1093/JAMIAOPEN/OOAC041' }, ids))
    assert.ok(!matchesIdList({ pmid: 2, doi: '10.1093/other' }, ids))
    assert.equal(normalizeDoi(' DOI: 10.5/ABC. '), '10.5/abc')
})
