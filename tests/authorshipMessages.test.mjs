// Unit tests for src/utils/authorshipMessages.ts (/authorships toast copy). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { actionToast, plainReason, actionErrorToast } from '../src/utils/authorshipMessages.ts'

const bales = { wcm_author: 'Michael Bales', id: 1 }

test('actionToast: one row names the author', () => {
    assert.equal(actionToast('snooze', [bales]), 'Snoozed for 90 days: Michael Bales')
    assert.equal(actionToast('dismiss', [bales]), 'Dismissed: Michael Bales')
    assert.equal(actionToast('reject', [bales], 'Ignored Target'), 'Rejected: Michael Bales')
})

test('actionToast: accept and assign add the identity', () => {
    assert.equal(actionToast('accept', [bales], 'Michael E. Bales'), 'Accepted: Michael Bales → Michael E. Bales')
    assert.equal(actionToast('assign', [bales], 'Jane Doe'), 'Assigned: Michael Bales → Jane Doe')
    assert.equal(actionToast('accept', [bales], null), 'Accepted: Michael Bales')
    assert.equal(actionToast('accept', [bales], '  '), 'Accepted: Michael Bales')
})

test('actionToast: bulk counts authorships with the short verb', () => {
    assert.equal(actionToast('snooze', [bales, bales, bales]), 'Snoozed 3 authorships')
    assert.equal(actionToast('accept', [bales, bales], 'X'), 'Accepted 2 authorships')
    assert.equal(actionToast('assign', Array(1200).fill(bales)), 'Assigned 1,200 authorships')
})

test('actionToast: falls back to the title, then the row id', () => {
    assert.equal(actionToast('dismiss', [{ wcm_author: '', title: 'A paper' }]), 'Dismissed: A paper')
    assert.equal(actionToast('dismiss', [{ id: 7 }]), 'Dismissed: row 7')
})

test('plainReason: plain server text passes through as a sentence', () => {
    assert.equal(plainReason(new Error('Gold-standard write failed (500)')), 'Gold-standard write failed (500).')
    assert.equal(plainReason(new Error('Jane has no record in ReCiter — dismiss it instead.')), 'Jane has no record in ReCiter — dismiss it instead.')
})

test('plainReason: JSON is unwrapped, never shown raw', () => {
    assert.equal(plainReason(new Error('{"message":"Multiple candidates"}')), 'Multiple candidates.')
    assert.equal(plainReason(new Error('{"error":"Too many connections"}')), 'Too many connections.')
    const generic = plainReason(Object.assign(new Error('{"foo":1}'), { status: 500 }))
    assert.equal(generic, 'The server had a problem saving it (HTTP 500).')
    assert.ok(!plainReason(new Error('{"a":')).includes('{'))
})

test('plainReason: exceptions, HTML and bare statuses become a generic sentence', () => {
    assert.equal(plainReason(new Error('SequelizeConnectionError: Too many connections')), 'The server had a problem saving it.')
    assert.equal(plainReason(new Error('<!DOCTYPE html><html>…')), 'The server had a problem saving it.')
    assert.equal(plainReason(new Error('HTTP 502')), 'The server had a problem saving it (HTTP 502).')
    assert.equal(plainReason(new TypeError('Failed to fetch')), 'The server could not be reached.')
    assert.equal(plainReason(new Error('')), 'The server had a problem saving it.')
    assert.equal(plainReason(undefined), 'The server had a problem saving it.')
})

test('actionErrorToast: names the action and the author', () => {
    const e = Object.assign(new Error('{"message":"boom"}'), { status: 500 })
    assert.equal(actionErrorToast('dismiss', { wcm_author: 'Nicolás Di Siervi' }, e),
        "Couldn't dismiss Nicolás Di Siervi. boom. The row is back in the list; nothing was saved.")
    assert.equal(actionErrorToast('accept', bales, new Error('No proposed identity'), { rowRestored: false }),
        "Couldn't accept Michael Bales. No proposed identity.")
})
