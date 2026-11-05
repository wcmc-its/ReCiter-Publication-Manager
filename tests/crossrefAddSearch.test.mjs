// PM#1060 — Crossref as an Add-tab source (src/utils/externalAddSearch.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    crossrefExternalArticleFrom, crossrefPubDate, decideCrossrefOutcome, crossrefWorkPath, MAX_EXTERNAL_ARTICLE_ID_LENGTH,
} from '../src/utils/externalAddSearch.ts'

const message = {
    DOI: '10.1016/J.SURG.2026.110815',
    title: ['A <i>new</i>  study'],
    'container-title': ['Surgery'],
    issued: { 'date-parts': [[2026, 10, 3]] },
    author: [{ given: 'Ada', family: 'Lovelace' }, { family: 'Babbage' }, { name: 'The Consortium' }],
    type: 'journal-article',
    abstract: '<jats:p>Background</jats:p>',
    reference: [{ key: 'r1' }],
}

test('crossrefExternalArticleFrom: maps a work to the external-article POST body', () => {
    const row = crossrefExternalArticleFrom(message)
    const { rawRecord, ...rest } = row
    assert.deepEqual(rest, {
        articleId: 'CROSSREF:10.1016/j.surg.2026.110815',
        title: 'A new study',
        doi: '10.1016/J.SURG.2026.110815',
        journalOrVenue: 'Surgery',
        authors: ['Ada Lovelace', 'Babbage', 'The Consortium'],
        pubDate: '2026-10-03',
        publicationType: 'journal-article',
        sourceType: 'CROSSREF',
        method: 'dropdown-search',
    })
    const raw = JSON.parse(rawRecord)
    assert.equal(raw.DOI, message.DOI)
    assert.equal(raw.reference, undefined, 'reference list is dropped from rawRecord')
})

test('crossrefExternalArticleFrom: no DOI or title is null; optional fields stay undefined', () => {
    assert.equal(crossrefExternalArticleFrom({ title: ['T'] }), null)
    assert.equal(crossrefExternalArticleFrom({ DOI: '10.1/x', title: [] }), null)
    assert.equal(crossrefExternalArticleFrom(null), null)
    const row = crossrefExternalArticleFrom({ DOI: '10.1/x', title: 'T' })
    assert.equal(row.journalOrVenue, undefined)
    assert.equal(row.pubDate, undefined)
    assert.equal(row.publicationType, undefined)
    assert.deepEqual(row.authors, [])
    assert.equal(row.notAddable, undefined)
})

test('crossrefExternalArticleFrom: an id over 96 chars is marked not addable; exactly 96 is fine', () => {
    const prefix = '10.1000/'
    const fits = prefix + 'a'.repeat(MAX_EXTERNAL_ARTICLE_ID_LENGTH - 'CROSSREF:'.length - prefix.length)
    const ok = crossrefExternalArticleFrom({ DOI: fits, title: ['T'] })
    assert.equal(ok.articleId.length, 96)
    assert.equal(ok.notAddable, undefined)
    const long = crossrefExternalArticleFrom({ DOI: fits + 'b', title: ['T'] })
    assert.equal(long.articleId.length, 97)
    assert.match(long.notAddable, /too long.*97 characters.*96/)
})

test('crossrefPubDate: YYYY-MM-DD, YYYY-MM or YYYY from date-parts', () => {
    assert.equal(crossrefPubDate([[2026, 10, 30]]), '2026-10-30')
    assert.equal(crossrefPubDate([[2026, 1]]), '2026-01')
    assert.equal(crossrefPubDate([[2026]]), '2026')
    assert.equal(crossrefPubDate([[null]]), undefined)
    assert.equal(crossrefPubDate(undefined), undefined)
})

test('decideCrossrefOutcome: hits replace the empty OpenAlex results, with a note', () => {
    assert.deepEqual(decideCrossrefOutcome({ status: 200, resultCount: 1 }),
        { kind: 'results', note: 'OpenAlex has no record of this DOI, so Crossref was searched instead.' })
})

test('decideCrossrefOutcome: no rows leaves the empty state, no note', () => {
    assert.deepEqual(decideCrossrefOutcome({ status: 200, resultCount: 0 }), { kind: 'none' })
})

test('decideCrossrefOutcome: 5xx / network failure / other leave the empty state with a note', () => {
    for (const status of [500, 502, 503, 0, 429, 400]) {
        const o = decideCrossrefOutcome({ status, resultCount: 0 })
        assert.equal(o.kind, 'none', `status ${status}`)
        assert.match(o.note, /could not be checked/)
    }
})

test('crossrefWorkPath: DOI is encoded but keeps its slashes', () => {
    assert.equal(crossrefWorkPath('10.1002/(SICI)1097-4636<23::AID>3.0.CO;2-#'),
        '/works/10.1002/(SICI)1097-4636%3C23%3A%3AAID%3E3.0.CO%3B2-%23')
})
