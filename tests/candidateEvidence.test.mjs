// Unit tests for src/utils/candidateEvidence.ts (Authorships 4d evidence rows). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    buildCandidateEvidence, cornellEmailIds, evidenceStrength, tallyOf, authorKey, normName, orderByEvidence,
} from '../src/utils/candidateEvidence.ts'

const row = {
    byline: 'Yiran Zhu', affiliation: 'Department of Medicine, Weill Cornell Medicine, New York, NY.',
    journal: 'Clinical and translational medicine', year: 2024, source: 'pubmed',
    coauthors: ['Ann Lee', 'Bo Chen', 'Carl Diaz'],
}
const facts = {
    accepted: 12, forms: [{ first: 'Yiran', last: 'Zhu', n: 10 }, { first: 'Y', last: 'Zhu', n: 2 }],
    rejectedForms: [], journalHits: 3, degreeYear: 2015,
    coauthorHits: [{ last: 'Lee', initial: 'A', n: 4 }],
}
const get = (rows, label) => rows.find((r) => r.label === label)

test('cornellEmailIds: anchored on both sides, all three domains, de-duplicated', () => {
    assert.deepEqual(cornellEmailIds('x. Electronic address: ABC1001@med.cornell.edu.'), ['abc1001'])
    assert.deepEqual(cornellEmailIds('a@cornell.edu; b@qatar-med.cornell.edu; a@cornell.edu'), ['a', 'b'])
    assert.deepEqual(cornellEmailIds('x@notcornell.edu y@cornell.edu.evil.com z@cornell.eduX'), [])
    assert.deepEqual(cornellEmailIds(undefined), [])
})

test('name: exact form, surname+initial fit, and mismatch', () => {
    const c = { cwid: 'yiz2020', name: 'Yiran Zhu' }
    assert.equal(get(buildCandidateEvidence(row, c, facts), 'Name').kind, 'match')
    assert.equal(get(buildCandidateEvidence({ ...row, byline: 'Yanhong Zhu' }, c, facts), 'Name').kind, 'partial')
    assert.equal(get(buildCandidateEvidence({ ...row, byline: 'Wei Zhang' }, c, facts), 'Name').kind, 'mismatch')
    // accents and punctuation do not break an exact form
    assert.equal(normName('José  M. Núñez'), 'jose m nunez')
})

test('email row appears only when the affiliation has a Cornell address, and is decisive', () => {
    const aff = row.affiliation + ' Electronic address: yiz2020@med.cornell.edu.'
    const mine = buildCandidateEvidence({ ...row, affiliation: aff }, { cwid: 'YIZ2020' }, facts)
    const other = buildCandidateEvidence({ ...row, affiliation: aff }, { cwid: 'yuz2002' }, facts)
    assert.equal(get(mine, 'Email').kind, 'match')
    assert.equal(get(other, 'Email').kind, 'mismatch')
    assert.equal(get(buildCandidateEvidence(row, { cwid: 'yiz2020' }, facts), 'Email'), undefined)
    assert.ok(evidenceStrength(mine) > evidenceStrength(other) + 50)
})

test('co-authors: hits by surname + first initial; null list and no history are no data', () => {
    const r = get(buildCandidateEvidence(row, { cwid: 'a' }, facts), 'Co-authors')
    assert.equal(r.kind, 'match')
    assert.match(r.theirs, /Ann Lee \(4\)/)
    assert.equal(get(buildCandidateEvidence(row, { cwid: 'a' }, { ...facts, coauthorHits: [] }), 'Co-authors').kind, 'mismatch')
    assert.equal(get(buildCandidateEvidence({ ...row, coauthors: null }, { cwid: 'a' }, facts), 'Co-authors').kind, 'nodata')
    assert.equal(get(buildCandidateEvidence(row, { cwid: 'a' }, { ...facts, accepted: 0 }), 'Co-authors').kind, 'nodata')
    assert.equal(authorKey('Mary-Ann  Smith-Jones'), 'm jones')
})

test('journal miss is no data, not a mismatch; career window catches pre-degree papers', () => {
    assert.equal(get(buildCandidateEvidence(row, {}, { ...facts, journalHits: 0 }), 'Journal').kind, 'nodata')
    assert.equal(get(buildCandidateEvidence(row, {}, facts), 'Journal').kind, 'match')
    assert.equal(get(buildCandidateEvidence({ ...row, year: 2005 }, {}, facts), 'Career window').kind, 'mismatch')
    assert.equal(get(buildCandidateEvidence({ ...row, year: 2013 }, {}, facts), 'Career window').kind, 'match')
    assert.equal(get(buildCandidateEvidence(row, {}, { ...facts, degreeYear: null }), 'Career window').kind, 'nodata')
})

test('prior decisions: already rejected, or a namesake byline; absent otherwise', () => {
    assert.equal(get(buildCandidateEvidence(row, { already_rejected: true }, facts), 'Prior decisions').kind, 'mismatch')
    const ns = { ...facts, forms: [{ first: 'Y', last: 'Zhu', n: 2 }], rejectedForms: [{ first: 'Yiran', last: 'Zhu', n: 5 }] }
    assert.match(get(buildCandidateEvidence(row, {}, ns), 'Prior decisions').why, /5 papers/)
    // the byline is also an accepted form, so it is not a namesake
    assert.equal(get(buildCandidateEvidence(row, {}, { ...facts, rejectedForms: [{ first: 'Yiran', last: 'Zhu', n: 1 }] }), 'Prior decisions'), undefined)
})

test('IO: 90/50 bands; unscored and external rows are no data', () => {
    const io = (v, src = 'pubmed') => get(buildCandidateEvidence({ ...row, source: src }, { io_score: v }, facts), 'Identity-Only Score').kind
    assert.equal(io(95), 'match'); assert.equal(io(60), 'partial'); assert.equal(io(10), 'mismatch')
    assert.equal(io(null), 'nodata'); assert.equal(io(95, 'scopus'), 'nodata')
})

test('no facts at all still yields a full, honest table', () => {
    const rows = buildCandidateEvidence(row, { cwid: 'x', name: 'Yiran Zhu', given_match: 'full' })
    const t = tallyOf(rows)
    assert.equal(t.match + t.partial + t.mismatch + t.nodata, rows.length)
    assert.equal(get(rows, 'Co-authors').kind, 'nodata')
})

test('mine: the article side of each row, and an empty co-author list is no data, not a mismatch', () => {
    const rows = buildCandidateEvidence(row, { cwid: 'yiz2020', name: 'Yiran Zhu', io_score: 95 }, facts)
    assert.equal(get(rows, 'Name').mine, 'Yiran Zhu')
    assert.equal(get(rows, 'Given name').mine, 'Yiran')
    assert.equal(get(rows, 'Co-authors').mine, '3 co-authors')
    assert.equal(get(rows, 'Journal').mine, 'Clinical and translational medicine')
    assert.equal(get(rows, 'Career window').mine, '2024')
    const lone = get(buildCandidateEvidence({ ...row, coauthors: [] }, { cwid: 'yiz2020' }, facts), 'Co-authors')
    assert.equal(lone.kind, 'nodata')
})

test('orderByEvidence: email match first, rejected last even when strongest, IO breaks ties', () => {
    const r = { ...row, affiliation: row.affiliation + ' Electronic address: zzz9999@med.cornell.edu.' }
    const cands = [
        { cwid: 'rej1', name: 'Yiran Zhu', given_match: 'full', io_score: 99, already_rejected: true },
        { cwid: 'aaa1', name: 'Yiran Zhu', given_match: 'full', io_score: 40 },
        { cwid: 'zzz9999', name: 'Yan Zhu', given_match: 'initial', io_score: 10 },
        { cwid: 'bbb1', name: 'Yiran Zhu', given_match: 'full', io_score: 60 },
    ]
    const order = orderByEvidence(cands, (c) => buildCandidateEvidence(r, c, facts)).map((x) => x.c.cwid)
    assert.deepEqual(order, ['zzz9999', 'bbb1', 'aaa1', 'rej1'])
})
