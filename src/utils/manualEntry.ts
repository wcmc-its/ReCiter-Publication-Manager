// Plan 3b-3e, 3d: the manual entry Dialog's form logic, free of React so tests/manualEntry.test.mjs
// can load it with `node --test` and the add route can reuse validateManualBody. Ported from the UI
// refresh prototype (app_logic.js: MAN_BASE, MAN_FIELDS, manFieldsFor, manMD, manNorm, manBuild,
// manSave's checks) with the plan's changes:
//   - the person's position is picked per name (radio), not required to be in the list; "Not
//     listed / not sure" saves NULL;
//   - a lookup runs against Crossref and OpenAlex for real (formFromCrossref / formFromOpenAlex);
//   - the record is the external_record add body (sourceType MANUAL), with kind, audience, living,
//     editors, place and the like in `fields` (fields_json, plan decision 11).

import {
  PUB_TYPE_GROUPS, PUB_ROLES, isPubType, mapSourceType, defaultPeerReviewed, canBePeerReviewed, defaultRole,
} from '../lib/pubTypes'
import { normalizeDoiInput, normalizeIsbnInput } from './externalAddSearch'

export { PUB_TYPE_GROUPS }

export interface ManualForm {
  type: string
  kind: string
  audience: string // "Students; Residents"
  role: string // '' = the type's default
  pr: string // '' = the type's default, else 'Peer-reviewed' | 'Not peer-reviewed'
  living: string // 'yes' | ''
  updated: string // YYYY-MM
  title: string
  authors: string // one per line or separated by semicolons
  target: number | null // 1-based position of the person in `authors`; null = not listed / not sure
  year: string
  month: string // MM or MM-DD
  journal: string
  volume: string
  issue: string
  pages: string
  doi: string
  isbn: string
  publisher: string
  place: string
  edition: string
  eds: string
  conf: string
  number: string
  url: string
  version: string
  degree: string
}

export const MAN_EMPTY: ManualForm = {
  type: 'Academic Article', kind: '', audience: '', role: '', pr: '', living: '', updated: '', title: '', authors: '', target: null,
  year: '', month: '', journal: '', volume: '', issue: '', pages: '', doi: '', isbn: '', publisher: '', place: '', edition: '',
  eds: '', conf: '', number: '', url: '', version: '', degree: '',
}

export type FieldKey = keyof ManualForm

// [key, label, required, wide, hint, options]
type FieldOpt = { chips?: string[]; multi?: boolean; check?: string; prField?: boolean }
type FieldDef = [FieldKey, string, boolean?, boolean?, string?, FieldOpt?]

const MAN_BASE: FieldDef[] = [
  ['title', 'Title', true, true],
  ['authors', 'Authors', true, true, 'One per line or separated by semicolons'],
  ['year', 'Year', true],
  ['month', 'Month/day (optional)', false, false, 'MM or MM-DD, e.g. 03 or 03-14'],
]

const KIND_NPRW = ['Op-ed or commentary', 'Magazine or newsletter article', 'Blog post', 'White paper or policy brief']
const KIND_EDU = ['Curriculum', 'Module', 'Teaching case', 'Video or podcast', 'Simulation']
const AUDIENCES = ['Students', 'Residents', 'Faculty', 'Public']

const MAN_FIELDS: Record<string, FieldDef[]> = {
  journal: [['journal', 'Journal', true, true], ['volume', 'Volume'], ['issue', 'Issue'], ['pages', 'Pages or article number'], ['doi', 'DOI']],
  'Conference Abstract': [['journal', 'Journal or abstract book', true, true], ['conf', 'Conference name, place and dates', false, true], ['pages', 'Pages'], ['doi', 'DOI']],
  Preprint: [['journal', 'Server (e.g. medRxiv, arXiv)', true], ['doi', 'DOI', true]],
  Book: [['publisher', 'Publisher', true], ['place', 'Place'], ['edition', 'Edition'], ['isbn', 'ISBN'], ['doi', 'DOI']],
  'Edited Book': [['publisher', 'Publisher', true], ['place', 'Place'], ['isbn', 'ISBN'], ['doi', 'DOI']],
  'Book Chapter': [['journal', 'Book title', true, true], ['eds', 'Book editors', false, true, 'Separated by semicolons'], ['publisher', 'Publisher', true], ['place', 'Place'], ['pages', 'Chapter pages'], ['isbn', 'ISBN'], ['doi', 'DOI']],
  'Conference Paper': [['journal', 'Proceedings title', true, true], ['conf', 'Conference name, place and dates', false, true], ['publisher', 'Publisher'], ['pages', 'Pages'], ['doi', 'DOI']],
  'Conference Proceedings': [['conf', 'Conference name, place and dates', true, true], ['publisher', 'Publisher', true], ['place', 'Place'], ['isbn', 'ISBN'], ['doi', 'DOI']],
  Report: [['publisher', 'Institution', true, true], ['place', 'Place'], ['number', 'Report number'], ['url', 'URL'], ['doi', 'DOI']],
  Dataset: [['journal', 'Repository (e.g. Zenodo)', true], ['version', 'Version'], ['doi', 'DOI'], ['url', 'URL']],
  Software: [['journal', 'Repository (e.g. GitHub, Zenodo)', true], ['version', 'Version'], ['doi', 'DOI'], ['url', 'URL']],
  Dissertation: [['publisher', 'Institution', true, true], ['degree', 'Degree (e.g. PhD)'], ['url', 'URL']],
  'Reference Entry': [['journal', 'Reference work (e.g. UpToDate, Stanford Encyclopedia of Philosophy)', true, true], ['publisher', 'Publisher'], ['url', 'URL'], ['living', '', false, true, '', { check: 'Updated continuously, like UpToDate or the Stanford Encyclopedia of Philosophy' }], ['doi', 'DOI']],
  'Non-Peer-Reviewed Writing': [['kind', 'Kind', true, true, '', { chips: KIND_NPRW }], ['journal', 'Outlet', true, true, 'e.g. STAT, The Conversation, a department newsletter'], ['url', 'URL'], ['doi', 'DOI']],
  'Educational Material': [['kind', 'Kind', true, true, '', { chips: KIND_EDU }], ['journal', 'Repository or publisher', true, true, 'e.g. MedEdPORTAL, an institutional site'], ['audience', 'Audience', false, true, '', { chips: AUDIENCES, multi: true }], ['doi', 'DOI'], ['url', 'URL']],
}

export interface FieldSpec {
  key: FieldKey | 'pr'
  label: string
  required: boolean
  wide: boolean
  hint: string
  chips?: string[]
  multi?: boolean
  check?: string
}

const EDITED = (t: string) => t === 'Edited Book' || t === 'Conference Proceedings'
const isLivingForm = (f: Partial<ManualForm>) => f.type === 'Reference Entry' && f.living === 'yes'

// The fields for a type, in order: title, authors (Editors for edited works), the person's role,
// year and month/day (first published, for a living entry), the type's own fields, then peer
// review (left out for Non-Peer-Reviewed Writing, which is never peer reviewed).
export function manFieldsFor(f: Partial<ManualForm> & { type: string }, who = ''): FieldSpec[] {
  const living = isLivingForm(f)
  const base: FieldDef[] = MAN_BASE.map((x): FieldDef => {
    if (x[0] === 'authors' && EDITED(f.type)) return ['authors', 'Editors', true, true, x[4]]
    if (x[0] === 'year' && living) return ['year', 'First published (year)', true]
    if (x[0] === 'month' && living) return ['month', 'First published month/day', false, false, x[4]]
    return x
  })
  base.splice(2, 0, ['role', who ? `${who}'s role` : 'Role', false, true, '', { chips: [...PUB_ROLES] }])
  const typed = (MAN_FIELDS[f.type] || MAN_FIELDS.journal).flatMap((x): FieldDef[] =>
    x[0] === 'living' && living ? [x, ['updated', 'Last updated', false, false, 'YYYY-MM']] : [x])
  const all: FieldDef[] = [...base, ...typed]
  const specs: FieldSpec[] = all.map(([key, label, req, wide, hint, opt]) => ({
    key, label, required: !!req, wide: !!wide, hint: hint || '', chips: opt?.chips, multi: opt?.multi, check: opt?.check,
  }))
  if (canBePeerReviewed(f.type)) specs.push({ key: 'pr', label: 'Peer review', required: false, wide: true, hint: '', chips: ['Peer-reviewed', 'Not peer-reviewed'] })
  return specs
}

export const splitNames = (v: unknown): string[] => String(v ?? '').split(/\n|;/).map((x) => x.trim()).filter(Boolean)

// '3', '03', '3-14', '03/14' -> {mo:'03', dy:'14'}; '' -> {}; anything else, or a day the month
// does not have, -> null.
export function parseMonthDay(v: unknown, year: unknown): { mo?: string; dy?: string } | null {
  const t = String(v ?? '').trim()
  if (!t) return {}
  const m = t.match(/^(\d{1,2})(?:[-/.](\d{1,2}))?$/)
  if (!m) return null
  const mo = +m[1]
  const dy = m[2] ? +m[2] : 0
  if (mo < 1 || mo > 12) return null
  if (m[2] && (dy < 1 || dy > new Date(+String(year ?? '') || 2001, mo, 0).getDate())) return null
  return { mo: String(mo).padStart(2, '0'), dy: dy ? String(dy).padStart(2, '0') : '' }
}

// The date the record stores: YYYY, YYYY-MM or YYYY-MM-DD, so date_precision follows what was
// entered (externalRecordShape.datePrecisionOf).
export function pubDateOf(f: Pick<ManualForm, 'year' | 'month'>): string {
  const y = f.year.trim()
  const md = parseMonthDay(f.month, y) || {}
  return [y, md.mo, md.dy].filter(Boolean).join('-')
}

// Surname of a display name, as externalRecordShape.splitName reads it: the last token, suffixes
// (Jr, III...) and punctuation dropped.
const SUFFIX = /^(jr|sr|ii|iii|iv)$/i
export const surnameOf = (name: unknown): string => {
  const toks = String(name ?? '').replace(/,/g, ' ').split(/\s+/).filter((t) => t && !SUFFIX.test(t.replace(/\./g, '')))
  return (toks[toks.length - 1] || '').replace(/[.]/g, '').toLowerCase()
}

// The person's position in an author list by surname: the first name whose surname is theirs, as
// ReCiterDB's byline_and_position finds it; null when no name matches.
export function targetBySurname(authors: string[], personSurname: string): number | null {
  const s = surnameOf(personSurname)
  if (!s) return null
  const i = authors.findIndex((a) => surnameOf(a) === s)
  return i < 0 ? null : i + 1
}

const ROLE_SET = new Set<string>(PUB_ROLES)
export const effectiveRole = (f: Pick<ManualForm, 'type' | 'role'>): string => (ROLE_SET.has(f.role) ? f.role : defaultRole(f.type))
export const prDefaultOf = (f: Pick<ManualForm, 'type' | 'journal'>): boolean => defaultPeerReviewed(f.type, { repository: f.journal })
export const effectivePr = (f: Pick<ManualForm, 'type' | 'journal' | 'pr'>): boolean =>
  !canBePeerReviewed(f.type) ? false : f.pr ? f.pr === 'Peer-reviewed' : prDefaultOf(f)

export type FormErrors = Partial<Record<FieldKey, string>>

const YEAR = /^(19|20)\d{2}$/
const YEAR_MONTH = /^(19|20)\d{2}-(0?[1-9]|1[0-2])$/

// Errors by field (empty when the form can be saved): the type's required fields, a four-digit
// year, a month/day the year has, the DOI's 10.x/y shape, a checked ISBN, and YYYY-MM for a living
// entry's last update.
export function validateForm(f: ManualForm): FormErrors {
  const err: FormErrors = {}
  if (!isPubType(f.type)) err.type = 'Pick a type'
  for (const s of manFieldsFor(f)) {
    if (s.key === 'pr' || !s.required) continue
    if (!String(f[s.key] ?? '').trim()) err[s.key] = s.chips ? 'Pick one' : 'Required'
  }
  if (f.year.trim() && !YEAR.test(f.year.trim())) err.year = 'Four-digit year'
  if (parseMonthDay(f.month, f.year.trim()) === null) err.month = 'Use MM or MM-DD, e.g. 03 or 03-14'
  if (f.doi.trim() && !normalizeDoiInput(f.doi)) err.doi = 'A DOI looks like 10.xxxx/…'
  if (f.isbn.trim() && !normalizeIsbnInput(f.isbn)) err.isbn = 'Not a valid ISBN-10 or ISBN-13'
  if (isLivingForm(f) && f.updated.trim() && !YEAR_MONTH.test(f.updated.trim())) err.updated = 'Use YYYY-MM'
  return err
}

// Only the fields the type shows are saved, so switching type does not carry hidden values.
function shown(f: ManualForm): Set<string> {
  return new Set(manFieldsFor(f).map((s) => s.key))
}

// The form as the record body: the external_record add body for a new record (POST
// /api/db/external/<uid>, sourceType MANUAL; the server mints MANUAL:<uuid>), and the edit patch
// (PATCH /api/db/external/record/<id>) for an existing one. Role and peer review are NULL when
// they are the type's default (plan: NULL = defaultRole / defaultPeerReviewed).
export function recordBodyOf(f: ManualForm, opts: { detailsFrom?: string | null } = {}) {
  const on = shown(f)
  const val = (k: FieldKey) => (on.has(k) ? String(f[k] ?? '').trim() : '')
  const authors = splitNames(f.authors)
  const target = f.target && f.target >= 1 && f.target <= authors.length ? f.target : null
  const role = effectiveRole(f)
  const prDef = prDefaultOf(f)
  const pr = !canBePeerReviewed(f.type) || !f.pr ? null : f.pr === 'Peer-reviewed'
  const doi = normalizeDoiInput(val('doi')) || null
  const journal = val('journal')
  const publisher = val('publisher')
  const conf = val('conf')
  // A book, report or thesis has no container; its publisher (or the conference, for proceedings)
  // stands in, as the prototype's manBuild did, so Reports always have a venue.
  const venue = journal || (['Book', 'Edited Book', 'Report', 'Dissertation'].includes(f.type) ? publisher : f.type === 'Conference Proceedings' ? conf : '')
  const fields: Record<string, any> = {}
  const eds = on.has('eds') ? splitNames(f.eds) : []
  if (eds.length) fields.editors = eds
  if (val('place')) fields.place = val('place')
  if (val('edition')) fields.edition = val('edition')
  if (conf) fields.conference = conf
  if (val('number')) fields.reportNumber = val('number')
  if (val('version')) fields.version = val('version')
  if (val('degree')) fields.degree = val('degree')
  if (val('kind')) fields.kind = val('kind')
  if (val('audience')) fields.audience = val('audience')
  if (isLivingForm(f)) {
    fields.living = true
    if (f.updated.trim()) fields.updated = f.updated.trim()
  }
  if (opts.detailsFrom) fields.detailsFrom = opts.detailsFrom
  return {
    title: f.title.trim(),
    authors,
    targetAuthorIndex: target,
    pubDate: pubDateOf(f),
    pubType: f.type,
    role: role === defaultRole(f.type) ? null : role,
    peerReviewed: pr === null || pr === prDef ? null : pr,
    journalOrVenue: venue || null,
    publisher: publisher || null,
    volume: val('volume') || null,
    issue: val('issue') || null,
    pages: val('pages') || null,
    doi,
    isbn: val('isbn') || null,
    url: val('url') || null,
    fields,
  }
}

export const newManualBody = (f: ManualForm, opts: { detailsFrom?: string | null } = {}) =>
  ({ sourceType: 'MANUAL', method: 'manual-entry', ...recordBodyOf(f, opts) })

// The body PATCH takes: every editable field (the server keeps only what changed).
export const editPatchOf = (f: ManualForm, rec: any) =>
  recordBodyOf(f, { detailsFrom: rec?.fields?.detailsFrom || null })

// An API record (src/lib/externalRecordShape apiRecordOf) back into the form, for Edit.
export function formFromRecord(rec: any): ManualForm {
  const fields = rec?.fields && typeof rec.fields === 'object' ? rec.fields : {}
  const type = isPubType(rec?.pubType) ? rec.pubType : 'Academic Article'
  const date = String(rec?.pubDate || '')
  const m = date.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/)
  const authors: string[] = Array.isArray(rec?.authors) ? rec.authors.map(String) : []
  const f: ManualForm = {
    ...MAN_EMPTY,
    type,
    title: rec?.title || '',
    authors: authors.join('; '),
    target: rec?.targetAuthorIndex ?? null,
    year: m ? m[1] : '',
    month: m && m[2] ? m[2] + (m[3] ? '-' + m[3] : '') : '',
    journal: rec?.journalOrVenue || '',
    volume: rec?.volume || '',
    issue: rec?.issue || '',
    pages: rec?.pages || '',
    doi: rec?.doi || '',
    isbn: rec?.isbn || '',
    publisher: rec?.publisher || '',
    url: rec?.url || '',
    place: fields.place || '',
    edition: fields.edition || '',
    eds: Array.isArray(fields.editors) ? fields.editors.join('; ') : '',
    conf: fields.conference || '',
    number: fields.reportNumber || '',
    version: fields.version || '',
    degree: fields.degree || '',
    kind: fields.kind || '',
    audience: fields.audience || '',
    living: fields.living ? 'yes' : '',
    updated: fields.updated || '',
    role: rec?.role && rec.role !== defaultRole(type) ? rec.role : '',
    pr: '',
  }
  if (typeof rec?.peerReviewed === 'boolean' && canBePeerReviewed(type) && rec.peerReviewed !== prDefaultOf(f)) {
    f.pr = rec.peerReviewed ? 'Peer-reviewed' : 'Not peer-reviewed'
  }
  return f
}

// What the "DOI, PMID or ISBN" box holds.
export type LookupKind = 'doi' | 'pmid' | 'isbn' | ''
export function lookupKindOf(q: unknown): { kind: LookupKind; value: string } {
  const t = String(q ?? '').trim()
  const pmid = t.match(/^(?:pmid\s*:?\s*)?([1-9]\d{0,8})$/i)
  if (pmid) return { kind: 'pmid', value: pmid[1] }
  const doi = normalizeDoiInput(t)
  if (doi) return { kind: 'doi', value: doi }
  const isbn = normalizeIsbnInput(t)
  if (isbn) return { kind: 'isbn', value: isbn }
  return { kind: '', value: t }
}

const parseRaw = (raw: unknown): any => {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(String(raw)) } catch { return {} }
}
// Crossref titles carry HTML entities and tags ("Knowledge Discovery &amp; Data Mining").
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export const plainText = (v: unknown): string => String(v ?? '')
  .replace(/<[^>]+>/g, '')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m }
    return ENTITIES[e.toLowerCase()] ?? m
  })
  .replace(/\s+/g, ' ')
  .trim()
const first = (v: unknown): string => plainText(Array.isArray(v) ? v[0] : v)
const personName = (p: any): string => (p ? (p.name || [p.given, p.family].filter(Boolean).join(' ')) : '')
const dateParts = (d: unknown): Pick<ManualForm, 'year' | 'month'> => {
  const m = String(d ?? '').match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/)
  if (!m) return { year: '', month: '' }
  const mo = m[2] ? m[2].padStart(2, '0') : ''
  return { year: m[1], month: mo ? mo + (m[3] ? '-' + m[3].padStart(2, '0') : '') : '' }
}

export interface Prefill { form: ManualForm; note?: string }

const BOOKISH = new Set(['book', 'edited-book', 'monograph', 'reference-book', 'book-set'])

// A Crossref result (src/utils/externalAddSearch crossrefExternalArticleFrom: title, authors,
// journalOrVenue, pubDate, publicationType, rawRecord) as a filled-in form. An ISBN lookup finds
// the book: unless the person wrote or edited the whole book, the form becomes their chapter in it
// (the prototype's "Found the book" case) with the book as the container.
export function formFromCrossref(row: any, opts: { isbn?: boolean; personSurname?: string } = {}): Prefill {
  const w = parseRaw(row?.rawRecord)
  const crType = String(row?.publicationType || w.type || '')
  const mapped = mapSourceType('Crossref', crType).type
  const authors: string[] = Array.isArray(row?.authors) && row.authors.length ? row.authors.map(String) : (w.author || []).map(personName).filter(Boolean)
  const editors: string[] = (w.editor || []).map(personName).filter(Boolean)
  const isbns: string[] = Array.isArray(w.ISBN) ? w.ISBN : []
  const base: ManualForm = {
    ...MAN_EMPTY,
    ...dateParts(row?.pubDate),
    doi: row?.doi || w.DOI || '',
    publisher: first(w.publisher),
    place: first(w['publisher-location']),
    volume: first(w.volume),
    issue: first(w.issue),
    pages: first(w.page),
    isbn: isbns[0] || '',
    url: '',
  }
  const book = BOOKISH.has(crType)
  if (book) {
    const names = authors.length ? authors : editors
    const mine = opts.personSurname ? targetBySurname(names, opts.personSurname) : null
    if (opts.isbn && !mine) {
      // Their chapter in this book: the book is the container; title, authors and pages are theirs.
      return {
        form: { ...base, type: 'Book Chapter', journal: plainText(row?.title) || first(w.title), eds: (editors.length ? editors : []).join('; '), doi: '', pages: '' },
        note: "Found the book in Crossref. Add your chapter's title, authors and pages.",
      }
    }
    const edited = !authors.length && editors.length > 0
    return {
      form: { ...base, type: edited ? 'Edited Book' : 'Book', title: plainText(row?.title) || first(w.title), authors: names.join('; '), target: mine },
    }
  }
  return {
    form: {
      ...base,
      type: mapped || 'Academic Article',
      title: plainText(row?.title) || first(w.title),
      authors: authors.join('; '),
      journal: plainText(row?.journalOrVenue) || first(w['container-title']),
      eds: editors.join('; '),
      target: opts.personSurname ? targetBySurname(authors, opts.personSurname) : null,
    },
  }
}

// An OpenAlex result (controllers/openalex.controller normalizeWork) as a filled-in form.
export function formFromOpenAlex(row: any, opts: { personSurname?: string } = {}): Prefill {
  const w = parseRaw(row?.rawRecord)
  const b = w.biblio || {}
  const authors: string[] = Array.isArray(row?.authors) ? row.authors.map(String) : []
  const pages = b.first_page ? (b.last_page && b.last_page !== b.first_page ? `${b.first_page}-${b.last_page}` : String(b.first_page)) : ''
  return {
    form: {
      ...MAN_EMPTY,
      ...dateParts(row?.pubDate),
      type: mapSourceType('OpenAlex', row?.publicationType || w.type).type || 'Academic Article',
      title: plainText(row?.title),
      authors: authors.join('; '),
      target: opts.personSurname ? targetBySurname(authors, opts.personSurname) : null,
      journal: plainText(row?.journalOrVenue),
      volume: b.volume ? String(b.volume) : '',
      issue: b.issue ? String(b.issue) : '',
      pages,
      doi: row?.doi || '',
      publisher: first(w.primary_location?.source?.host_organization_name),
    },
  }
}

// Server-side check of a manual add body (the route refuses what the Dialog would not send):
// a known type, a title and a four-digit year; a DOI of the 10.x/y shape; a checked ISBN.
// `create`: a new manual record carries no PMID (the Dialog sends a PMID to the PubMed add flow).
// An edit may set one later, which the supersede reconcile then matches.
export function validateManualBody(body: any, opts: { create?: boolean } = {}): string | null {
  if (!body || typeof body !== 'object') return 'A record body is required'
  if (!isPubType(body.pubType)) return 'A manual record needs a publication type'
  if (!String(body.title ?? '').trim()) return 'A manual record needs a title'
  // A real month and day too: '2024-13' would otherwise save as month precision and show "2024 undefined".
  const d = String(body.pubDate ?? '').trim().match(/^((?:19|20)\d{2})(?:-(\d{2})(?:-(\d{2}))?)?$/)
  if (!d || (d[2] && parseMonthDay(d[3] ? `${d[2]}-${d[3]}` : d[2], d[1]) === null)) return 'A manual record needs a year (YYYY, YYYY-MM or YYYY-MM-DD)'
  // Non-Peer-Reviewed Writing is never peer reviewed (the Dialog has no choice for it).
  if (body.peerReviewed === true && !canBePeerReviewed(body.pubType)) return `${body.pubType} cannot be marked peer-reviewed`
  if (body.doi != null && String(body.doi).trim() && !normalizeDoiInput(String(body.doi))) return 'The DOI must look like 10.xxxx/…'
  if (body.isbn != null && String(body.isbn).trim() && !normalizeIsbnInput(String(body.isbn))) return 'The ISBN is not a valid ISBN-10 or ISBN-13'
  if (body.role != null && !ROLE_SET.has(body.role)) return `Unknown role ${body.role}`
  if (opts.create && body.pmid != null && String(body.pmid).trim()) return 'A work with a PMID is added through PubMed, not by hand'
  return null
}

// "Added manually by X · date" and its tooltip, for an accepted manual row in All sources.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmtDay = (iso: unknown): string => {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${MON[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ''
}
export function manualProvenance(rec: any): { text: string; tip: string } {
  const on = fmtDay(rec?.dateAdded)
  const from = rec?.fields?.detailsFrom
  return {
    text: `Added manually by ${rec?.addedBy || 'a curator'}${on ? ' · ' + on : ''}`,
    tip: `Entered in Publication Manager${from ? ', with details from ' + from : ''}. A later import with the same DOI merges into this record.`,
  }
}

// The record's date as entered: "2025", "2025 Mar" or "Mar 10, 2025".
export function manualDateText(pubDate: unknown): string {
  const m = String(pubDate ?? '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/)
  if (!m) return String(pubDate ?? '')
  if (m[3]) return `${MON[+m[2] - 1]} ${+m[3]}, ${m[1]}`
  if (m[2]) return `${m[1]} ${MON[+m[2] - 1]}`
  return m[1]
}

// The venue-line input (pubTypes.venueOf) for a stored manual record.
export function venueInputOf(rec: any) {
  const f = rec?.fields && typeof rec.fields === 'object' ? rec.fields : {}
  return {
    type: rec?.pubType || '',
    journal: rec?.journalOrVenue || '',
    publisher: rec?.publisher || '',
    place: f.place || '',
    eds: Array.isArray(f.editors) ? f.editors : [],
    pages: rec?.pages || '',
    volume: rec?.volume || '',
    issue: rec?.issue || '',
    conf: f.conference || '',
    kind: f.kind || '',
    audience: f.audience || '',
    role: rec?.role || '',
    living: !!f.living,
    updated: f.updated || '',
    degree: f.degree || '',
  }
}
