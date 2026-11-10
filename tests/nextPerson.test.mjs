// Unit tests for src/utils/nextPerson.ts. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { nextPersonAfter, personName, withPendingCount } from '../src/utils/nextPerson.ts'

const p = (id, pending) => ({ personIdentifier: id, countPendingArticles: pending })
const ids = (r) => (r ? r.personIdentifier : null)

test('nextPersonAfter: first later person with pending, wrapping, skipping current', () => {
    const list = [p('a', 2), p('b', 0), p('c', 1), p('d', 0)]
    assert.equal(ids(nextPersonAfter(list, 'a')), 'c')
    assert.equal(ids(nextPersonAfter(list, 'c')), 'a')
    assert.equal(ids(nextPersonAfter(list, 'd')), 'a')
    assert.equal(ids(nextPersonAfter(list, 'b')), 'c')
})

test('nextPersonAfter: null when only the current person (or nobody) has pending', () => {
    assert.equal(nextPersonAfter([p('a', 5), p('b', 0)], 'a'), null)
    assert.equal(nextPersonAfter([p('a', 0), p('b', null)], 'a'), null)
})

test('nextPersonAfter: no results list hides it', () => {
    assert.equal(nextPersonAfter(undefined, 'a'), null)
    assert.equal(nextPersonAfter([], 'a'), null)
})

test('nextPersonAfter: current not in the list starts from the top', () => {
    assert.equal(ids(nextPersonAfter([p('a', 0), p('b', 3)], 'zz')), 'b')
})

test('personName: first middle last, falling back to the cwid', () => {
    assert.equal(personName({ personIdentifier: 'x', firstName: 'Paul', middleName: 'J.', lastName: 'Albert' }), 'Paul J. Albert')
    assert.equal(personName({ personIdentifier: 'x', firstName: 'Ann', lastName: 'Lee' }), 'Ann Lee')
    assert.equal(personName({ personIdentifier: 'x' }), 'x')
})

test('withPendingCount: patches one row, leaves the rest', () => {
    const list = [p('a', 2), p('b', 3)]
    const out = withPendingCount(list, 'a', 0)
    assert.deepEqual(out.map((r) => r.countPendingArticles), [0, 3])
    assert.equal(list[0].countPendingArticles, 2)
    assert.equal(out[1], list[1])
})
