// Unit tests for src/utils/canonicalCwid.ts (convert person identifiers on the way in). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canonicalCwid, isValidCwid, parseCwid, parseCwidList, cwidParam, sameCwid, isExternalCohortId, javaStrip } from '../src/utils/canonicalCwid.ts'
import { canonicalCwid as assignCanonical, toCanonicalCwid } from '../src/lib/assignGate.ts'

// ReCiter's UidCanonicalizerTest table (reciter.utils.UidCanonicalizer, ReCiter #787/#789).
// PM writes keys ReCiter looks up byte-exact, so every row must give the same answer here.
const JAVA_VALID = [
    ['abl9002', 'abl9002'], ['Abl9002', 'abl9002'], ['DLAMB', 'dlamb'], ['HAF9018', 'haf9018'],
    ['Hlloyd', 'hlloyd'], ['ggi9001 ', 'ggi9001'], [' Isk9008', 'isk9008'], ['\tJih9026\n', 'jih9026'],
    [' Abl9002\u3000', 'abl9002'], ['ab123', 'ab123'], ['Jason.Carmel', 'jason.carmel'],
    ['str2025-mi', 'str2025-mi'], ['_lsw8099', '_lsw8099'], ['UC_Abc', 'uc_abc'],
    ['fredhutch_Rachel.Rau', 'fredhutch_Rachel.Rau'], [' fredhutch_Rachel.Rau ', 'fredhutch_Rachel.Rau'],
    ['fh_catherine.albert', 'fh_catherine.albert'], ['usc_123', 'usc_123'], ['ucsf_AbC', 'ucsf_AbC'],
    ['ucla_Xy-1', 'ucla_Xy-1'], ['UCSF_AbC', 'ucsf_AbC'], ['FREDHUTCH_A.B', 'fredhutch_A.B'], ['Usc_123', 'usc_123'],
]
const JAVA_INVALID = ['', '   ', 'kims7@mskcc.org', 'ldn9002@nyp.org', 'Mahender Jangari', 'Hello, world!',
    'abc 123', 'fredhutch_Rachel Rau', 'usc_a@b', 'abc/123', 'abc\u00e9', 'usc_', 'fh_', 'fredhutch_', 'ucsf_',
    ' UCLA_ ', 'abc\r\n[ERROR] x', 'abc\x00x']

test('Java UidCanonicalizer table: valid inputs give the same canonical uid', () => {
    for (const [input, want] of JAVA_VALID) {
        assert.equal(parseCwid(input), want, JSON.stringify(input))
        assert.equal(toCanonicalCwid(input), want, `assignGate ${JSON.stringify(input)}`)
        assert.ok(isValidCwid(want), want)
    }
})

test('Java UidCanonicalizer table: invalid inputs are rejected', () => {
    for (const input of JAVA_INVALID) assert.equal(parseCwid(input), null, JSON.stringify(input))
})

test('whitespace is Java String.strip(), not JS trim()', () => {
    // Java keeps the non-breaking spaces and the BOM, so these stay invalid uids.
    for (const ws of ['\u00a0', '\u2007', '\u202f', '\ufeff']) {
        assert.equal(javaStrip(`${ws}abc${ws}`), `${ws}abc${ws}`)
        assert.equal(parseCwid(`abl9002${ws}`), null, JSON.stringify(ws))
        assert.equal(toCanonicalCwid(`abl9002${ws}`), `abl9002${ws}`)
    }
    // Java strips U+001C..U+001F (trim() does not) and the Unicode spaces trim() also strips.
    for (const ws of ['\x1c', '\x1d', '\x1e', '\x1f', '\u1680', '\u2000', '\u200a', '\u2028', '\u2029', '\u205f', '\u3000', '\v', '\f', '\r']) {
        assert.equal(parseCwid(`${ws}Abl9002${ws}`), 'abl9002', JSON.stringify(ws))
        assert.equal(toCanonicalCwid(`${ws}Abl9002${ws}`), 'abl9002', JSON.stringify(ws))
    }
    // Inner whitespace is never stripped.
    assert.equal(javaStrip(' a b '), 'a b')
})

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
    // The prefix matches case-insensitively (as in Java); only the prefix is lowercased.
    assert.equal(canonicalCwid('FREDHUTCH_X'), 'fredhutch_X')
})

test('"uc_" alone is not a cohort prefix (uc[a-z]+_): lowercased like any id', () => {
    assert.ok(!isExternalCohortId('uc_x'))
    assert.ok(!isExternalCohortId('uc_X'))
    assert.equal(canonicalCwid('uc_x'), 'uc_x')
    assert.equal(canonicalCwid('uc_X'), 'uc_x')
    assert.equal(toCanonicalCwid('uc_X'), 'uc_x')
    assert.ok(isValidCwid('uc_x'))
    assert.ok(!isValidCwid('uc_X'))
})

test('bare external prefixes with nothing after them are rejected', () => {
    for (const id of ['usc_', 'fh_', 'fredhutch_', 'ucsf_', 'ucdavis_', ' usc_ ', 'FH_']) {
        assert.equal(parseCwid(id), null, JSON.stringify(id))
    }
    for (const id of ['usc_', 'fh_', 'fredhutch_', 'ucsf_']) assert.ok(!isValidCwid(id), id)
    // One character after the prefix is enough.
    assert.equal(parseCwid('usc_1'), 'usc_1')
    assert.equal(parseCwid('fh_X'), 'fh_X')
})

test('underscore-led ids like _pab4001 stay valid and separate', () => {
    assert.equal(parseCwid('_PAB4001'), '_pab4001')
    assert.ok(!sameCwid('_pab4001', 'pab4001'))
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
    for (const id of ['Abl9002', ' ggi9001 ', 'fredhutch_Rachel.Rau', 'Uca4001', 'usc_X', 'kjc39', 'uc_X', 'ucsf_Q', 'fh_']) {
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
        ['src/pages/api/db/external-article/feedback.ts', /const uid = cwidParam\(rawUid\)/],
        ['controllers/db/proxy.controller.ts', /personIdentifiers = Array\.from\(new Set\(rawPersonIdentifiers\.map\(\(p: unknown\) => parseCwid\(p\)/],
        ['controllers/db/proxy.controller.ts', /const personIdentifier = parseCwid\(rawPersonIdentifier\)/],
        ['controllers/db/proxy.controller.ts', /const personIdentifier = cwidParam\(req\.query\.personIdentifier\)/],
        ['controllers/pubmed.controller.ts', /const uid = cwidParam\(req\.body\.personIdentifier\)[\s\S]{0,300}getPublications\(uid, req\)/],
        ['src/middleware.ts', /proxyPersonIds\.some\(\(pid\) => sameCwid\(pid, curateTarget\)\)/],
    ]
    for (const [file, re] of cases) assert.match(src(file), re, file)
})

test('external-article feedback: the canCurate check and the write use the same canonical uid', () => {
    const f = src('src/pages/api/db/external-article/feedback.ts')
    const at = f.indexOf('const uid = cwidParam(rawUid)')
    assert.ok(at > 0)
    for (const use of ['feedbackExternal(uid,', 'canCurate(effectiveToken(token), uid)', 'recordExternalArticleFeedback(uid,']) {
        assert.ok(f.indexOf(use) > at, use)
    }
    assert.doesNotMatch(f, /const \{ uid, articleId/)
})

test('proxy lookups match a grant in any stored spelling, not via case-sensitive JSON_CONTAINS', () => {
    const f = src('controllers/db/proxy.controller.ts')
    assert.doesNotMatch(f, /WHERE JSON_CONTAINS/)
    assert.match(f, /parseCwid\(pid\) === canonicalId/)
    assert.match(f, /currentArr\.filter\(\(pid: string\) => parseCwid\(pid\) !== personIdentifier\)/)
})

test('admin_users: a login reuses the CWID row, then the email row, before creating', () => {
    const f = src('controllers/db/admin.users.controller.ts')
    assert.doesNotMatch(f, /AdminUser\.findOrCreate\(/)
    const byCwid = f.indexOf("where: { personIdentifier: uid }, order })")
    const byEmail = f.indexOf("where: { email, personIdentifier: { [Op.notLike]: '%@%' } }, order: [['userID', 'ASC']]")
    assert.ok(byCwid > 0 && byEmail > byCwid, 'CWID row preferred over email row, lowest userID')
    const reuse = f.indexOf('const existing = await findExistingAdminUser(uid, samlEmail)')
    const create = f.indexOf('models.AdminUser.create(')
    assert.ok(reuse > 0 && create > reuse, 'create only after the existing-row lookup')
})

test('direct login denies a non-CWID username instead of crashing on a null account', () => {
    const f = src('src/pages/api/auth/[...nextauth].jsx')
    assert.match(f, /const adminUser = await findOrcreateAdminUser\([\s\S]{0,200}\);\s*\/\/[^\n]*\n\s*if \(!adminUser\) return null;\s*\n\s*const assignedRoles = await grantDefaultRolesToAdminUser\(adminUser\)/)
})

test('admin_users: duplicate CWID rows resolve to the SAML-email row first, then lowest userID', () => {
    const f = src('controllers/db/admin.users.controller.ts')
    assert.match(f, /\[sequelize\.literal\(`\(email = \$\{sequelize\.escape\(email\)\}\)`\), 'DESC'\], \['userID', 'ASC'\]/)
})

test('authorship accept: the row top_cwid is canonical before identity/retired checks and writes', () => {
    const f = src('controllers/db/authorships.controller.ts')
    assert.match(f, /const cwid = row\.top_cwid \? toCanonicalCwid\(String\(row\.top_cwid\)\) : undefined;/)
    assert.doesNotMatch(f, /const cwid = row\.top_cwid as string/)
})

test('manage-users create: an existing account for the CWID/email is a 409, not a second row', () => {
    const f = src('controllers/db/manage-users/user.controller.ts')
    const check = f.indexOf('await findExistingAdminUser(canonical, email || undefined)')
    const conflict = f.indexOf('res.status(409)', check)
    const create = f.indexOf('models.AdminUser.create(createUserPayload')
    assert.ok(check > 0 && conflict > check && create > conflict, 'existence check + 409 before create')
})

test('parseCwidList: canonical, de-duplicated, invalid entries split out', () => {
    assert.deepEqual(parseCwidList(['Abl9002', 'abl9002 ', 'fredhutch_Rachel.Rau', 'a b', 'x@y.edu', '', 7, 'ggi9001']),
        { valid: ['abl9002', 'fredhutch_Rachel.Rau', 'ggi9001'], invalid: ['a b', 'x@y.edu', '', 7] })
    assert.deepEqual(parseCwidList('abl9002'), { valid: [], invalid: [] })
})

test('feature-generator/group: bulk uids are canonicalized before they reach ReCiter', () => {
    const f = src('controllers/featuregeneratorbulk.controller.ts')
    assert.match(f, /const \{ valid: uids, invalid \} = parseCwidList\(rawBody\)/)
    assert.match(f, /statusCode: 400, statusText: 'No valid uids in request body'/)
    assert.match(f, /body: JSON\.stringify\(uids\)/)
    assert.match(f, /getPendingFeedback\(uids, data\)/)
    assert.match(f, /sameCwid\(item\?\.personIdentifier, uid\)/)
    assert.doesNotMatch(f, /JSON\.stringify\(req\.body\)/)
})

test('self/proxy checks compare canonical forms, so a stored `Abl9002` role row still matches abl9002', () => {
    assert.match(src('src/middleware.ts'), /let loggedInUserInfo = canonicalCwid\(userRoles\[0\]\.personIdentifier\)/)
    assert.match(src('src/components/elements/Notifications/Notifications.tsx'), /sameCwid\(router\.query\.userId, session\.data\.username\)/)
    assert.match(src('src/pages/api/db/admin/view-as/lookup.ts'), /sameCwid\(cwid, token\?\.username\)/)
    const search = src('src/components/elements/Search/Search.js')
    assert.match(search, /sameCwid\(pid, loggedInPersonIdentifier\)/)
    assert.doesNotMatch(search, /pid === loggedInPersonIdentifier/)
    assert.doesNotMatch(search, /isProxyFor\(proxyPersonIds,/)
    const profile = src('src/components/elements/Profile/Profile.tsx')
    assert.match(profile, /sameCwid\(uid, caps\.canCurate\.personIdentifier\)/)
    assert.doesNotMatch(profile, /isProxyFor\(proxyPersonIds, uid\)/)
    // A malformed proxy entry canonicalizes to '' and must never match an all-whitespace target.
    assert.match(src('controllers/db/authorization.controller.ts'), /const uid = canonicalCwid\(targetUid\)[\s\S]{0,200}if \(uid === ''\) return false/)
})
