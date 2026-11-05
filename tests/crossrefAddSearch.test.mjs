// PM#1060 — the Add tab's read-only Crossref step (src/utils/externalAddSearch.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import { crossrefCardFrom, decideCrossrefOutcome, crossrefWorkPath } from '../src/utils/externalAddSearch.ts'

const message = {
    DOI: '10.2139/ssrn.5012345',
    title: ['A <i>new</i>  preprint'],
    'container-title': ['SSRN Electronic Journal'],
    issued: { 'date-parts': [[2026, 10, 30]] },
    author: [{ given: 'Ada', family: 'Lovelace' }, { family: 'Babbage' }, { name: 'The Consortium' }],
    type: 'posted-content',
}

test('crossrefCardFrom: maps title (tags stripped), venue, year, authors, type', () => {
    assert.deepEqual(crossrefCardFrom(message), {
        doi: '10.2139/ssrn.5012345', title: 'A new preprint', venue: 'SSRN Electronic Journal', year: 2026,
        authors: ['Ada Lovelace', 'Babbage', 'The Consortium'], type: 'posted-content',
    })
})

test('crossrefCardFrom: missing optional fields stay undefined; no DOI or title is null', () => {
    const card = crossrefCardFrom({ DOI: '10.1/x', title: ['T'] })
    assert.deepEqual(card, { doi: '10.1/x', title: 'T', venue: undefined, year: undefined, authors: [], type: undefined })
    assert.equal(crossrefCardFrom({ title: ['T'] }), null)
    assert.equal(crossrefCardFrom({ DOI: '10.1/x', title: [] }), null)
    assert.equal(crossrefCardFrom(null), null)
})

test('decideCrossrefOutcome: hit shows the card', () => {
    const card = crossrefCardFrom(message)
    assert.deepEqual(decideCrossrefOutcome({ status: 200, card }), { kind: 'card', card })
})

test('decideCrossrefOutcome: miss (404, or 200 without a record) leaves the empty state, no note', () => {
    assert.deepEqual(decideCrossrefOutcome({ status: 404 }), { kind: 'none' })
    assert.deepEqual(decideCrossrefOutcome({ status: 200, card: null }), { kind: 'none' })
})

test('decideCrossrefOutcome: 5xx / network failure / other leave the empty state with a note', () => {
    for (const status of [500, 502, 503, 0, 429]) {
        const o = decideCrossrefOutcome({ status })
        assert.equal(o.kind, 'none', `status ${status}`)
        assert.match(o.note, /could not be checked/)
    }
})

test('crossrefWorkPath: DOI is encoded but keeps its slashes', () => {
    assert.equal(crossrefWorkPath('10.1002/(SICI)1097-4636<23::AID>3.0.CO;2-#'),
        '/works/10.1002/(SICI)1097-4636%3C23%3A%3AAID%3E3.0.CO%3B2-%23')
})
