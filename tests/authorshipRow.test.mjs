// Unit tests for src/utils/authorshipRow.ts (/authorships table row). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    ioBand, ioBadgeText, ioBadge, shortInstitution, roleLine, formatRowDate,
    splitAffiliation, sourceBadgeText, shortcutsLine,
} from '../src/utils/authorshipRow.ts'

test('ioBand uses the page bands (90 / 50)', () => {
    assert.equal(ioBand(99.8), 'High')
    assert.equal(ioBand(90), 'High')
    assert.equal(ioBand(89.99), 'Medium')
    assert.equal(ioBand(50), 'Medium')
    assert.equal(ioBand(49.9), 'Low')
    assert.equal(ioBand(0), 'Low')
    assert.equal(ioBand(undefined), null)
    assert.equal(ioBand(null), null)
})

test('ioBadgeText floors so the number never outranks its band', () => {
    assert.equal(ioBadgeText(99.8), '99')
    assert.equal(ioBadgeText(100), '100')
    assert.equal(ioBadgeText(89.6), '89')
    assert.equal(ioBadgeText(null), '—')
})

test('ioBadge: single, multi, no candidate, no score', () => {
    assert.deepEqual(ioBadge({ top_cwid: 'a', top_io_score: 98.1, single_candidate: true }), { text: '98', tone: 'slate', band: 'High' })
    assert.deepEqual(ioBadge({ top_cwid: 'a', top_io_score: 72, single_candidate: true }), { text: '72', tone: 'amber', band: 'Medium' })
    assert.deepEqual(ioBadge({ top_cwid: 'a', top_io_score: 12, single_candidate: true }), { text: '12', tone: 'red', band: 'Low' })
    // multi: best candidate, always amber until one is picked
    assert.deepEqual(ioBadge({ top_cwid: 'a', top_io_score: 97.9, single_candidate: false }), { text: '97', tone: 'amber', band: 'High' })
    assert.equal(ioBadge({ top_cwid: null, top_io_score: 99, single_candidate: true }).text, '—')
    assert.equal(ioBadge({ top_cwid: 'a', top_io_score: null, single_candidate: true }).tone, 'muted')
})

test('roleLine joins type, dept and a short institution', () => {
    assert.equal(roleLine('Staff', 'Library', 'Weill Cornell Medicine'), 'Staff · Library · WCM')
    assert.equal(roleLine('Full-Time Faculty', null, 'Weill Cornell Medical College'), 'Full-Time Faculty · WCM')
    assert.equal(roleLine('Student MD (NYC)', '', ''), 'Student MD (NYC)')
    assert.equal(roleLine(undefined, 'Medicine', 'Memorial Sloan Kettering'), 'Medicine · Memorial Sloan Kettering')
    assert.equal(shortInstitution('Cornell University'), 'Cornell')
    assert.equal(shortInstitution('NewYork-Presbyterian'), 'NYP')
})

test('formatRowDate writes the prototype form', () => {
    assert.equal(formatRowDate('2025-10-13'), '2025 Oct 13')
    assert.equal(formatRowDate('2025-05-08T00:00:00.000Z'), '2025 May 8')
    assert.equal(formatRowDate('2026-09'), '2026 Sep')
    assert.equal(formatRowDate('Spring 2025'), 'Spring 2025')
    assert.equal(formatRowDate(undefined), '')
})

test('splitAffiliation isolates the first match', () => {
    const re = /Weill[ -]Cornell(?:\s+(?:Medicine|Medical College))?/i
    assert.deepEqual(splitAffiliation('Dept of Medicine, Weill Cornell Medicine, New York', re),
        { pre: 'Dept of Medicine, ', hit: 'Weill Cornell Medicine', post: ', New York' })
    assert.deepEqual(splitAffiliation('Mayo Clinic', re), { pre: 'Mayo Clinic', hit: '', post: '' })
})

test('sourceBadgeText and shortcutsLine', () => {
    assert.equal(sourceBadgeText('pubmed'), 'PubMed')
    assert.equal(sourceBadgeText(undefined), 'PubMed')
    assert.equal(sourceBadgeText('scopus'), 'Scopus · not in PubMed')
    assert.equal(sourceBadgeText('openalex'), 'OpenAlex · not in PubMed')
    assert.deepEqual(shortcutsLine(true), ['J/K move', 'Y accept', 'N reject', 'S snooze', 'X select', 'U undo', '? all shortcuts'])
    assert.deepEqual(shortcutsLine(false), ['J/K move', 'U undo', '? all shortcuts'])
})
