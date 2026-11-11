import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";
import {
    AuthorIdAction, AuthorIdRow, AuthorIdType, parseEvidence, planAuthorIdAction, sortAuthorIds,
} from "../../../src/utils/authorIds";

// reciterdb.person_author_id arrives with ReCiterDB DDL v3.8. Until it is applied to a given
// reciterdb, reads report the feature as unavailable (the card hides) and writes return 503.
export const isMissingTable = (e: any): boolean => {
    const o = e?.original || e?.parent || e
    return o?.errno === 1146 || o?.code === 'ER_NO_SUCH_TABLE'
}

const isRetryable = (e: any): boolean => {
    const o = e?.original || e?.parent || e
    return o?.errno === 1213 || o?.code === 'ER_LOCK_DEADLOCK' || o?.errno === 1062 || o?.code === 'ER_DUP_ENTRY'
}

const toRow = (r: any): AuthorIdRow => {
    const ev = parseEvidence(r.evidence_json)
    const share = r.share == null ? null : Number(r.share)
    return {
        idType: r.id_type,
        idValue: r.id_value,
        status: r.status,
        method: r.method,
        votes: Number(r.votes) || 0,
        resolvable: Number(r.resolvable) || 0,
        share: Number.isFinite(share) ? share : null,
        pmids: ev.pmids,
        competing: ev.competing,
        orcidLookup: ev.orcidLookup,
        conflictUid: r.conflict_uid || null,
        decidedBy: r.decided_by || null,
        decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    }
}

export const listAuthorIds = async (uid: string): Promise<{ available: boolean, ids: AuthorIdRow[] }> => {
    try {
        const rows = await models.PersonAuthorId.findAll({ where: { uid: uid.toLowerCase() }, raw: true })
        return { available: true, ids: sortAuthorIds(rows.map(toRow)) }
    } catch (e) {
        if (isMissingTable(e)) return { available: false, ids: [] }
        throw e
    }
}

export type AuthorIdWriteResult =
    | { http: 200, row: AuthorIdRow | null, changed: boolean }
    | { http: number, message: string, conflictUid?: string }

// One curator action on (uid, idType, idValue), in a transaction that locks every row holding
// that id (any uid), so two curators cannot confirm the same id for two people at once.
export const applyAuthorIdAction = async (
    uid: string, actor: string, action: AuthorIdAction, idType: AuthorIdType, idValue: string,
): Promise<AuthorIdWriteResult> => {
    const person = uid.toLowerCase()
    const attempt = () => sequelize.transaction(async (transaction): Promise<AuthorIdWriteResult> => {
        const holders: any[] = await models.PersonAuthorId.findAll({
            where: { id_type: idType, id_value: idValue },
            lock: transaction.LOCK.UPDATE, transaction, raw: true,
        })
        const mine = holders.find((h) => String(h.uid).toLowerCase() === person) || null
        const existing = mine ? toRow(mine) : null
        const confirmedBy = holders.find((h) => String(h.uid).toLowerCase() !== person && h.status === 'CONFIRMED')?.uid || null
        const plan = planAuthorIdAction(action, existing, confirmedBy)
        const now = new Date()

        if (plan.kind === 'error') return { http: plan.http, message: plan.message, conflictUid: plan.conflictUid }
        if (plan.kind === 'noop') return { http: 200 as const, row: existing, changed: false }
        if (plan.kind === 'delete') {
            await models.PersonAuthorId.destroy({ where: { id: mine.id }, transaction })
            return { http: 200 as const, row: null, changed: true }
        }
        const decided = plan.decided ? { decided_by: actor, decided_at: now } : { decided_by: null, decided_at: null }
        if (plan.kind === 'insert') {
            // Informational, like the nightly's: another uid holding it as SUGGESTED.
            const suggestedFor = holders.find((h) => String(h.uid).toLowerCase() !== person && h.status === 'SUGGESTED')?.uid || null
            await models.PersonAuthorId.create({
                uid: person, id_type: idType, id_value: idValue, status: plan.status, method: plan.method,
                votes: 0, resolvable: 0, share: null, evidence_json: null, conflict_uid: suggestedFor,
                ...decided, first_seen: now, last_seen: now,
            }, { transaction })
        } else {
            await models.PersonAuthorId.update(
                { status: plan.status, method: plan.method, ...decided },
                { where: { id: mine.id }, transaction },
            )
        }
        const fresh = await models.PersonAuthorId.findOne({
            where: { uid: person, id_type: idType, id_value: idValue }, transaction, raw: true,
        })
        return { http: 200 as const, row: fresh ? toRow(fresh) : null, changed: true }
    })
    // When no row holds the id yet, FOR UPDATE takes only a gap lock, which two transactions can
    // share; both then insert and InnoDB kills one with a deadlock (or a duplicate key for the same
    // person). Retrying re-reads the winner's row, so the loser gets 409 or a no-op, not a 500.
    for (let tries = 1; ; tries++) {
        try {
            return await attempt()
        } catch (e) {
            if (isMissingTable(e)) return { http: 503, message: 'Author profiles are not available yet on this database' }
            if (tries < 3 && isRetryable(e)) continue
            throw e
        }
    }
}

