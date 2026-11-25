// Unit tests for src/utils/noAccessMessage.ts (the /noaccess wording). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { noAccessMessage } from '../src/utils/noAccessMessage.ts'

test('nothing while the session loads', () => {
    assert.equal(noAccessMessage('loading', undefined), null)
})

test('a refused sign-in (no session) is not called a roles problem', () => {
    assert.match(noAccessMessage('unauthenticated', undefined), /this account doesn't have access/)
})

test('signed in with no roles keeps the roles message', () => {
    for (const roles of [undefined, '', '[]', [], 'not json'])
        assert.match(noAccessMessage('authenticated', roles), /don't have any roles assigned/, String(roles))
})

test('signed in with roles gets the generic message', () => {
    assert.match(noAccessMessage('authenticated', '[{"roleLabel":"Reporter_All"}]'), /^Sorry, you don't have access/)
    assert.match(noAccessMessage('authenticated', [{ roleLabel: 'Reporter_All' }]), /^Sorry/)
})
