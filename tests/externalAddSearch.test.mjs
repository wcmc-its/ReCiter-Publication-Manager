// Unit tests for src/utils/externalAddSearch.ts (the curate Add tab's DOI detection, Scopus ->
// OpenAlex fallback rule, and deep-link parsing). Run with `npm test` (node's built-in test
// runner; Node 22.18+ strips the TypeScript types itself, so no extra dependencies).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    normalizeDoiInput, looksLikeDoi, scopusSearchFor, decideScopusOutcome,
    enrichScopusResults, seedAddedStates, parseAddDeepLink, ADD_DEEP_LINK_PARAMS,
} from '../src/utils/externalAddSearch.ts'

test('normalizeDoiInput: bare DOI is returned as-is (case kept)', () => {
    assert.equal(normalizeDoiInput('10.1038/s41586-020-2649-2'), '10.1038/s41586-020-2649-2')
    assert.equal(normalizeDoiInput('  10.1023/A:1018877904839  '), '10.1023/A:1018877904839')
})

test('normalizeDoiInput: doi.org URL forms and doi: prefix are stripped', () => {
    assert.equal(normalizeDoiInput('https://doi.org/10.1000/xyz123'), '10.1000/xyz123')
    assert.equal(normalizeDoiInput('http://doi.org/10.1000/xyz123'), '10.1000/xyz123')
    assert.equal(normalizeDoiInput('https://dx.doi.org/10.1000/xyz123'), '10.1000/xyz123')
    assert.equal(normalizeDoiInput('HTTPS://DOI.ORG/10.1000/xyz123'), '10.1000/xyz123')
    assert.equal(normalizeDoiInput('doi:10.1000/xyz123'), '10.1000/xyz123')
    assert.equal(normalizeDoiInput('DOI: 10.1000/xyz123'), '10.1000/xyz123')
})

test('normalizeDoiInput: percent-encoded doi.org URL is decoded', () => {
    assert.equal(normalizeDoiInput('https://doi.org/10.1000%2Fxyz123'), '10.1000/xyz123')
    assert.equal(normalizeDoiInput('https://doi.org/10.1000%E0%A4%A'), null) // malformed escape
})

test('normalizeDoiInput: trailing sentence punctuation is dropped, parentheses kept', () => {
    assert.equal(normalizeDoiInput('10.1000/xyz123.'), '10.1000/xyz123')
    assert.equal(normalizeDoiInput('10.1000/xyz123;'), '10.1000/xyz123')
    assert.equal(normalizeDoiInput('10.1016/S0140-6736(20)30183-5'), '10.1016/S0140-6736(20)30183-5')
})

test('normalizeDoiInput: SICI-style DOIs are accepted', () => {
    const sici = '10.1002/(SICI)1097-4636(199706)35:3<287::AID-JBM3>3.0.CO;2-H'
    assert.equal(normalizeDoiInput(sici), sici)
})

test('normalizeDoiInput: non-DOIs are rejected', () => {
    for (const bad of [
        '', '   ', 'cancer immunotherapy', '10.1000', '10.12/abc', '11.1000/abc',
        'see 10.1000/xyz123', '10.1000/xyz 123', 'https://example.org/10.1000/xyz',
        'https://doi.org.evil.com/10.1000/xyz', 'javascript:alert(1)',
        '10.1000/"><script>alert(1)</script>', "10.1000/x'y", '10.1000/x`y', '10.1000/x\\y',
        '10.1000/x\ny', '10.1000/' + 'a'.repeat(400),
    ]) {
        assert.equal(normalizeDoiInput(bad), null, `should reject ${JSON.stringify(bad)}`)
    }
    assert.equal(normalizeDoiInput(undefined), null)
    assert.equal(normalizeDoiInput(null), null)
    assert.equal(normalizeDoiInput(['10.1000/xyz']), null)
})

test('looksLikeDoi mirrors normalizeDoiInput', () => {
    assert.equal(looksLikeDoi('10.1000/xyz123'), true)
    assert.equal(looksLikeDoi('A title about 10 things'), false)
})

test('scopusSearchFor: DOI-looking query searches by doi with the bare DOI', () => {
    assert.deepEqual(scopusSearchFor('https://doi.org/10.1000/xyz123'), { by: 'doi', term: '10.1000/xyz123' })
    assert.deepEqual(scopusSearchFor(' 10.1000/xyz123 '), { by: 'doi', term: '10.1000/xyz123' })
})

test('scopusSearchFor: anything else searches by keyword, trimmed', () => {
    assert.deepEqual(scopusSearchFor('  tumor microenvironment  '), { by: 'keyword', term: 'tumor microenvironment' })
    assert.deepEqual(scopusSearchFor('see 10.1000/xyz123'), { by: 'keyword', term: 'see 10.1000/xyz123' })
})

test('decideScopusOutcome: results stay on Scopus', () => {
    assert.deepEqual(decideScopusOutcome({ status: 200, resultCount: 3, by: 'doi' }), { kind: 'results' })
    assert.deepEqual(decideScopusOutcome({ status: 200, resultCount: 3, by: 'keyword' }), { kind: 'results' })
})

test('decideScopusOutcome: a DOI Scopus does not hold falls back to OpenAlex with a note', () => {
    const o = decideScopusOutcome({ status: 200, resultCount: 0, by: 'doi' })
    assert.equal(o.kind, 'fallback')
    assert.match(o.note, /no record of this DOI/)
})

test('decideScopusOutcome: an empty keyword search does not fall back', () => {
    assert.deepEqual(decideScopusOutcome({ status: 200, resultCount: 0, by: 'keyword' }), { kind: 'empty' })
})

test('decideScopusOutcome: 503 / 502 / other 5xx / network failure fall back, for doi and keyword alike', () => {
    for (const by of ['doi', 'keyword']) {
        const o503 = decideScopusOutcome({ status: 503, resultCount: 0, by })
        assert.equal(o503.kind, 'fallback')
        assert.match(o503.note, /not configured/)
        for (const status of [502, 500, 504, 0]) {
            const o = decideScopusOutcome({ status, resultCount: 0, by })
            assert.equal(o.kind, 'fallback', `status ${status}`)
            assert.match(o.note, /unavailable/)
        }
    }
})

test('decideScopusOutcome: other 4xx is an error, not a fallback', () => {
    for (const status of [400, 401, 403, 404]) {
        const o = decideScopusOutcome({ status, resultCount: 0, by: 'doi' })
        assert.equal(o.kind, 'error')
        assert.match(o.message, new RegExp(String(status)))
    }
})

test('enrichScopusResults: PMID-less docs pick up the record PMID; PMID-bearing docs are untouched', () => {
    const withPmid = { articleId: 'SCOPUS:1', pmid: 111, doi: '10.1/a' }
    const matched = { articleId: 'SCOPUS:2', doi: '10.1/b' }
    const unmatched = { articleId: 'SCOPUS:3', doi: '10.1/c' }
    const calls = []
    const find = (d) => { calls.push(d.articleId); return d.articleId === 'SCOPUS:2' ? 222 : null }
    const out = enrichScopusResults([withPmid, matched, unmatched], find)
    assert.equal(out[0], withPmid)
    assert.equal(out[1].pmid, 222)
    assert.equal(out[2].pmid, undefined)
    assert.deepEqual(calls, ['SCOPUS:2', 'SCOPUS:3'])
    assert.deepEqual(enrichScopusResults(undefined, find), [])
})

test('seedAddedStates: marks already-added docs, returns prev when unchanged', () => {
    const docs = [{ articleId: 'SCOPUS:1' }, { articleId: 'SCOPUS:2' }]
    const prev = { 'SCOPUS:2': { status: 'idle' } }
    const next = seedAddedStates(prev, docs, new Set(['SCOPUS:1']))
    assert.notEqual(next, prev)
    assert.deepEqual(next, { 'SCOPUS:1': { status: 'added' }, 'SCOPUS:2': { status: 'idle' } })
    assert.equal(seedAddedStates(next, docs, new Set(['SCOPUS:1'])), next)
    assert.equal(seedAddedStates(prev, docs, new Set()), prev)
    assert.equal(seedAddedStates(prev, [], new Set(['SCOPUS:1'])), prev)
})

test('parseAddDeepLink: no add param behaves as today (closed)', () => {
    assert.deepEqual(parseAddDeepLink({ id: 'abc1234' }), { open: false, invalidDoi: false, source: 'SCOPUS' })
    assert.deepEqual(parseAddDeepLink({ id: 'abc1234', doi: '10.1000/xyz' }).open, false)
    assert.equal(parseAddDeepLink({ add: 'pubmed', doi: '10.1000/xyz' }).open, false)
    assert.equal(parseAddDeepLink(undefined).open, false)
    assert.equal(parseAddDeepLink(null).open, false)
})

test('parseAddDeepLink: add=pubmed opens with a valid PMID only', () => {
    assert.deepEqual(parseAddDeepLink({ id: 'abc1234', add: 'pubmed', pmid: '41032574' }),
        { open: true, pmid: 41032574, invalidDoi: false, source: 'SCOPUS' })
    assert.equal(parseAddDeepLink({ add: 'PubMed', pmid: ' 123 ' }).pmid, 123)
    for (const pmid of [undefined, '', '0', '-5', '12a', '1234567890', '"><img src=x>']) {
        assert.equal(parseAddDeepLink({ add: 'pubmed', pmid }).open, false, String(pmid))
    }
})

test('parseAddDeepLink: add=external with a bare DOI or doi.org URL', () => {
    assert.deepEqual(parseAddDeepLink({ id: 'abc1234', add: 'external', doi: '10.1000/xyz123' }),
        { open: true, doi: '10.1000/xyz123', invalidDoi: false, source: 'SCOPUS' })
    assert.deepEqual(parseAddDeepLink({ add: 'External', doi: 'https://doi.org/10.1000/xyz123' }),
        { open: true, doi: '10.1000/xyz123', invalidDoi: false, source: 'SCOPUS' })
})

test('parseAddDeepLink: add=external without a DOI opens the tab with nothing filled', () => {
    assert.deepEqual(parseAddDeepLink({ add: 'external' }), { open: true, invalidDoi: false, source: 'SCOPUS' })
    assert.deepEqual(parseAddDeepLink({ add: 'external', doi: '' }), { open: true, invalidDoi: false, source: 'SCOPUS' })
})

test('parseAddDeepLink: an invalid DOI is flagged and never returned', () => {
    const evil = '"><img src=x onerror=alert(1)>'
    const link = parseAddDeepLink({ add: 'external', doi: evil })
    assert.deepEqual(link, { open: true, invalidDoi: true, source: 'SCOPUS' })
    assert.ok(!JSON.stringify(link).includes('onerror'))
    assert.equal(parseAddDeepLink({ add: 'external', doi: 'https://example.com/10.1000/x' }).invalidDoi, true)
})

test('parseAddDeepLink: source=openalex selects OpenAlex; anything else is Scopus', () => {
    assert.equal(parseAddDeepLink({ add: 'external', doi: '10.1000/x', source: 'openalex' }).source, 'OPENALEX')
    assert.equal(parseAddDeepLink({ add: 'external', doi: '10.1000/x', source: 'OpenAlex' }).source, 'OPENALEX')
    assert.equal(parseAddDeepLink({ add: 'external', doi: '10.1000/x', source: 'scopus' }).source, 'SCOPUS')
    assert.equal(parseAddDeepLink({ add: 'external', doi: '10.1000/x', source: 'wos' }).source, 'SCOPUS')
})

test('parseAddDeepLink: repeated params use the first value', () => {
    assert.deepEqual(parseAddDeepLink({ add: ['external', 'x'], doi: ['10.1000/a', '10.1000/b'], source: ['openalex'] }),
        { open: true, doi: '10.1000/a', invalidDoi: false, source: 'OPENALEX' })
})

test('ADD_DEEP_LINK_PARAMS lists exactly the params the curate page strips', () => {
    assert.deepEqual(ADD_DEEP_LINK_PARAMS, ['add', 'doi', 'source', 'pmid'])
})
