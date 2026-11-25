// Unit tests for src/lib/externalLifecycle.ts, the external_record state machine (plan 3b-3e
// "Lifecycle"). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXTERNAL_STATUSES, TRANSITIONS, planTransition, planUndo, planReAdd, allowedTargets, isReportable, SYSTEM_ACTOR,
} from '../src/lib/externalLifecycle.ts'

const rec = (status, extra = {}) => ({ status, prev_status: null, status_by: 'abc1234', ...extra })
const ok = (p) => { assert.equal(p.ok, true, p.error); return p }
const no = (p, re) => { assert.equal(p.ok, false); if (re) assert.match(p.error, re); return p }

// The plan's table, as (from, to, actor). Everything else must be refused.
const ALLOWED = [
  [null, 'PENDING', 'import'],
  [null, 'AUTOMERGED', 'import'],
  [null, 'ACCEPTED', 'curator'],
  ['PENDING', 'ACCEPTED', 'curator'],
  ['PENDING', 'REJECTED', 'curator'],
  ['PENDING', 'MERGED', 'curator'],
  ['ACCEPTED', 'REMOVED', 'curator'],
  ['ACCEPTED', 'MERGED', 'curator'],
  ['ACCEPTED', 'SUPERSEDED', 'system'],
  ['SUPERSEDED', 'ACCEPTED', 'system'],
  ['AUTOMERGED', 'PENDING', 'curator'],
]
const needs = { mergedIntoId: 7, supersededByPmid: 123 }

test('the transition map is exactly the plan table', () => {
  assert.deepEqual(TRANSITIONS.map((r) => [r.from, r.to, ...r.actors]), ALLOWED)
})

test('full matrix: every (from, to, actor) not in the table is refused', () => {
  const allowed = new Set(ALLOWED.map((r) => r.join('|')))
  let refused = 0
  for (const from of [null, ...EXTERNAL_STATUSES]) {
    for (const to of EXTERNAL_STATUSES) {
      for (const actor of ['curator', 'system', 'import']) {
        const opts = { actor, ...(to === 'MERGED' || to === 'AUTOMERGED' ? { mergedIntoId: 7 } : {}), ...(to === 'SUPERSEDED' ? { supersededByPmid: 123 } : {}) }
        const p = planTransition(from ? rec(from) : null, to, opts)
        const want = allowed.has([from, to, actor].join('|'))
        assert.equal(p.ok, want, `${from} -> ${to} by ${actor}: ${p.error || 'allowed'}`)
        if (!want) refused++
      }
    }
  }
  assert.equal(refused, 8 * 7 * 3 - ALLOWED.length)
})

test('Reject and Remove write rejection memory; Authorships reopen does not', () => {
  assert.equal(ok(planTransition(rec('PENDING'), 'REJECTED', { actor: 'curator' })).memory, 'write')
  assert.equal(ok(planTransition(rec('ACCEPTED'), 'REMOVED', { actor: 'curator' })).memory, 'write')
  assert.equal(ok(planTransition(rec('ACCEPTED'), 'REMOVED', { actor: 'curator', withoutMemory: true })).memory, 'none')
  no(planTransition(rec('PENDING'), 'REJECTED', { actor: 'curator', withoutMemory: true }), /reopen/)
  assert.equal(ok(planTransition(rec('PENDING'), 'ACCEPTED', { actor: 'curator' })).memory, 'none')
})

test('steps record prev_status and the event action', () => {
  const p = ok(planTransition(rec('PENDING'), 'ACCEPTED', { actor: 'curator' }))
  assert.deepEqual(p.patch, { status: 'ACCEPTED', prev_status: 'PENDING' })
  assert.equal(p.action, 'TRANSITION')
  assert.equal(ok(planTransition(null, 'ACCEPTED', { actor: 'curator' })).action, 'ADD')
  assert.equal(ok(planTransition(null, 'PENDING', { actor: 'import' })).action, 'IMPORT')
  assert.equal(ok(planTransition(rec('ACCEPTED'), 'MERGED', { actor: 'curator', mergedIntoPmid: 5 })).action, 'MERGE')
  assert.equal(ok(planTransition(rec('AUTOMERGED', { merged_into_id: 3 }), 'PENDING', { actor: 'curator' })).action, 'UNMERGE')
  assert.equal(planTransition(rec('AUTOMERGED'), 'PENDING', { actor: 'curator' }).patch.merged_into_id, null)
})

test('merge needs exactly one target; supersede needs the twin', () => {
  no(planTransition(rec('ACCEPTED'), 'MERGED', { actor: 'curator' }), /exactly one/)
  no(planTransition(rec('ACCEPTED'), 'MERGED', { actor: 'curator', mergedIntoId: 1, mergedIntoPmid: 2 }), /exactly one/)
  no(planTransition(rec('ACCEPTED'), 'MERGED', { actor: 'curator', mergedIntoId: -1 }), /record id/)
  const m = ok(planTransition(rec('PENDING'), 'MERGED', { actor: 'curator', mergedIntoPmid: 4242 }))
  assert.deepEqual([m.patch.merged_into_id, m.patch.merged_into_pmid], [null, 4242])
  no(planTransition(rec('ACCEPTED'), 'SUPERSEDED', { actor: 'system' }), /twin/)
  const s = ok(planTransition(rec('ACCEPTED'), 'SUPERSEDED', { actor: 'system', ...needs }))
  assert.equal(s.patch.superseded_by_pmid, 123)
  const back = ok(planTransition(rec('SUPERSEDED', { superseded_by_pmid: 123 }), 'ACCEPTED', { actor: 'system' }))
  assert.equal(back.patch.superseded_by_pmid, null)
})

test('a no-op or unknown status is refused', () => {
  no(planTransition(rec('ACCEPTED'), 'ACCEPTED', { actor: 'curator' }), /already/)
  no(planTransition(rec('ACCEPTED'), 'DELETED', { actor: 'curator' }), /Unknown/)
})

test('Undo goes back one step and clears prev_status', () => {
  const u = ok(planUndo(rec('ACCEPTED', { prev_status: 'PENDING' })))
  assert.deepEqual(u.patch, { status: 'PENDING', prev_status: null })
  assert.equal(u.memory, 'none')
  no(planUndo(rec('PENDING')), /Nothing to undo/)
})

test('Undo of Reject/Remove deletes memory; Undo into REJECTED/REMOVED writes it back', () => {
  assert.equal(ok(planUndo(rec('REJECTED', { prev_status: 'PENDING' }))).memory, 'clear')
  assert.equal(ok(planUndo(rec('REMOVED', { prev_status: 'ACCEPTED' }))).memory, 'clear')
  assert.equal(ok(planUndo(rec('ACCEPTED', { prev_status: 'REJECTED' }))).memory, 'write')
})

test('Undo never touches a supersede, nor a step the system made', () => {
  no(planUndo(rec('SUPERSEDED', { prev_status: 'ACCEPTED', status_by: SYSTEM_ACTOR })), /system/)
  no(planUndo(rec('ACCEPTED', { prev_status: 'SUPERSEDED' })), /Supersede/)
})

test('Undo of a merge detaches; Undo of "Not the same" restores the parent', () => {
  const u = ok(planUndo(rec('MERGED', { prev_status: 'ACCEPTED', merged_into_id: 9 })))
  assert.deepEqual([u.patch.status, u.patch.merged_into_id, u.patch.merged_into_pmid, u.action], ['ACCEPTED', null, null, 'UNMERGE'])
  no(planUndo(rec('PENDING', { prev_status: 'AUTOMERGED' })), /merged into/)
  const r = ok(planUndo(rec('PENDING', { prev_status: 'AUTOMERGED' }), { mergedIntoId: 9 }))
  assert.deepEqual([r.patch.status, r.patch.merged_into_id, r.action], ['AUTOMERGED', 9, 'MERGE'])
})

test('re-add revives only a rejected or removed row, for a curator, and clears its memory', () => {
  const p = ok(planReAdd(rec('REMOVED'), { actor: 'curator' }))
  assert.deepEqual([p.patch.status, p.patch.prev_status, p.memory, p.action], ['ACCEPTED', 'REMOVED', 'clear', 'ADD'])
  ok(planReAdd(rec('REJECTED'), { actor: 'curator' }))
  no(planReAdd(rec('ACCEPTED'), { actor: 'curator' }))
  no(planReAdd(rec('MERGED'), { actor: 'curator' }))
  no(planReAdd(rec('REJECTED'), { actor: 'import' }))
})

test('allowedTargets and reportability', () => {
  assert.deepEqual(allowedTargets('PENDING', 'curator'), ['ACCEPTED', 'REJECTED', 'MERGED'])
  assert.deepEqual(allowedTargets('ACCEPTED', 'curator'), ['REMOVED', 'MERGED'])
  assert.deepEqual(allowedTargets('REJECTED', 'curator'), [])
  assert.deepEqual(EXTERNAL_STATUSES.filter(isReportable), ['ACCEPTED'])
})
