// Pure helpers behind /api/db/authorships/feedback ("Report a problem"): access, body validation,
// id parsing, the people list, and the block runner. No database, no next: tests import this file
// with `node --test`. The queries are in src/lib/authorshipFeedbackEnrich.ts.
//
// NO PAYLOAD IN LOGS. A report holds a comment about named colleagues and HR dates, and Sequelize
// errors carry the bound values (`parameters`, `sql`, `errors[].instance`). So nothing here or in
// the two files that use it may log or return an error object or message: only errorInfo().

import { parseCwid } from '../utils/canonicalCwid'
import { isExternalSource, openalexWorkId } from './externalSource'
import { normDoi, titleYearKey } from './externalRecordShape'

// ---------------------------------------------------------------------------- access

/** Curator_All or Superuser on the REAL user's token (the /authorships rule in src/middleware.ts). */
export function mayReviewToken(token: any): boolean {
  let roles: any[] = []
  try { roles = JSON.parse(token?.userRoles || '[]') } catch { roles = [] }
  return Array.isArray(roles) && roles.some((r: any) => r?.roleLabel === 'Curator_All' || r?.roleLabel === 'Superuser')
}

/** The signed-in person's own cwid. Never the "View as" target: the overlay is not read here. */
export const realCwid = (token: any): string | null => parseCwid(token?.actor?.personIdentifier ?? token?.username)

/** AUTHORSHIP_FEEDBACK_CWIDS is a comma list of cwids. Unset or empty = off for everyone. */
export function feedbackAllowed(token: any, list: string | undefined): boolean {
  const who = realCwid(token)
  if (!who || !mayReviewToken(token)) return false
  return String(list || '').split(',').map((c) => parseCwid(c)).some((c) => c === who)
}

// ---------------------------------------------------------------------------- request body

export const TRIGGER_PLACES = ['menu', 'queue', 'dup_pair', 'activity', 'page'] as const
export const CATEGORIES = [
  'wrong_person', 'missing_person', 'wrong_evidence', 'duplicate', 'action_failed', 'list_or_count', 'layout', 'idea',
] as const

export interface FeedbackInput {
  client_uuid: string
  trigger_place: string
  category: string
  about_cwids: string[]
  expected: string | null
  typed_ref: string | null
  comment: string
  review_id: number | null
  snapshot_version: number
  client_build: string | null
  client_snapshot: string // JSON text, as stored
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The validated body, or { message } naming the field. Messages never quote what was sent. */
export function parseFeedbackBody(body: any): { input: FeedbackInput } | { message: string } {
  const b = body && typeof body === 'object' ? body : {}
  if (typeof b.client_uuid !== 'string' || !UUID.test(b.client_uuid)) return { message: 'client_uuid must be a UUID' }
  if (!TRIGGER_PLACES.includes(b.trigger_place)) return { message: 'trigger_place is not valid' }
  if (!CATEGORIES.includes(b.category)) return { message: 'category is not valid' }
  if (typeof b.comment !== 'string' || !b.comment.trim()) return { message: 'comment is required' }
  if (b.comment.length > 5000) return { message: 'comment is longer than 5000 characters' }
  for (const f of ['expected', 'typed_ref']) {
    if (b[f] == null) continue
    if (typeof b[f] !== 'string') return { message: `${f} must be text` }
    if (b[f].length > 255) return { message: `${f} is longer than 255 characters` }
  }
  if (b.about_cwids != null && !Array.isArray(b.about_cwids)) return { message: 'about_cwids must be a list' }
  if (b.about_cwids?.length > 30) return { message: 'about_cwids has more than 30 entries' }
  const reviewId = b.review_id == null ? null : Number(b.review_id)
  if (reviewId !== null && (!Number.isSafeInteger(reviewId) || reviewId <= 0)) return { message: 'review_id must be a row id or null' }
  if (b.snapshot_version !== 1) return { message: 'snapshot_version must be 1' }
  if (b.client_build != null && typeof b.client_build !== 'string') return { message: 'client_build must be text' }
  if (!b.client_snapshot || typeof b.client_snapshot !== 'object' || Array.isArray(b.client_snapshot)) {
    return { message: 'client_snapshot must be an object' }
  }
  const about: string[] = (b.about_cwids || []).map((c: any) => parseCwid(c)).filter(Boolean)
  return {
    input: {
      client_uuid: b.client_uuid.toLowerCase(),
      trigger_place: b.trigger_place,
      category: b.category,
      about_cwids: [...new Set(about)],
      expected: b.expected?.trim() || null,
      typed_ref: b.typed_ref?.trim() || null,
      comment: b.comment,
      review_id: reviewId,
      snapshot_version: 1,
      client_build: b.client_build ? b.client_build.slice(0, 64) : null,
      client_snapshot: JSON.stringify(b.client_snapshot),
    },
  }
}

/** PMID (bare, "PMID 1", a pubmed URL) or DOI out of the page-level form's reference box. */
export function parseTypedRef(ref: string | null): { pmid: number | null; doi: string | null } {
  const s = String(ref || '').trim()
  const doi = normDoi(/10\.\d{4,9}\/\S+/.exec(s)?.[0].replace(/[.,;]+$/, ''))
  if (doi) return { pmid: null, doi }
  // Text may follow a PMID that is labelled or long enough not to be a year or a count.
  const pmid = /^pmid\s*:?\s*(\d{1,9})(?=$|[\s.,;])/i.exec(s)?.[1] ?? /^(\d{1,9})[\s.,;]*$/.exec(s)?.[1]
    ?? /^(\d{6,9})(?=[\s.,;])/.exec(s)?.[1] ?? /pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,9})/i.exec(s)?.[1]
  return { pmid: pmid ? Number(pmid) : null, doi: null }
}

/** The "who should it be" box takes a cwid, a NetID or a name: the identifier in it, if any. */
export function expectedCwid(expected: string | null): string | null {
  // parseCwid is not shape-checked, so the whole text counts only when it cannot be a surname or a PMID.
  const whole = parseCwid(expected)
  if (whole && /[a-z]/i.test(whole) && /[\d_]/.test(whole) && !/^pmid/.test(whole)) return whole
  return parseCwid(/\b(?!pmid)[a-z]{2,4}\d{1,5}\b/i.exec(String(expected || ''))?.[0])
}

/** Only a PR or issue in these two repositories becomes a link; the value is written by an agent. */
export function resolutionUrl(ref: unknown): string | null {
  const s = String(ref ?? '')
  return /^https:\/\/github\.com\/wcmc-its\/(ReCiter-Publication-Manager|ReCiterDB)\/(pull|issues)\/\d+$/.test(s) ? s : null
}

// ---------------------------------------------------------------------------- row ids

export interface RowKeys {
  from: 'row' | 'typed'
  pmids: number[] // pmid, matched_pmid
  pmid: number | null
  matchedPmid: number | null
  dois: string[] // as stored, and normalised
  doiNorm: string | null
  externalId: string | null
  articleId: string | null // SOURCE:external_id, external lanes only
  titleYear: string | null // the external store's title+year key, stored rows only
}

const num = (v: any): number | null => (v == null || v === '' || !(Number(v) > 0) ? null : Number(v))
const text = (v: any): string | null => String(v ?? '').trim() || null

function keys(from: 'row' | 'typed', pmid: number | null, matchedPmid: number | null, doi: string | null,
  externalId: string | null, articleId: string | null, titleYear: string | null): RowKeys {
  const doiNorm = normDoi(doi)
  return {
    from, pmid, matchedPmid, externalId, articleId, doiNorm, titleYear,
    pmids: [...new Set([pmid, matchedPmid])].filter((p): p is number => p != null),
    dois: [...new Set([doi, doiNorm])].filter((d): d is string => !!d),
  }
}

/** Article keys of the STORED row. A blank id is null, so it is skipped and never matched. */
export function rowKeys(row: any): RowKeys {
  const ext = text(row.external_id)
  const articleId = !ext || !isExternalSource(row) ? null
    : row.source === 'openalex' ? `OPENALEX:${openalexWorkId(ext)}` : `${String(row.source).toUpperCase()}:${ext}`
  return keys('row', num(row.pmid), num(row.matched_pmid), text(row.doi), ext, articleId,
    titleYearKey(row.title, row.entrez_date))
}

/** Page-level report: what the reporter typed. null when it is neither a PMID nor a DOI. */
export function typedKeys(ref: string | null): RowKeys | null {
  const t = parseTypedRef(ref)
  return t.pmid || t.doi ? keys('typed', t.pmid, null, t.doi, null, null, null) : null
}

/** cwids in candidate_cwids_json, as rendered and in order. Malformed JSON = none. */
export function candidateCwids(json: any): string[] {
  let list: any = []
  try { list = typeof json === 'string' ? JSON.parse(json) : json } catch { list = [] }
  return Array.isArray(list)
    ? list.map((c: any) => (typeof c === 'string' ? c : c?.cwid)).filter(Boolean).map(String)
    : []
}

/** Surnames a byline may carry: its last word, last two and last three ("van der Berg"). */
export function bylineSurnames(name: any): string[] {
  const parts = String(name ?? '').trim().replace(/[\s,]+(jr|sr|ii|iii|iv)\.?$/i, '').split(/\s+/).filter(Boolean)
  return [1, 2, 3].filter((n) => n <= parts.length).map((n) => parts.slice(-n).join(' '))
}

/** Accents, spaces and punctuation off, as the producer keys its surname cohort. */
export const normSurname = (s: string): string =>
  s.normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()

/** Bare and URL forms of one ORCID iD: cornell_pub_orcid_mapping stores the URL. */
export function orcidForms(orcid: any): string[] {
  const bare = /\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i.exec(String(orcid ?? ''))?.[0].toUpperCase()
  return bare ? [bare, `https://orcid.org/${bare}`, `http://orcid.org/${bare}`] : []
}

// ---------------------------------------------------------------------------- people

export interface PersonRef { as_rendered: string; canonical: string | null; why: string[] }
export const PEOPLE_CAP = 30
export const PEOPLE_DETAIL_CAP = 12

/**
 * One entry per spelling, in seed order, capped. Two spellings of one cwid stay two entries with
 * the same `canonical`: DynamoDB keys are case-exact, so both have to be looked up.
 */
export function buildPeople(seeds: Array<{ cwid: any; why: string }>, cap = PEOPLE_CAP): { list: PersonRef[]; dropped: number } {
  const by = new Map<string, PersonRef>()
  for (const { cwid, why } of seeds) {
    const as = String(cwid ?? '')
    if (!as.trim()) continue
    const p = by.get(as)
    if (!p) by.set(as, { as_rendered: as, canonical: parseCwid(as), why: [why] })
    else if (!p.why.includes(why)) p.why.push(why)
  }
  const all = [...by.values()]
  return { list: all.slice(0, cap), dropped: Math.max(0, all.length - cap) }
}

/** Every key to look a set of people up under: as rendered and canonical. */
export const personKeys = (people: PersonRef[]): string[] =>
  [...new Set(people.flatMap((p) => [p.as_rendered, p.canonical]).filter((c): c is string => !!c))]

/**
 * Why a people block is not asked for, or null to ask. Ids that were never read (the row, its
 * byline or its siblings failed) are not_loaded: not_applicable would say there are none.
 */
export function peopleBlockSkip(i: {
  people: number; needsPmid: boolean; pmids: number; rowUnread: boolean; seedsFailed: boolean
}): BlockStatus | null {
  if (i.needsPmid && i.rowUnread) return 'not_loaded'
  if (!i.people) return i.rowUnread || i.seedsFailed ? 'not_loaded' : 'not_applicable'
  return i.needsPmid && !i.pmids ? 'not_applicable' : null
}

// ---------------------------------------------------------------------------- blocks

export type BlockStatus =
  'ok' | 'empty' | 'error' | 'timeout' | 'not_loaded' | 'not_applicable' | 'unavailable' | 'too_large'
export interface Block {
  status: BlockStatus
  at: string
  ms?: number
  data?: any
  error?: { name: string; code: string | null }
  from?: 'typed'
}

/** What a block function throws or returns when the answer is a status rather than data. */
export class BlockStop extends Error {
  status: BlockStatus
  data?: any
  info?: { name: string; code: string | null }
  constructor(status: BlockStatus, data?: any, info?: { name: string; code: string | null }) {
    super(status)
    this.status = status
    this.data = data
    this.info = info
  }
}

/** The only thing about an error that may be logged, stored or returned. */
export function errorInfo(e: any): { name: string; code: string | null; errno: number | null } {
  const o = e?.original ?? e?.parent ?? e
  const errno = Number.isInteger(o?.errno) ? o.errno : null
  const code = typeof o?.code === 'string' ? o.code : errno != null ? String(errno) : null
  return { name: String(e?.name || 'Error').slice(0, 64), code: code ? code.slice(0, 64) : null, errno }
}

export const isMissingTable = (e: any): boolean => errorInfo(e).errno === 1146
export const isDuplicateKey = (e: any): boolean => errorInfo(e).errno === 1062

// 1969: max_statement_time reached (MariaDB).
export function errorStatus(e: any): BlockStatus {
  if (e instanceof BlockStop) return e.status
  const { errno } = errorInfo(e)
  return errno === 1146 ? 'unavailable' : errno === 1969 ? 'timeout' : 'error'
}

const BLOCK = Symbol('block')
const isBlock = (v: any): v is Block => !!v && v[BLOCK] === true
/** Marks a value a block function returns as a finished block rather than as data. */
export function asBlock(b: Block): Block {
  Object.defineProperty(b, BLOCK, { value: true })
  return b
}

const isEmpty = (d: any): boolean => d == null || (Array.isArray(d) ? d.length === 0
  : typeof d === 'object' && Array.isArray(d.rows) && d.rows.length === 0)

/** data -> ok / empty / too_large. */
export function dataBlock(data: any, ms?: number, maxBytes = 1024 * 1024): Block {
  const at = new Date().toISOString()
  if (isEmpty(data)) return { status: 'empty', at, ms, data }
  const bytes = Buffer.byteLength(JSON.stringify(data))
  if (bytes > maxBytes) return { status: 'too_large', at, ms, error: { name: 'TooLarge', code: String(bytes) } }
  return { status: 'ok', at, ms, data }
}

export const statusBlock = (status: BlockStatus): Block => ({ status, at: new Date().toISOString() })

export function errorBlock(e: any, ms?: number): Block {
  const base = { status: errorStatus(e), at: new Date().toISOString(), ms }
  if (e instanceof BlockStop) {
    return { ...base, ...(e.data === undefined ? {} : { data: e.data }), ...(e.info ? { error: e.info } : {}) }
  }
  const { name, code } = errorInfo(e)
  return { ...base, error: { name, code } }
}

/** One block over several tables: each part keeps its own envelope, and the worst one decides. */
export function combineParts(parts: Record<string, Block>): Block {
  const all = Object.values(parts).map((p) => p.status)
  const status = (['error', 'timeout', 'too_large', 'ok', 'empty', 'unavailable', 'not_applicable'] as BlockStatus[])
    .find((s) => all.includes(s)) ?? 'not_applicable'
  return asBlock({ status, at: new Date().toISOString(), data: parts })
}

/** One part of a combined block: its failure is recorded here and does not stop the other parts. */
export async function part(fn: () => Promise<any>): Promise<Block> {
  const t0 = Date.now()
  try { return dataBlock(await fn(), Date.now() - t0) } catch (e) { return errorBlock(e, Date.now() - t0) }
}

/**
 * Runs block functions with at most `concurrency` at once and one overall deadline. A block that
 * has not finished by the deadline is `timeout` and one that has not started never starts. A block
 * function must run its own queries one after another, so blocks at once = queries at once.
 */
export function createRunner({ concurrency = 3, overallMs = 20000 } = {}) {
  const deadline = Date.now() + overallMs
  const expired = () => Date.now() >= deadline
  let active = 0
  const waiting: Array<() => void> = []
  const release = () => { const next = waiting.shift(); if (next) next(); else active-- }

  async function run(fn: () => Promise<any>): Promise<Block> {
    if (active < concurrency) active++
    else await new Promise<void>((r) => waiting.push(r))
    const t0 = Date.now()
    let timer: any
    try {
      if (expired()) return statusBlock('timeout')
      const work = fn()
      work.catch(() => { /* a late failure after the deadline is already reported as timeout */ })
      const out = await Promise.race([
        work,
        new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new BlockStop('timeout')), deadline - t0) }),
      ])
      const ms = Date.now() - t0
      return isBlock(out) ? { ...out, ms } : dataBlock(out, ms)
    } catch (e) {
      return errorBlock(e, Date.now() - t0)
    } finally {
      clearTimeout(timer)
      release()
    }
  }
  return { run, expired }
}

export const blockFailed = (b: any): boolean => ['error', 'timeout', 'too_large'].includes(b?.status)

/** partial = any block error, timeout or too_large. `people.list` is not a block. */
export function snapshotState(snapshot: { row: any; people: any; run: any }): 'complete' | 'partial' {
  const blocks = [snapshot.row, snapshot.people, snapshot.run].flatMap((g) => Object.values(g || {}))
  return blocks.some(blockFailed) ? 'partial' : 'complete'
}

/**
 * Writes what was collected, again once if that fails, and then only the keys and raw_row: the
 * producer refreshes the row in place, so raw_row is the one block nobody can read again later.
 * Throws the last error when even that is refused.
 */
export async function writeSnapshot<T extends { server_snapshot: string; snapshot_state: string }>(
  update: (values: T) => Promise<unknown>, found: T, onFail: (e: any) => void,
): Promise<void> {
  for (let i = 0; i < 2; i++) {
    try { await update(found); return } catch (e) { onFail(e) }
  }
  const { raw_row } = JSON.parse(found.server_snapshot).row
  await update({ ...found, server_snapshot: JSON.stringify({ row: { raw_row } }), snapshot_state: 'partial' })
}
