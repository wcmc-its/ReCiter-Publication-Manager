// Unit tests for src/utils/scholarsOrcid.ts (/manageprofile defers to Scholars for active scholars).
import test from 'node:test'
import assert from 'node:assert/strict'
import { scholarsManagesOrcid, scholarsChangeUrl } from '../src/utils/scholarsOrcid.ts'

test('scholarsManagesOrcid: active scholar in a fresh table is locked', () => {
    assert.equal(scholarsManagesOrcid({ hasConfirmedOrcid: 1, ageHours: 3 }), true)
    assert.equal(scholarsManagesOrcid({ hasConfirmedOrcid: 0, ageHours: 47 }), true)
})

test('scholarsManagesOrcid: no row or a stale/empty table keeps the editable field', () => {
    assert.equal(scholarsManagesOrcid(undefined), false)
    assert.equal(scholarsManagesOrcid(null), false)
    assert.equal(scholarsManagesOrcid({ hasConfirmedOrcid: 1, ageHours: 48 }), false)
    assert.equal(scholarsManagesOrcid({ hasConfirmedOrcid: 1, ageHours: null }), false)
})

test('scholarsChangeUrl: queue link with lowercased cwid, base override', () => {
    assert.equal(scholarsChangeUrl('ABC1234'), 'https://scholars.weill.cornell.edu/edit/orcid-queue?q=abc1234')
    assert.equal(scholarsChangeUrl('abc1234', 'https://scholars-staging.weill.cornell.edu/'),
        'https://scholars-staging.weill.cornell.edu/edit/orcid-queue?q=abc1234')
})
