// Unit test for src/utils/peopleOrder.ts. Run with `npm test`.
// Runs the real ORDER BY fragment against an in-memory SQLite table, so the check exercises the
// order itself rather than its spelling.
import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { peopleOrderSql } from '../src/utils/peopleOrder.ts'

const order = (people) => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE person (personIdentifier TEXT, firstName TEXT, lastName TEXT)')
    for (const p of people) db.prepare('INSERT INTO person VALUES (?, ?, ?)').run(...p)
    return db.prepare(`SELECT personIdentifier AS uid FROM person \`Person\` ORDER BY ${peopleOrderSql('Person')}`)
        .all().map((r) => r.uid)
}

test('peopleOrderSql: last name, then first name, then CWID', () => {
    assert.deepEqual(order([
        ['zzz1001', 'Anna', 'Smith'],
        ['aaa1001', 'Brian', 'Smith'],
        ['bbb1001', 'Anna', 'Smith'],
        ['ccc1001', 'Zoe', 'Abbott'],
    ]), ['ccc1001', 'bbb1001', 'zzz1001', 'aaa1001'])
})

test('peopleOrderSql: underscore CWIDs sort by their name, not first', () => {
    assert.deepEqual(order([
        ['_djulius', 'David', 'Julius'],
        ['abc1001', 'Ann', 'Adams'],
        ['xyz1001', 'Zed', 'Zimmer'],
    ]), ['abc1001', '_djulius', 'xyz1001'])
})

test('peopleOrderSql: people with no last name (NULL, empty or blank) go last, by CWID', () => {
    assert.deepEqual(order([
        ['_lal2055', null, null],
        ['abc1001', 'Ann', 'Zimmer'],
        ['aaa1000', null, ''],
        ['aab1000', 'Bo', '  '],
    ]), ['abc1001', '_lal2055', 'aaa1000', 'aab1000'])
})

test('peopleOrderSql: leading spaces in names do not move a person to the top', () => {
    assert.deepEqual(order([
        ['abc1001', 'Ann', 'Brown'],
        ['abc1002', 'Ann', ' Young'],
        ['abc1003', ' Cy', 'Brown'],
    ]), ['abc1001', 'abc1003', 'abc1002'])
})
