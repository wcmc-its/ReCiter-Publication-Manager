// Reads and writes for reciterdb `external_record` and its three side tables (plan 3b-3e, P1).
// The 3c routes (P2) call this behind EXTERNAL_STORE=mysql; until then nothing in the app does.
//
// Every write:
//   - runs in one transaction (the caller's, when it passes one: the Authorships accept writes its
//     authorship_review update and the record together), and locks the rows it changes;
//   - goes through src/lib/externalLifecycle.ts, so a step the map does not allow is a 409;
//   - appends an external_record_event row and sets pm_touched = 1, so the DynamoDB sync (plan R2)
//     never overwrites a row PM owns;
//   - takes the actor from the caller, which takes it from the JWT, never from a request body.

import { Op, QueryTypes, Transaction, UniqueConstraintError } from 'sequelize'
import sequelize from '../db/db'
import models from '../db/sequelize'
import { getKnownPmidsByCwid, getRejectedPmidsByCwid } from './goldStandardRejections'
import {
  planTransition, planUndo, planReAdd, SYSTEM_ACTOR,
  type ExternalStatus, type LifecycleActor, type LifecyclePlan,
} from './externalLifecycle'
import { checkExternalDup, conflictBody, orderedPair, type DupContext, type DupResult } from './externalDupCheck'
import { recordFromInput, apiRecordOf, rejectionKeysOf, ShapeError } from './externalRecordShape'

export type ExternalStoreMode = 'reciter' | 'mysql'

// The cutover switch (plan "Cutover without double-writes"): `reciter` (default) keeps every read
// and write on the Java/DynamoDB API; `mysql` moves them to this store.
export const externalStoreMode = (): ExternalStoreMode => (process.env.EXTERNAL_STORE === 'mysql' ? 'mysql' : 'reciter')

export class StoreError extends Error {
  status: number
  body?: any
  constructor(status: number, message: string, body?: any) {
    super(message)
    this.status = status
    this.body = body
  }
}

export interface Actor {
  cwid: string
  impersonatedBy?: string | null // the real admin under "View as"
  kind?: LifecycleActor // default 'curator'
}

type CanCurate = (uid: string) => boolean | Promise<boolean>

const withTx = <T>(t: Transaction | undefined | null, fn: (t: Transaction) => Promise<T>): Promise<T> =>
  t ? fn(t) : sequelize.transaction(fn)

const actorKind = (a: Actor): LifecycleActor => a.kind || 'curator'
const actorId = (a: Actor): string => (actorKind(a) === 'system' ? SYSTEM_ACTOR : a.cwid)

const plain = (m: any) => (m && typeof m.get === 'function' ? m.get({ plain: true }) : m)

// MariaDB JSON columns are LONGTEXT, but mysql2 can hand them back already parsed (the server
// flags them as JSON in the column metadata). Compare and parse in one form.
const jsonText = (v: unknown): string | null => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v))
const jsonValue = (v: unknown): any => {
  if (v == null || typeof v !== 'string') return v ?? null
  try { return JSON.parse(v) } catch { return null }
}

// Reads

export async function listRecords(uid: string, opts: { transaction?: Transaction } = {}) {
  const rows = await models.ExternalRecord.findAll({
    where: { uid },
    order: [['added_at', 'DESC'], ['id', 'DESC']],
    transaction: opts.transaction,
  })
  return rows.map(apiRecordOf)
}

export async function getRecord(id: number, opts: { transaction?: Transaction } = {}) {
  const row = await models.ExternalRecord.findByPk(id, { transaction: opts.transaction })
  return row ? apiRecordOf(row) : null
}

export async function listEvents(recordId: number) {
  const rows = await models.ExternalRecordEvent.findAll({ where: { record_id: recordId }, order: [['id', 'ASC']] })
  return rows.map(plain)
}

// Duplicate check

export interface GoldStandardSets { known: Iterable<number>; rejected: Iterable<number> }

// Inputs for checkExternalDup. GoldStandard is read live from DynamoDB unless the caller already
// has it (goldStandardRejections never throws: an outage reads as "no PMIDs", as it does for the
// Authorships guards). Candidates come from person_article as of the last nightly (plan: known gap).
export async function loadDupContext(uid: string, opts: { goldStandard?: GoldStandardSets; transaction?: Transaction } = {}): Promise<DupContext> {
  const [existing, candidates, rejections, gs] = await Promise.all([
    models.ExternalRecord.findAll({
      where: { uid },
      attributes: ['id', 'article_id', 'source_type', 'status', 'pmid', 'doi', 'title', 'pub_date', 'container_title',
        'scopus_eid', 'openalex_id', 'orcid_put_code', 'title_year_key', 'merged_into_id', 'merged_into_pmid'],
      transaction: opts.transaction,
    }),
    sequelize.query(
      'SELECT pmid, doi, articleTitle, journalTitleVerbose, publicationDateStandardized, articleYear '
      + 'FROM person_article WHERE personIdentifier = :uid',
      { replacements: { uid }, type: QueryTypes.SELECT, transaction: opts.transaction },
    ),
    models.ExternalRejection.findAll({ where: { uid }, transaction: opts.transaction }),
    opts.goldStandard
      ? Promise.resolve(opts.goldStandard)
      : Promise.all([getKnownPmidsByCwid([uid]), getRejectedPmidsByCwid([uid])])
        .then(([k, r]) => ({ known: k[uid] || new Set<number>(), rejected: r[uid] || new Set<number>() })),
  ])
  return {
    existing: existing.map(plain).map((e: any) => ({ ...e, id: Number(e.id), pmid: e.pmid == null ? null : Number(e.pmid) })),
    candidates: (candidates as any[]).map((c) => ({ ...c, pmid: Number(c.pmid) })),
    rejections: rejections.map(plain),
    knownPmids: gs.known,
    rejectedPmids: gs.rejected,
  }
}

// Dry-run of the create check (the manual-entry dialog's live check, 3d).
export async function dupCheck(uid: string, body: any, opts: { goldStandard?: GoldStandardSets } = {}) {
  const record = recordFromInput(body)
  const result = checkExternalDup(record as any, await loadDupContext(uid, opts))
  return { record, result, conflict: conflictBody(result) }
}

// Events and rejection memory

async function addEvent(t: Transaction, rec: any, e: {
  action: 'ADD' | 'IMPORT' | 'TRANSITION' | 'EDIT' | 'MERGE' | 'UNMERGE'
  from?: string | null
  to?: string | null
  actor: Actor
  note?: string | null
  diff?: any
}) {
  await models.ExternalRecordEvent.create({
    record_id: rec.id,
    uid: rec.uid,
    action: e.action,
    from_status: (e.from ?? null) as any,
    to_status: (e.to ?? null) as any,
    actor: actorId(e.actor),
    impersonated_by: e.actor.impersonatedBy ?? null,
    note: e.note ?? null,
    diff_json: e.diff ? JSON.stringify(e.diff) : null,
  }, { transaction: t })
}

async function writeMemory(t: Transaction, rec: any, reason: 'REJECTED' | 'REMOVED', actor: Actor) {
  const keys = rejectionKeysOf(plain(rec))
  if (!keys.length) return
  await models.ExternalRejection.bulkCreate(
    keys.map((k) => ({ uid: rec.uid, ...k, record_id: rec.id, reason, rejected_by: actorId(actor), rejected_at: new Date() })),
    { transaction: t, updateOnDuplicate: ['record_id', 'reason', 'rejected_by', 'rejected_at'] },
  )
}

const clearMemory = (t: Transaction, recordId: number) =>
  models.ExternalRejection.destroy({ where: { record_id: recordId }, transaction: t })

// Apply one planned step to a locked row: status columns, memory, event.
async function applyPlan(t: Transaction, rec: any, plan: Extract<LifecyclePlan, { ok: true }>, actor: Actor, note?: string | null, diff?: any) {
  const from = rec.status as ExternalStatus
  await rec.update({
    ...plan.patch,
    status_by: actorId(actor),
    status_impersonated_by: actor.impersonatedBy ?? null,
    status_at: new Date(),
    pm_touched: 1,
  }, { transaction: t })
  if (plan.memory === 'write') await writeMemory(t, rec, plan.patch.status as 'REJECTED' | 'REMOVED', actor)
  if (plan.memory === 'clear') await clearMemory(t, rec.id)
  await addEvent(t, rec, { action: plan.action, from, to: plan.patch.status, actor, note, diff })
}

async function lockRows(t: Transaction, ids: number[], canCurate?: CanCurate) {
  const uniq = [...new Set((ids || []).map(Number))]
  if (!uniq.length || uniq.some((n) => !Number.isInteger(n) || n <= 0)) throw new StoreError(400, 'ids must be record ids')
  const rows = await models.ExternalRecord.findAll({ where: { id: { [Op.in]: uniq } }, transaction: t, lock: t.LOCK.UPDATE })
  if (rows.length !== uniq.length) {
    const found = new Set(rows.map((r: any) => Number(r.id)))
    throw new StoreError(404, `No external record ${uniq.filter((n) => !found.has(n)).join(', ')}`)
  }
  if (canCurate) {
    for (const uid of new Set(rows.map((r: any) => r.uid))) {
      if (!(await canCurate(uid))) throw new StoreError(403, `Not allowed to curate ${uid}`)
    }
  }
  return rows
}

// Create

export interface CreateOptions {
  uid: string
  body: any
  actor: Actor
  force?: boolean
  provenance?: string // overrides body.provenance (the route knows where the add came from)
  goldStandard?: GoldStandardSets
  transaction?: Transaction
}

export type CreateResult =
  | { status: 201; record: any; reAdded: boolean }
  | { status: 409; body: ReturnType<typeof conflictBody>; result: DupResult }

// Add publication, manual entry, Authorships accept/assign: duplicate check, then the row and its
// ADD event in one transaction. A work whose own row was REJECTED/REMOVED is revived ("Add anyway").
export async function createRecord(o: CreateOptions): Promise<CreateResult> {
  const uid = String(o.uid || '').trim()
  if (!uid) throw new StoreError(400, 'uid is required')
  let record: Record<string, any>
  try {
    record = recordFromInput({ ...o.body, provenance: o.provenance ?? o.body?.provenance })
  } catch (e) {
    if (e instanceof ShapeError) throw new StoreError(400, e.message)
    throw e
  }
  const ctx = await loadDupContext(uid, { goldStandard: o.goldStandard, transaction: o.transaction })
  const result = checkExternalDup(record as any, ctx)
  if (result.level === 'BLOCKED' || (result.level === 'WARNING' && !o.force)) {
    return { status: 409, body: conflictBody(result), result }
  }
  const memoryHits = result.matches.filter((m) => m.type === 'REJECTION_MEMORY')

  try {
    return await withTx(o.transaction, async (t) => {
      const existing: any = await models.ExternalRecord.findOne({
        where: { uid, article_id: record.article_id }, transaction: t, lock: t.LOCK.UPDATE,
      })
      let row: any
      let reAdded = false
      if (existing) {
        const plan = planReAdd(existing, { actor: actorKind(o.actor) })
        if (!plan.ok) throw new StoreError(409, plan.error)
        const { article_id: _a, source_type: _s, ...fields } = record
        await existing.update(fields, { transaction: t })
        await applyPlan(t, existing, plan, o.actor, 'added again')
        row = existing
        reAdded = true
      } else {
        const plan = planTransition(null, 'ACCEPTED', { actor: actorKind(o.actor) })
        if (!plan.ok) throw new StoreError(409, plan.error)
        const now = new Date()
        row = await models.ExternalRecord.create({
          ...record,
          uid,
          ...plan.patch,
          status_by: actorId(o.actor),
          status_impersonated_by: o.actor.impersonatedBy ?? null,
          status_at: now,
          added_by: actorId(o.actor),
          added_at: now,
          sync_origin: 'PM',
          pm_touched: 1,
        } as any, { transaction: t })
        await addEvent(t, row, { action: plan.action, from: null, to: plan.patch.status, actor: o.actor })
      }
      // "Add anyway" past a rejection-memory warning clears that memory (plan decision 12).
      const hitIds = memoryHits.map((m) => m.recordId).filter((n): n is number => n != null)
      if (hitIds.length) await models.ExternalRejection.destroy({ where: { uid, record_id: { [Op.in]: hitIds } }, transaction: t })
      const keys = rejectionKeysOf(record)
      if (memoryHits.length && keys.length) {
        await models.ExternalRejection.destroy({
          where: { uid, record_id: null, [Op.or]: keys.map((k) => ({ key_type: k.key_type, key_value: k.key_value })) },
          transaction: t,
        })
      }
      await row.reload({ transaction: t })
      return { status: 201 as const, record: apiRecordOf(row), reAdded }
    })
  } catch (e) {
    // Lost a race with a concurrent add of the same article_id.
    if (e instanceof UniqueConstraintError) {
      const raced: DupResult = {
        level: 'BLOCKED',
        matches: [{ type: 'ALREADY_ADDED', matchedId: record.article_id, detail: 'This external article was already added for this person.', title: record.title ?? null, journal: record.container_title ?? null, pubYear: null }],
      }
      return { status: 409, body: conflictBody(raced), result: raced }
    }
    throw e
  }
}

// Transitions

export interface TransitionRequest {
  ids: number[]
  to: ExternalStatus
  actor: Actor
  note?: string | null
  mergedIntoId?: number | null
  mergedIntoPmid?: number | null
  supersededByPmid?: number | null
  withoutMemory?: boolean // Authorships reopen only
  canCurate?: CanCurate
  transaction?: Transaction
}

// Accept, Reject, Remove, Same work (MERGED), supersede... for a batch. All or nothing: the first
// step the lifecycle map refuses rolls the whole batch back with a 409.
export async function transitionRecords(r: TransitionRequest) {
  return withTx(r.transaction, async (t) => {
    const rows = await lockRows(t, r.ids, r.canCurate)
    if (r.mergedIntoId != null && r.ids.map(Number).includes(Number(r.mergedIntoId))) throw new StoreError(400, 'A record cannot be merged into itself')
    for (const rec of rows) {
      const plan = planTransition(plain(rec), r.to, {
        actor: actorKind(r.actor),
        mergedIntoId: r.mergedIntoId, mergedIntoPmid: r.mergedIntoPmid,
        supersededByPmid: r.supersededByPmid, withoutMemory: r.withoutMemory,
      })
      if (!plan.ok) throw new StoreError(409, `Record ${rec.id}: ${plan.error}`)
      // "Not the same" detaches an AUTOMERGED child; keep the parent in the event so Undo can restore it.
      const diff = plan.action === 'UNMERGE'
        ? { merged_into_id: [rec.merged_into_id ?? null, null], merged_into_pmid: [rec.merged_into_pmid ?? null, null] }
        : undefined
      await applyPlan(t, rec, plan, r.actor, r.note, diff)
    }
    for (const rec of rows) await rec.reload({ transaction: t })
    return rows.map(apiRecordOf)
  })
}

// One-step Undo for a batch, all or nothing.
export async function undoRecords(r: { ids: number[]; actor: Actor; note?: string | null; canCurate?: CanCurate; transaction?: Transaction }) {
  return withTx(r.transaction, async (t) => {
    const rows = await lockRows(t, r.ids, r.canCurate)
    for (const rec of rows) {
      let restore = {}
      if (rec.prev_status === 'MERGED' || rec.prev_status === 'AUTOMERGED') {
        const last: any = await models.ExternalRecordEvent.findOne({
          where: { record_id: rec.id, action: 'UNMERGE' }, order: [['id', 'DESC']], transaction: t,
        })
        const d = jsonValue(last?.diff_json) || {}
        restore = { mergedIntoId: d.merged_into_id?.[0] ?? null, mergedIntoPmid: d.merged_into_pmid?.[0] ?? null }
      }
      const plan = planUndo(plain(rec), restore)
      if (!plan.ok) throw new StoreError(409, `Record ${rec.id}: ${plan.error}`)
      const diff = plan.action === 'UNMERGE'
        ? { merged_into_id: [rec.merged_into_id ?? null, null], merged_into_pmid: [rec.merged_into_pmid ?? null, null] }
        : undefined
      await applyPlan(t, rec, plan, r.actor, r.note ?? 'undo', diff)
    }
    for (const rec of rows) await rec.reload({ transaction: t })
    return rows.map(apiRecordOf)
  })
}

// Edit

// API field -> the columns it may change. Editing never changes status, source or article_id.
const EDITABLE: Record<string, string[]> = {
  title: ['title', 'title_year_key'],
  pubDate: ['pub_date', 'date_precision', 'title_year_key'],
  doi: ['doi'],
  pmid: ['pmid'],
  isbn: ['isbn'],
  url: ['url'],
  pubType: ['pub_type'],
  peerReviewed: ['peer_reviewed', 'peer_reviewed_by_hand'],
  role: ['role'],
  journalOrVenue: ['container_title'],
  containerTitle: ['container_title'],
  publisher: ['publisher'],
  volume: ['volume'],
  issue: ['issue'],
  pages: ['pages'],
  fields: ['fields_json'],
  authors: ['authors_json', 'author_count', 'byline', 'target_author_index'],
  targetAuthorIndex: ['target_author_index', 'byline'],
}

export async function editRecord(r: { id: number; patch: any; actor: Actor; canCurate?: CanCurate; transaction?: Transaction }) {
  const keys = Object.keys(r.patch || {})
  const bad = keys.filter((k) => !EDITABLE[k])
  if (!keys.length) throw new StoreError(400, 'Nothing to change')
  if (bad.length) throw new StoreError(400, `Not editable: ${bad.join(', ')}`)
  return withTx(r.transaction, async (t) => {
    const [rec] = await lockRows(t, [r.id], r.canCurate)
    const cur = apiRecordOf(rec)
    let next: Record<string, any>
    try {
      next = recordFromInput({
        ...cur,
        authors: cur.authorsJson,
        ...r.patch,
        articleId: rec.article_id,
        sourceType: rec.source_type,
      })
    } catch (e) {
      if (e instanceof ShapeError) throw new StoreError(400, e.message)
      throw e
    }
    const cols = new Set(keys.flatMap((k) => EDITABLE[k]))
    const diff: Record<string, [any, any]> = {}
    const update: Record<string, any> = {}
    for (const c of cols) {
      const json = c === 'fields_json' || c === 'authors_json'
      const before = json ? jsonText((rec as any)[c]) : (rec as any)[c] ?? null
      const after = next[c] ?? null
      if (String(before) !== String(after)) { diff[c] = json ? [jsonValue(before), jsonValue(after)] : [before, after]; update[c] = after }
    }
    if (!Object.keys(update).length) return cur
    await rec.update({ ...update, pm_touched: 1 }, { transaction: t })
    await addEvent(t, rec, { action: 'EDIT', actor: r.actor, diff })
    await rec.reload({ transaction: t })
    return apiRecordOf(rec)
  })
}

// "Different papers" verdicts (3e)

export async function addDupVerdict(v: { uid: string; a: string; b: string; scopeCwid?: string | null; actor: Actor; transaction?: Transaction }) {
  const [key_a, key_b] = orderedPair(v.a, v.b)
  await models.ExternalDupVerdict.bulkCreate(
    [{ uid: v.uid, key_a, key_b, verdict: 'DIFFERENT', scope_cwid: v.scopeCwid ?? null, decided_by: actorId(v.actor), decided_at: new Date() }],
    { transaction: v.transaction, updateOnDuplicate: ['decided_by', 'decided_at'] },
  )
  return { uid: v.uid, keyA: key_a, keyB: key_b, scopeCwid: v.scopeCwid ?? null }
}

export async function removeDupVerdict(v: { uid: string; a: string; b: string; scopeCwid?: string | null; transaction?: Transaction }) {
  const [key_a, key_b] = orderedPair(v.a, v.b)
  return models.ExternalDupVerdict.destroy({ where: { uid: v.uid, key_a, key_b, scope_cwid: v.scopeCwid ?? null }, transaction: v.transaction })
}

// The verdicts that apply for a curator: the global ones plus their own.
export async function listDupVerdicts(uid: string, cwid?: string | null) {
  const rows = await models.ExternalDupVerdict.findAll({
    where: { uid, [Op.or]: [{ scope_cwid: null }, ...(cwid ? [{ scope_cwid: cwid }] : [])] },
  })
  return rows.map(plain)
}

