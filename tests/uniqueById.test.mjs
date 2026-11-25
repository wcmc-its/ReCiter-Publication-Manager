// Unit tests for src/utils/uniqueById.ts (/authorships list guard). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { uniqueById } from '../src/utils/uniqueById.ts'

test('uniqueById: keeps the first row for a repeated id, in order', () => {
    const rows = [{ id: 41222, n: 'a' }, { id: 7, n: 'b' }, { id: 41222, n: 'c' }, { id: 9, n: 'd' }]
    assert.deepEqual(uniqueById(rows), [{ id: 41222, n: 'a' }, { id: 7, n: 'b' }, { id: 9, n: 'd' }])
})

test('uniqueById: no repeats returns the same rows; empty stays empty', () => {
    const rows = [{ id: 1 }, { id: 2 }]
    assert.deepEqual(uniqueById(rows), rows)
    assert.deepEqual(uniqueById([]), [])
})

test('uniqueById: does not mutate its input', () => {
    const rows = [{ id: 1 }, { id: 1 }]
    uniqueById(rows)
    assert.equal(rows.length, 2)
})
