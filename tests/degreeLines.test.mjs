// Unit tests for src/utils/degreeLines.ts. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { degreeLines } from '../src/utils/degreeLines.ts'

test('degreeLines: both years, bachelors first', () => {
    assert.deepEqual(degreeLines({ bachelorYear: 1995, doctoralYear: 2009 }), ['1995 Bachelors', '2009 Doctoral'])
})

test('degreeLines: 0 / missing / null mean unknown', () => {
    assert.deepEqual(degreeLines({ bachelorYear: 0, doctoralYear: 2009 }), ['2009 Doctoral'])
    assert.deepEqual(degreeLines({ bachelorYear: 1995 }), ['1995 Bachelors'])
    assert.deepEqual(degreeLines({ bachelorYear: 0, doctoralYear: 0 }), [])
    assert.deepEqual(degreeLines(undefined), [])
    assert.deepEqual(degreeLines(null), [])
})
