// Unit tests for the /authorships call recorder (src/utils/authorshipsCalls.ts) and the report
// built from it (src/utils/authorshipsCapture.ts). Run with `npm test`.
import test, { beforeEach } from 'node:test'
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
  recordedFetch, setRecording, markCall, noteRows, rowLoaded, noteRefusal, noteBulk, lastCall, ringOf, lookupsOf, lastFacetSummary,
} = await import('../src/utils/authorshipsCalls.ts')
const { callBlock, captureReport, buildReport, reopenDraft, reportJson, trimReport, uuid4 } = await import('../src/utils/authorshipsCapture.ts')
const { enterIsTaken } = await import('../src/utils/authorshipChips.ts')
const { parseFeedbackBody } = await import('../src/lib/authorshipFeedback.ts')

const API = '/api/db/authorships'
const tick = () => new Promise((r) => setTimeout(r, 5))
let answer
const unhandled = []
process.on('unhandledRejection', (e) => unhandled.push(e))
globalThis.fetch = async (url, init) => answer(url, init)
const draft = (target, form) => ({ target, fetched: {}, again: [], againDropped: 0,
  form: { category: 'idea', about: [], expected: '', typedRef: '', comment: 'c', ...form } })
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const post = (body, extra = {}) => ({ method: 'POST', headers: { Authorization: 'SECRET' }, body: JSON.stringify(body), ...extra })

beforeEach(() => { setRecording(false); setRecording(true); answer = () => json({}) })

test('same Response, body still readable by the caller, no headers kept', async () => {
  const sent = json({ ok: true, before: { status: 'open' } })
  answer = () => sent
  const row = { id: 1 }
  const r = await recordedFetch(`${API}/action`, post({ id: 1, action: 'snooze' }), { site: 'doAction', row })
  assert.equal(r, sent)
  assert.deepEqual(await r.json(), { ok: true, before: { status: 'open' } })
  await tick()
  const e = lastCall('/action', 1)
  assert.equal(e.outcome, 'ok')
  assert.equal(e.row, row)
  assert.equal(e.response.before.status, 'open')
  assert.ok(!JSON.stringify(e).includes('SECRET'))
})

test('rejects with the very error fetch rejected with', async () => {
  const err = new TypeError('Failed to fetch')
  answer = () => { throw err }
  await assert.rejects(recordedFetch(`${API}/action`, post({ id: 2, action: 'accept' }), { site: 'doAction' }), (e) => e === err)
  assert.equal(lastCall('/action', 2).outcome, 'network_error')
  assert.equal(ringOf('failed').length, 1)
})

test('an unrecordable request or response never reaches the page', async () => {
  const odd = { status: 200, ok: true, clone() { throw new Error('no') } }
  answer = () => odd
  assert.equal(await recordedFetch(`${API}/action`, post({ id: 3 }), { site: 'x' }), odd)
  assert.equal((await recordedFetch(`${API}/lookup`, { body: '{not json' }, { site: 'x' })), odd)
})

test('aborted: same rejection, no unhandled rejection, and the answer on screen is kept', async () => {
  answer = () => json({ record: { orcid: 'x' } })
  await (await recordedFetch(`${API}/orcid-record`, post({ id: 4 }), { site: 'p' })).json()
  await tick()
  const abort = new DOMException('aborted', 'AbortError')
  // before the headers
  answer = () => { throw abort }
  await assert.rejects(recordedFetch(`${API}/orcid-record`, post({ id: 4 }), { site: 'p' }), (e) => e === abort)
  // after them, while the body is read
  answer = () => new Response(new ReadableStream({ start(c) { c.error(abort) } }))
  const r = await recordedFetch(`${API}/orcid-record`, post({ id: 4 }), { site: 'p' })
  await assert.rejects(r.json())
  await tick()
  assert.equal(lastCall('/orcid-record', 4).response.record.orcid, 'x')
  // an aborted first call is not an answer
  answer = () => { throw abort }
  await assert.rejects(recordedFetch(`${API}/orcid-record`, post({ id: 5 }), { site: 'p' }))
  assert.equal(callBlock(lastCall('/orcid-record', 5)).status, 'not_loaded')
  // a list body that fails
  answer = () => new Response(new ReadableStream({ start(c) { c.error(abort) } }))
  await assert.rejects((await recordedFetch(API, post({}), { site: 'fetchData' })).json())
  await tick()
  assert.equal(ringOf('list').at(-1).outcome, 'aborted')
  assert.deepEqual(unhandled, [])
})

test('lists: the caller gets every row, the recorder keeps counts, 200 ids and the duplicates', async () => {
  const rows = [...Array.from({ length: 300 }, (_, i) => ({ id: i + 1, title: 'TITLE' })), { id: 7 }]
  answer = () => json({ rows, count: 999 })
  const call = { site: 'topUp', guarded: true }
  const d = await (await recordedFetch(API, post({ limit: 20 }), call)).json()
  assert.equal(ringOf('list')[0].applied, 'not applied')
  markCall(call, 'applied')
  noteRows(d.rows, 'topUp')
  assert.equal(d.rows.length, 301)
  const e = ringOf('list')[0]
  assert.deepEqual([e.outcome, e.site, e.applied, e.count, e.rows_returned, e.ids.length], ['ok', 'topUp', 'applied', 999, 301, 200])
  assert.deepEqual(e.dup_ids, [7])
  assert.deepEqual(e.request, { limit: 20 })
  assert.ok(!JSON.stringify(e).includes('TITLE'))
  assert.equal(rowLoaded(d.rows[0]).site, 'topUp')
  assert.ok(!('site' in d.rows[0]))
})

test('a failed list keeps the raw body, cut at 4 KB, and the caller can still read it', async () => {
  answer = () => new Response('x'.repeat(9000), { status: 500 })
  const r = await recordedFetch(API, post({}), { site: 'fetchData' })
  assert.equal((await r.text()).length, 9000)
  await tick()
  const e = ringOf('list')[0]
  assert.deepEqual([e.outcome, e.status, e.raw.length], ['http_error', 500, 4096])
})

test('rings are bounded, and 50 actions do not push out a row\'s evidence', async () => {
  answer = () => json({ facts: { abc1001: {} } })
  await recordedFetch(`${API}/candidate-evidence`, post({ id: 1 }), { site: 'evidence' })
  await tick()
  answer = (url) => (url.endsWith('/action') ? json({ message: 'dup' }, 409) : json({ rows: [] }))
  for (let i = 0; i < 150; i++) {
    await recordedFetch(`${API}/action`, post({ id: 100 + i, action: 'accept' }), { site: 'doAction' })
    await (await recordedFetch(API, post({}), { site: 'topUp' })).json()
  }
  await tick()
  assert.equal(callBlock(lastCall('/candidate-evidence', 1)).status, 'ok')
  assert.deepEqual(['action', 'failed', 'list'].map((k) => ringOf(k).length), [10, 100, 20])
  assert.equal(ringOf('failed').at(-1).response.message, 'dup')
  for (let i = 0; i < 1100; i++) await recordedFetch(`${API}/action`, post({ id: 1000 + i }), { site: 'x' })
  await tick()
  assert.equal(lastCall('/action', 100), null)
  assert.ok(lastCall('/action', 2099))
})

test('lookups stay with their row, last 10, email fields dropped', async () => {
  answer = () => json({ matches: [{ id: 'abc1001', email: 'a@example.org', mail: 'b' }], debug: { wcmFirst: true } })
  for (let i = 0; i < 12; i++) await recordedFetch(`${API}/lookup`, post({ q: `name ${i}` }), { site: 'assignOther', rowId: 1 })
  await recordedFetch(`${API}/lookup`, post({ cwid: 'abc1001' }), { site: 'bulkAssign' })
  await tick()
  assert.equal(lookupsOf(1).length, 10)
  assert.equal(lookupsOf(0).length, 1)
  assert.deepEqual(lookupsOf(1).at(-1).response, { matches: [{ id: 'abc1001' }], debug: { wcmFirst: true } })
})

test('the last summary with the affiliation facet survives later ones', async () => {
  answer = () => json({ total: 1, authorInstitutions: [] })
  await recordedFetch(`${API}/summary`, post({ includeAuthorInstitutions: true }), { site: 'fetchSummary' })
  await tick()
  for (let i = 0; i < 12; i++) await recordedFetch(`${API}/summary`, post({}), { site: 'fetchSummary' })
  await tick()
  assert.equal(ringOf('summary').length, 10)
  assert.deepEqual(lastFacetSummary().response.authorInstitutions, [])
})

test('off: nothing is kept and the call still goes out', async () => {
  setRecording(false)
  let n = 0
  answer = () => { n++; return json({ rows: [] }) }
  await (await recordedFetch(API, post({}), { site: 'fetchData' })).json()
  noteRefusal({ id: 1 }, 'accept', 'x')
  assert.equal(n, 1)
  assert.deepEqual([ringOf('list'), ringOf('refused')], [[], []])
})

test('not loaded, empty, failed and in flight are distinct', async () => {
  assert.equal(callBlock(null).status, 'not_loaded')
  answer = () => json({ record: null })
  await recordedFetch(`${API}/orcid-record`, post({ id: 1 }), { site: 'p' })
  answer = () => new Response('gone', { status: 502 })
  await recordedFetch(`${API}/orcid-record`, post({ id: 2 }), { site: 'p' })
  await tick()
  assert.equal(callBlock(lastCall('/orcid-record', 1)).status, 'empty')
  const bad = callBlock(lastCall('/orcid-record', 2))
  assert.deepEqual([bad.status, bad.error.code, bad.data.raw], ['error', '502', 'gone'])
  let go
  answer = () => new Promise((r) => { go = () => r(json({ record: {} })) })
  const p = recordedFetch(`${API}/orcid-record`, post({ id: 3 }), { site: 'p' })
  const open = lastCall('/orcid-record', 3)
  go(); await p; await tick()
  assert.equal(callBlock(open).data.in_flight, true) // a copy: it did not change when the call settled
  assert.equal(callBlock(lastCall('/orcid-record', 3)).status, 'ok')
})

test('a captured report has every block, passes the server\'s check and never holds an email field', async () => {
  const row = { id: 9, top_cwid: 'abc1001', matched_pmid: null, byline_orcid: null, email: 'a@example.org', author_affiliation: 'a@example.org', doi: null }
  noteRows([row], 'fetchData')
  noteRefusal(row, 'accept', 'several candidates')
  noteBulk('accept', [{ status: 'fulfilled' }, { status: 'rejected', reason: { status: 409 } }])
  const t = captureReport({ place: 'menu', row, people: [{ cwid: 'abc1001' }, { cwid: 'abc1001' }], view: { page: 0 }, heading: 'h' })
  const form = { category: 'wrong_person', about: ['abc1001'], expected: ' xyz2002 ', typedRef: 'ignored', comment: 'c' }
  const report = buildReport(uuid4(), draft(t, form))
  const sent = JSON.parse(reportJson(report))
  const { input, message } = parseFeedbackBody(sent)
  assert.equal(message, undefined)
  assert.deepEqual([input.review_id, input.expected, input.typed_ref, input.about_cwids], [9, 'xyz2002', null, ['abc1001']])
  assert.deepEqual(Object.keys(sent.client_snapshot), ['form', 'shown_row', 'card', 'last_hover', 'calls_row', 'calls_people',
    'calls_lookup', 'calls_recent', 'actions', 'conflict', 'view', 'env', 'fetched_for_report', 'recaptured'])
  for (const [k, b] of Object.entries(sent.client_snapshot)) if (k !== 'form') assert.ok(b.status && b.at, k)
  assert.equal(sent.client_snapshot.shown_row.loader, 'fetchData')
  assert.ok(!('email' in sent.client_snapshot.shown_row.data))
  assert.deepEqual([sent.client_snapshot.shown_row.data.doi, sent.client_snapshot.shown_row.data.author_affiliation], [null, 'a@example.org'])
  assert.equal(sent.client_snapshot.calls_row.data.orcid_record.status, 'not_applicable')
  assert.deepEqual(sent.client_snapshot.actions.data.bulk_runs[0].failed_by_status, { 409: 1 })
  assert.equal(sent.client_snapshot.actions.data.refused_in_browser[0].refused, 'several candidates')
})

test('page-level: row blocks are not applicable; a 413 retry drops only the calls', () => {
  const t = captureReport({ place: 'page', view: {} })
  assert.deepEqual(['shown_row', 'card', 'last_hover', 'calls_row', 'calls_people', 'conflict'].map((k) => t.capture[k].status), Array(6).fill('not_applicable'))
  t.capture.calls_recent = { status: 'ok', at: 'x', data: { list: [1] } }
  const report = buildReport(uuid4(), draft(t, { typedRef: 'PMID 1' }))
  assert.equal(report.typed_ref, 'PMID 1')
  const small = trimReport(report)
  assert.deepEqual(small.client_snapshot.calls_recent, { status: 'too_large', at: 'x' })
  assert.equal(small.client_snapshot.calls_row.status, 'not_applicable')
  assert.equal(report.client_snapshot.calls_recent.status, 'ok')
  assert.equal(small.client_snapshot.form.comment, 'c')
})

test('Recent activity: the entry, plus the row as it was when this session acted on it', async () => {
  const row = { id: 12, status: 'open' }
  await recordedFetch(`${API}/action`, post({ id: 12, action: 'accept' }), { site: 'doAction', row })
  await tick()
  const t = captureReport({ place: 'activity', activity: { id: 12, status: 'accepted' }, activityIds: [12, 13], view: {} })
  assert.equal(t.reviewId, 12)
  assert.deepEqual([t.capture.shown_row.status, t.capture.shown_row.data, t.capture.shown_row.activity.status], ['ok', row, 'accepted'])
  assert.deepEqual(Object.keys(t.capture.actions.data.recent_activity), ['12'])
  const other = captureReport({ place: 'activity', activity: { id: 13 }, view: {} })
  assert.deepEqual([other.capture.shown_row.status, other.capture.shown_row.data], ['not_loaded', null])
})

test('a list answered 200 with a page that is not JSON keeps the body, and the caller still fails', async () => {
  answer = () => new Response('<html>' + 'x'.repeat(9000))
  const r = await recordedFetch(API, post({}), { site: 'fetchData' })
  await assert.rejects(r.json(), SyntaxError)
  const e = ringOf('list')[0]
  assert.deepEqual([e.outcome, e.status, e.error.name, e.raw.length], ['unread', 200, 'SyntaxError', 4096])
  assert.deepEqual(unhandled, [])
})

test('a lookup that found nobody is empty; one that could not look is not', async () => {
  const look = async (body) => {
    answer = () => json({ matches: [], ...body })
    await recordedFetch(`${API}/lookup`, post({ q: 'name' }), { site: 'assignOther', rowId: 1 })
    await tick()
    return callBlock(lookupsOf(1).at(-1)).status
  }
  assert.equal(await look({ configured: true, debug: { perDirectory: { wcm: { count: 0, truncated: false } } } }), 'empty')
  assert.equal(await look({ configured: false }), 'unavailable')
  assert.equal(await look({ configured: true, debug: { perDirectory: { wcm: { count: 0, truncated: false, failed: true } } } }), 'error')
})

test('prior names: nobody accepted is empty, names or nameless papers are not', async () => {
  const ask = async (names, accepted) => {
    answer = () => json({ names: { abc1001: names }, accepted: { abc1001: accepted } })
    await recordedFetch(`${API}/prior-names`, post({ cwid: 'abc1001' }), { site: 'hoverCard' })
    await tick()
    return callBlock(lastCall('/prior-names', 'abc1001')).status
  }
  assert.deepEqual([await ask([], 0), await ask([], 2), await ask([{ last: 'x' }], 2)], ['empty', 'ok', 'ok'])
})

test('calls_recent and actions say what the newest call came to', async () => {
  const status = (k) => captureReport({ place: 'page', view: {} }).capture[k].status
  assert.deepEqual([status('calls_recent'), status('actions')], ['not_loaded', 'empty'])
  answer = () => json({ rows: [] })
  await recordedFetch(`${API}/recent-activity`, post({}), { site: 'fetchRecentActivity' })
  await tick()
  assert.equal(status('calls_recent'), 'ok')
  answer = () => new Response('boom', { status: 500 })
  await recordedFetch(API, post({}), { site: 'fetchData' })
  await recordedFetch(`${API}/action`, post({ id: 1, action: 'accept' }), { site: 'doAction' })
  await tick()
  assert.deepEqual([status('calls_recent'), status('actions')], ['error', 'error'])
  answer = () => json({ rows: [] })
  await (await recordedFetch(API, post({}), { site: 'fetchData' })).json()
  await recordedFetch(`${API}/action`, post({ id: 1, action: 'accept' }), { site: 'doAction' })
  await tick()
  assert.deepEqual([status('calls_recent'), status('actions')], ['ok', 'ok'])
})

test('a draft opened again: a comment keeps its capture and gains the new one; a category alone moves to the new one', () => {
  const at = (n, extra = {}) => captureReport({ place: 'page', view: { n }, people: [{ cwid: `abc100${n}` }], ...extra })
  const views = (d) => {
    const s = buildReport(uuid4(), d).client_snapshot
    return [s.view.data.n, s.recaptured.status, (s.recaptured.data || []).map((c) => c.view.data.n)]
  }
  const bare = draft(at(1), { comment: ' ', about: ['abc1001'] })
  bare.fetched = { x: { status: 'ok', at: 'x' } }
  reopenDraft(bare, at(2))
  assert.deepEqual(views(bare), [2, 'not_applicable', []])
  assert.deepEqual([bare.form.about, bare.target.people.map((p) => p.cwid), bare.fetched], [['abc1001'], ['abc1002', 'abc1001'], {}])

  const d = draft(at(1))
  reopenDraft(d, at(2))
  d.again[0].fetched.x = { status: 'ok', at: 'x', data: 1 }
  assert.deepEqual(views(d), [1, 'ok', [2]])
  const { client_snapshot: snap } = buildReport(uuid4(), d)
  assert.deepEqual([snap.form.comment, snap.recaptured.data[0].fetched_for_report.data.x.data], ['c', 1])
  assert.deepEqual(d.target.people.map((p) => p.cwid), ['abc1001', 'abc1002'])
  for (const n of [3, 4, 5]) reopenDraft(d, at(n))
  assert.deepEqual(views(d), [1, 'ok', [3, 4, 5]])
  assert.equal(buildReport(uuid4(), d).client_snapshot.recaptured.dropped, 1)
})

test('a 413 retry trims the added captures too, and stays small', () => {
  const big = 'x'.repeat(15000), many = Array.from({ length: 100 }, () => ({ row: { big }, raw: 'x'.repeat(4096) }))
  const full = () => {
    const t = captureReport({ place: 'page', view: { n: 1 } })
    t.capture.calls_recent = { status: 'error', at: 'x', data: { big: big.repeat(20) } }
    t.capture.actions = { status: 'error', at: 'x', data: { last: many.slice(0, 10), failed: many, this_row: { big }, recent_activity: {} } }
    return t
  }
  const d = draft(full())
  for (let i = 0; i < 3; i++) reopenDraft(d, full())
  const report = buildReport(uuid4(), d)
  assert.ok(reportJson(report).length > 2 * 1024 * 1024)
  const small = trimReport(report)
  assert.ok(reportJson(small).length < 1024 * 1024)
  const [c] = small.client_snapshot.recaptured.data
  assert.deepEqual([c.calls_recent.status, c.view.data.n, c.actions.trimmed, Object.keys(c.actions.data)], ['too_large', 1, true, ['this_row']])
  assert.equal(report.client_snapshot.recaptured.data[0].calls_recent.status, 'error') // the report itself is untouched
})

test('Enter on a focused control, or one already handled, is not the row shortcut', () => {
  const inside = { closest: () => ({}) }, card = { closest: () => null }
  assert.deepEqual([[false, inside], [true, card], [false, card], [false, null]].map(([defaultPrevented, target]) => enterIsTaken({ defaultPrevented, target })),
    [true, true, false, false])
})
