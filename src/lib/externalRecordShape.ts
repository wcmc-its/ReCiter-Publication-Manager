// Row shaping for reciterdb `external_record`: the API body <-> column mapping, the byline, the
// duplicate keys (normalized DOI, title+year key, source ids) and the rejection-memory keys.
// Pure apart from node's crypto (SHA-1, UUID), so it is server-side only; tests import it with
// `node --test`. Used by src/lib/externalDupCheck.ts and src/lib/externalStore.ts.

import { createHash, randomUUID } from 'crypto'
import { PUB_ROLES, isPubType, mapSourceType, normTitle } from './pubTypes'

export const SOURCE_TYPES = ['SCOPUS', 'WOS', 'OPENALEX', 'CROSSREF', 'MANUAL', 'ORCID'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]
export const PROVENANCES = [
  'ORCID_SELF', 'ORCID_CROSSREF', 'ORCID_SCOPUS', 'SCOPUS_AUID', 'OPENALEX_AUTHOR', 'MANUAL', 'ADD_SEARCH', 'AUTHORSHIPS',
] as const
export type Provenance = (typeof PROVENANCES)[number]

const SOURCE_LABEL: Record<string, string> = { SCOPUS: 'Scopus', OPENALEX: 'OpenAlex', CROSSREF: 'Crossref', ORCID: 'ORCID' }

// Same rule as external_record.doi_norm (generated in MariaDB) and Java's normalizeDoi: trim,
// lower-case, strip a doi.org URL or "doi:" prefix; blank -> null.
export const normDoi = (d: unknown): string | null => {
  const s = String(d ?? '').trim().toLowerCase().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/, '').trim()
  return s || null
}

// First four-digit year in a date string ("2024-05-01", "May 2024", "2024").
export const yearOf = (date: unknown): string | null => String(date ?? '').match(/\d{4}/)?.[0] || null

// external_record.title_year_key: SHA-1 hex of `${normTitle(title)}|${year}` (UTF-8). NULL when
// either part is missing, so blank titles never collide. ReCiterDB's sync (plan R2) must compute
// the identical value; tests/externalDupCheck.test.mjs pins two vectors for it.
export const titleYearKey = (title: unknown, date: unknown): string | null => {
  const t = normTitle(title == null ? '' : String(title))
  const y = yearOf(date)
  if (!t || !y) return null
  return createHash('sha1').update(`${t}|${y}`, 'utf8').digest('hex')
}

export const datePrecisionOf = (d: unknown): 'YEAR' | 'MONTH' | 'DAY' | null => {
  const s = String(d ?? '').trim()
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) return 'DAY'
  if (/^\d{4}-\d{1,2}$/.test(s)) return 'MONTH'
  if (/^\d{4}$/.test(s)) return 'YEAR'
  return null
}

// Bare OpenAlex work id: "https://openalex.org/W123" and "W123" are the same.
const bareOpenalex = (id: unknown): string | null => {
  const s = String(id ?? '').trim().replace(/^https?:\/\/openalex\.org\//i, '')
  return s || null
}

// Source ids a record carries, as `SCOPUS:<id>` / `OPENALEX:<W id>` / `WOS:<id>` strings: its own
// article_id for those three sources, plus any Scopus EID / OpenAlex id it carries from another
// source. Crossref and manual ids are not source ids (a Crossref id is its DOI).
export const sourceIdsOf = (r: { article_id?: string | null; scopus_eid?: string | null; openalex_id?: string | null }): string[] => {
  const out = new Set<string>()
  const id = String(r.article_id || '')
  const i = id.indexOf(':')
  const prefix = id.slice(0, i).toUpperCase()
  if (prefix === 'SCOPUS' || prefix === 'WOS') out.add(`${prefix}:${id.slice(i + 1).trim()}`)
  if (prefix === 'OPENALEX') { const w = bareOpenalex(id.slice(i + 1)); if (w) out.add(`OPENALEX:${w}`) }
  if (r.scopus_eid) out.add(`SCOPUS:${String(r.scopus_eid).trim()}`)
  const w = bareOpenalex(r.openalex_id)
  if (w) out.add(`OPENALEX:${w}`)
  return [...out]
}

// Authors and the byline

export interface AuthorName { given: string; surname: string }

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv'])

// (surname, given) from {given, surname} / Crossref {given, family} or a "Given M. Surname" string.
// As ReCiterDB's retrieveExternalArticles._split_name: the last token of a free-text name is the
// surname, so "Anna van der Berg" gives "Berg"; structured names are unaffected.
export const splitName = (n: any): AuthorName => {
  if (n && typeof n === 'object') {
    return { given: String(n.given || '').trim(), surname: String(n.surname || n.family || n.name || '').trim() }
  }
  const toks = String(n ?? '').replace(/,/g, ' ').split(/\s+/).filter((t) => t && !SUFFIXES.has(t.replace(/\./g, '').toLowerCase()))
  return toks.length ? { given: toks.slice(0, -1).join(' '), surname: toks[toks.length - 1] } : { given: '', surname: '' }
}

export const normalizeAuthors = (list: unknown): AuthorName[] =>
  (Array.isArray(list) ? list : []).map(splitName).filter((a) => a.surname)

export const displayName = (a: AuthorName): string => [a.given, a.surname].filter(Boolean).join(' ')

const shortName = (a: AuthorName): string => {
  const initials = a.given.split(/[\s.\-]+/).filter((w) => w && /\p{L}/u.test(w[0])).map((w) => w[0].toUpperCase()).join('')
  return `${a.surname} ${initials}`.trim()
}

export const BYLINE_MAX = 1000

// "Surname GA, ((Person PB)), ..." with the person (1-based targetIndex) wrapped as in PubMed rows;
// cut at a name boundary with "et al." past BYLINE_MAX, keeping the person's own name. Port of
// ReCiterDB retrieveExternalArticles.byline_and_position / _fit, with the position given instead
// of found by surname. null when there are no authors.
export const buildByline = (authors: AuthorName[], targetIndex?: number | null): string | null => {
  if (!authors.length) return null
  const hit = targetIndex && targetIndex >= 1 && targetIndex <= authors.length ? targetIndex - 1 : null
  const shorts = authors.map((a, i) => (i === hit ? `((${shortName(a)}))` : shortName(a)))
  const all = shorts.join(', ')
  if (all.length <= BYLINE_MAX) return all
  let tail = hit !== null ? `, ..., ${shorts[hit]}, et al.` : ', et al.'
  const keep: string[] = []
  for (let i = 0; i < shorts.length; i++) {
    if (i === hit || [...keep, shorts[i]].join(', ').length + tail.length > BYLINE_MAX) break
    keep.push(shorts[i])
  }
  if (hit !== null && hit === keep.length) tail = `, ${shorts[hit]}, et al.`
  return keep.join(', ') + tail
}

// Rejection-memory keys (external_rejection), in precedence order (plan decision 7).
export const REJECTION_KEY_TYPES = ['DOI', 'ORCID_PUTCODE', 'SOURCE_ID', 'TITLE_YEAR'] as const
export type RejectionKeyType = (typeof REJECTION_KEY_TYPES)[number]
export interface RejectionKey { key_type: RejectionKeyType; key_value: string }

export interface KeyedRecord {
  article_id?: string | null
  doi?: string | null
  orcid_put_code?: string | null
  scopus_eid?: string | null
  openalex_id?: string | null
  title?: string | null
  pub_date?: string | null
  title_year_key?: string | null
}

// Every key the record carries (Reject and Remove write all of them).
export const rejectionKeysOf = (r: KeyedRecord): RejectionKey[] => {
  const keys: RejectionKey[] = []
  const doi = normDoi(r.doi)
  if (doi) keys.push({ key_type: 'DOI', key_value: doi.slice(0, 255) })
  const put = String(r.orcid_put_code ?? '').trim()
  if (put) keys.push({ key_type: 'ORCID_PUTCODE', key_value: put })
  for (const s of sourceIdsOf(r)) keys.push({ key_type: 'SOURCE_ID', key_value: s.slice(0, 255) })
  const ty = r.title_year_key || titleYearKey(r.title, r.pub_date)
  if (ty) keys.push({ key_type: 'TITLE_YEAR', key_value: ty })
  return keys
}

// API body -> external_record columns

const str = (v: unknown, max: number): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}
const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

export class ShapeError extends Error {
  status = 400
}

export const newManualArticleId = (): string => `MANUAL:${randomUUID()}`

// Columns a create writes, from the add body PM sends today (the Java ExternalArticle fields:
// articleId, sourceType, doi, pmid, title, journalOrVenue, authors, pubDate, publicationType,
// method, rawRecord) plus the 3b fields. Lifecycle, sync and audit columns are set by the store.
export function recordFromInput(body: any): Record<string, any> {
  if (!body || typeof body !== 'object') throw new ShapeError('A record body is required')
  let sourceType = String(body.sourceType || '').trim().toUpperCase()
  let articleId = String(body.articleId || '').trim()
  if (!articleId && sourceType === 'MANUAL') articleId = newManualArticleId()
  const prefix = articleId.slice(0, Math.max(0, articleId.indexOf(':'))).toUpperCase()
  if (!sourceType) sourceType = prefix
  if (!(SOURCE_TYPES as readonly string[]).includes(sourceType)) throw new ShapeError(`Unknown sourceType ${sourceType || '(none)'}`)
  if (prefix !== sourceType || articleId.length <= prefix.length + 1) {
    throw new ShapeError(`articleId must look like ${sourceType}:<id>`)
  }
  if (articleId.length > 96) throw new ShapeError('articleId is longer than 96 characters')

  const authors = normalizeAuthors(body.authors ?? body.authorsJson)
  const target = posInt(body.targetAuthorIndex)
  const title = str(body.title, 65535)
  const pubDate = str(body.pubDate, 32)
  const sourcePubType = str(body.publicationType ?? body.sourcePubType, 64)
  const mapped = sourcePubType && SOURCE_LABEL[sourceType] ? mapSourceType(SOURCE_LABEL[sourceType], sourcePubType) : null
  const pubType = isPubType(body.pubType) ? body.pubType : mapped?.type ?? null
  const isbn = Array.isArray(body.isbn) ? body.isbn.join(',') : body.isbn
  const raw = body.rawRecord == null ? null : typeof body.rawRecord === 'string' ? body.rawRecord : JSON.stringify(body.rawRecord)
  const fields = body.fields && typeof body.fields === 'object' ? JSON.stringify(body.fields) : null
  const peer = typeof body.peerReviewed === 'boolean' ? (body.peerReviewed ? 1 : 0) : null

  return {
    article_id: articleId,
    source_type: sourceType,
    provenance: (PROVENANCES as readonly string[]).includes(body.provenance) ? body.provenance : null,
    method: str(body.method, 64),
    pmid: posInt(body.pmid),
    doi: str(body.doi, 255),
    isbn: str(isbn, 128),
    scopus_eid: str(body.scopusEid, 64),
    openalex_id: str(bareOpenalex(body.openalexId), 64),
    orcid_put_code: str(body.orcidPutCode, 32),
    url: str(body.url, 1024),
    title,
    title_year_key: titleYearKey(title, pubDate),
    pub_type: pubType,
    source_pub_type: sourcePubType,
    type_notice: body.typeNotice === 'erratum' || body.typeNotice === 'retraction' ? body.typeNotice : mapped?.notice ?? null,
    peer_reviewed: peer,
    peer_reviewed_by_hand: peer === null ? 0 : 1,
    role: (PUB_ROLES as readonly string[]).includes(body.role) ? body.role : null,
    pub_date: pubDate,
    date_precision: datePrecisionOf(pubDate),
    container_title: str(body.containerTitle ?? body.journalOrVenue, 512),
    publisher: str(body.publisher, 255),
    volume: str(body.volume, 64),
    issue: str(body.issue, 64),
    pages: str(body.pages, 64),
    fields_json: fields,
    authors_json: authors.length ? JSON.stringify(authors) : null,
    target_author_index: target && target <= authors.length ? target : null,
    author_count: authors.length || null,
    byline: buildByline(authors, target),
    raw_record: raw,
  }
}

// external_record row -> the API record. Keeps today's ExternalArticle field names so
// useExternalArticles / DuplicatesBanner / allSources only swap URLs (plan "PM API"), and adds
// the lifecycle and 3b fields. `suppressed` is the projection's rule: anything not ACCEPTED.
const parseJson = (s: unknown): any => {
  if (s == null || s === '') return null
  if (typeof s !== 'string') return s
  try { return JSON.parse(s) } catch { return null }
}
const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const iso = (d: unknown): string | null => (d ? new Date(d as any).toISOString() : null)

export function apiRecordOf(row: any): Record<string, any> {
  const r = row && typeof row.get === 'function' ? row.get({ plain: true }) : row
  const authors = parseJson(r.authors_json)
  return {
    id: num(r.id),
    uid: r.uid,
    articleId: r.article_id,
    sourceType: r.source_type,
    status: r.status,
    prevStatus: r.prev_status ?? null,
    statusBy: r.status_by ?? null,
    statusImpersonatedBy: r.status_impersonated_by ?? null,
    statusAt: iso(r.status_at),
    suppressed: r.status !== 'ACCEPTED',
    supersededByPmid: num(r.superseded_by_pmid),
    mergedIntoId: num(r.merged_into_id),
    mergedIntoPmid: num(r.merged_into_pmid),
    addedBy: r.added_by ?? null,
    dateAdded: iso(r.added_at),
    provenance: r.provenance ?? null,
    // Plan 3f-3h (3g columns, added with the import's DDL): null until the row and model carry them.
    sourceDetail: r.source_detail ?? null,
    affiliationFlag: r.affiliation_flag ?? null,
    slotAffiliations: parseJson(r.slot_affiliations_json),
    method: r.method ?? null,
    pmid: num(r.pmid),
    doi: r.doi ?? null,
    isbn: r.isbn ?? null,
    scopusEid: r.scopus_eid ?? null,
    openalexId: r.openalex_id ?? null,
    orcidPutCode: r.orcid_put_code ?? null,
    url: r.url ?? null,
    title: r.title ?? null,
    journalOrVenue: r.container_title ?? null,
    publisher: r.publisher ?? null,
    volume: r.volume ?? null,
    issue: r.issue ?? null,
    pages: r.pages ?? null,
    pubDate: r.pub_date ?? null,
    datePrecision: r.date_precision ?? null,
    publicationType: r.source_pub_type ?? null,
    pubType: r.pub_type ?? null,
    typeNotice: r.type_notice ?? null,
    peerReviewed: r.peer_reviewed == null ? null : !!Number(r.peer_reviewed),
    role: r.role ?? null,
    fields: parseJson(r.fields_json),
    authors: Array.isArray(authors) ? authors.map(displayName) : [],
    authorsJson: Array.isArray(authors) ? authors : [],
    targetAuthorIndex: num(r.target_author_index),
    authorCount: num(r.author_count),
    byline: r.byline ?? null,
  }
}
