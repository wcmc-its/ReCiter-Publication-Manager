// Unit tests for src/utils/curateGroups.ts. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { bandOf, yearOf, groupModeFor, groupsOf, yearHistogram, spotCheckSample, GROUP_MIN } from '../src/utils/curateGroups.ts'

const p = (score, date) => ({ authorshipLikelihoodScore: score, publicationDateStandardized: date })

test('bandOf: 70/40 cut-offs on the rounded score', () => {
    assert.equal(bandOf(p(69.5)), 'strong')
    assert.equal(bandOf(p(69.4)), 'moderate')
    assert.equal(bandOf(p(40)), 'moderate')
    assert.equal(bandOf(p(39.4)), 'weak')
    assert.equal(bandOf({}), 'weak')
})

test('yearOf: standardized date, then display date, else Undated', () => {
    assert.equal(yearOf(p(1, '2021-02-03')), '2021')
    assert.equal(yearOf({ publicationDateDisplay: '2019 Aug 12' }), '2019')
    assert.equal(yearOf({}), 'Undated')
})

test('groupModeFor: bands on long Suggested by score, years on long Accepted/Rejected by date', () => {
    const big = GROUP_MIN + 1
    assert.equal(groupModeFor('NULL', '0', big), 'band')
    assert.equal(groupModeFor('NULL', '1', big), 'band')
    assert.equal(groupModeFor('NULL', '2', big), 'flat')
    assert.equal(groupModeFor('ACCEPTED', '2', big), 'year')
    assert.equal(groupModeFor('REJECTED', '4', big), 'year')
    assert.equal(groupModeFor('ACCEPTED', '1', big), 'flat')
    assert.equal(groupModeFor('NULL', '0', GROUP_MIN), 'flat')
})

test('groupsOf: contiguous runs with counts', () => {
    const l = [p(95), p(80), p(50), p(10), p(5)]
    assert.deepEqual(groupsOf('band', l), [{ key: 'strong', count: 2 }, { key: 'moderate', count: 1 }, { key: 'weak', count: 2 }])
    assert.deepEqual(groupsOf('flat', l), [])
})

test('yearHistogram: fills gaps, oldest first, skips undated', () => {
    assert.deepEqual(yearHistogram([p(1, '2020-01-01'), p(1, '2022-05-01'), p(1, '2022-07-01'), {}]),
        [{ year: 2020, count: 1 }, { year: 2021, count: 0 }, { year: 2022, count: 2 }])
    assert.deepEqual(yearHistogram([]), [])
})

test('spotCheckSample: riskiest first', () => {
    const l = [p(99), p(71), p(85), p(70)]
    assert.deepEqual(spotCheckSample(l, 'ACCEPTED', 2).map(x => x.authorshipLikelihoodScore), [70, 71])
    assert.deepEqual(spotCheckSample([p(5), p(39), p(20)], 'REJECTED', 2).map(x => x.authorshipLikelihoodScore), [39, 20])
})
