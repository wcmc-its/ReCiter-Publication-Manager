// Unit tests for src/utils/authorshipChips.ts (/authorships chip row, drill banner, shortcuts).
// Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { chipText, singleChipText, drillBanner, keyCommand, KEY_LEGEND } from '../src/utils/authorshipChips.ts'

const inst = { wcm: 'Weill Cornell Medicine', nyp: 'New York-Presbyterian Hospital' }

test('chipText: at rest, one value, several values', () => {
    assert.equal(chipText('Person type', []), 'Person type')
    assert.equal(chipText('Identity affiliation', [], { allLabel: 'Any' }), 'Identity affiliation: Any')
    assert.equal(chipText('Identity affiliation', ['wcm'], { allLabel: 'Any', labelOf: (k) => inst[k] }), 'Identity affiliation: Weill Cornell Medicine')
    assert.equal(chipText('Identity affiliation', ['wcm', 'nyp'], { allLabel: 'Any', labelOf: (k) => inst[k] }), 'Identity affiliation: 2')
    assert.equal(chipText('Person type', ['Full-Time Faculty']), 'Person type: Full-Time Faculty')
})

test('singleChipText always names the value', () => {
    assert.equal(singleChipText('Queue', 'Open'), 'Queue: Open')
    assert.equal(singleChipText('Date', 'Last 2 years'), 'Date: Last 2 years')
})

test('drillBanner: like drill names the pile and offers the way back', () => {
    assert.deepEqual(drillBanner({ likeAuthor: 'Shari R. Lipner', count: 3, statusView: 'open' }), {
        label: 'Showing 3 authorships like “Shari R. Lipner”',
        note: 'When the last one is done, your previous filters come back.',
        back: true,
    })
    assert.equal(drillBanner({ likeAuthor: 'A B', count: 1, statusView: 'open' }).label, 'Showing 1 authorship like “A B”')
    assert.equal(drillBanner({ likeAuthor: ' A B ', count: null, statusView: 'open' }).label, 'Showing authorships like “A B”')
    assert.equal(drillBanner({ likeAuthor: 'A B', count: 1200, statusView: 'open' }).label, 'Showing 1,200 authorships like “A B”')
})

test('drillBanner: says so when the current filters hide part of the pile', () => {
    assert.deepEqual(drillBanner({ likeAuthor: 'Carrie Sha', count: 1, expected: 2, statusView: 'open' }), {
        label: 'Showing 1 of 2 authorships like “Carrie Sha”',
        note: '1 is outside the current filters. When the last one is done, your previous filters come back.',
        back: true,
    })
    assert.equal(drillBanner({ likeAuthor: 'A B', count: 2, expected: 5, statusView: 'open' }).note.startsWith('3 are outside'), true)
    // the whole pile is on screen: no "of"
    assert.equal(drillBanner({ likeAuthor: 'A B', count: 3, expected: 3, statusView: 'open' }).label, 'Showing 3 authorships like “A B”')
    assert.equal(drillBanner({ likeAuthor: 'A B', count: 4, expected: 3, statusView: 'open' }).label, 'Showing 4 authorships like “A B”')
})

test('drillBanner: review queues get a label and no way back; the open queue gets nothing', () => {
    assert.deepEqual(drillBanner({ likeAuthor: '', count: 2, statusView: 'conflicts' }), { label: 'Showing identity conflicts', note: '', back: false })
    assert.deepEqual(drillBanner({ likeAuthor: '', count: 4, statusView: 'duplicates' }), { label: 'Showing duplicate records', note: '', back: false })
    assert.equal(drillBanner({ likeAuthor: '', count: 9, statusView: 'open' }), null)
    assert.equal(drillBanner({ likeAuthor: '   ', count: 9, statusView: 'snoozed' }), null)
    // a like drill wins over the queue it sits in
    assert.equal(drillBanner({ likeAuthor: 'A B', count: 2, statusView: 'conflicts' }).back, true)
})

test('keyCommand maps the prototype keys and their aliases', () => {
    const cmd = (key, mods = {}) => keyCommand({ key, ...mods })
    assert.equal(cmd('j'), 'next'); assert.equal(cmd('J'), 'next'); assert.equal(cmd('ArrowDown'), 'next')
    assert.equal(cmd('k'), 'prev'); assert.equal(cmd('ArrowUp'), 'prev')
    assert.equal(cmd('y'), 'accept'); assert.equal(cmd('a'), 'accept')
    assert.equal(cmd('n'), 'reject'); assert.equal(cmd('r'), 'reject')
    assert.equal(cmd('s'), 'snooze'); assert.equal(cmd('x'), 'select')
    assert.equal(cmd('e'), 'evidence'); assert.equal(cmd('Enter'), 'open'); assert.equal(cmd('?'), 'legend')
    assert.equal(cmd('u'), null)   // U is the toast host's
    assert.equal(cmd('q'), null)
})

test('keyCommand leaves browser chords alone', () => {
    assert.equal(keyCommand({ key: 'r', metaKey: true }), null)
    assert.equal(keyCommand({ key: 'a', ctrlKey: true }), null)
    assert.equal(keyCommand({ key: 'j', altKey: true }), null)
})

test('the legend lists every key the handler answers to', () => {
    const legend = KEY_LEGEND.map((k) => k.key).join(' ')
    for (const k of ['J', '↓', 'K', '↑', 'Y', 'A', 'N', 'R', 'S', 'X', 'E', 'U', '↵', '?']) assert.ok(legend.includes(k), k)
    assert.equal(KEY_LEGEND[0].key, 'J / ↓')
    assert.equal(KEY_LEGEND.at(-1).key, '?')
})
