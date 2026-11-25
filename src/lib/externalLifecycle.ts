// Lifecycle of an external or manual record (reciterdb `external_record.status`), plan 3b-3e
// "Lifecycle". One allowed-transition map; the store (src/lib/externalStore.ts) applies only what
// planTransition / planUndo / planReAdd return, and every write API answers anything else with 409.
// Only ACCEPTED reaches Reports.
//
// Dependency-free, so `node --test` (tests/externalLifecycle.test.mjs), the check scripts and the
// client can all import it.

export const EXTERNAL_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'REMOVED', 'MERGED', 'AUTOMERGED', 'SUPERSEDED'] as const
export type ExternalStatus = (typeof EXTERNAL_STATUSES)[number]

export const isExternalStatus = (s: unknown): s is ExternalStatus => EXTERNAL_STATUSES.includes(s as ExternalStatus)

// Who drives a step. `curator` = a person in PM (Curate or Authorships); `system` = PM's supersede
// reconcile on a gold-standard write; `import` = the nightly harvest (3g).
export type LifecycleActor = 'curator' | 'system' | 'import'

// status_by / event actor recorded for system steps. The curator's cwid is recorded otherwise.
export const SYSTEM_ACTOR = 'system'

// Statuses that reach Reports (6b) and that the projection's `suppressed = 0` stands for.
export const REPORTABLE_STATUSES: readonly ExternalStatus[] = ['ACCEPTED']
export const isReportable = (s: string | null | undefined): boolean => s === 'ACCEPTED'

// A record in one of these is still "in the person's record" for the duplicate check: adding the
// same work again is BLOCKED (plan "Duplicate check in PM").
export const LIVE_STATUSES: readonly ExternalStatus[] = ['PENDING', 'ACCEPTED', 'SUPERSEDED']

// Statuses that leave rejection memory behind (an import or add of the same work is skipped/warned).
export const MEMORY_STATUSES: readonly ExternalStatus[] = ['REJECTED', 'REMOVED']

// What a step needs from the caller besides the target status.
//   mergeTarget     merged_into_id or merged_into_pmid (MERGED / AUTOMERGED)
//   supersedingPmid the accepted PubMed twin (SUPERSEDED)
type Needs = 'mergeTarget' | 'supersedingPmid'

export interface TransitionRule {
  from: ExternalStatus | null // null = the record does not exist yet
  to: ExternalStatus
  actors: readonly LifecycleActor[]
  memory: 'write' | 'none' // 'write' = rejection memory for every key the record carries
  needs?: Needs
  label: string
}

// The plan's lifecycle table, row for row. Undo and the re-add of a rejected/removed record are
// not rows here: they have their own planners below.
export const TRANSITIONS: readonly TransitionRule[] = [
  { from: null, to: 'PENDING', actors: ['import'], memory: 'none', label: 'import (3g)' },
  // 3f-3h plan step 7: an import matching an existing record is written as an AUTOMERGED child.
  { from: null, to: 'AUTOMERGED', actors: ['import'], memory: 'none', needs: 'mergeTarget', label: 'import auto-merge (3g)' },
  { from: null, to: 'ACCEPTED', actors: ['curator'], memory: 'none', label: 'Add publication / manual entry / Authorships accept' },
  { from: 'PENDING', to: 'ACCEPTED', actors: ['curator'], memory: 'none', label: 'Accept' },
  { from: 'PENDING', to: 'REJECTED', actors: ['curator'], memory: 'write', label: 'Reject' },
  { from: 'PENDING', to: 'MERGED', actors: ['curator'], memory: 'none', needs: 'mergeTarget', label: 'Same work' },
  { from: 'ACCEPTED', to: 'REMOVED', actors: ['curator'], memory: 'write', label: 'Remove' },
  { from: 'ACCEPTED', to: 'MERGED', actors: ['curator'], memory: 'none', needs: 'mergeTarget', label: 'Keep the other record' },
  { from: 'ACCEPTED', to: 'SUPERSEDED', actors: ['system'], memory: 'none', needs: 'supersedingPmid', label: 'PubMed twin accepted' },
  { from: 'SUPERSEDED', to: 'ACCEPTED', actors: ['system'], memory: 'none', label: 'PubMed twin no longer accepted' },
  { from: 'AUTOMERGED', to: 'PENDING', actors: ['curator'], memory: 'none', label: 'Not the same (3g)' },
]

export const findRule = (from: ExternalStatus | null, to: ExternalStatus): TransitionRule | undefined =>
  TRANSITIONS.find((r) => r.from === from && r.to === to)

export interface LifecycleRecord {
  status: ExternalStatus
  prev_status?: ExternalStatus | null
  status_by?: string | null
}

export interface TransitionOptions {
  actor: LifecycleActor
  mergedIntoId?: number | null
  mergedIntoPmid?: number | null
  supersededByPmid?: number | null
  // Authorships reopen (the undo of an accept): ACCEPTED -> REMOVED without rejection memory, so
  // the work can come back (plan decision 8). Only valid on that one step.
  withoutMemory?: boolean
}

// Column values a step sets on external_record, besides status_by/status_at (the store stamps those).
export interface StatusPatch {
  status: ExternalStatus
  prev_status: ExternalStatus | null
  merged_into_id?: number | null
  merged_into_pmid?: number | null
  superseded_by_pmid?: number | null
}

export type EventAction = 'ADD' | 'IMPORT' | 'TRANSITION' | 'MERGE' | 'UNMERGE'

export type LifecyclePlan =
  | {
      ok: true
      patch: StatusPatch
      // write: rejection memory for every key (reason = the new status); clear: delete the
      // record's memory rows; none: leave memory alone.
      memory: 'write' | 'clear' | 'none'
      action: EventAction
      error?: undefined
    }
  | { ok: false; error: string; patch?: undefined; memory?: undefined; action?: undefined }

const fail = (error: string): LifecyclePlan => ({ ok: false, error })

const validMergeTarget = (o: TransitionOptions): boolean => {
  const id = o.mergedIntoId != null, pmid = o.mergedIntoPmid != null
  return id !== pmid // exactly one
}

const isPositiveInt = (n: unknown): boolean => Number.isInteger(n) && (n as number) > 0

// Plan one step. `rec` is null for a record that does not exist yet (a create).
export function planTransition(rec: LifecycleRecord | null, to: ExternalStatus, opts: TransitionOptions): LifecyclePlan {
  if (!isExternalStatus(to)) return fail(`Unknown status ${to}`)
  const from = rec ? rec.status : null
  if (rec && !isExternalStatus(rec.status)) return fail(`Record has an unknown status ${rec.status}`)
  if (from === to) return fail(`The record is already ${to}`)
  const rule = findRule(from, to)
  if (!rule) return fail(`${from ?? 'A new record'} cannot become ${to}`)
  if (!rule.actors.includes(opts.actor)) return fail(`${from ?? 'new'} -> ${to} is a ${rule.actors.join('/')} step, not ${opts.actor}`)

  if (opts.withoutMemory && !(from === 'ACCEPTED' && to === 'REMOVED')) {
    return fail('Only ACCEPTED -> REMOVED (Authorships reopen) can skip rejection memory')
  }

  const patch: StatusPatch = { status: to, prev_status: from }
  if (rule.needs === 'mergeTarget') {
    if (!validMergeTarget(opts)) return fail(`${to} needs exactly one of mergedIntoId or mergedIntoPmid`)
    if (opts.mergedIntoId != null && !isPositiveInt(opts.mergedIntoId)) return fail('mergedIntoId must be a record id')
    if (opts.mergedIntoPmid != null && !isPositiveInt(opts.mergedIntoPmid)) return fail('mergedIntoPmid must be a PMID')
    patch.merged_into_id = opts.mergedIntoId ?? null
    patch.merged_into_pmid = opts.mergedIntoPmid ?? null
  }
  if (rule.needs === 'supersedingPmid') {
    if (!isPositiveInt(opts.supersededByPmid)) return fail('SUPERSEDED needs the PubMed twin (supersededByPmid)')
    patch.superseded_by_pmid = opts.supersededByPmid as number
  }
  // Leaving SUPERSEDED drops the twin, as Java's reconcile un-suppress does.
  if (from === 'SUPERSEDED') patch.superseded_by_pmid = null
  // Leaving AUTOMERGED ("Not the same") detaches the child from its parent.
  if (from === 'AUTOMERGED') { patch.merged_into_id = null; patch.merged_into_pmid = null }

  const memory = rule.memory === 'write' && !opts.withoutMemory ? 'write' : 'none'
  const action: EventAction =
    from === null ? (opts.actor === 'import' ? 'IMPORT' : 'ADD')
      : to === 'MERGED' ? 'MERGE'
        : from === 'AUTOMERGED' ? 'UNMERGE'
          : 'TRANSITION'
  return { ok: true, patch, memory, action }
}

// One-step Undo: back to prev_status. Undo also clears prev_status, so a second Undo is refused
// rather than flipping back and forth. A system step (supersede) is not the curator's to undo:
// the twin's gold-standard state owns it.
// Undoing "Not the same" (AUTOMERGED -> PENDING) restores the merge, so the caller passes the
// parent the step detached (the store reads it from that step's UNMERGE event).
export function planUndo(
  rec: LifecycleRecord,
  restore: { mergedIntoId?: number | null; mergedIntoPmid?: number | null } = {},
): LifecyclePlan {
  if (!rec || !isExternalStatus(rec.status)) return fail('Unknown record')
  const back = rec.prev_status
  if (!back) return fail('Nothing to undo')
  if (!isExternalStatus(back)) return fail(`Unknown previous status ${back}`)
  if (rec.status_by === SYSTEM_ACTOR) return fail('The last change was made by the system and cannot be undone here')
  if (rec.status === 'SUPERSEDED' || back === 'SUPERSEDED') return fail('Supersede follows the PubMed record and cannot be undone here')
  const patch: StatusPatch = { status: back, prev_status: null }
  // Undoing a merge detaches the record again.
  if (rec.status === 'MERGED' || rec.status === 'AUTOMERGED') { patch.merged_into_id = null; patch.merged_into_pmid = null }
  if (back === 'MERGED' || back === 'AUTOMERGED') {
    const o = { actor: 'curator' as const, mergedIntoId: restore.mergedIntoId ?? null, mergedIntoPmid: restore.mergedIntoPmid ?? null }
    if (!validMergeTarget(o)) return fail(`Undo to ${back} needs the record it was merged into`)
    patch.merged_into_id = o.mergedIntoId
    patch.merged_into_pmid = o.mergedIntoPmid
  }
  // Undoing a Reject/Remove deletes the memory it wrote. Undoing into REJECTED/REMOVED (the undo of
  // an Accept or a re-add) puts the memory back, so the state and its memory never disagree.
  const memory = MEMORY_STATUSES.includes(rec.status) ? 'clear' : MEMORY_STATUSES.includes(back) ? 'write' : 'none'
  const action: EventAction =
    rec.status === 'MERGED' || rec.status === 'AUTOMERGED' ? 'UNMERGE'
      : back === 'MERGED' || back === 'AUTOMERGED' ? 'MERGE'
        : 'TRANSITION'
  return { ok: true, patch, memory, action }
}

// "Add anyway" for a work whose own row (same uid + article_id) was REJECTED or REMOVED. The UNIQUE
// key forbids a second row, so the add revives that row as ACCEPTED and clears its memory; the
// rejection-memory WARNING already asked the curator (plan decision 12). The plan's table has no
// such row; it is the create path meeting an existing row, and is curator-only.
export function planReAdd(rec: LifecycleRecord, opts: { actor: LifecycleActor }): LifecyclePlan {
  if (opts.actor !== 'curator') return fail('Only a curator can add a rejected or removed work again')
  if (!MEMORY_STATUSES.includes(rec.status)) return fail(`A ${rec.status} record cannot be added again`)
  return { ok: true, patch: { status: 'ACCEPTED', prev_status: rec.status }, memory: 'clear', action: 'ADD' }
}

// Every (from, to) pair the map allows for an actor; used by the check script's matrix and by the
// UI to decide which actions to offer.
export const allowedTargets = (from: ExternalStatus | null, actor: LifecycleActor): ExternalStatus[] =>
  TRANSITIONS.filter((r) => r.from === from && r.actors.includes(actor)).map((r) => r.to)
