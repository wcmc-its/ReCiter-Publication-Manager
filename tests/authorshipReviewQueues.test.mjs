// Unit tests for the PR 6 helpers in src/utils/authorshipRow.ts: identity-conflict rows and the
// in-card empty state. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { conflictIdentities, conflictKeep, emptyState } from '../src/utils/authorshipRow.ts'

test('conflictIdentities lists the proposed identity, then each person who accepted it', () => {
    const ids = conflictIdentities({
        top_cwid: 'paa2013', top_name: 'Paul J. Albert', top_io_score: 92.4,
        accepted_by: [{ cwid: 'jma2016', name: 'Jonathan M. Albert' }],
    }, [{ cwid: 'JMA2016', io_score: 40 }])
    assert.deepEqual(ids, [
        { cwid: 'paa2013', name: 'Paul J. Albert', io: 92.4, accepted: false },
        { cwid: 'jma2016', name: 'Jonathan M. Albert', io: 40, accepted: true },
    ])
})

test('conflictIdentities never lists a person twice and tolerates no IO', () => {
    const ids = conflictIdentities({
        top_cwid: 'abc1', top_name: '', top_io_score: null,
        accepted_by: [{ cwid: 'ABC1', name: 'X' }, { cwid: 'def2', name: '' }, { cwid: 'def2', name: 'Dup' }],
    })
    assert.deepEqual(ids.map((i) => [i.cwid, i.name, i.io, i.accepted]), [['abc1', 'abc1', null, false], ['def2', 'def2', null, true]])
    assert.deepEqual(conflictIdentities({ top_cwid: null, accepted_by: [] }), [])
})

test('conflictKeep: keeping the proposed identity accepts or assigns to it', () => {
    assert.deepEqual(conflictKeep({ top_cwid: 'paa2013', single_candidate: true }, 'PAA2013'), { action: 'accept' })
    assert.deepEqual(conflictKeep({ top_cwid: 'paa2013', single_candidate: false }, 'paa2013', ['paa2013', 'jma2016']),
        { action: 'assign', extra: { cwid: 'paa2013' } })
})

test('conflictKeep: keeping the person who accepted it rejects, unless reject would hit them', () => {
    assert.deepEqual(conflictKeep({ top_cwid: 'paa2013', single_candidate: true }, 'jma2016', ['paa2013']), { action: 'reject' })
    // multi row whose candidates do not include them: reject-all is safe
    assert.deepEqual(conflictKeep({ top_cwid: 'paa2013', single_candidate: false }, 'jma2016', ['paa2013', 'xyz9']), { action: 'reject' })
    // multi row that lists them: reject-all would write "not mine" over their acceptance
    assert.deepEqual(conflictKeep({ top_cwid: 'paa2013', single_candidate: false }, 'jma2016', ['paa2013', 'JMA2016']), { action: 'dismiss' })
})

test('emptyState: filtered queue names how many fall outside and offers Reset', () => {
    assert.deepEqual(emptyState({ statusView: 'open', queueTotal: 23, filtersOn: true }), {
        title: 'No rows match these filters',
        body: '23 unassigned authorships fall outside the current source, filters, or search.',
        canReset: true,
    })
    assert.equal(emptyState({ statusView: 'conflicts', queueTotal: 1, filtersOn: false }).body,
        '1 authorship with an identity conflict falls outside the current source, filters, or search.')
    assert.equal(emptyState({ statusView: 'open', queueTotal: 1200, filtersOn: true }).body.startsWith('1,200 '), true)
    assert.equal(emptyState({ statusView: 'open', queueTotal: null, filtersOn: true }).body,
        'Nothing in this queue matches the current source, filters, or search.')
})

test('emptyState: an empty queue says so, per queue, with no Reset', () => {
    assert.deepEqual(emptyState({ statusView: 'open', queueTotal: 0, filtersOn: true }),
        { title: 'Queue is clear', body: 'Every open authorship has been assigned, rejected, snoozed, or dismissed.', canReset: false })
    assert.equal(emptyState({ statusView: 'snoozed', queueTotal: 0, filtersOn: false }).title, 'No snoozed authorships')
    assert.equal(emptyState({ statusView: 'duplicates', queueTotal: 0, filtersOn: false }).title, 'No duplicates left')
})
