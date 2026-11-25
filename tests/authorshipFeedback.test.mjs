// Unit tests for src/lib/authorshipFeedback.ts ("Report a problem"). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// These modules import their siblings without an extension, as Next resolves them.
registerHooks({
  resolve(spec, ctx, next) {
    try { return next(spec, ctx) } catch (e) {
      if (spec.startsWith('.') && !/\.[cm]?[jt]s$/.test(spec)) return next(spec + '.ts', ctx)
      throw e
    }
  },
})
const {
  feedbackAllowed, realCwid, parseFeedbackBody, parseTypedRef, expectedCwid, resolutionUrl, rowKeys, typedKeys, candidateCwids,
  bylineSurnames, orcidForms, buildPeople, personKeys, errorInfo, errorBlock, isMissingTable, isDuplicateKey, dataBlock,
  combineParts, statusBlock, part, createRunner, snapshotState, BlockStop,
} = await import('../src/lib/authorshipFeedback.ts')

const roles = (...labels) => JSON.stringify(labels.map((roleLabel) => ({ roleLabel })))
const token = (cwid, extra = {}) => ({ username: cwid, actor: { personIdentifier: cwid }, userRoles: roles('Curator_All'), ...extra })

test('access: real user, reviewer role and listed; unset list = off', () => {
  assert.equal(feedbackAllowed(token('abc1001'), undefined), false)
  assert.equal(feedbackAllowed(token('abc1001'), ''), false)
  assert.equal(feedbackAllowed(token('abc1001'), ' ABC1001 , xyz2002'), true)
  assert.equal(feedbackAllowed(token('def3003'), 'abc1001'), false)
  assert.equal(feedbackAllowed(token('abc1001', { userRoles: roles('Reporter_All') }), 'abc1001'), false)
  assert.equal(feedbackAllowed(token('abc1001', { userRoles: 'not json' }), 'abc1001'), false)
  assert.equal(feedbackAllowed({}, 'abc1001'), false)
  // Viewing as a listed, privileged person grants nothing, and as somebody unlisted takes nothing away.
  const viewAs = { viewAs: { targetCwid: 'abc1001', userRoles: roles('Superuser'), startedAt: Math.floor(Date.now() / 1000) } }
  assert.equal(feedbackAllowed(token('def3003', viewAs), 'abc1001'), false)
  assert.equal(feedbackAllowed(token('def3003', viewAs), 'def3003'), true)
  assert.equal(realCwid(token('def3003', viewAs)), 'def3003')
  assert.equal(realCwid({ username: 'someone@example.org' }), null)
})

const body = (extra = {}) => ({
  client_uuid: '00000000-0000-4000-8000-00000000000A', trigger_place: 'menu', category: 'wrong_person',
  about_cwids: ['ABC1001 ', 'abc1001', 'not a cwid', 7], comment: 'x', review_id: 5, snapshot_version: 1,
  client_build: null, client_snapshot: { form: {} }, ...extra,
})

test('body: valid, normalised', () => {
  const { input } = parseFeedbackBody(body({ expected: ' xyz2002 ', typed_ref: '' }))
  assert.deepEqual(input.about_cwids, ['abc1001'])
  assert.equal(input.expected, 'xyz2002')
  assert.equal(input.typed_ref, null)
  assert.equal(input.client_snapshot, '{"form":{}}')
  assert.equal(parseFeedbackBody(body({ review_id: null })).input.review_id, null)
})

test('body: each invalid field is refused without echoing it', () => {
  const marker = 'MARKER'
  for (const bad of [
    { client_uuid: marker }, { trigger_place: marker }, { category: marker }, { comment: '  ' }, { comment: marker.repeat(1000) },
    { expected: marker.repeat(50) }, { typed_ref: {} }, { about_cwids: marker }, { about_cwids: Array(31).fill('abc1001') },
    { review_id: marker }, { review_id: 0 }, { snapshot_version: 2 }, { client_build: {} }, { client_snapshot: [] }, { client_snapshot: marker },
  ]) {
    const r = parseFeedbackBody(body(bad))
    assert.ok(r.message && !r.message.includes(marker), JSON.stringify(Object.keys(bad)))
  }
  for (const b of [undefined, null, '', 'x']) assert.ok(parseFeedbackBody(b).message)
})

test('typed reference, expected person, resolution link', () => {
  for (const s of ['1', 'PMID: 1', 'pmid 1', 'https://pubmed.ncbi.nlm.nih.gov/1/']) assert.deepEqual(parseTypedRef(s), { pmid: 1, doi: null }, s)
  for (const s of ['10.1234/ABC', 'doi:10.1234/abc', 'https://doi.org/10.1234/abc.']) assert.deepEqual(parseTypedRef(s), { pmid: null, doi: '10.1234/abc' }, s)
  assert.equal(typedKeys('some title'), null)
  assert.equal(typedKeys(null), null)
  assert.equal(typedKeys('1').from, 'typed')
  assert.equal(expectedCwid('ABC1001'), 'abc1001')
  assert.equal(expectedCwid('Pat Example (abc1001)'), 'abc1001')
  assert.equal(expectedCwid('Pat Example'), null)
  assert.equal(expectedCwid(null), null)
  const ok = 'https://github.com/wcmc-its/ReCiterDB/pull/1'
  assert.equal(resolutionUrl(ok), ok)
  for (const bad of ['javascript:alert(1)', ok + '?x', 'x ' + ok, 'https://github.com/other/ReCiterDB/pull/1', null]) assert.equal(resolutionUrl(bad), null)
})

test('row keys: blank ids are skipped, never matched', () => {
  const p = rowKeys({ source: 'pubmed', pmid: '1', doi: ' ', external_id: '', matched_pmid: null })
  assert.deepEqual([p.pmids, p.dois, p.externalId, p.articleId], [[1], [], null, null])
  const s = rowKeys({ source: 'scopus', pmid: null, external_id: '77', doi: 'https://doi.org/10.1234/ABC', matched_pmid: 2 })
  assert.deepEqual([s.pmids, s.dois, s.articleId], [[2], ['https://doi.org/10.1234/ABC', '10.1234/abc'], 'SCOPUS:77'])
  assert.equal(rowKeys({ source: 'openalex', external_id: 'https://openalex.org/W1' }).articleId, 'OPENALEX:W1')
  assert.deepEqual(candidateCwids('[{"cwid":"Abc1001"},"xyz2002",null]'), ['Abc1001', 'xyz2002'])
  for (const bad of ['{', null, '{}']) assert.deepEqual(candidateCwids(bad), [])
  assert.deepEqual(bylineSurnames('Pat van der Example Jr.'), ['Example', 'der Example', 'van der Example'])
  assert.deepEqual(bylineSurnames(null), [])
  assert.deepEqual(orcidForms('https://orcid.org/0000-0000-0000-000x'),
    ['0000-0000-0000-000X', 'https://orcid.org/0000-0000-0000-000X', 'http://orcid.org/0000-0000-0000-000X'])
  assert.deepEqual(orcidForms(null), [])
})

test('people: both spellings kept, reasons merged, capped in order', () => {
  const { list, dropped } = buildPeople([
    { cwid: 'Abc1001', why: 'top' }, { cwid: 'Abc1001', why: 'candidate' }, { cwid: 'abc1001', why: 'byline' },
    { cwid: null, why: 'resolution' }, { cwid: 'not a cwid', why: 'byline' },
  ], 2)
  assert.deepEqual(list, [
    { as_rendered: 'Abc1001', canonical: 'abc1001', why: ['top', 'candidate'] },
    { as_rendered: 'abc1001', canonical: 'abc1001', why: ['byline'] },
  ])
  assert.equal(dropped, 1)
  assert.deepEqual(personKeys(list), ['Abc1001', 'abc1001'])
})

// What Sequelize throws: the bound values sit on the error, its parent and its message.
const sqlError = (errno, code) => Object.assign(new Error('MARKER'), {
  name: 'SequelizeDatabaseError', sql: 'MARKER', parameters: ['MARKER'], errors: [{ instance: 'MARKER' }],
  original: Object.assign(new Error('MARKER'), { errno, code, sqlMessage: 'MARKER' }),
})

test('errors carry a name and a code only', () => {
  const e = sqlError(1146, 'ER_NO_SUCH_TABLE')
  assert.ok(!JSON.stringify([errorInfo(e), errorBlock(e)]).includes('MARKER'))
  assert.deepEqual(errorInfo(e), { name: 'SequelizeDatabaseError', code: 'ER_NO_SUCH_TABLE', errno: 1146 })
  assert.equal(isMissingTable(e), true)
  assert.equal(isDuplicateKey(sqlError(1062, 'ER_DUP_ENTRY')), true)
  assert.equal(errorBlock(e).status, 'unavailable')
  assert.equal(errorBlock(sqlError(1969)).status, 'timeout')
  assert.equal(errorBlock(sqlError(1054, 'ER_BAD_FIELD_ERROR')).status, 'error')
  assert.equal(errorBlock('MARKER').error.name, 'Error')
})

test('block statuses are distinct', async () => {
  assert.equal(dataBlock({ rows: [] }).status, 'empty')
  assert.equal(dataBlock(undefined).status, 'empty')
  assert.equal(dataBlock({ rows: [null] }).status, 'ok')
  assert.equal(dataBlock({ rows: ['xxxxxxxxxx'] }, 0, 5).status, 'too_large')
  const ok = dataBlock([1]), empty = dataBlock([]), none = statusBlock('unavailable')
  assert.equal(combineParts({ a: none, b: empty }).status, 'empty')
  assert.equal(combineParts({ a: none, b: ok }).status, 'ok')
  assert.equal(combineParts({ a: none, b: none }).status, 'unavailable')
  assert.equal(combineParts({ a: ok, b: await part(async () => { throw sqlError(1) }) }).status, 'error')
})

test('runner: at most three at once, failures stay in their block, deadline is a timeout', async () => {
  const { run } = createRunner({ overallMs: 2000 })
  let now = 0, peak = 0
  const work = async () => { peak = Math.max(peak, ++now); await new Promise((r) => setTimeout(r, 5)); now--; return [1] }
  const blocks = await Promise.all([...Array(10).fill(work), async () => { throw sqlError(1) }].map((f) => run(f)))
  assert.equal(peak, 3)
  assert.deepEqual(blocks.map((b) => b.status), [...Array(10).fill('ok'), 'error'])
  const combined = await run(async () => combineParts({ a: statusBlock('unavailable') }))
  assert.equal(combined.status, 'unavailable')
  const kept = await run(async () => { throw new BlockStop('error', { rows: [1] }, { name: 'N', code: null }) })
  assert.deepEqual([kept.status, kept.data, kept.error], ['error', { rows: [1] }, { name: 'N', code: null }])

  const short = createRunner({ concurrency: 1, overallMs: 20 })
  let started = false
  const [a, b] = await Promise.all([
    short.run(() => new Promise((r) => setTimeout(r, 200))),
    short.run(async () => { started = true; return [1] }),
  ])
  assert.deepEqual([a.status, b.status, started], ['timeout', 'timeout', false])
})

test('snapshot state', () => {
  const snap = (status) => ({ row: { raw_row: statusBlock(status) }, people: { list: [], identity: statusBlock('empty') }, run: {} })
  for (const s of ['ok', 'empty', 'not_applicable', 'unavailable', 'not_loaded']) assert.equal(snapshotState(snap(s)), 'complete', s)
  for (const s of ['error', 'timeout', 'too_large']) assert.equal(snapshotState(snap(s)), 'partial', s)
})
