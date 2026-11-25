// Unit tests for src/utils/partnerAccount.ts (Cornell NetID self-curation accounts). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { decidePartnerLogin, netidFromPartnerKey } from '../src/utils/partnerAccount.ts'

const KEY = 'abc123@cornell.edu'
const ROSTER = ['cornell-ithaca', 'academic-faculty']

test('netidFromPartnerKey accepts only a well-formed lowercase netid@cornell.edu', () => {
    assert.equal(netidFromPartnerKey(KEY), 'abc123')
    for (const bad of ['abc123', 'abc123@med.cornell.edu', 'abc123@cornell.edu.evil', 'ABC123@cornell.edu', 'a.b@cornell.edu', '@cornell.edu', null, 42]) {
        assert.equal(netidFromPartnerKey(bad), null, String(bad))
    }
})

test('first login of a rostered NetID creates the account with a proxy grant', () => {
    assert.deepEqual(decidePartnerLogin(KEY, ROSTER, null), { ok: true, netid: 'abc123', create: true, setProxy: true })
})

test('NetID without the cornell-ithaca type (unknown, or a WCM-only person) is refused', () => {
    assert.deepEqual(decidePartnerLogin(KEY, [], null), { ok: false, reason: 'not_on_roster' })
    assert.deepEqual(decidePartnerLogin(KEY, ['academic-faculty-weillfulltime'], null), { ok: false, reason: 'not_on_roster' })
    assert.deepEqual(decidePartnerLogin(KEY, null, null), { ok: false, reason: 'not_on_roster' })
})

test('leaving the roster refuses an existing account', () => {
    assert.equal(decidePartnerLogin(KEY, [], { personIdentifier: KEY, status: 1, proxy_person_ids: ['abc123'] }).ok, false)
})

test('status 0 means an administrator disabled the account', () => {
    assert.deepEqual(decidePartnerLogin(KEY, ROSTER, { personIdentifier: KEY, status: 0, proxy_person_ids: ['abc123'] }), { ok: false, reason: 'disabled' })
})

test('the proxy grant is server-owned: reset to [netid] whenever it differs', () => {
    const ok = (proxy) => decidePartnerLogin(KEY, ROSTER, { personIdentifier: KEY, status: 1, proxy_person_ids: proxy })
    assert.equal(ok(['abc123']).setProxy, false)
    assert.equal(ok('["abc123"]').setProxy, false)
    assert.equal(ok(['abc123', 'xyz9999']).setProxy, true)
    assert.equal(ok(['xyz9999']).setProxy, true)
    assert.equal(ok(null).setProxy, true)
    assert.equal(ok('not json').setProxy, true)
})

test('a case-insensitive match on a different stored key is refused', () => {
    assert.deepEqual(decidePartnerLogin(KEY, ROSTER, { personIdentifier: 'abc123', status: 1 }), { ok: false, reason: 'key_mismatch' })
})

test('reciterActor never sends a Cornell key (or its bare NetID) to ReCiter', async () => {
    const { reciterActor } = await import('../src/utils/partnerAccount.ts')
    assert.equal(reciterActor('abc1234'), 'abc1234')
    assert.equal(reciterActor('abc123@cornell.edu'), undefined)
    assert.equal(reciterActor(''), undefined)
    assert.equal(reciterActor(undefined), undefined)
})

test('Cornell rows stay out of the email fallbacks and settings need an admin', async () => {
    const { readFileSync } = await import('node:fs')
    const users = readFileSync(new URL('../controllers/db/admin.users.controller.ts', import.meta.url), 'utf8')
    const provision = users.slice(users.indexOf('export const provisionPartnerAdminUser'))
    assert.match(provision, /email: null,/)
    assert.match(provision, /models\.Person\.findOne/)
    // Cornell sends no givenName/sn: the names fall back to the roster row, which must be selected.
    assert.match(provision, /attributes: \['personIdentifier', 'firstName', 'lastName'\]/)
    assert.match(provision, /nameFirst: firstName \|\| person\?\.firstName/)
    assert.match(provision, /nameLast: lastName \|\| person\?\.lastName/)
    assert.match(users, /where: \{ email, personIdentifier: \{ \[Op\.notLike\]: '%@%' \} \}/)
    const settings = readFileSync(new URL('../src/pages/api/db/admin/settings/updateSettings/index.ts', import.meta.url), 'utf8')
    assert.ok(settings.indexOf('isAuthorizedAdmin(req)') > 0 && settings.indexOf('isAuthorizedAdmin(req)') < settings.indexOf('await updateAdminSettings'))
})
