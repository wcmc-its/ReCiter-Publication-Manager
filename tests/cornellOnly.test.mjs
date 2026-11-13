// Unit test for src/utils/cornellOnly.ts. Run with `npm test`.
// Evaluates the real SQL fragment against an in-memory SQLite copy of the two columns it reads,
// so the check exercises the predicate itself rather than its spelling.
import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { cornellOnlySql } from '../src/utils/cornellOnly.ts'

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
