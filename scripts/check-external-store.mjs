#!/usr/bin/env node
/**
 * src/lib/externalStore.ts against a real reciterdb (plan 3b-3e P1): the four v3.6 tables, every
 * lifecycle path the store exposes, the duplicate check's 409 bodies, rejection memory, events,
 * edits, verdicts and caller-owned transactions.
 * Run: node scripts/check-external-store.mjs
 *
 * Prerequisites: .env.local pointing at the DEV reciterdb, with ReCiterDB
 * setup/alter_external_record_v3.6.sql applied. Refuses any host without "dev" in its name.
 * Writes only rows for the synthetic uid below, deletes them before and after, and reads no
 * DynamoDB (GoldStandard is passed in empty).
 *
 * Also checks, with no DB, that each new model pins its modelName (the 4d minification incident).
 */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require(path.join(root, 'node_modules/typescript'))
const PASS = '\x1b[32mPASS\x1b[0m'
const FAIL = '\x1b[31mFAIL\x1b[0m'
let failures = 0
const check = (cond, label, extra = '') => {
  console.log(`  ${cond ? PASS : FAIL} ${label}${!cond && extra ? ' -- ' + extra : ''}`)
  if (!cond) failures++
}

console.log('\n0. models pin modelName')
for (const m of ['ExternalRecord', 'ExternalRecordEvent', 'ExternalRejection', 'ExternalDupVerdict']) {
  const src = readFileSync(path.join(root, `src/db/models/${m}.ts`), 'utf8')
  check(src.includes(`modelName: '${m}'`), `${m}.ts has modelName '${m}'`)
  check(readFileSync(path.join(root, 'src/db/models/init-models.ts'), 'utf8').includes(`${m}.initModel(sequelize)`), `init-models registers ${m}`)
}

// Load .env.local the way Next does, then refuse anything but the dev database.
const { loadEnvConfig } = require(path.join(root, 'node_modules/@next/env'))
loadEnvConfig(root, true)
if (!/dev/i.test(process.env.RECITER_DB_HOST || '')) {
  console.error(`\nRefusing: RECITER_DB_HOST does not look like the dev database.`)
  process.exit(2)
}
process.env.RECITER_DB_POOL_MAX = '2'

// Run the app's TypeScript as CommonJS (target ES2019, so model class fields are not emitted and
// do not shadow Sequelize's attribute getters, as in the Next build).
require.extensions['.ts'] = (mod, filename) => {
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
    fileName: filename,
  })
  mod._compile(outputText, filename)
}
const store = require(path.join(root, 'src/lib/externalStore.ts'))
const sequelize = require(path.join(root, 'src/db/db.ts')).default
const models = require(path.join(root, 'src/db/sequelize.ts')).default

const UID = 'zzextstorecheck'
const GS = { known: [], rejected: [] }
const me = { cwid: 'zzcurator' }
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT })
const cleanup = async () => {
  for (const t of ['external_record_event', 'external_rejection', 'external_dup_verdict', 'external_record']) {
    await sequelize.query(`DELETE FROM ${t} WHERE uid = :uid`, { replacements: { uid: UID } })
  }
}
const events = async (id) => (await q('SELECT action, from_status, to_status, actor, diff_json FROM external_record_event WHERE record_id = :id ORDER BY id', { id }))
const memory = async (id) => (await q('SELECT key_type, key_value, reason FROM external_rejection WHERE record_id = :id ORDER BY key_type, key_value', { id }))
const status = async (id) => (await q('SELECT status, prev_status, status_by, pm_touched, merged_into_id, superseded_by_pmid FROM external_record WHERE id = :id', { id }))[0]
const rejects = async (p, re) => { try { await p; return false } catch (e) { return re.test(String(e.message)) ? e : false } }

const scopus = {
  articleId: 'SCOPUS:900000001', sourceType: 'SCOPUS', doi: 'https://doi.org/10.9999/ZZ_check.1', title: 'Hepatic outcomes in a synthetic cohort',
  pubDate: '2024-03-01', journalOrVenue: 'Synthetic J', publicationType: 'Note', authors: ['Ann Lee', 'Bo Chen'], targetAuthorIndex: 1,
  method: 'scopus-authorships-tab',
}

try {
  await cleanup()

  console.log('\n1. tables')
  const cols = await q(`SELECT table_name AS t, COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE()
    AND table_name IN ('external_record','external_record_event','external_rejection','external_dup_verdict') GROUP BY table_name ORDER BY table_name`)
  check(JSON.stringify(cols.map((c) => [c.t, Number(c.n)])) === JSON.stringify([['external_dup_verdict', 9], ['external_record', 49], ['external_record_event', 11], ['external_rejection', 8]]),
    'v3.6 tables present with 9/49/11/8 columns', JSON.stringify(cols))

  console.log('\n2. create + duplicate check')
  const c1 = await store.createRecord({ uid: UID, body: scopus, actor: me, provenance: 'AUTHORSHIPS', goldStandard: GS })
  check(c1.status === 201 && c1.record.status === 'ACCEPTED' && !c1.record.suppressed, 'Scopus add -> 201 ACCEPTED')
  const A = c1.record.id
  const rowA = (await q('SELECT doi_norm, title_year_key, pub_type, byline, sync_origin, pm_touched, provenance, added_by FROM external_record WHERE id = :id', { id: A }))[0]
  check(rowA.doi_norm === '10.9999/zz_check.1', 'doi_norm generated by MariaDB matches normDoi', rowA.doi_norm)
  check(rowA.pub_type === 'Letter' && rowA.byline === '((Lee A)), Chen B', 'pub_type from the Scopus Note map; byline built server-side', JSON.stringify(rowA))
  check(rowA.sync_origin === 'PM' && Number(rowA.pm_touched) === 1 && rowA.provenance === 'AUTHORSHIPS' && rowA.added_by === 'zzcurator', 'sync_origin PM, pm_touched, provenance, added_by')
  check(JSON.stringify((await events(A)).map((e) => [e.action, e.from_status, e.to_status, e.actor])) === JSON.stringify([['ADD', null, 'ACCEPTED', 'zzcurator']]), 'ADD event')

  const again = await store.createRecord({ uid: UID, body: scopus, actor: me, goldStandard: GS })
  check(again.status === 409 && again.body.status === 'BLOCKED' && again.body.matches[0].type === 'ALREADY_ADDED', 'same article -> 409 BLOCKED ALREADY_ADDED')
  const sameDoi = await store.createRecord({ uid: UID, body: { articleId: 'CROSSREF:10.9999/zz_check.1', sourceType: 'CROSSREF', doi: '10.9999/zz_check.1', title: 'x' }, actor: me, goldStandard: GS })
  check(sameDoi.status === 409 && sameDoi.body.matches[0].type === 'DOI_MATCH_EXTERNAL', 'same DOI from Crossref -> BLOCKED DOI_MATCH_EXTERNAL')
  const gs = await store.createRecord({ uid: UID, body: { articleId: 'OPENALEX:W900000009', sourceType: 'OPENALEX', pmid: 12345, title: 'y' }, actor: me, goldStandard: { known: [12345], rejected: [] } })
  check(gs.status === 409 && gs.body.matches[0].type === 'PMID_IN_GOLD_STANDARD', 'PMID in GoldStandard known -> BLOCKED')

  const oa = { articleId: 'OPENALEX:W900000002', sourceType: 'OPENALEX', title: 'Hepatic outcomes in a synthetic cohort.', pubDate: '2024', publicationType: 'conference-abstract' }
  const warn = await store.createRecord({ uid: UID, body: oa, actor: me, goldStandard: GS })
  check(warn.status === 409 && warn.body.status === 'WARNING' && warn.body.matches[0].type === 'TITLE_YEAR_MATCH_EXTERNAL', 'title+year -> 409 WARNING')
  const forced = await store.createRecord({ uid: UID, body: oa, actor: me, force: true, goldStandard: GS })
  check(forced.status === 201 && forced.record.pubType === 'Conference Abstract', 'force -> 201, OpenAlex conference-abstract mapped')
  const B = forced.record.id

  console.log('\n3. transitions, rejection memory, Undo')
  await store.transitionRecords({ ids: [A], to: 'REMOVED', actor: me, note: 'not hers' })
  const memA = await memory(A)
  check((await status(A)).status === 'REMOVED' && (await status(A)).prev_status === 'ACCEPTED', 'Remove -> REMOVED, prev ACCEPTED')
  check(JSON.stringify(memA.map((m) => m.key_type)) === JSON.stringify(['DOI', 'SOURCE_ID', 'TITLE_YEAR']) && memA.every((m) => m.reason === 'REMOVED'), 'Remove writes DOI, SOURCE_ID, TITLE_YEAR memory', JSON.stringify(memA))
  await store.undoRecords({ ids: [A], actor: me })
  const sA = await status(A)
  check(sA.status === 'ACCEPTED' && sA.prev_status === null && (await memory(A)).length === 0, 'Undo -> ACCEPTED, prev cleared, memory deleted')
  check(!!(await rejects(store.undoRecords({ ids: [A], actor: me }), /Nothing to undo/)), 'second Undo refused (409)')

  await store.transitionRecords({ ids: [A], to: 'REMOVED', actor: me })
  const hit = await store.createRecord({ uid: UID, body: scopus, actor: { cwid: 'zzother' }, goldStandard: GS })
  check(hit.status === 409 && hit.body.status === 'WARNING' && hit.body.matches.some((m) => m.type === 'REJECTION_MEMORY' && /^Removed by zzcurator on \d{4}-\d\d-\d\d/.test(m.detail)), 'add of a removed work -> WARNING REJECTION_MEMORY "Removed by X on DATE"', JSON.stringify(hit.body?.matches))
  const readd = await store.createRecord({ uid: UID, body: scopus, actor: { cwid: 'zzother' }, force: true, goldStandard: GS })
  check(readd.status === 201 && readd.reAdded && readd.record.id === A && readd.record.status === 'ACCEPTED' && readd.record.prevStatus === 'REMOVED', 'Add anyway revives the same row as ACCEPTED')
  check((await memory(A)).length === 0, 'Add anyway cleared the memory')

  console.log('\n4. batches are all or nothing')
  await store.transitionRecords({ ids: [B], to: 'REMOVED', actor: me })
  const before = (await events(A)).length
  const e409 = await rejects(store.transitionRecords({ ids: [A, B], to: 'REMOVED', actor: me }), /cannot become REMOVED|already REMOVED/)
  check(!!e409 && e409.status === 409, 'batch with one refused step -> 409')
  check((await status(A)).status === 'ACCEPTED' && (await events(A)).length === before, 'the allowed half rolled back (no status change, no event)')
  const forbidden = await rejects(store.transitionRecords({ ids: [A], to: 'REMOVED', actor: me, canCurate: () => false }), /Not allowed/)
  check(!!forbidden && forbidden.status === 403 && (await status(A)).status === 'ACCEPTED', 'canCurate false -> 403, nothing written')
  const bad = await rejects(store.transitionRecords({ ids: [A], to: 'PENDING', actor: me }), /cannot become PENDING/)
  check(!!bad && bad.status === 409, 'ACCEPTED -> PENDING refused by the lifecycle map')

  console.log('\n5. merge, supersede, reopen')
  await store.undoRecords({ ids: [B], actor: me })
  await store.transitionRecords({ ids: [B], to: 'MERGED', actor: me, mergedIntoId: A })
  check((await status(B)).status === 'MERGED' && Number((await status(B)).merged_into_id) === A, 'Keep the other record -> MERGED into A')
  await store.undoRecords({ ids: [B], actor: me })
  const evB = await events(B)
  check((await status(B)).status === 'ACCEPTED' && (await status(B)).merged_into_id === null && evB.at(-1).action === 'UNMERGE', 'Undo merge -> ACCEPTED, detached, UNMERGE event')

  await store.transitionRecords({ ids: [A], to: 'SUPERSEDED', actor: { cwid: 'ignored', kind: 'system' }, supersededByPmid: 424242 })
  const sup = await status(A)
  check(sup.status === 'SUPERSEDED' && Number(sup.superseded_by_pmid) === 424242 && sup.status_by === 'system', 'system supersede -> SUPERSEDED, status_by system')
  check(!!(await rejects(store.undoRecords({ ids: [A], actor: me }), /system/)), 'curator Undo of a supersede refused')
  check(!!(await rejects(store.transitionRecords({ ids: [A], to: 'ACCEPTED', actor: me }), /system/)), 'curator cannot un-supersede')
  await store.transitionRecords({ ids: [A], to: 'ACCEPTED', actor: { cwid: 'x', kind: 'system' } })
  check((await status(A)).status === 'ACCEPTED' && (await status(A)).superseded_by_pmid === null, 'system un-supersede -> ACCEPTED, twin cleared')

  await store.transitionRecords({ ids: [A], to: 'REMOVED', actor: me, withoutMemory: true, note: 'Authorships reopen' })
  check((await status(A)).status === 'REMOVED' && (await memory(A)).length === 0, 'Authorships reopen -> REMOVED with no rejection memory')

  console.log('\n6. edit')
  const ed = await store.editRecord({ id: B, patch: { title: 'Hepatic outcomes, revised', peerReviewed: true }, actor: me })
  const evE = (await events(B)).at(-1)
  const diff = typeof evE.diff_json === 'string' ? JSON.parse(evE.diff_json) : evE.diff_json
  check(ed.title === 'Hepatic outcomes, revised' && ed.peerReviewed === true && ed.status === 'ACCEPTED', 'edit changes fields, never status')
  check(evE.action === 'EDIT' && 'title' in diff && 'title_year_key' in diff && 'peer_reviewed_by_hand' in diff, 'EDIT event carries the column diff', JSON.stringify(evE.diff_json))
  check(!!(await rejects(store.editRecord({ id: B, patch: { status: 'REJECTED' }, actor: me }), /Not editable: status/)), 'status is not editable')

  console.log('\n7. verdicts')
  const v = await store.addDupVerdict({ uid: UID, a: 'EXT:CROSSREF:10.1/a_b', b: 'EXT:CROSSREF:10.1/a1b', scopeCwid: 'zzcurator', actor: me })
  check(v.keyA === 'EXT:CROSSREF:10.1/a1b', 'pair stored in code-point order (passes the CHECK)')
  await store.addDupVerdict({ uid: UID, a: 'PMID:1', b: 'EXT:SCOPUS:1', actor: me })
  check((await store.listDupVerdicts(UID, 'zzcurator')).length === 2 && (await store.listDupVerdicts(UID, 'zzsomeoneelse')).length === 1, 'curator sees global + own; another sees global only')
  check((await store.removeDupVerdict({ uid: UID, a: 'EXT:CROSSREF:10.1/a1b', b: 'EXT:CROSSREF:10.1/a_b', scopeCwid: 'zzcurator' })) === 1, 'verdict removed (Undo)')

  console.log('\n8. caller-owned transaction (Authorships accept)')
  const rolled = await rejects(sequelize.transaction(async (t) => {
    const r = await store.createRecord({ uid: UID, body: { articleId: 'OPENALEX:W900000003', sourceType: 'OPENALEX', title: 'Rolled back' }, actor: me, goldStandard: GS, transaction: t })
    if (r.status !== 201) throw new Error('create failed')
    throw new Error('authorship_review update failed')
  }), /authorship_review/)
  const left = await q('SELECT COUNT(*) AS n FROM external_record WHERE uid = :uid AND article_id = :a', { uid: UID, a: 'OPENALEX:W900000003' })
  check(!!rolled && Number(left[0].n) === 0, 'record rolled back with the caller\'s transaction')

  console.log('\n9. list')
  const list = await store.listRecords(UID)
  check(list.length === 2 && list.every((r) => 'articleId' in r && 'suppressed' in r && 'status' in r), 'listRecords returns API-shaped rows')
} catch (e) {
  failures++
  console.error(`  ${FAIL} unexpected error: ${e.stack || e}`)
} finally {
  await cleanup().catch(() => {})
  const left = await q('SELECT (SELECT COUNT(*) FROM external_record WHERE uid=:uid) + (SELECT COUNT(*) FROM external_record_event WHERE uid=:uid) + (SELECT COUNT(*) FROM external_rejection WHERE uid=:uid) + (SELECT COUNT(*) FROM external_dup_verdict WHERE uid=:uid) AS n', { uid: UID })
  check(Number(left[0].n) === 0, `cleanup: no ${UID} rows left`)
  await sequelize.close()
}

console.log(failures ? `\ncheck-external-store: ${failures} FAILED` : '\ncheck-external-store: all checks passed')
process.exit(failures ? 1 : 0)
