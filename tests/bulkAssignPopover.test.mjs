// Unit tests for the bulk "Assign to…" popover and parked-queue helpers in src/lib/bulkAssign.ts
// (Authorships UI refresh PR 5). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    isParkedQueue, isBulkSelectable, assignBand, assignOptionSummary, assignPreview, looksLikeCwid,
    orderAssignOptions,
} from '../src/lib/bulkAssign.ts'

test('isParkedQueue: Snoozed and Dismissed only; isBulkSelectable stays open-only', () => {
    assert.equal(isParkedQueue('snoozed'), true)
    assert.equal(isParkedQueue('dismissed'), true)
    for (const q of ['open', 'conflicts', 'duplicates', '']) assert.equal(isParkedQueue(q), false)
    // A parked row never becomes accept/assign-selectable through the open-queue predicate.
    const row = { single_candidate: true, identity_in_reciter: true, top_cwid: 'abc1234' }
    assert.equal(isBulkSelectable(row, 'snoozed'), false)
    assert.equal(isBulkSelectable(row, 'dismissed'), false)
})

test('assignBand uses the page bands (90 / 50)', () => {
    assert.equal(assignBand(90), 'High')
    assert.equal(assignBand(89.9), 'Medium')
    assert.equal(assignBand(50), 'Medium')
    assert.equal(assignBand(49.9), 'Low')
    assert.equal(assignBand(null), null)
    assert.equal(assignBand(undefined), null)
})

test('assignOptionSummary: IO range, band counts and the amber warning', () => {
    const a = assignOptionSummary([98.4, 88.2, 92], 15, 3)
    assert.equal(a.ioText, 'IO 88–98')
    assert.deepEqual(a.bands, [{ band: 'High', n: 2 }, { band: 'Medium', n: 1 }])
    assert.equal(a.warn, 'Not a candidate on 12 selected rows')

    const b = assignOptionSummary([96.7, 61, 40], 3, 3)
    assert.equal(b.ioText, 'IO 40–96')
    assert.deepEqual(b.bands, [{ band: 'High', n: 1 }, { band: 'Medium', n: 1 }, { band: 'Low', n: 1 }])
    assert.equal(b.warn, '1 low-confidence match')

    const c = assignOptionSummary([93.2, 93.9], 3, 2)
    assert.equal(c.ioText, 'IO 93', 'one floored value reads as a single number')
    assert.equal(c.warn, 'Not a candidate on 1 selected row')

    const d = assignOptionSummary([], 2, 2)
    assert.equal(d.ioText, 'No IO score')
    assert.deepEqual(d.bands, [])
    assert.equal(d.warn, '')
})

test('assignPreview: strongest first, not-a-candidate last, safe = candidate at High', () => {
    const rows = [
        { id: 1, cands: [{ cwid: 'x', score: 61 }] },
        { id: 2, cands: [{ cwid: 'y', score: 99 }] },
        { id: 3, cands: [{ cwid: 'x', score: 98 }, { cwid: 'y', score: 40 }] },
        { id: 4, cands: [{ cwid: 'x', score: 92 }] },
        { id: 5, cands: [{ cwid: 'x' }] },
    ]
    const pv = assignPreview(rows, (r) => r.cands, 'x')
    assert.deepEqual(pv.items.map((i) => i.row.id), [3, 4, 1, 5, 2])
    assert.deepEqual(pv.items.map((i) => i.band), ['High', 'High', 'Medium', null, null])
    assert.deepEqual(pv.items.map((i) => i.onCandidate), [true, true, true, true, false])
    assert.deepEqual(pv.safe.map((r) => r.id), [3, 4])
    assert.equal(pv.weak, 2)
    assert.equal(pv.offCandidate, 1)
    assert.equal(pv.note, "2 rows are below high confidence. 1 row doesn't list this person as a candidate, so you'd be overriding the match.")

    const all = assignPreview([rows[2], rows[3]], (r) => r.cands, 'x')
    assert.equal(all.note, 'Every selected row is a high-confidence match.')
    assert.equal(all.safe.length, 2)

    const none = assignPreview([rows[1]], (r) => r.cands, 'x')
    assert.equal(none.note, "1 row doesn't list this person as a candidate, so you'd be overriding the match.")
    assert.deepEqual(none.safe, [])
})

test('looksLikeCwid: no spaces and a digit, else it is a name', () => {
    for (const q of ['abc1234', ' paa2013 ', 'ml3392', 'hko23']) assert.equal(looksLikeCwid(q), true, q)
    for (const q of ['Lipner', 'Shari Lipner', 'S. Lipner', '', 'abc 1234']) assert.equal(looksLikeCwid(q), false, q)
})

test('orderAssignOptions: most matches first, then mean IO, no score last', () => {
    const opts = [
        { cwid: 'a', matches: 1 }, { cwid: 'b', matches: 3 }, { cwid: 'c', matches: 3 },
        { cwid: 'd', matches: 3 }, { cwid: 'e', matches: 1 },
    ]
    const scores = { a: [99], b: [60, 70, 80], c: [98, 40, 99], d: [], e: [] }
    assert.deepEqual(orderAssignOptions(opts, (c) => scores[c]).map((o) => o.cwid), ['c', 'b', 'd', 'a', 'e'])
    assert.deepEqual(opts.map((o) => o.cwid), ['a', 'b', 'c', 'd', 'e'], 'input untouched')
})
