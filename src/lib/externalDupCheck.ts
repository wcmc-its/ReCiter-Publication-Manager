// Duplicate check for adding an external or manual record (plan 3b-3e "Duplicate check in PM").
// Replaces ReCiter's ExternalArticleDupCheck for adds once EXTERNAL_STORE=mysql, and answers with
// the same 409 body ({status: 'BLOCKED'|'WARNING', message, matches: [{type, matchedId, detail,
// title, journal, pubYear}]}), so authorships.controller's dupConflict and the Add publication
// card keep working unchanged.
//
//   BLOCKED  the PMID is in the GoldStandard known or rejected list; the PMID or DOI is in the
//            person's person_article candidates; or the work matches one of the person's
//            external_record rows by article_id, PMID, DOI or source id while that row is live
//            (PENDING, ACCEPTED, SUPERSEDED) or merged. No override.
//   WARNING  title + year at >= 85% word overlap (pubTypes isPossibleDuplicate) against a
//            candidate or a live external record, or a hit in rejection memory ("Removed by X on
//            DATE"). Overridable with force; Add anyway then clears that memory.
//
// Where this differs from the Java check (deliberately, per the plan): the title test is the 85%
// overlap with both years required, not an exact normalized-title match that also fires when a
// year is missing; source ids are compared; rejected/removed rows are not "already added" but
// rejection memory; candidate DOIs come from person_article as of the last nightly, not the live
// Analysis.
//
// Pure: the store (src/lib/externalStore.ts loadDupContext) gathers the inputs.

import { isPossibleDuplicate } from './pubTypes'
import { normDoi, yearOf, sourceIdsOf, rejectionKeysOf, REJECTION_KEY_TYPES, type RejectionKey, type RejectionKeyType } from './externalRecordShape'
import { LIVE_STATUSES } from './externalLifecycle'

export type DupLevel = 'OK' | 'WARNING' | 'BLOCKED'

// Java's MatchType values, plus REJECTION_MEMORY (new: PM keeps rejection memory, Java never did).
export type DupMatchType =
  | 'ALREADY_ADDED'
  | 'PMID_MATCH_EXTERNAL'
  | 'DOI_MATCH_EXTERNAL'
  | 'TITLE_YEAR_MATCH_EXTERNAL'
  | 'PMID_IN_GOLD_STANDARD'
  | 'PMID_REJECTED_IN_GOLD_STANDARD'
  | 'PMID_IN_CANDIDATES'
  | 'DOI_MATCH'
  | 'TITLE_YEAR_MATCH'
  | 'REJECTION_MEMORY'

export interface DupMatch {
  type: DupMatchType
  matchedId: string // an external article_id for *_EXTERNAL / ALREADY_ADDED / REJECTION_MEMORY, else a PMID
  detail: string
  title: string | null
  journal: string | null
  pubYear: string | null
  recordId?: number | null // external_record.id of the matched row, when there is one
  rejectedBy?: string | null // REJECTION_MEMORY only
  rejectedAt?: string | null
  reason?: 'REJECTED' | 'REMOVED' // REJECTION_MEMORY only
}

export interface DupResult { level: DupLevel; matches: DupMatch[] }

// The work being added, in external_record column names (recordFromInput output).
export interface DupCandidate {
  article_id: string
  pmid?: number | null
  doi?: string | null
  title?: string | null
  pub_date?: string | null
  scopus_eid?: string | null
  openalex_id?: string | null
  orcid_put_code?: string | null
  title_year_key?: string | null
}

export interface ExistingRecord extends DupCandidate {
  id: number
  source_type: string
  status: string
  container_title?: string | null
  merged_into_id?: number | null
  merged_into_pmid?: number | null
}

// A person_article row (PubMed candidate, any assertion).
export interface CandidateArticle {
  pmid: number
  doi?: string | null
  articleTitle?: string | null
  journalTitleVerbose?: string | null
  publicationDateStandardized?: string | null
  articleYear?: number | string | null
}

export interface RejectionRow {
  key_type: RejectionKeyType
  key_value: string
  record_id?: number | null
  reason: 'REJECTED' | 'REMOVED'
  rejected_by?: string | null
  rejected_at?: Date | string | null
}

export interface DupContext {
  knownPmids?: Iterable<number> | null
  rejectedPmids?: Iterable<number> | null
  candidates?: CandidateArticle[] | null
  existing?: ExistingRecord[] | null
  rejections?: RejectionRow[] | null
}

const MERGED = ['MERGED', 'AUTOMERGED']
const SOURCE_NAME: Record<string, string> = { SCOPUS: 'Scopus', OPENALEX: 'OpenAlex', CROSSREF: 'Crossref', WOS: 'Web of Science', MANUAL: 'manual entry', ORCID: 'ORCID' }
const sourceName = (s: string) => SOURCE_NAME[String(s).toUpperCase()] || s
const isoDay = (d: unknown): string | null => {
  if (!d) return null
  const t = new Date(d as any)
  return Number.isNaN(t.getTime()) ? String(d) : t.toISOString().slice(0, 10)
}

// Rejection memory, plan decision 7: per remembered record, compare on the highest-precedence key
// type both it and the candidate carry (DOI, then ORCID put-code, then source id, then title+year).
// Different DOIs mean different works even when the titles match. Rows without a record_id stand
// alone. Returns the remembered rows that match, one per remembered record.
export function matchRejectionMemory(candidateKeys: RejectionKey[], rows: RejectionRow[]): RejectionRow[] {
  const groups = new Map<string, RejectionRow[]>()
  rows.forEach((r, i) => {
    const g = r.record_id != null ? `r${r.record_id}` : `x${i}`
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(r)
  })
  const hits: RejectionRow[] = []
  for (const group of groups.values()) {
    for (const type of REJECTION_KEY_TYPES) {
      const mine = candidateKeys.filter((k) => k.key_type === type).map((k) => k.key_value)
      const theirs = group.filter((r) => r.key_type === type)
      if (!mine.length || !theirs.length) continue
      const hit = theirs.find((r) => mine.includes(r.key_value))
      if (hit) hits.push(hit)
      break // the highest shared key type decides, match or not
    }
  }
  return hits
}

export function checkExternalDup(c: DupCandidate, ctx: DupContext): DupResult {
  const blocked: DupMatch[] = []
  const warnings: DupMatch[] = []
  const doi = normDoi(c.doi)
  const pmid = c.pmid ?? null
  const myIds = sourceIdsOf(c)
  const me = { pmid, doi, title: c.title, date: c.pub_date }

  for (const e of ctx.existing || []) {
    const live = (LIVE_STATUSES as readonly string[]).includes(e.status)
    const merged = MERGED.includes(e.status)
    const base = { title: e.title ?? null, journal: e.container_title ?? null, pubYear: yearOf(e.pub_date), recordId: e.id }
    const from = sourceName(e.source_type)
    if (e.article_id === c.article_id) {
      // Rejected/removed: rejection memory speaks for it (below); the store revives the row.
      if (live || merged) {
        blocked.push({
          type: 'ALREADY_ADDED', matchedId: e.article_id, ...base,
          detail: merged ? `This external article was already added for this person and merged into another record.`
            : 'This external article was already added for this person.',
        })
      }
      continue
    }
    if (!live && !merged) continue
    if (pmid && Number(e.pmid) === pmid) {
      blocked.push({ type: 'PMID_MATCH_EXTERNAL', matchedId: e.article_id, ...base, detail: `An external article with the same PMID was already added from ${from}.` })
    } else if (doi && doi === normDoi(e.doi)) {
      blocked.push({ type: 'DOI_MATCH_EXTERNAL', matchedId: e.article_id, ...base, detail: `An external article with the same DOI was already added from ${from}.` })
    } else if (myIds.length && sourceIdsOf(e).some((s) => myIds.includes(s))) {
      blocked.push({ type: 'ALREADY_ADDED', matchedId: e.article_id, ...base, detail: `This work was already added from ${from} (same source id).` })
    } else if (live && isPossibleDuplicate(me, { title: e.title, date: e.pub_date })) {
      warnings.push({
        type: 'TITLE_YEAR_MATCH_EXTERNAL', matchedId: e.article_id, ...base,
        detail: `An external article with a matching title and year was already added: ${e.title}`,
      })
    }
  }

  const known = new Set([...(ctx.knownPmids || [])].map(Number))
  const rejected = new Set([...(ctx.rejectedPmids || [])].map(Number))
  if (pmid && known.has(pmid)) {
    blocked.push({ type: 'PMID_IN_GOLD_STANDARD', matchedId: String(pmid), title: null, journal: null, pubYear: null, detail: "This PMID is already accepted in the person's gold standard." })
  }
  if (pmid && rejected.has(pmid)) {
    blocked.push({
      type: 'PMID_REJECTED_IN_GOLD_STANDARD', matchedId: String(pmid), title: null, journal: null, pubYear: null,
      detail: 'This PMID was explicitly rejected by a curator; do not re-add it from an external source.',
    })
  }

  for (const a of ctx.candidates || []) {
    const year = yearOf(a.publicationDateStandardized) || (a.articleYear ? String(a.articleYear) : null)
    const base = { matchedId: String(a.pmid), title: a.articleTitle ?? null, journal: a.journalTitleVerbose ?? null, pubYear: year }
    if (pmid && Number(a.pmid) === pmid) {
      blocked.push({ type: 'PMID_IN_CANDIDATES', ...base, detail: "This PMID exists in the person's PubMed candidate set; adjudicate it via normal feedback instead." })
    } else if (doi && doi === normDoi(a.doi)) {
      blocked.push({ type: 'DOI_MATCH', ...base, detail: `A PubMed article with the same DOI exists in the person's candidate set (PMID ${a.pmid}).` })
    } else if (isPossibleDuplicate(me, { title: a.articleTitle, year })) {
      warnings.push({ type: 'TITLE_YEAR_MATCH', ...base, detail: `A PubMed article with a matching title and year exists (PMID ${a.pmid}): ${a.articleTitle}` })
    }
  }

  const byId = new Map((ctx.existing || []).map((e) => [Number(e.id), e]))
  for (const hit of matchRejectionMemory(rejectionKeysOf(c), ctx.rejections || [])) {
    const rec = hit.record_id != null ? byId.get(Number(hit.record_id)) : undefined
    const verb = hit.reason === 'REMOVED' ? 'Removed' : 'Rejected'
    const by = hit.rejected_by ? ` by ${hit.rejected_by}` : ''
    const on = isoDay(hit.rejected_at)
    warnings.push({
      type: 'REJECTION_MEMORY', matchedId: rec?.article_id ?? `${hit.key_type}:${hit.key_value}`,
      title: rec?.title ?? null, journal: rec?.container_title ?? null, pubYear: rec ? yearOf(rec.pub_date) : null,
      recordId: hit.record_id ?? null, rejectedBy: hit.rejected_by ?? null, rejectedAt: on, reason: hit.reason,
      detail: `${verb}${by}${on ? ' on ' + on : ''}. Add anyway to restore it.`,
    })
  }

  if (blocked.length) return { level: 'BLOCKED', matches: [...blocked, ...warnings] }
  if (warnings.length) return { level: 'WARNING', matches: warnings }
  return { level: 'OK', matches: [] }
}

// The 409 body, word for word as ExternalArticleController.conflictBody.
export function conflictBody(r: DupResult): { status: 'BLOCKED' | 'WARNING'; message: string; matches: DupMatch[] } | null {
  if (r.level === 'BLOCKED') return { status: 'BLOCKED', message: "This article already exists in the person's record.", matches: r.matches }
  if (r.level === 'WARNING') return { status: 'WARNING', message: 'Possible duplicate. Retry with force=true to add anyway.', matches: r.matches }
  return null
}

// external_dup_verdict pair keys, ordered in BINARY (code-point) order to satisfy the table's
// CHECK: a collation-aware or localeCompare sort puts '_' before digits and is refused.
export const pmidKey = (pmid: number | string) => `PMID:${pmid}`
export const extKey = (articleId: string) => `EXT:${articleId}`
export function orderedPair(a: string, b: string): [string, string] {
  if (a === b) throw new Error('A verdict needs two different records')
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) < 0 ? [a, b] : [b, a]
}
