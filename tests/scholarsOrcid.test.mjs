// Unit tests for src/utils/scholarsOrcid.ts (/manageprofile defers to Scholars for active scholars).
import test from 'node:test'
import assert from 'node:assert/strict'
import { scholarsStatus, scholarsChangeUrl, identityOrcidUpdate } from '../src/utils/scholarsOrcid.ts'

test('scholarsStatus: in a fresh table is a scholar, absent from a fresh table is not', () => {
    assert.equal(scholarsStatus({ hasConfirmedOrcid: 1, ageHours: 3 }), 'scholar')
    assert.equal(scholarsStatus({ hasConfirmedOrcid: 0, ageHours: 47 }), 'scholar')
    assert.equal(scholarsStatus({ hasConfirmedOrcid: null, ageHours: 3 }), 'not_scholar')
})

test('scholarsStatus: no row or a stale/empty table is unknown', () => {
    assert.equal(scholarsStatus(undefined), 'unknown')
    assert.equal(scholarsStatus(null), 'unknown')
    assert.equal(scholarsStatus({ hasConfirmedOrcid: 1, ageHours: 48 }), 'unknown')
    assert.equal(scholarsStatus({ hasConfirmedOrcid: null, ageHours: 48 }), 'unknown')
    assert.equal(scholarsStatus({ hasConfirmedOrcid: null, ageHours: null }), 'unknown')
})

test('scholarsChangeUrl: queue link with lowercased cwid, base override', () => {
    assert.equal(scholarsChangeUrl('ABC1234'), 'https://scholars.weill.cornell.edu/edit/orcid-queue?q=abc1234')
    assert.equal(scholarsChangeUrl('abc1234', 'https://scholars-staging.weill.cornell.edu/'),
        'https://scholars-staging.weill.cornell.edu/edit/orcid-queue?q=abc1234')
})

test('identityOrcidUpdate: save writes only a changed iD, keeps the rest of the record', () => {
    const rec = { uid: 'abc1234', orcid: '0000-0002-1825-0097', other: 1 }
    assert.equal(identityOrcidUpdate(rec, { save: '0000-0002-1825-0097' }), null)
    assert.deepEqual(identityOrcidUpdate(rec, { save: '0000-0001-5109-3700' }),
        { uid: 'abc1234', orcid: '0000-0001-5109-3700', other: 1 })
    assert.deepEqual(identityOrcidUpdate({ uid: 'x' }, { save: '0000-0001-5109-3700' }),
        { uid: 'x', orcid: '0000-0001-5109-3700' })
    assert.equal(identityOrcidUpdate(null, { save: '0000-0001-5109-3700' }), null)
})

test('identityOrcidUpdate: remove clears only the iD PM saved', () => {
    const rec = { uid: 'abc1234', orcid: '0000-0002-1825-0097' }
    assert.deepEqual(identityOrcidUpdate(rec, { remove: '0000-0002-1825-0097' }), { uid: 'abc1234', orcid: null })
    assert.equal(identityOrcidUpdate(rec, { remove: '0000-0001-5109-3700' }), null)
    assert.equal(identityOrcidUpdate(rec, { remove: null }), null)
    assert.equal(identityOrcidUpdate(null, { remove: '0000-0002-1825-0097' }), null)
})
