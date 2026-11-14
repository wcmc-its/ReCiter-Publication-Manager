#!/usr/bin/env node
/**
 * The 3c API layer (plan 3b-3e P2) against a real reciterdb: controllers/db/external.controller.ts
 * in both EXTERNAL_STORE modes, the legacy-route mappings, re-accept, merge, verdicts, dupcheck,
 * edit, the supersede reconcile (PMID and DOI paths, revive, skip-on-error), and the 3d manual
 * entry rules (refused without the store, body checks, server-minted id, edit checks, excludeId).
 * Run: node scripts/check-external-api.mjs
 *
 * Prerequisites: .env.local pointing at the DEV reciterdb, with ReCiterDB
 * setup/alter_external_record_v3.6.sql applied. Refuses any host without "dev" in its name.
 * Writes only rows for the synthetic uid below (external_* and one person_article row for the DOI
 * supersede path), deletes them before and after. Never calls the Java API: the reciter-mode
 * checks use only the store-only routes, which answer 409 without a call. GoldStandard is passed in
 * where the store would read it, except the add path, which reads DynamoDB GoldStandard for the
 * synthetic uid (a read; it has no item).
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

const { loadEnvConfig } = require(path.join(root, 'node_modules/@next/env'))
loadEnvConfig(root, true)
if (!/dev/i.test(process.env.RECITER_DB_HOST || '')) {
  console.error('\nRefusing: RECITER_DB_HOST does not look like the dev database.')
  process.exit(2)
}
process.env.RECITER_DB_POOL_MAX = '2'
process.env.EXTERNAL_STORE = 'mysql'

// The app's TypeScript, and its ESM .js outside node_modules (config/local.js, src/utils/viewAs.js),
// as CommonJS (target ES2019, as in check-external-store.mjs).
const compile = (mod, filename) => {
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true, allowJs: true },
    fileName: filename,
  })
  mod._compile(outputText, filename)
}
require.extensions['.ts'] = compile
const jsDefault = require.extensions['.js']
require.extensions['.js'] = (mod, filename) => (filename.startsWith(root) && !filename.includes('node_modules') ? compile(mod, filename) : jsDefault(mod, filename))

const api = require(path.join(root, 'controllers/db/external.controller.ts'))
const store = require(path.join(root, 'src/lib/externalStore.ts'))
const sequelize = require(path.join(root, 'src/db/db.ts')).default

const UID = 'zzextapicheck'
const OTHER = 'zzextapiother'
const session = (cwid, proxy = [UID]) => {
  const token = { username: cwid, userRoles: '[]', proxyPersonIds: JSON.stringify(proxy) }
  return { token, eff: token, actor: { cwid, impersonatedBy: null } }
}
const me = session('zzcurator')
const stranger = session('zzstranger', [])
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT })
const cleanup = async () => {
  for (const uid of [UID, OTHER]) {
    for (const t of ['external_record_event', 'external_rejection', 'external_dup_verdict', 'external_record']) {
      await sequelize.query(`DELETE FROM ${t} WHERE uid = :uid`, { replacements: { uid } })
    }
    await sequelize.query('DELETE FROM person_article WHERE personIdentifier = :uid', { replacements: { uid } })
  }
}
const status = async (id) => (await q('SELECT status, prev_status, status_by, superseded_by_pmid, merged_into_pmid, provenance FROM external_record WHERE id = :id', { id }))[0]
const memory = async (id) => Number((await q('SELECT COUNT(*) AS n FROM external_rejection WHERE record_id = :id', { id }))[0].n)
const lastEvent = async (id) => (await q('SELECT action, from_status, to_status, actor, note FROM external_record_event WHERE record_id = :id ORDER BY id DESC LIMIT 1', { id }))[0]

const scopus = {
  articleId: 'SCOPUS:900000101', sourceType: 'SCOPUS', doi: '10.9999/zz_api.1', title: 'Renal outcomes in a synthetic cohort',
  pubDate: '2023-05-01', journalOrVenue: 'Synthetic J', publicationType: 'Article', authors: ['Ann Lee', 'Bo Chen'], method: 'dropdown-search',
  addedBy: 'spoofed', provenance: 'AUTHORSHIPS',
}

try {
  await cleanup()

  console.log('\n1. EXTERNAL_STORE=reciter: store-only routes are off')
  process.env.EXTERNAL_STORE = 'reciter'
  for (const [name, call] of [
    ['transition', () => api.transitionExternal({ ids: [1], to: 'REMOVED' }, me)],
    ['undo', () => api.undoExternal({ ids: [1] }, me)],
    ['merge', () => api.mergeExternal({ dropIds: [1], keepPmid: 1 }, me)],
    ['edit', () => api.editExternal(1, { title: 'x' }, me)],
    ['record', () => api.getExternalRecord(1, me)],
    ['dupcheck', () => api.dupCheckExternal(UID, {}, me)],
    ['dup-verdict', () => api.dupVerdictExternal('GET', UID, {}, me)],
    // 3d: a manual add is refused before any Java call (Java has no MANUAL source).
    ['manual add', () => api.addExternal(UID, { sourceType: 'MANUAL', pubType: 'Book', title: 'x', pubDate: '2020' }, me, false)],
    ['manual add by articleId', () => api.addExternal(UID, { articleId: 'MANUAL:abc', pubType: 'Book', title: 'x', pubDate: '2020' }, me, false)],
  ]) {
    const r = await call()
    check(r.status === 409 && r.body.store === 'reciter', `${name} -> 409 store reciter`)
  }
  check(store.externalStoreMode() === 'reciter', 'externalStoreMode() follows the env')
  check((await store.reconcileSupersedeAfterGoldStandard(UID)) === null, 'gold-standard reconcile is a no-op')
  process.env.EXTERNAL_STORE = 'mysql'

  console.log('\n2. add and list (mysql)')
  const add = await api.addExternal(UID, scopus, me, false)
  check(add.status === 201 && add.body.external.status === 'ACCEPTED', 'add -> 201 ACCEPTED', JSON.stringify(add.body))
  const A = add.body.external.id
  const sA = await status(A)
  check(sA.provenance === 'ADD_SEARCH' && add.body.external.addedBy === 'zzcurator', 'provenance ADD_SEARCH from the server, addedBy from the session (client values ignored)')
  const manual = await api.addExternal(UID, { sourceType: 'MANUAL', pubType: 'Book', title: 'A manual work', pubDate: '2020' }, me, false)
  check(manual.status === 201 && /^MANUAL:/.test(manual.body.external.articleId) && (await status(manual.body.external.id)).provenance === 'MANUAL', 'manual add -> MANUAL:<uuid>, provenance MANUAL')
  const M = manual.body.external.id
  const dup = await api.addExternal(UID, scopus, me, false)
  check(dup.status === 409 && dup.body.message.status === 'BLOCKED', '409 body keeps the Java shape {statusCode, message: {status, message, matches}}')
  check((await api.addExternal(UID, scopus, stranger, false)).status === 403, 'add without canCurate -> 403')
  const list = await api.listExternal(UID)
  check(list.status === 200 && list.body.store === 'mysql' && list.body.external.length === 2, 'list -> store mysql, 2 rows')

  console.log('\n3. legacy feedback / delete mappings')
  let r = await api.feedbackExternal(UID, scopus.articleId, 'REJECTED', me, 'not hers')
  check(r.status === 200 && (await status(A)).status === 'REMOVED' && (await memory(A)) > 0, 'feedback REJECTED on ACCEPTED -> REMOVED, memory written')
  r = await api.feedbackExternal(UID, scopus.articleId, 'ACCEPTED', me)
  const back = await status(A)
  check(r.status === 200 && back.status === 'ACCEPTED' && back.prev_status === 'REMOVED' && (await memory(A)) === 0, 'feedback ACCEPTED on REMOVED -> re-accept, prev REMOVED, memory cleared')
  check((await lastEvent(A)).action === 'TRANSITION', 're-accept logs a TRANSITION event')
  r = await api.feedbackExternal(UID, scopus.articleId, 'PENDING', me, 'Not a duplicate of PMID 1')
  check(r.status === 200 && (await status(A)).status === 'ACCEPTED', 'feedback PENDING (marker) -> no state change')
  check((await api.feedbackExternal(UID, 'SCOPUS:404', 'ACCEPTED', me)).status === 404, 'unknown articleId -> 404')
  r = await api.removeExternal(UID, scopus.articleId, me)
  check(r.status === 200 && (await status(A)).status === 'REMOVED', 'legacy DELETE -> soft Remove')
  check((await api.removeExternal(UID, scopus.articleId, me)).status === 409, 'Remove of a REMOVED record -> 409 from the lifecycle map')

  console.log('\n4. transition / undo routes')
  r = await api.undoExternal({ ids: [A] }, me)
  check(r.status === 200 && (await status(A)).status === 'ACCEPTED' && (await memory(A)) === 0, 'undo -> ACCEPTED, memory cleared')
  r = await api.transitionExternal({ ids: [A, M], to: 'REMOVED' }, me)
  check(r.status === 200 && r.body.external.every((x) => x.status === 'REMOVED' && x.prevStatus === 'ACCEPTED'), 'batch Remove of two -> both REMOVED, rows carry prevStatus')
  r = await api.transitionExternal({ ids: [A, M], to: 'ACCEPTED' }, me)
  check(r.status === 200 && r.body.external.every((x) => x.status === 'ACCEPTED'), 'Accept from Rejected view -> both ACCEPTED')
  check((await api.transitionExternal({ ids: [A], to: 'BOGUS' }, me)).status === 400, 'unknown target -> 400')
  check((await api.transitionExternal({ ids: [A], to: 'REMOVED' }, stranger)).status === 403, 'transition without canCurate -> 403')
  check((await api.transitionExternal({ ids: [A], to: 'REMOVED' }, { ...me, actor: null })).status === 401, 'no session -> 401')

  console.log('\n5. merge (Keep PubMed record) and undo')
  r = await api.mergeExternal({ dropIds: [A], keepPmid: 31415926, note: 'Duplicate of PMID 31415926' }, me)
  const mA = await status(A)
  check(r.status === 200 && mA.status === 'MERGED' && Number(mA.merged_into_pmid) === 31415926, 'merge keepPmid -> MERGED into the PMID')
  r = await api.undoExternal({ ids: [A] }, me)
  check(r.status === 200 && (await status(A)).status === 'ACCEPTED', 'undo merge -> ACCEPTED')
  check((await api.mergeExternal({ dropIds: [A], keepId: M, keepPmid: 1 }, me)).status === 400, 'both keepId and keepPmid -> 400')
  const other = await store.createRecord({ uid: OTHER, body: { articleId: 'OPENALEX:W900000777', sourceType: 'OPENALEX', title: 'Other person' }, actor: { cwid: 'zzcurator' }, goldStandard: { known: [], rejected: [] } })
  check((await api.mergeExternal({ dropIds: [A], keepId: other.record.id }, me)).status === 400, 'keepId of another person -> 400')
  r = await api.mergeExternal({ dropIds: [M], keepId: A }, me)
  check(r.status === 200 && (await status(M)).status === 'MERGED', 'merge keepId -> MERGED into the kept record')
  await api.undoExternal({ ids: [M] }, me)

  console.log('\n6. verdicts, dupcheck, edit, record')
  r = await api.dupVerdictExternal('POST', UID, { a: 'PMID:31415926', b: `EXT:${scopus.articleId}`, verdict: 'DIFFERENT' }, me)
  check(r.status === 200, 'verdict POST')
  r = await api.dupVerdictExternal('GET', UID, {}, me)
  check(r.status === 200 && r.body.verdicts.length === 1 && r.body.verdicts[0].scope_cwid === 'zzcurator', 'verdict GET: the curator\'s own verdict')
  r = await api.dupVerdictExternal('DELETE', UID, { a: `EXT:${scopus.articleId}`, b: 'PMID:31415926' }, me)
  check(r.status === 200 && r.body.removed === 1, 'verdict DELETE (either order)')
  check((await api.dupVerdictExternal('POST', UID, { a: 'x', b: 'y' }, me)).status === 400, 'bad keys -> 400')
  r = await api.dupCheckExternal(UID, { articleId: 'CROSSREF:10.9999/zz_api.1', sourceType: 'CROSSREF', doi: '10.9999/ZZ_API.1', title: 'x' }, me)
  check(r.status === 200 && r.body.level === 'BLOCKED' && r.body.conflict.status === 'BLOCKED', 'dupcheck: same DOI -> BLOCKED (dry run)')
  r = await api.dupCheckExternal(UID, { sourceType: 'MANUAL', title: 'Something else entirely', pubDate: '2001' }, me)
  check(r.status === 200 && r.body.level === 'OK' && r.body.conflict === null, 'dupcheck: new work -> OK')
  r = await api.editExternal(A, { title: 'Renal outcomes, revised' }, me)
  check(r.status === 200 && r.body.external.title === 'Renal outcomes, revised' && (await lastEvent(A)).action === 'EDIT', 'edit -> new title, EDIT event')
  check((await api.editExternal(A, { status: 'REJECTED' }, me)).status === 400, 'edit of status -> 400')
  r = await api.getExternalRecord(A, me)
  check(r.status === 200 && r.body.external.id === A && r.body.events.length >= 10, 'record GET returns the row and its history')
  check((await api.getExternalRecord(A, stranger)).status === 403, 'record GET without canCurate -> 403')

  console.log('\n7. supersede reconcile')
  // A: SCOPUS with DOI 10.9999/zz_api.1. M: manual, no DOI. Give M a PMID.
  await api.editExternal(M, { pmid: 27182818 }, me)
  let rec = await store.reconcileSupersede(UID, { knownPmids: [27182818] })
  check(rec.superseded === 1 && (await status(M)).status === 'SUPERSEDED' && Number((await status(M)).superseded_by_pmid) === 27182818 && (await status(M)).status_by === 'system', 'PMID accepted -> record SUPERSEDED by it (system)')
  check((await status(A)).status === 'ACCEPTED', 'unrelated record untouched')
  await sequelize.query('INSERT INTO person_article (personIdentifier, pmid, doi) VALUES (:uid, 16180339, :doi)', { replacements: { uid: UID, doi: 'https://doi.org/10.9999/ZZ_API.1' } })
  rec = await store.reconcileSupersede(UID, { knownPmids: [27182818, 16180339] })
  check(rec.superseded === 1 && Number((await status(A)).superseded_by_pmid) === 16180339, 'DOI of an accepted PMID (person_article) -> SUPERSEDED by that PMID')
  rec = await store.reconcileSupersede(UID, { knownPmids: [16180339] })
  check(rec.revived === 1 && (await status(M)).status === 'ACCEPTED' && (await status(A)).status === 'SUPERSEDED', 'twin no longer accepted -> revived; the other stays')
  check((await api.undoExternal({ ids: [A] }, me)).status === 409, 'curator cannot undo a supersede')
  rec = await store.reconcileSupersede(UID, { knownPmids: [] })
  check(rec.revived === 1 && rec.superseded === 0 && (await status(A)).status === 'ACCEPTED', 'empty knownpmids -> everything revived')
  // A strict GoldStandard read that fails must skip, not revive.
  await store.reconcileSupersede(UID, { knownPmids: [16180339] })
  const gsr = require(path.join(root, 'src/lib/goldStandardRejections.ts'))
  const saved = gsr.getKnownPmidsStrict
  // Point the store's strict read at a failing stub through the module export it imports.
  gsr.getKnownPmidsStrict = async () => { throw new Error('simulated DynamoDB outage') }
  const skipped = await store.reconcileSupersedeAfterGoldStandard(UID).finally(() => { gsr.getKnownPmidsStrict = saved })
  check(skipped === null && (await status(A)).status === 'SUPERSEDED', 'GoldStandard read error -> reconcile skipped, nothing revived')

  console.log('\n8. manual entry (3d)')
  for (const [label, body] of [
    ['no type', { sourceType: 'MANUAL', title: 'T', pubDate: '2021' }],
    ['no title', { sourceType: 'MANUAL', pubType: 'Book', title: ' ', pubDate: '2021' }],
    ['no year', { sourceType: 'MANUAL', pubType: 'Book', title: 'T', pubDate: '' }],
    ['bad DOI', { sourceType: 'MANUAL', pubType: 'Book', title: 'T', pubDate: '2021', doi: 'nope' }],
    ['bad ISBN', { sourceType: 'MANUAL', pubType: 'Book', title: 'T', pubDate: '2021', isbn: '978-0-00-000000-1' }],
    ['month 13', { sourceType: 'MANUAL', pubType: 'Book', title: 'T', pubDate: '2021-13' }],
    ['Feb 30', { sourceType: 'MANUAL', pubType: 'Book', title: 'T', pubDate: '2021-02-30' }],
    ['a PMID', { sourceType: 'MANUAL', pubType: 'Book', title: 'T', pubDate: '2021', pmid: 12345678 }],
    ['peer-reviewed NPRW', { sourceType: 'MANUAL', pubType: 'Non-Peer-Reviewed Writing', title: 'T', pubDate: '2021', peerReviewed: true }],
  ]) check((await api.addExternal(UID, body, me, false)).status === 400, `manual add, ${label} -> 400`)
  const man = await api.addExternal(UID, {
    sourceType: 'MANUAL', articleId: 'MANUAL:client-chosen', pubType: 'Book Chapter', title: 'A chapter entered by hand',
    pubDate: '2024-05', authors: ['Mei Lin', 'Ann Zed'], targetAuthorIndex: 2, journalOrVenue: 'The Book', publisher: 'Facet',
    doi: '10.9999/zz_api.manual', fields: { editors: ['E One'], place: 'London', detailsFrom: 'Crossref' }, role: 'Translator', peerReviewed: true,
  }, me, false)
  const X = man.body.external?.id
  check(man.status === 201 && /^MANUAL:[0-9a-f-]{36}$/.test(man.body.external.articleId), 'manual add -> 201 with a server-minted MANUAL:<uuid> (client articleId ignored)', JSON.stringify(man.body).slice(0, 300))
  const xr = (await q('SELECT provenance, status, source_type, date_precision, target_author_index, byline, pub_type, role, peer_reviewed, fields_json FROM external_record WHERE id = :id', { id: X }))[0]
  check(xr.provenance === 'MANUAL' && xr.status === 'ACCEPTED' && xr.source_type === 'MANUAL', 'row: provenance MANUAL, ACCEPTED, source MANUAL')
  check(xr.date_precision === 'MONTH' && Number(xr.target_author_index) === 2 && xr.byline === 'Lin M, ((Zed A))', 'row: date precision MONTH, position 2, byline built server-side', JSON.stringify(xr))
  check(xr.pub_type === 'Book Chapter' && xr.role === 'Translator' && Number(xr.peer_reviewed) === 1, 'row: type, role and peer review as entered')
  const ev = await lastEvent(X)
  check(ev.action === 'ADD' && ev.to_status === 'ACCEPTED' && ev.actor === 'zzcurator', 'ADD event by the session curator')
  const dupDoi = await api.addExternal(UID, { sourceType: 'MANUAL', pubType: 'Book', title: 'Other', pubDate: '2024', doi: '10.9999/ZZ_API.MANUAL' }, me, false)
  check(dupDoi.status === 409 && dupDoi.body.message.status === 'BLOCKED', 'same DOI again -> 409 BLOCKED')
  const warn = await api.addExternal(UID, { sourceType: 'MANUAL', pubType: 'Book', title: 'A chapter entered by hand.', pubDate: '2024' }, me, false)
  check(warn.status === 409 && warn.body.message.status === 'WARNING', 'same title and year -> 409 WARNING')
  let dc = await api.dupCheckExternal(UID, { sourceType: 'MANUAL', doi: '10.9999/zz_api.manual', title: 'A chapter entered by hand', pubDate: '2024' }, me)
  check(dc.status === 200 && dc.body.level === 'BLOCKED', 'dupcheck of its own DOI -> BLOCKED')
  dc = await api.dupCheckExternal(UID, { sourceType: 'MANUAL', doi: '10.9999/zz_api.manual', title: 'A chapter entered by hand', pubDate: '2024' }, me, X)
  check(dc.status === 200 && dc.body.level === 'OK', 'dupcheck with excludeId (its Edit) -> OK', JSON.stringify(dc.body).slice(0, 300))
  let ed = await api.editExternal(X, { title: '' }, me)
  check(ed.status === 400, 'edit a manual record to no title -> 400')
  ed = await api.editExternal(X, { pubDate: 'n.d.' }, me)
  check(ed.status === 400, 'edit a manual record to no year -> 400')
  ed = await api.editExternal(X, { title: 'A chapter, edited', pubDate: '2024-05-02', targetAuthorIndex: 1 }, me)
  const xe = (await q('SELECT article_id, title, date_precision, byline FROM external_record WHERE id = :id', { id: X }))[0]
  check(ed.status === 200 && xe.article_id === man.body.external.articleId && xe.title === 'A chapter, edited' && xe.date_precision === 'DAY' && xe.byline === '((Lin M)), Zed A', 'edit keeps the article_id, changes title, precision and position', JSON.stringify(xe))
  check((await lastEvent(X)).action === 'EDIT', 'EDIT event')
  check((await api.editExternal(X, { title: 'x' }, stranger)).status === 403, 'edit without canCurate -> 403')
  check((await api.editExternal(X, { title: '' }, stranger)).status === 403, 'edit without canCurate -> 403 before the body checks')
  check((await api.editExternal(X, { pubDate: '2024-13' }, me)).status === 400, 'edit a manual record to month 13 -> 400')
} catch (e) {
  failures++
  console.error(`  ${FAIL} unexpected error: ${e.stack || e}`)
} finally {
  await cleanup().catch(() => {})
  const left = await q(`SELECT (SELECT COUNT(*) FROM external_record WHERE uid IN (:u)) + (SELECT COUNT(*) FROM external_record_event WHERE uid IN (:u))
    + (SELECT COUNT(*) FROM external_rejection WHERE uid IN (:u)) + (SELECT COUNT(*) FROM external_dup_verdict WHERE uid IN (:u))
    + (SELECT COUNT(*) FROM person_article WHERE personIdentifier IN (:u)) AS n`, { u: [UID, OTHER] })
  check(Number(left[0].n) === 0, `cleanup: no ${UID} / ${OTHER} rows left`)
  await sequelize.close()
}

console.log(failures ? `\ncheck-external-api: ${failures} FAILED` : '\ncheck-external-api: all checks passed')
process.exit(failures ? 1 : 0)
