// Unit tests for src/utils/canonicalCwid.ts (convert person identifiers on the way in). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canonicalCwid, isValidCwid, parseCwid, cwidParam, sameCwid, isExternalCohortId } from '../src/utils/canonicalCwid.ts'
import { canonicalCwid as assignCanonical, toCanonicalCwid } from '../src/lib/assignGate.ts'

// The families the 11-18 DynamoDB scan found, and what each must become.
test('canonicalCwid: trims, then lowercases', () => {
    assert.equal(canonicalCwid('Abl9002'), 'abl9002')
    assert.equal(canonicalCwid('DLAMB'), 'dlamb')
    assert.equal(canonicalCwid('HAF9018'), 'haf9018')
    assert.equal(canonicalCwid('ggi9001 '), 'ggi9001')
    assert.equal(canonicalCwid(' Isk9008'), 'isk9008')
    assert.equal(canonicalCwid('\tmrj4001\n'), 'mrj4001')
    assert.equal(canonicalCwid('abl9002'), 'abl9002')
})

test('canonicalCwid: non-strings become empty', () => {
    for (const v of [undefined, null, 42, ['abl9002'], {}]) assert.equal(canonicalCwid(v), '')
})

test('external cohort ids keep their case but are still trimmed', () => {
    assert.equal(canonicalCwid('fredhutch_Rachel.Rau'), 'fredhutch_Rachel.Rau')
    assert.equal(canonicalCwid(' fredhutch_Erin.crotty '), 'fredhutch_Erin.crotty')
    for (const id of ['usc_123', 'fh_x', 'ucsf_A1', 'ucdavis_Q', 'ucsd_1', 'ucla_2', 'uci_3']) {
        assert.ok(isExternalCohortId(id), id)
        assert.equal(canonicalCwid(id), id)
    }
})

test('a bare "uc" start is a real WCM CWID, not a cohort: still lowercased', () => {
    for (const id of ['Uca4001', 'UCX9002', 'Ucs9009']) {
        assert.ok(!isExternalCohortId(id.trim()), id)
        assert.equal(canonicalCwid(id), id.toLowerCase())
    }
    // The prefix has to be lowercase as written to count as a cohort.
    assert.equal(canonicalCwid('FREDHUTCH_X'), 'fredhutch_x')
})

test('isValidCwid: canonical identifiers of every shape we keep', () => {
    for (const id of ['abl9002', 'mtw1', 'kjc39', 'dlamb', 'jason.carmel', 'str2025-mi', '_lsw8099',
        'usc_123', 'fredhutch_Rachel.Rau', 'ucsf_x-y']) {
        assert.ok(isValidCwid(id), id)
    }
})

test('isValidCwid: rejects what is still not an identifier', () => {
    for (const id of ['', 'Abl9002', 'ggi9001 ', 'kims7@mskcc.org', 'ldn9002@nyp.org', 'hello, world!',
        'mahender jangari', 'a/b', "o'brien", 'x'.repeat(65), 'fredhutch_Rachel Rau', 'fredhutch_a@b']) {
        assert.ok(!isValidCwid(id), JSON.stringify(id))
    }
    assert.ok(!isValidCwid(undefined))
    assert.ok(!isValidCwid(['abl9002']))
})

test('parseCwid: canonical form when valid, null otherwise', () => {
    assert.equal(parseCwid(' Abl9002 '), 'abl9002')
    assert.equal(parseCwid('WCMCWID'), 'wcmcwid') // shape is not policed, only characters
    assert.equal(parseCwid('kims7@mskcc.org'), null)
    assert.equal(parseCwid('Hello, world!'), null)
    assert.equal(parseCwid('Mahender Jangari'), null)
    assert.equal(parseCwid('   '), null)
    assert.equal(parseCwid(undefined), null)
})

test('cwidParam: route params arrive as string | string[]', () => {
    assert.equal(cwidParam('Abl9002'), 'abl9002')
    assert.equal(cwidParam(['Abl9002', 'zzz1']), 'abl9002')
    assert.equal(cwidParam([]), null)
    assert.equal(cwidParam(undefined), null)
})

test('sameCwid: canCurate self check compares canonical on both sides', () => {
    assert.ok(sameCwid('Abl9002', 'abl9002'))
    assert.ok(sameCwid('abl9002 ', 'ABL9002'))
    assert.ok(!sameCwid('abl9002', 'abl9003'))
    assert.ok(!sameCwid('', ''))
    assert.ok(!sameCwid(undefined, undefined))
    assert.ok(!sameCwid('fredhutch_Rachel.Rau', 'fredhutch_rachel.rau'))
})

test('assignGate keeps the same rule inline, and the canonical form always wins', () => {
    for (const id of ['Abl9002', ' ggi9001 ', 'fredhutch_Rachel.Rau', 'Uca4001', 'usc_X', 'kjc39']) {
        assert.equal(toCanonicalCwid(id), canonicalCwid(id), id)
    }
    // Even over a byte-exact hit on a mixed-case twin (the pre-cleanup ordering).
    assert.equal(assignCanonical('DLAMB', new Set(['DLAMB', 'dlamb'])), 'dlamb')
    assert.equal(assignCanonical('DLAMB', new Set(['DLAMB'])), 'dlamb')
    assert.equal(assignCanonical('Aaa2014', new Set(['aaa2014'])), 'aaa2014')
})

// Source checks: every write boundary named in the plan routes the uid through the helper.
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
test('write boundaries canonicalize on the way in', () => {
    const cases = [
        ['controllers/db/admin.users.controller.ts', /const uid = rawUid \? canonicalCwid\(rawUid\)/],
        ['src/pages/api/auth/[...nextauth].jsx', /token\.username = canonicalCwid\(/],
        ['src/pages/api/reciter/update/goldstandard.ts', /const targetUid = parseCwid\(req\.body\?\.uid\)/],
        ['src/pages/api/reciter/update/goldstandard.ts', /req\.body\.uid = targetUid/],
        ['src/pages/api/reciter/feature-generator/[uid].ts', /const uid = cwidParam\(req\.query\.uid\)/],
        ['controllers/featuregenerator.controller.ts', /const uid = cwidParam\(rawUid\)/],
        ['controllers/db/admin.feedbacklog.controller.ts', /const personIdentifier = parseCwid\(req\.body\?\.personIdentifier\)/],
        ['controllers/db/authorships.controller.ts', /async function writeGoldStandard\(\s*rawUid[\s\S]{0,400}const uid = parseCwid\(rawUid\)/],
        ['controllers/db/authorships.controller.ts', /const identity = \{ \.\.\.rawIdentity, uid \}/],
        ['controllers/db/authorships.controller.ts', /const personIdentifier = parseCwid\(rawPersonIdentifier\)/],
        ['controllers/db/authorships.controller.ts', /async function registerForFeatureGenerator\(rawUid: string\) \{\s*const uid = parseCwid\(rawUid\)/],
        ['src/lib/externalStore.ts', /const uid = parseCwid\(o\.uid\)/],
        ['controllers/db/manage-profile/manageProfile.controller.ts', /const personIdentifier = cwidParam\(req\.body\?\.personIdentifier\)/],
        ['controllers/db/notifications/notifications.controller.ts', /const personIdentifier = cwidParam\(req\.body\?\.personIdentifier\)/],
        ['controllers/db/manage-profile/authorIds.controller.ts', /const person = parseCwid\(uid\)/],
        ['controllers/db/authorization.controller.ts', /sameCwid\(caps\.canCurate\.personIdentifier, uid\)/],
        ['controllers/db/manage-users/user.controller.ts', /'personIdentifier': canonical,/],
        ['src/components/elements/CurateIndividual/CurateIndividual.tsx', /const id = canonicalCwid\(/],
    ]
    for (const [file, re] of cases) assert.match(src(file), re, file)
})
