// Unit tests for src/utils/authorIds.ts (Manage Profile "Author profiles" card, 3f).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    normalizeAuthorId, authorIdUrl, authorIdStatusLabel, authorIdEvidenceLine, parseEvidence,
    sortAuthorIds, planAuthorIdAction, reverseAction, rowUndoLabel,
} from '../src/utils/authorIds.ts'

test('normalizeAuthorId: Scopus takes digits or a profile URL', () => {
    assert.equal(normalizeAuthorId('SCOPUS_AUID', '55943287700'), '55943287700')
    assert.equal(normalizeAuthorId('SCOPUS_AUID', ' 55943287700 '), '55943287700')
    assert.equal(normalizeAuthorId('SCOPUS_AUID', 'https://www.scopus.com/authid/detail.uri?authorId=55943287700'), '55943287700')
    assert.equal(normalizeAuthorId('SCOPUS_AUID', '5594328770A'), null)
    assert.equal(normalizeAuthorId('SCOPUS_AUID', '1234'), null)
    assert.equal(normalizeAuthorId('SCOPUS_AUID', ''), null)
    assert.equal(normalizeAuthorId('SCOPUS_AUID', 55943287700), null)
})

test('normalizeAuthorId: OpenAlex takes A+digits in any case, or a URL', () => {
    assert.equal(normalizeAuthorId('OPENALEX_AUTHOR', 'A5048964197'), 'A5048964197')
    assert.equal(normalizeAuthorId('OPENALEX_AUTHOR', 'a5048964197'), 'A5048964197')
    assert.equal(normalizeAuthorId('OPENALEX_AUTHOR', 'https://openalex.org/A5048964197'), 'A5048964197')
    assert.equal(normalizeAuthorId('OPENALEX_AUTHOR', 'https://openalex.org/authors/A5048964197'), 'A5048964197')
    assert.equal(normalizeAuthorId('OPENALEX_AUTHOR', 'https://api.openalex.org/authors/A5048964197'), 'A5048964197')
    assert.equal(normalizeAuthorId('OPENALEX_AUTHOR', '5048964197'), null)
    assert.equal(normalizeAuthorId('OPENALEX_AUTHOR', 'W5048964197'), null)
    assert.equal(normalizeAuthorId('OPENALEX_AUTHOR', 'A50489x'), null)
    assert.equal(normalizeAuthorId('ORCID', '0000-0001-2345-6789'), null)
})

test('authorIdUrl', () => {
    assert.equal(authorIdUrl('SCOPUS_AUID', '123456'), 'https://www.scopus.com/authid/detail.uri?authorId=123456')
    assert.equal(authorIdUrl('OPENALEX_AUTHOR', 'A123456'), 'https://openalex.org/authors/A123456')
})

test('authorIdStatusLabel', () => {
    assert.equal(authorIdStatusLabel({ status: 'CONFIRMED', method: 'AUTO' }), 'Confirmed (auto)')
    assert.equal(authorIdStatusLabel({ status: 'CONFIRMED', method: 'CURATOR' }), 'Confirmed')
    assert.equal(authorIdStatusLabel({ status: 'SUGGESTED', method: 'PUB_VOTE' }), 'Suggested')
    assert.equal(authorIdStatusLabel({ status: 'REJECTED', method: 'CURATOR' }), 'Rejected')
})

test('authorIdEvidenceLine', () => {
    assert.equal(authorIdEvidenceLine({ votes: 27, resolvable: 29, orcidLookup: false, method: 'PUB_VOTE' }),
        'on 27 of 29 accepted papers with an author id')
    assert.equal(authorIdEvidenceLine({ votes: 1, resolvable: 1, orcidLookup: true, method: 'PUB_VOTE' }),
        'on 1 of 1 accepted paper with an author id; matches the ORCID iD')
    assert.equal(authorIdEvidenceLine({ votes: 0, resolvable: 0, orcidLookup: true, method: 'ORCID_LOOKUP' }), 'matches the ORCID iD')
    assert.equal(authorIdEvidenceLine({ votes: 0, resolvable: 0, orcidLookup: false, method: 'CURATOR' }), 'added by a curator')
    assert.equal(authorIdEvidenceLine({ votes: 0, resolvable: 0, orcidLookup: false, method: 'PUB_VOTE' }), null)
})

test('parseEvidence: text (MariaDB) or object (MySQL), bad input is empty', () => {
    const txt = '{"pmids": [39760135, 39403828], "competing": {"57195111692": 1}, "orcid_lookup": true}'
    assert.deepEqual(parseEvidence(txt), { pmids: [39760135, 39403828], competing: { '57195111692': 1 }, orcidLookup: true })
    assert.deepEqual(parseEvidence({ pmids: ['1', 2], competing: {} }), { pmids: [1, 2], competing: {}, orcidLookup: false })
    assert.deepEqual(parseEvidence(null), { pmids: [], competing: {}, orcidLookup: false })
    assert.deepEqual(parseEvidence('not json'), { pmids: [], competing: {}, orcidLookup: false })
})

test('sortAuthorIds: Scopus first, then Confirmed > Suggested > Rejected, then votes', () => {
    const rows = [
        { idType: 'OPENALEX_AUTHOR', idValue: 'A1', status: 'CONFIRMED', votes: 9 },
        { idType: 'SCOPUS_AUID', idValue: '3', status: 'REJECTED', votes: 20 },
        { idType: 'SCOPUS_AUID', idValue: '2', status: 'SUGGESTED', votes: 2 },
        { idType: 'SCOPUS_AUID', idValue: '1', status: 'SUGGESTED', votes: 5 },
        { idType: 'SCOPUS_AUID', idValue: '0', status: 'CONFIRMED', votes: 1 },
    ]
    assert.deepEqual(sortAuthorIds(rows).map((r) => r.idValue), ['0', '1', '2', '3', 'A1'])
})

const suggested = { status: 'SUGGESTED', method: 'PUB_VOTE', votes: 3, orcidLookup: false }
const autoConfirmed = { status: 'CONFIRMED', method: 'AUTO', votes: 9, orcidLookup: false }

test('planAuthorIdAction: confirm / reject write CURATOR rows the nightly will not touch', () => {
    assert.deepEqual(planAuthorIdAction('confirm', suggested, null), { kind: 'update', status: 'CONFIRMED', method: 'CURATOR', decided: true })
    assert.deepEqual(planAuthorIdAction('reject', autoConfirmed, null), { kind: 'update', status: 'REJECTED', method: 'CURATOR', decided: true })
    assert.deepEqual(planAuthorIdAction('confirm', autoConfirmed, null), { kind: 'noop' })
    assert.deepEqual(planAuthorIdAction('reject', { ...suggested, status: 'REJECTED', method: 'CURATOR' }, null), { kind: 'noop' })
    assert.equal(planAuthorIdAction('confirm', null, null).http, 404)
    assert.equal(planAuthorIdAction('reject', null, null).http, 404)
})

test('planAuthorIdAction: an id confirmed for another uid blocks confirm and add (409), not reject', () => {
    const c = planAuthorIdAction('confirm', suggested, 'abc1234')
    assert.equal(c.kind, 'error'); assert.equal(c.http, 409); assert.equal(c.conflictUid, 'abc1234')
    assert.equal(planAuthorIdAction('add', null, 'abc1234').http, 409)
    assert.equal(planAuthorIdAction('reject', suggested, 'abc1234').kind, 'update')
})

test('planAuthorIdAction: add inserts a new CONFIRMED CURATOR row, or confirms an existing one', () => {
    assert.deepEqual(planAuthorIdAction('add', null, null), { kind: 'insert', status: 'CONFIRMED', method: 'CURATOR', decided: true })
    assert.deepEqual(planAuthorIdAction('add', suggested, null), { kind: 'update', status: 'CONFIRMED', method: 'CURATOR', decided: true })
    assert.deepEqual(planAuthorIdAction('add', { ...suggested, status: 'REJECTED', method: 'CURATOR' }, null).status, 'CONFIRMED')
    assert.deepEqual(planAuthorIdAction('add', autoConfirmed, null), { kind: 'noop' })
})

test('planAuthorIdAction: undo hands a decision back to the nightly, or removes a bare curator id', () => {
    const decided = { status: 'CONFIRMED', method: 'CURATOR', votes: 4, orcidLookup: false }
    assert.deepEqual(planAuthorIdAction('undo', decided, null), { kind: 'update', status: 'SUGGESTED', method: 'PUB_VOTE', decided: false })
    assert.deepEqual(planAuthorIdAction('undo', { ...decided, status: 'REJECTED', votes: 0, orcidLookup: true }, null),
        { kind: 'update', status: 'SUGGESTED', method: 'ORCID_LOOKUP', decided: false })
    assert.deepEqual(planAuthorIdAction('undo', { ...decided, votes: 0 }, null), { kind: 'delete' })
    assert.deepEqual(planAuthorIdAction('undo', suggested, null), { kind: 'noop' })
    assert.deepEqual(planAuthorIdAction('undo', null, null), { kind: 'noop' })
    // An AUTO-confirmed row is the nightly's: undo of it (only reachable via a crafted call) returns it to Suggested.
    assert.equal(planAuthorIdAction('undo', autoConfirmed, null).status, 'SUGGESTED')
    assert.equal(planAuthorIdAction('bogus', suggested, null).http, 400)
})

test('reverseAction: the toast Undo restores the previous status', () => {
    assert.equal(reverseAction(null), 'undo')
    assert.equal(reverseAction({ status: 'SUGGESTED' }), 'undo')
    assert.equal(reverseAction({ status: 'CONFIRMED' }), 'confirm')
    assert.equal(reverseAction({ status: 'REJECTED' }), 'reject')
})

test('rowUndoLabel: only curator decisions; a bare curator id says Remove', () => {
    assert.equal(rowUndoLabel(suggested), null)
    assert.equal(rowUndoLabel(autoConfirmed), null)
    assert.equal(rowUndoLabel({ status: 'REJECTED', method: 'CURATOR', votes: 3, orcidLookup: false }), 'Undo')
    assert.equal(rowUndoLabel({ status: 'CONFIRMED', method: 'CURATOR', votes: 0, orcidLookup: true }), 'Undo')
    assert.equal(rowUndoLabel({ status: 'CONFIRMED', method: 'CURATOR', votes: 0, orcidLookup: false }), 'Remove')
})
