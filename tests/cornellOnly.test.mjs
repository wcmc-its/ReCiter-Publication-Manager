// Unit test for src/utils/cornellOnly.ts. Run with `npm test`.
// Evaluates the real SQL fragment against an in-memory SQLite copy of the two columns it reads,
// so the check exercises the predicate itself rather than its spelling.
import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { cornellOnlySql, reciterRunStatus, CORNELL_RECITER_MIN_PUBMED } from '../src/utils/cornellOnly.ts'

test('cornellOnlySql: cornell-ithaca type AND no Analysis (dateAdded NULL)', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE person (personIdentifier TEXT, dateAdded TEXT)')
    db.exec('CREATE TABLE person_person_type (personIdentifier TEXT, personType TEXT)')
    const people = [
        // uid, dateAdded, person types
        ['jma7', null, ['cornell-ithaca', 'cornell-faculty', 'cornell-emeritus']], // Cornell-only
        ['dual1', '2026-01-01', ['cornell-ithaca', 'academic-faculty-weillfulltime']], // dual appointee, has Analysis
        ['wcm1', '2026-01-01', ['academic-faculty-weillfulltime']], // ordinary WCM person
        ['wcm2', null, ['student-md-new-york']], // WCM with no Analysis yet: not Cornell
        ['cfac1', null, ['cornell-faculty']], // Cornell-ish type but not cornell-ithaca
    ]
    for (const [uid, added, types] of people) {
        db.prepare('INSERT INTO person VALUES (?, ?)').run(uid, added)
        for (const t of types) db.prepare('INSERT INTO person_person_type VALUES (?, ?)').run(uid, t)
    }
    const rows = db.prepare(
        `SELECT \`Person\`.personIdentifier AS uid, ${cornellOnlySql('Person')} AS cornellOnly FROM person \`Person\` ORDER BY uid`
    ).all()
    const flags = Object.fromEntries(rows.map((r) => [r.uid, Number(r.cornellOnly)]))
    assert.deepEqual(flags, { cfac1: 0, dual1: 0, jma7: 1, wcm1: 0, wcm2: 0 })
})

// reciterRunStatus with stubbed lookups: who is blocked from ReCiter.
const stub = ({ cornell = [], known = {}, cornellFails = false, knownFails = false } = {}) => ({
    isCornellOnly: async (uid) => { if (cornellFails) throw new Error('reciterdb down'); return cornell.includes(uid) },
    knownPmidCount: async (uid) => { if (knownFails) throw new Error('DynamoDB down'); return known[uid] ?? 0 },
})
const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn() } finally { console.log = log } }

test('CORNELL_RECITER_MIN_PUBMED is 3 (approved 2026-11-16)', () => {
    assert.equal(CORNELL_RECITER_MIN_PUBMED, 3)
})

test('reciterRunStatus: Cornell-only below 3 accepted PubMed papers is blocked', async () => {
    for (const n of [0, 1, 2]) {
        assert.deepEqual(await reciterRunStatus('jma7', stub({ cornell: ['jma7'], known: { jma7: n } })),
            { cornellOnly: true, reciterEligible: false, blocked: true }, `known=${n}`)
    }
})

test('reciterRunStatus: Cornell-only at or above 3 is allowed', async () => {
    for (const n of [3, 4, 40]) {
        assert.deepEqual(await reciterRunStatus('jma7', stub({ cornell: ['jma7'], known: { jma7: n } })),
            { cornellOnly: true, reciterEligible: true, blocked: false }, `known=${n}`)
    }
})

test('reciterRunStatus: WCM people are unaffected, whatever their GoldStandard holds', async () => {
    let knownAsked = false
    const lookups = { ...stub({ known: { wcm1: 0 } }), knownPmidCount: async () => { knownAsked = true; return 0 } }
    assert.deepEqual(await reciterRunStatus('wcm1', lookups), { cornellOnly: false, reciterEligible: true, blocked: false })
    assert.equal(knownAsked, false, 'no GoldStandard read for a non-Cornell person')
})

test('reciterRunStatus: a failed Cornell lookup fails open (runs, as before the rule)', async () => {
    assert.deepEqual(await quiet(() => reciterRunStatus('jma7', stub({ cornell: ['jma7'], cornellFails: true }))),
        { cornellOnly: false, reciterEligible: true, blocked: false })
})

test('reciterRunStatus: a failed GoldStandard read keeps a Cornell-only person blocked', async () => {
    assert.deepEqual(await quiet(() => reciterRunStatus('jma7', stub({ cornell: ['jma7'], known: { jma7: 9 }, knownFails: true }))),
        { cornellOnly: true, reciterEligible: false, blocked: true })
})
