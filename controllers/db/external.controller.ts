import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { reciterConfig } from '../../config/local'
import { canCurate } from './authorization.controller'
import { effectiveToken, viewAsActive } from '../../src/utils/viewAs'
import {
  getExternalArticles, addExternalArticle, deleteExternalArticle, recordExternalArticleFeedback,
} from '../externalArticle.controller'
import {
  externalStoreMode, StoreError, listRecords, getRecord, listEvents, createRecord, transitionRecords, undoRecords,
  editRecord, mergeRecords, recordsByArticleIds, dupCheck, addDupVerdict, removeDupVerdict, listDupVerdicts,
  type Actor,
} from '../../src/lib/externalStore'
import { isExternalStatus } from '../../src/lib/externalLifecycle'
import { storeTargetOf } from '../../src/utils/allSources'

// The 3c API (plan 3b-3e, "PM API"): /api/db/external/**, plus the legacy external-article routes
// when EXTERNAL_STORE=mysql. One switch decides the store:
//   reciter (default): list / add / remove proxy the ReCiter Java API exactly as the legacy
//                      routes do; the store-only routes answer 409.
//   mysql:             everything reads and writes reciterdb external_record (src/lib/externalStore.ts)
//                      and nothing reaches DynamoDB ExternalArticle.
// Every write takes canCurate(effectiveToken(token), uid) and the actor from the JWT: under View as
// the actor is the target and the real admin is recorded as impersonated_by.

export interface Reply { status: number; body: any }

export const send = (res: NextApiResponse, r: Reply) => res.status(r.status).send(r.body)
const fail = (status: number, message: any): Reply => ({ status, body: { statusCode: status, message } })

// The app-level backendApiKey every /api/db and /api/reciter route checks; answers and returns
// false when it is missing or wrong.
export function apiKeyOk(req: NextApiRequest, res: NextApiResponse): boolean {
  if (req.headers.authorization === undefined) { send(res, fail(400, 'Authorization header is needed')); return false }
  if (req.headers.authorization !== reciterConfig.backendApiKey) { send(res, fail(401, 'Authorization header is incorrect')); return false }
  return true
}

export interface Session {
  token: any // the raw JWT: the real signed-in user
  eff: any // effectiveToken(token): the View as target when one is active
  actor: Actor | null
}

export async function sessionOf(req: NextApiRequest): Promise<Session> {
  let token: any = null
  try { token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }) } catch (e) { /* no session: writes refuse below */ }
  const eff = effectiveToken(token)
  const cwid = eff?.username ? String(eff.username) : null
  const impersonatedBy = viewAsActive(token) && token?.username ? String(token.username) : null
  return { token, eff, actor: cwid ? { cwid, impersonatedBy } : null }
}

const mayCurate = (s: Session) => (uid: string) => canCurate(s.eff, uid)

const forbidden = (): Reply => fail(403, "You do not have permission to curate this person's publications")
const noSession = (): Reply => fail(401, 'Your session has expired. Please sign in again.')
export const storeOff = (): Reply => ({
  status: 409,
  body: { statusCode: 409, store: 'reciter', message: 'The external record store is not enabled (EXTERNAL_STORE=reciter).' },
})

// A StoreError is the store's answer (400/403/404/409); anything else is a 500.
async function guarded(fn: () => Promise<Reply>, label: string): Promise<Reply> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof StoreError) return fail(e.status, e.body ?? e.message)
    console.error(`[external] ${label} failed:`, e)
    return fail(500, 'Internal server error')
  }
}

const javaReply = (r: { statusCode: number; statusText: any }, ok: number[], extra: Record<string, any> = {}): Reply =>
  ok.includes(r.statusCode)
    ? { status: r.statusCode, body: { statusCode: r.statusCode, ...extra, external: r.statusText } }
    : fail(r.statusCode || 502, r.statusText)

// Per-person list / add / remove / feedback: both stores.

export async function listExternal(uid: string): Promise<Reply> {
  if (externalStoreMode() === 'mysql') {
    return guarded(async () => ({ status: 200, body: { statusCode: 200, store: 'mysql', external: await listRecords(uid) } }), 'list')
  }
  return javaReply(await getExternalArticles(uid), [200], { store: 'reciter' })
}

// Add publication (Curate). Provenance is the server's call: MANUAL for a manual record,
// otherwise ADD_SEARCH; AUTHORSHIPS is written only by the Authorships controller.
export async function addExternal(uid: string, body: any, s: Session, force: boolean): Promise<Reply> {
  if (!(await canCurate(s.eff, uid))) return forbidden()
  if (externalStoreMode() !== 'mysql') {
    const addedBy = s.token?.username ? String(s.token.username) : undefined
    return javaReply(await addExternalArticle(uid, body, addedBy, force), [200, 201])
  }
  if (!s.actor) return noSession()
  return guarded(async () => {
    const { addedBy: _a, provenance: _p, ...rest } = body || {}
    const manual = String(rest.sourceType || rest.articleId || '').toUpperCase().startsWith('MANUAL')
    const r = await createRecord({ uid, body: rest, actor: s.actor as Actor, force, provenance: manual ? 'MANUAL' : 'ADD_SEARCH' })
    if (r.status === 409) return { status: 409, body: { statusCode: 409, message: r.body } }
    return { status: 201, body: { statusCode: 201, external: r.record, reAdded: r.reAdded } }
  }, 'add')
}

// Legacy DELETE. With the store it is the soft Remove (ACCEPTED -> REMOVED, with rejection memory).
export async function removeExternal(uid: string, articleId: string, s: Session): Promise<Reply> {
  if (!(await canCurate(s.eff, uid))) return forbidden()
  if (externalStoreMode() !== 'mysql') return javaReply(await deleteExternalArticle(uid, articleId), [200])
  if (!s.actor) return noSession()
  return guarded(async () => {
    const [rec] = await recordsByArticleIds(uid, [articleId])
    if (!rec) return fail(404, `No external record ${articleId} for ${uid}`)
    const [row] = await transitionRecords({ ids: [Number(rec.id)], to: 'REMOVED', actor: s.actor as Actor, canCurate: mayCurate(s) })
    return { status: 200, body: { statusCode: 200, external: row } }
  }, 'remove')
}

// Legacy feedback (Accept / Reject / PENDING marker). With the store: Accept -> ACCEPTED,
// Reject -> REJECTED from Pending or REMOVED from Accepted, and PENDING (a FeedbackLog marker
// note, no state) changes nothing; "Different papers" lives in external_dup_verdict now.
export async function feedbackExternal(uid: string, articleId: string, action: 'ACCEPTED' | 'REJECTED' | 'PENDING', s: Session, note?: string): Promise<Reply> {
  if (!(await canCurate(s.eff, uid))) return forbidden()
  if (externalStoreMode() !== 'mysql') {
    const actorId = s.token?.username ? String(s.token.username) : undefined
    if (!actorId) return noSession()
    return javaReply(await recordExternalArticleFeedback(uid, articleId, action, actorId, note), [200])
  }
  if (!s.actor) return noSession()
  return guarded(async () => {
    const [rec] = await recordsByArticleIds(uid, [articleId])
    if (!rec) return fail(404, `No external record ${articleId} for ${uid}`)
    const to = action === 'ACCEPTED' ? storeTargetOf(rec.status, 'accept')
      : action === 'REJECTED' ? storeTargetOf(rec.status, rec.status === 'PENDING' ? 'reject' : 'remove')
        : null
    if (!to) return { status: 200, body: { statusCode: 200, external: await getRecord(Number(rec.id)) } }
    const [row] = await transitionRecords({ ids: [Number(rec.id)], to, actor: s.actor as Actor, note: note ?? null, canCurate: mayCurate(s) })
    return { status: 200, body: { statusCode: 200, external: row } }
  }, 'feedback')
}

// Store-only operations (EXTERNAL_STORE=mysql).

const ids = (v: any): number[] => (Array.isArray(v) ? v.map(Number) : [])

export async function transitionExternal(body: any, s: Session): Promise<Reply> {
  if (externalStoreMode() !== 'mysql') return storeOff()
  if (!s.actor) return noSession()
  const { to, note } = body || {}
  if (!isExternalStatus(to)) return fail(400, 'to must be an external record status')
  return guarded(async () => ({
    status: 200,
    body: { statusCode: 200, external: await transitionRecords({ ids: ids(body?.ids), to, actor: s.actor as Actor, note: note ?? null, canCurate: mayCurate(s) }) },
  }), 'transition')
}

export async function undoExternal(body: any, s: Session): Promise<Reply> {
  if (externalStoreMode() !== 'mysql') return storeOff()
  if (!s.actor) return noSession()
  return guarded(async () => ({
    status: 200,
    body: { statusCode: 200, external: await undoRecords({ ids: ids(body?.ids), actor: s.actor as Actor, note: body?.note ?? null, canCurate: mayCurate(s) }) },
  }), 'undo')
}

export async function mergeExternal(body: any, s: Session): Promise<Reply> {
  if (externalStoreMode() !== 'mysql') return storeOff()
  if (!s.actor) return noSession()
  return guarded(async () => ({
    status: 200,
    body: {
      statusCode: 200,
      external: await mergeRecords({
        dropIds: ids(body?.dropIds), keepId: body?.keepId ?? null, keepPmid: body?.keepPmid ?? null,
        actor: s.actor as Actor, note: body?.note ?? null, canCurate: mayCurate(s),
      }),
    },
  }), 'merge')
}

export async function getExternalRecord(id: number, s: Session): Promise<Reply> {
  if (externalStoreMode() !== 'mysql') return storeOff()
  return guarded(async () => {
    const rec = await getRecord(id)
    if (!rec) return fail(404, `No external record ${id}`)
    if (!(await canCurate(s.eff, rec.uid))) return forbidden()
    return { status: 200, body: { statusCode: 200, external: rec, events: await listEvents(id) } }
  }, 'get')
}

export async function editExternal(id: number, patch: any, s: Session): Promise<Reply> {
  if (externalStoreMode() !== 'mysql') return storeOff()
  if (!s.actor) return noSession()
  return guarded(async () => ({
    status: 200,
    body: { statusCode: 200, external: await editRecord({ id, patch, actor: s.actor as Actor, canCurate: mayCurate(s) }) },
  }), 'edit')
}

export async function dupCheckExternal(uid: string, body: any, s: Session): Promise<Reply> {
  if (externalStoreMode() !== 'mysql') return storeOff()
  if (!(await canCurate(s.eff, uid))) return forbidden()
  return guarded(async () => {
    const { result, conflict } = await dupCheck(uid, body)
    return { status: 200, body: { statusCode: 200, level: result.level, conflict, matches: result.matches } }
  }, 'dupcheck')
}

// "Different papers" (plan 3e): scope 'curator' (Curate's default) is the signed-in curator's own
// verdict; 'global' applies for everyone (Authorships).
export async function dupVerdictExternal(method: string, uid: string, q: any, s: Session): Promise<Reply> {
  if (externalStoreMode() !== 'mysql') return storeOff()
  if (!(await canCurate(s.eff, uid))) return forbidden()
  if (!s.actor) return noSession()
  if (method === 'GET') {
    return guarded(async () => ({ status: 200, body: { statusCode: 200, verdicts: await listDupVerdicts(uid, s.actor?.cwid) } }), 'verdicts')
  }
  const { a, b } = q || {}
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b || a === b) return fail(400, 'a and b must be two record keys')
  if (!/^(PMID:\d+|EXT:.+)$/.test(a) || !/^(PMID:\d+|EXT:.+)$/.test(b)) return fail(400, 'keys look like PMID:<n> or EXT:<articleId>')
  const scopeCwid = q?.scope === 'global' ? null : s.actor.cwid
  if (method === 'DELETE') {
    return guarded(async () => ({ status: 200, body: { statusCode: 200, removed: await removeDupVerdict({ uid, a, b, scopeCwid }) } }), 'verdict delete')
  }
  if ((q?.verdict ?? 'DIFFERENT') !== 'DIFFERENT') return fail(400, 'verdict must be DIFFERENT')
  return guarded(async () => ({
    status: 200,
    body: { statusCode: 200, verdict: await addDupVerdict({ uid, a, b, scopeCwid, actor: s.actor as Actor }) },
  }), 'verdict')
}

export const firstParam = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)
