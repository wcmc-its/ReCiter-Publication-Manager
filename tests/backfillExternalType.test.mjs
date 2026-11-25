// Unit tests for scripts/backfill-external-type.mjs (plan 3b-3e, P3). An in-memory stand-in for
// the external_record table answers the script's three statements, so apply mode, batching and
// re-runs are tested without a database. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// externalRecordShape.ts imports './pubTypes' without an extension, as Next resolves it.
registerHooks({
  resolve(spec, ctx, next) {
    try { return next(spec, ctx) } catch (e) {
      if (spec.startsWith('.') && !/\.[cm]?[jt]s$/.test(spec)) return next(spec + '.ts', ctx)
      throw e
    }
  },
})
const { planRow, runBackfill, formatReport, SOURCE_LABEL } = await import('../scripts/backfill-external-type.mjs')
const { recordFromInput } = await import('../src/lib/externalRecordShape.ts')

// A fake mysql2 connection over an array of rows. It understands exactly the statements the
// script sends and fails loudly on anything else.
function fakeDb(rows) {
  const calls = []
  const untyped = (r) => r.pub_type == null && r.type_notice == null
  return {
    rows,
    calls,
    async query(sql, params = []) {
      calls.push(sql)
      if (/^SELECT COUNT\(\*\) AS n FROM `\w+` WHERE NOT \(pub_type IS NULL AND type_notice IS NULL\)$/.test(sql)) {
        return [[{ n: rows.filter((r) => !untyped(r)).length }]]
      }
      if (/^SELECT id, source_type, source_pub_type FROM `\w+` WHERE pub_type IS NULL AND type_notice IS NULL AND id > \? ORDER BY id LIMIT \?$/.test(sql)) {
        const [after, limit] = params
        const page = rows.filter((r) => untyped(r) && r.id > after).sort((a, b) => a.id - b.id).slice(0, limit)
        return [page.map(({ id, source_type, source_pub_type }) => ({ id, source_type, source_pub_type }))]
      }
      if (/^UPDATE `\w+` SET pub_type = \?, type_notice = \? WHERE id IN \(\?\) AND pub_type IS NULL AND type_notice IS NULL$/.test(sql)) {
        const [pub_type, type_notice, ids] = params
        let affectedRows = 0
        for (const r of rows) {
          if (ids.includes(r.id) && untyped(r)) { r.pub_type = pub_type; r.type_notice = type_notice; affectedRows++ }
        }
        return [{ affectedRows }]
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
}

const row = (id, source_type, source_pub_type, extra = {}) => ({
  id, source_type, source_pub_type, pub_type: null, type_notice: null, peer_reviewed: null, peer_reviewed_by_hand: 0, role: null, ...extra,
})

// One row per distinct (source, source type) seen in dev external_record on Nov 14, 2026, plus edge cases.
const fixture = () => [
  row(1, 'SCOPUS', 'Article'),
  row(2, 'SCOPUS', 'Conference Paper'),
  row(3, 'SCOPUS', 'Book Chapter'),
  row(4, 'SCOPUS', 'Review'),
  row(5, 'SCOPUS', 'Book'),
  row(6, 'SCOPUS', 'Editorial'),
  row(7, 'SCOPUS', 'Note'),
  row(8, 'SCOPUS', 'Erratum'),
  row(9, 'SCOPUS', 'Letter'),
  row(10, 'SCOPUS', 'Short Survey'),
  row(11, 'SCOPUS', 'Data Paper'),
  row(12, 'SCOPUS', 'Retracted'),
  row(13, 'OPENALEX', 'conference-abstract'),
  row(14, 'OPENALEX', 'preprint'),
  row(15, 'OPENALEX', 'conference-paper'),
  row(16, 'OPENALEX', 'dataset'),
  row(17, 'OPENALEX', 'article'),
  row(18, 'OPENALEX', 'Book Chapter'),
  row(19, 'CROSSREF', 'book'),
  row(20, 'CROSSREF', 'edited-book'),
  row(21, 'OPENALEX', 'paratext'), // no map: stays NULL
  row(22, 'SCOPUS', null), // no source type: stays NULL
  row(23, 'WOS', 'Article'), // no WOS map
  row(24, 'MANUAL', 'Book'), // manual: the curator picks
  row(25, 'CROSSREF', 'peer-review'), // out of scope: stays NULL
  // Already typed by PM: never selected, never changed, hand values kept.
  row(26, 'SCOPUS', 'Article', { pub_type: 'Review', peer_reviewed: 0, peer_reviewed_by_hand: 1, role: 'Editor' }),
  row(27, 'SCOPUS', 'Erratum', { type_notice: 'erratum' }),
]

test('planRow maps through pubTypes.ts', () => {
  assert.deepEqual(planRow({ source_type: 'SCOPUS', source_pub_type: 'Article' }), { pub_type: 'Academic Article', type_notice: null, disposition: 'publication' })
  assert.deepEqual(planRow({ source_type: 'SCOPUS', source_pub_type: 'Note' }), { pub_type: 'Letter', type_notice: null, disposition: 'publication' })
  assert.deepEqual(planRow({ source_type: 'SCOPUS', source_pub_type: 'Erratum' }), { pub_type: null, type_notice: 'erratum', disposition: 'not-counted' })
  assert.deepEqual(planRow({ source_type: 'SCOPUS', source_pub_type: 'Retracted' }), { pub_type: null, type_notice: 'retraction', disposition: 'not-counted' })
  assert.deepEqual(planRow({ source_type: 'OPENALEX', source_pub_type: 'conference-abstract' }), { pub_type: 'Conference Abstract', type_notice: null, disposition: 'publication' })
  assert.deepEqual(planRow({ source_type: 'OPENALEX', source_pub_type: 'Book Chapter' }), { pub_type: 'Book Chapter', type_notice: null, disposition: 'publication' })
  assert.deepEqual(planRow({ source_type: 'CROSSREF', source_pub_type: 'peer-review' }), { pub_type: null, type_notice: null, disposition: 'out-of-scope' })
  assert.equal(planRow({ source_type: 'WOS', source_pub_type: 'Article' }).disposition, 'unmapped')
  assert.equal(planRow({ source_type: 'MANUAL', source_pub_type: 'Book' }).pub_type, null)
  assert.equal(planRow({ source_type: 'SCOPUS', source_pub_type: null }).disposition, 'unmapped')
})

test('planRow agrees with what a PM create writes (recordFromInput), so there is one mapping', () => {
  for (const r of fixture()) {
    const created = recordFromInput({
      sourceType: r.source_type,
      articleId: `${r.source_type}:x${r.id}`,
      publicationType: r.source_pub_type,
    })
    const p = planRow(r)
    assert.equal(p.pub_type, created.pub_type, `${r.source_type} ${r.source_pub_type} pub_type`)
    assert.equal(p.type_notice, created.type_notice, `${r.source_type} ${r.source_pub_type} type_notice`)
    // A create leaves both NULL (= type default); so does the backfill, which never writes them.
    assert.equal(created.peer_reviewed, null)
    assert.equal(created.role, null)
  }
  assert.deepEqual(Object.keys(SOURCE_LABEL).sort(), ['CROSSREF', 'OPENALEX', 'ORCID', 'SCOPUS'])
})

test('dry run reads only and counts per source and type', async () => {
  const db = fakeDb(fixture())
  const before = JSON.stringify(db.rows)
  const res = await runBackfill(db, { batch: 4 })
  assert.equal(JSON.stringify(db.rows), before)
  assert.ok(db.calls.every((s) => s.startsWith('SELECT')))
  assert.equal(res.updated, 0)
  assert.equal(res.skippedTyped, 2)
  assert.equal(res.rows.reduce((s, r) => s + r.n, 0), 25)
  const note = res.rows.find((r) => r.source_type === 'SCOPUS' && r.source_pub_type === 'Note')
  assert.equal(note.pub_type, 'Letter')
  const report = formatReport(res)
  assert.match(report, /^DRY RUN: external_record, 25 untyped rows/)
  assert.match(report, /Would update 20 rows; 5 stay untyped\. Nothing written\./)
  assert.match(report, /Edited Book\s+no\s+Editor\s+1/)
  assert.match(report, /Academic Article\s+yes\s+Author\s+3/)
})

test('apply writes pub_type and type_notice only, across batches, and leaves typed rows alone', async () => {
  const db = fakeDb(fixture())
  const res = await runBackfill(db, { apply: true, batch: 3 })
  assert.equal(res.updated, 20)
  const by = Object.fromEntries(db.rows.map((r) => [r.id, r]))
  assert.equal(by[1].pub_type, 'Academic Article')
  assert.equal(by[7].pub_type, 'Letter')
  assert.equal(by[8].pub_type, null)
  assert.equal(by[8].type_notice, 'erratum')
  assert.equal(by[12].type_notice, 'retraction')
  assert.equal(by[20].pub_type, 'Edited Book')
  for (const id of [21, 22, 23, 24, 25]) assert.equal(by[id].pub_type, null, `row ${id}`)
  for (const r of db.rows.filter((r) => r.id < 26)) {
    assert.equal(r.peer_reviewed, null)
    assert.equal(r.role, null)
  }
  assert.deepEqual(by[26], row(26, 'SCOPUS', 'Article', { pub_type: 'Review', peer_reviewed: 0, peer_reviewed_by_hand: 1, role: 'Editor' }))
  assert.deepEqual(by[27], row(27, 'SCOPUS', 'Erratum', { type_notice: 'erratum' }))
})

test('a second run is a no-op: it sees only the rows that map to nothing', async () => {
  const db = fakeDb(fixture())
  await runBackfill(db, { apply: true, batch: 7 })
  const after = JSON.stringify(db.rows)
  const again = await runBackfill(db, { apply: true, batch: 7 })
  assert.equal(again.updated, 0)
  assert.equal(JSON.stringify(db.rows), after)
  assert.equal(again.rows.reduce((s, r) => s + r.n, 0), 5)
  assert.ok(again.rows.every((r) => !r.pub_type && !r.type_notice))
})

test('a row typed by PM between the read and the write is not overwritten', async () => {
  const db = fakeDb(fixture())
  const orig = db.query.bind(db)
  db.query = async (sql, params) => {
    if (sql.startsWith('UPDATE')) { const r = db.rows.find((x) => x.id === 1); r.pub_type = 'Review'; r.role = 'Author' }
    return orig(sql, params)
  }
  const res = await runBackfill(db, { apply: true, batch: 100 })
  assert.equal(res.updated, 19)
  assert.equal(db.rows.find((x) => x.id === 1).pub_type, 'Review')
})

test('bad table names and batch sizes are refused before any query', async () => {
  const db = fakeDb(fixture())
  await assert.rejects(runBackfill(db, { table: 'external_record; DROP TABLE x' }), /Bad table name/)
  await assert.rejects(runBackfill(db, { batch: 0 }), /Bad batch size/)
  assert.equal(db.calls.length, 0)
})
