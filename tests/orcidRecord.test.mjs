// Unit tests for src/lib/orcidRecord.ts (the opened /authorships row's ORCID panel). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { familyOnByline, getOrcidRecord, isCornellOrg, isOrcid, parseOrcidRecord, primaryFromRedirect, yearsText } from '../src/lib/orcidRecord.ts'

const A = '0000-0002-1825-0097', B = '0000-0001-5109-3700'
const y = (v) => (v ? { year: { value: String(v) } } : null)
const aff = (kind, org, start, end, extra = {}) => ({ summaries: [{ [`${kind}-summary`]: { organization: { name: org }, 'start-date': y(start), 'end-date': y(end), ...extra } }] })
const rec = {
    person: {
        name: { 'given-names': { value: 'Ana' }, 'family-name': { value: 'García-López' }, 'credit-name': { value: 'A. García' } },
        'other-names': { 'other-name': [{ content: 'Ana Smith' }, { content: 'ana garcía-lópez' }] },
        emails: { email: [{ email: 'a@Cornell.edu' }, { email: 'a@gmail.com' }] },
    },
    'activities-summary': {
        employments: { 'affiliation-group': [aff('employment', 'Old U', 2001, 2005), aff('employment', 'Cornell University', 2019, null, { 'department-name': 'Physics', 'role-title': 'Professor' }), { summaries: null }] },
        educations: { 'affiliation-group': [aff('education', 'MIT', 2010, 2014)] },
    },
}

test('isOrcid: shape and check digit', () => {
    assert.ok(isOrcid(A)); assert.ok(isOrcid(B)); assert.ok(isOrcid('0000-0002-1694-233X'))
    for (const bad of ['0000-0002-1825-0098', A + '/x', '../' + A, A.replace(/-/g, ''), null, 5]) assert.equal(isOrcid(bad), false, String(bad))
})

test('parse: current job first, then newest; names de-duplicated; consumer mail dropped', () => {
    const r = parseOrcidRecord(A, A, rec)
    assert.deepEqual(r.affiliations.map((a) => a.org), ['Cornell University', 'MIT', 'Old U'])
    assert.deepEqual(r.affiliations[0], { kind: 'employment', org: 'Cornell University', dept: 'Physics', role: 'Professor', start: 2019, end: null })
    assert.deepEqual(r.otherNames, ['A. García', 'Ana Smith'])
    assert.deepEqual(r.emailDomains, ['cornell.edu'])
    assert.equal(r.deprecated, false)
    assert.deepEqual(parseOrcidRecord(A, A, {}), { orcid: A, deprecated: false, name: '', family: '', otherNames: [], affiliations: [], emailDomains: [] })
})

test('parse: long text and long lists are bounded', () => {
    const r = parseOrcidRecord(A, A, { 'activities-summary': { employments: { 'affiliation-group': Array.from({ length: 90 }, () => aff('employment', 'x'.repeat(5000), 2000, null)) } } })
    assert.equal(r.affiliations.length, 40); assert.equal(r.affiliations[0].org.length, 200)
})

test('familyOnByline', () => {
    const r = parseOrcidRecord(A, A, rec)
    assert.ok(familyOnByline(r, 'Ana Garcia')); assert.ok(familyOnByline(r, 'A Smith')); assert.ok(!familyOnByline(r, 'Bo Chen'))
    const f = (family, byline) => familyOnByline({ family, otherNames: [] }, byline)
    assert.ok(f('O’Brien', "Stephen J. O'Brien")); assert.ok(f('De Vlaminck', 'Iwijn DeVlaminck')); assert.ok(f('Li', 'Li Y'))
    assert.ok(!f('Li', 'Oliver Wu')); assert.ok(f('李', 'Yi Li')); assert.ok(f('', 'Yi Li'))
})

test('yearsText, isCornellOrg', () => {
    const t = (kind, start, end) => yearsText({ kind, start, end, org: '', dept: '', role: '' })
    assert.equal(t('employment', 2019, null), '2019 to now'); assert.equal(t('education', 2019, null), 'from 2019')
    assert.equal(t('education', 2010, 2014), '2010 to 2014'); assert.equal(t('employment', null, 2014), 'until 2014'); assert.equal(t('employment', null, null), '')
    assert.ok(isCornellOrg('Weill Medical College')); assert.ok(!isCornellOrg('Cornellia College'))
})

test('fetch: merged iD is followed by iD only, never to another host; cached; failures retried', async () => {
    const urls = []
    const ok = () => new Response(JSON.stringify(rec), { status: 200 })
    const r = await getOrcidRecord(A, async (u, o) => {
        urls.push(u); assert.equal(o.redirect, 'manual')
        return urls.length === 1 ? new Response(null, { status: 301, headers: { location: `http://169.254.169.254/${B}/record` } }) : ok()
    })
    assert.deepEqual(urls, [`https://pub.orcid.org/v3.0/${A}/record`, `https://pub.orcid.org/v3.0/${B}/record`])
    assert.equal(r.orcid, B); assert.equal(r.deprecated, true)
    assert.equal(await getOrcidRecord(A, () => assert.fail('cached')), r)
    assert.equal(primaryFromRedirect(A, 'http://evil.example/'), null)

    await assert.rejects(getOrcidRecord(B, async () => new Response('', { status: 503 })))
    await assert.rejects(getOrcidRecord(B, async () => new Response(new Uint8Array(9_000_000), { status: 200 })), /too large/)
    assert.equal((await getOrcidRecord(B, async () => ok())).orcid, B)
    assert.equal(await getOrcidRecord('0000-0002-1694-233X', async () => new Response('', { status: 409 })), null)
})
