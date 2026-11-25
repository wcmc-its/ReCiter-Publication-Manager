// Unit tests for src/utils/samlIdentity.ts (WCM vs Cornell NetID logins). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { classifySamlAttributes, cornellLoginEnabled } from '../src/utils/samlIdentity.ts'
import { isValidCwid } from '../src/utils/canonicalCwid.ts'

const EPPN = 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6'
const MAIL = 'urn:oid:0.9.2342.19200300.100.1.3'
const ON = { cornellLogin: true }
const OFF = { cornellLogin: false }

test('WCM login with ePPN @med.cornell.edu keeps the CWID path', () => {
    const r = classifySamlAttributes({ CWID: ['abc1234'], uid: ['abc1234'], [EPPN]: ['abc1234@med.cornell.edu'], 'user.email': ['a@med.cornell.edu'], 'urn:oid:2.5.4.42': ['Ann'] }, OFF)
    assert.deepEqual(r, { kind: 'wcm', personIdentifier: 'abc1234', email: 'a@med.cornell.edu', firstName: 'Ann', lastName: '' })
})

test('WCM-Qatar login (ePPN @qatar-med.cornell.edu) keeps the CWID path', () => {
    const r = classifySamlAttributes({ CWID: ['abc1234'], [EPPN]: ['abc1234@qatar-med.cornell.edu'], 'user.email': ['abc1234@qatar-med.cornell.edu'] }, ON)
    assert.equal(r.kind, 'wcm')
    assert.equal(r.personIdentifier, 'abc1234')
    assert.equal(r.email, 'abc1234@qatar-med.cornell.edu')
    assert.equal(classifySamlAttributes({ CWID: ['x'], [EPPN]: ['x@evil.qatar-med.cornell.edu'] }, ON).reason, 'untrusted_scope')
})

test('assertion without an ePPN keeps the legacy CWID || uid path', () => {
    assert.equal(classifySamlAttributes({ uid: ['abc1234'] }, OFF).personIdentifier, 'abc1234')
    assert.equal(classifySamlAttributes({ CWID: ['x'], uid: ['y'] }, OFF).personIdentifier, 'x')
})

test('Cornell login: the key is the full ePPN, never CWID or uid', () => {
    const r = classifySamlAttributes({ uid: ['abc1234'], CWID: ['abc1234'], [EPPN]: ['ABC1234@Cornell.edu'], [MAIL]: ['abc1234@cornell.edu'] }, ON)
    assert.equal(r.kind, 'cornell')
    assert.equal(r.personIdentifier, 'abc1234@cornell.edu')
    assert.equal(r.email, 'abc1234@cornell.edu')
    // Can never be used where a CWID is expected.
    assert.equal(isValidCwid(r.personIdentifier), false)
})

test('Cornell login is refused while CORNELL_LOGIN is off, even with a uid', () => {
    assert.deepEqual(classifySamlAttributes({ uid: ['abc1234'], [EPPN]: ['abc1234@cornell.edu'] }, OFF), { kind: 'refused', reason: 'cornell_login_off' })
})

test('other institutions and malformed ePPNs are refused', () => {
    assert.equal(classifySamlAttributes({ CWID: ['x'], [EPPN]: ['kim@mskcc.org'] }, ON).reason, 'untrusted_scope')
    assert.equal(classifySamlAttributes({ CWID: ['x'], [EPPN]: ['abc@evil.cornell.edu'] }, ON).reason, 'untrusted_scope')
    assert.equal(classifySamlAttributes({ CWID: ['x'], [EPPN]: ['no-scope'] }, ON).reason, 'untrusted_scope')
    assert.equal(classifySamlAttributes({ [EPPN]: ['a.b@cornell.edu'] }, ON).reason, 'bad_netid')
    assert.equal(classifySamlAttributes({ [EPPN]: ['@cornell.edu'] }, ON).reason, 'bad_netid')
})

test('CORNELL_LOGIN flag reads only "on"', () => {
    assert.equal(cornellLoginEnabled({ CORNELL_LOGIN: 'on' }), true)
    assert.equal(cornellLoginEnabled({ CORNELL_LOGIN: ' ON ' }), true)
    assert.equal(cornellLoginEnabled({ CORNELL_LOGIN: 'true' }), false)
    assert.equal(cornellLoginEnabled({}), false)
})
