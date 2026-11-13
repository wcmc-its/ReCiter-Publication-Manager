// Unit tests for the Find People in-scope flag (src/utils/scopeResolver.ts). Run with `npm test`.
// inScopeSql is evaluated against an in-memory SQLite copy of the columns it reads and checked
// against isPersonInScope, the rule canCurate applies on every curate write.
import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { inScopeSql, inScopeFlagScope, isPersonInScope, rowInScopeCanCurate } from '../src/utils/scopeResolver.ts'

const quote = (v) => `'${String(v).replace(/'/g, "''")}'`

const people = [
    // uid, org unit, institution, person types
    ['ft1', 'Medicine', 'Weill Cornell Medicine', ['academic-faculty-weillfulltime']],
    ['ft2', 'Surgery', 'Weill Cornell Medicine', ['academic-faculty-weillfulltime', 'academic-faculty']],
    ['vol1', 'Medicine', 'Weill Cornell Medicine', ['academic-faculty-voluntary']],
    ['qat1', 'Medicine', 'WCM in Qatar', ['academic-faculty-weillfulltime']],
    ['none1', null, null, []],
    ['quo1', "O'Brien Center", 'Weill Cornell Medicine', ['student-md-new-york']],
]

const db = new DatabaseSync(':memory:')
db.exec('CREATE TABLE person (personIdentifier TEXT, primaryOrganizationalUnit TEXT, primaryInstitution TEXT)')
db.exec('CREATE TABLE person_person_type (personIdentifier TEXT, personType TEXT)')
for (const [uid, org, inst, types] of people) {
    db.prepare('INSERT INTO person VALUES (?, ?, ?)').run(uid, org, inst)
    for (const t of types) db.prepare('INSERT INTO person_person_type VALUES (?, ?)').run(uid, t)
}
const flags = (scope) => {
    const sql = inScopeSql('Person', scope, quote)
    const rows = db.prepare(`SELECT \`Person\`.personIdentifier AS uid, ${sql} AS inScope FROM person \`Person\` ORDER BY uid`).all()
    return Object.fromEntries(rows.map((r) => [r.uid, r.inScope]))
}

const scopes = {
    personTypes: { personTypes: ['academic-faculty-weillfulltime'], orgUnits: null },
    orgUnits: { personTypes: null, orgUnits: ['Medicine', "O'Brien Center"] },
    institutions: { personTypes: null, orgUnits: null, institutions: ['WCM in Qatar'] },
    typesAndOrg: { personTypes: ['academic-faculty-weillfulltime'], orgUnits: ['Medicine'] },
    allThree: { personTypes: ['academic-faculty-weillfulltime'], orgUnits: ['Medicine'], institutions: ['Weill Cornell Medicine'] },
    // An empty list next to a configured dimension: isPersonInScope matches nobody.
    typesAndEmptyOrg: { personTypes: ['academic-faculty-weillfulltime'], orgUnits: [] },
    orgAndEmptyTypes: { personTypes: [], orgUnits: ['Medicine'] },
}

for (const [name, scope] of Object.entries(scopes)) {
    test(`inScopeSql agrees with isPersonInScope: ${name}`, () => {
        const got = flags(scope)
        for (const [uid, org, inst, types] of people) {
            assert.equal(got[uid], isPersonInScope(scope, org, types, inst) ? 1 : 0, uid)
        }
    })
}

test('inScopeSql: full-time faculty scope flags exactly the full-time rows', () => {
    assert.deepEqual(flags(scopes.personTypes), { ft1: 1, ft2: 1, none1: 0, qat1: 1, quo1: 0, vol1: 0 })
})

test('inScopeSql: values are quoted (an apostrophe in an org unit matches, not breaks)', () => {
    assert.equal(flags(scopes.orgUnits).quo1, 1)
})

test('inScopeSql: no configured dimension gives null (no flag)', () => {
    assert.equal(inScopeSql('Person', null, quote), null)
    assert.equal(inScopeSql('Person', { personTypes: null, orgUnits: null }, quote), null)
    assert.equal(inScopeSql('Person', { personTypes: [], orgUnits: [], institutions: [] }, quote), null)
})

test('inScopeFlagScope: only viewers without curate-all who have a configured scope', () => {
    const scope = { personTypes: ['academic-faculty-weillfulltime'], orgUnits: null }
    assert.deepEqual(inScopeFlagScope(false, scope), scope)
    assert.equal(inScopeFlagScope(true, scope), null) // Curator_All / Superuser: no flag
    assert.equal(inScopeFlagScope(false, null), null) // Reporter_All, Curator_Self: no flag
    assert.equal(inScopeFlagScope(false, { personTypes: [], orgUnits: null }), null)
})

test('rowInScopeCanCurate: in scope, proxy or own row', () => {
    assert.equal(rowInScopeCanCurate(1, false, false), true)
    assert.equal(rowInScopeCanCurate('1', false, false), true) // MySQL may send it as text
    assert.equal(rowInScopeCanCurate(0, false, false), false)
    assert.equal(rowInScopeCanCurate('0', false, false), false)
    assert.equal(rowInScopeCanCurate(0, true, false), true)
    assert.equal(rowInScopeCanCurate(0, false, true), true)
})
