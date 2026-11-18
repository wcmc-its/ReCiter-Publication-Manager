// Unit tests for src/utils/authorshipRow.ts (/authorships table row). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    ioBand, ioBadgeText, ioBadge, shortInstitution, roleLine, formatRowDate,
    splitAffiliation, sourceBadgeText, shortcutsLine, parkedNote,
    ioScoreText, fgLine, bylineParts, rankCandidates, confidenceLevel, confidenceTip, CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, compareHint, shareLine, venueFitBand, orcidMatchTip,
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

test('venueFitBand: >= 1 good, < -1 poor, nothing in between or when unknown', () => {
    assert.equal(venueFitBand(1), 'good')
    assert.equal(venueFitBand(2.4), 'good')
    assert.equal(venueFitBand(0.999), null)
    assert.equal(venueFitBand(0), null)
    assert.equal(venueFitBand(-1), null)
    assert.equal(venueFitBand(-1.001), 'poor')
    assert.equal(venueFitBand(-3), 'poor')
    assert.equal(venueFitBand(null), null)
    assert.equal(venueFitBand(undefined), null)
    assert.equal(venueFitBand(NaN), null)
})

test('orcidMatchTip names the ORCID when the row has one', () => {
    assert.equal(orcidMatchTip('0000-0002-1825-0097'), 'The byline ORCID 0000-0002-1825-0097 is on file for this person')
    assert.equal(orcidMatchTip(' 0000-0002-1825-0097 '), 'The byline ORCID 0000-0002-1825-0097 is on file for this person')
    assert.equal(orcidMatchTip(null), 'The byline ORCID is on file for this person')
    assert.equal(orcidMatchTip(undefined), 'The byline ORCID is on file for this person')
    assert.equal(orcidMatchTip(''), 'The byline ORCID is on file for this person')
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
    // Snoozed / Dismissed can select rows for bulk Reopen.
    assert.deepEqual(shortcutsLine(false, true), ['J/K move', 'X select', 'U undo', '? all shortcuts'])
})

test('parkedNote: the note above a parked row\'s Reopen', () => {
    assert.equal(parkedNote('snoozed', '2027-01-28'), 'Snoozed until 2027 Jan 28')
    assert.equal(parkedNote('snoozed', '2027-01-28T05:00:00.000Z'), 'Snoozed until 2027 Jan 28')
    assert.equal(parkedNote('snoozed', null), 'Snoozed')
    assert.equal(parkedNote('dismissed', '2027-01-28'), 'Dismissed')
    assert.equal(parkedNote('open', '2027-01-28'), '')
})

test('ioScoreText floors and names the band', () => {
    assert.equal(ioScoreText(99.8), '99 · High')
    assert.equal(ioScoreText(71.2), '71 · Medium')
    assert.equal(ioScoreText(12), '12 · Low')
    assert.equal(ioScoreText(null), '—')
})

test('fgLine says which side of the 30 cut, and why there is none', () => {
    assert.equal(fgLine(89.4, 'pubmed'), '89 · at or above the 30 cut')
    assert.equal(fgLine(30, 'pubmed'), '30 · at or above the 30 cut')
    assert.equal(fgLine(29.99, 'pubmed'), '29 · below the 30 cut')
    assert.equal(fgLine(null, 'pubmed'), 'None · production never scored this person')
    assert.equal(fgLine(55, 'scopus'), 'None · Scopus rows are not scored by production')
    assert.equal(fgLine(undefined, 'openalex'), 'None · OpenAlex rows are not scored by production')
})

test('bylineParts highlights the target and elides long lists around it', () => {
    assert.deepEqual(bylineParts(['Mei Lin', 'Michael Bales', 'Paul J Albert'], 1),
        { pre: 'Mei Lin, ', tgt: 'Michael Bales', post: ', Paul J Albert' })
    assert.deepEqual(bylineParts(['A B'], 0), { pre: '', tgt: 'A B', post: '' })
    // not found: the whole list, no highlight
    assert.deepEqual(bylineParts(['A', 'B'], -1), { pre: 'A, B', tgt: '', post: '' })
    const many = Array.from({ length: 30 }, (_, i) => `N${i}`)
    const p = bylineParts(many, 15)
    assert.equal(p.tgt, 'N15')
    assert.equal(p.pre, 'N0, N1, N2, …, N14, ')
    assert.equal(p.post, ', N16, …, N29')
    // target at the end of a long list
    const q = bylineParts(many, 29)
    assert.equal(q.pre, 'N0, N1, N2, …, N28, ')
    assert.equal(q.post, '')
    assert.deepEqual(bylineParts([], 0), { pre: '', tgt: '', post: '' })
})

test('rankCandidates: ORCID match, then confidence, none last, ties in the given order; rejected last; retired out', () => {
    const c = [
        { cwid: 'a', confidence: 0.4 },
        { cwid: 'b', confidence: null },
        { cwid: 'c', confidence: 0.99, already_rejected: true },
        { cwid: 'd', confidence: 0.99, retired_cwid: true },
        { cwid: 'e', confidence: 0.9 },
        { cwid: 'f', confidence: 0.4 },
        { cwid: 'g', confidence: 0.1, orcid_match: true },
        { cwid: 'h' },
        { cwid: 'i', confidence: 0, orcid_match: false },
    ]
    assert.deepEqual(rankCandidates(c).map((x) => x.cwid), ['g', 'e', 'a', 'f', 'i', 'b', 'h', 'c'])
    assert.deepEqual(c.map((x) => x.cwid).join(''), 'abcdefghi') // the input is not reordered
    assert.deepEqual(rankCandidates([]), [])
})

test('confidenceLevel and confidenceTip: High from 0.5, Medium from 0.25, nothing without a number', () => {
    assert.equal(CONFIDENCE_HIGH, 0.5)
    assert.equal(CONFIDENCE_MEDIUM, 0.25)
    assert.equal(confidenceLevel(1), 'High')
    assert.equal(confidenceLevel(0.5), 'High')
    assert.equal(confidenceLevel(0.499), 'Medium')
    assert.equal(confidenceLevel(0.25), 'Medium')
    assert.equal(confidenceLevel(0.249), 'Low')
    assert.equal(confidenceLevel(0), 'Low')
    assert.equal(confidenceLevel(null), null)
    assert.equal(confidenceLevel(undefined), null)
    assert.equal(confidenceLevel(NaN), null)
    assert.equal(confidenceTip(0.617), 'Match confidence 62%')
    assert.equal(confidenceTip(0), 'Match confidence 0%')
    assert.equal(confidenceTip(null), '')
})

test('compareHint and shareLine', () => {
    assert.equal(compareHint(), "Click a person's column heading to assign this authorship to them.")
    assert.equal(shareLine(5, true), '5 people share this name · click one to assign')
    assert.equal(shareLine(5, false), '5 people share this name')
})
