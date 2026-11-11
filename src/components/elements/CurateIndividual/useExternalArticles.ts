import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "react-toastify"
import { reciterConfig } from "../../../../config/local"

// The person's external rows (all sources, incl. suppressed) for Curate's All sources tab.
//   GET    /api/db/external/{uid}                   list; `store` says which store answered
//                                                   (EXTERNAL_STORE, plan 3b-3e)
//   POST   /api/db/authorships/authors              byline backfill for older Scopus rows
// With store 'reciter' (default) the writes are the ones the former per-source tabs made:
//   POST   /api/db/external-article/feedback        reversible accept / reject (suppress)
//   DELETE /api/db/external/{uid}?articleId=        permanent delete
// With store 'mysql' they are lifecycle steps on record ids:
//   POST   /api/db/external/transition              {ids, to}: Accept / Reject / Remove
//   POST   /api/db/external/undo                    {ids}: one-step Undo

const apiHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: reciterConfig.backendApiKey,
}

// AAR-accepted Scopus rows use articleId "SCOPUS:<numeric external_id>". Rows accepted before
// scopusExternalPayload sent `authors` (commit 4b4c1cbb) carry none; their byline is looked up
// by this numeric id.
const SCOPUS_NUMERIC_ID = /^SCOPUS:(\d+)$/

const hasAuthors = (row: any): boolean => (
    (Array.isArray(row.authors) && row.authors.some(Boolean)) ||
    (typeof row.authors === 'string' && row.authors.trim().length > 0)
)

// authors_json ([{given,surname}, ...]) from the AAR pipeline, as display names.
const authorsFromJson = (json?: string | null): string[] => {
    if (!json) return []
    try {
        const parsed = JSON.parse(json)
        if (!Array.isArray(parsed)) return []
        return parsed
            .map((a: any) => {
                const given = (a?.given || '').trim()
                const surname = (a?.surname || '').trim()
                if (given && surname) return `${given} ${surname}`
                return given || surname || ''
            })
            .filter(Boolean)
    } catch {
        return []
    }
}

const readJson = async (r: Response) => {
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error((body && body.message) || `HTTP ${r.status}`)
    return body
}

export type ExternalStore = 'reciter' | 'mysql'

export type ExternalArticles = {
    rows: any[],
    loading: boolean,
    loaded: boolean,
    // Which store answered the list (null until it has); the write path follows it.
    store: ExternalStore | null,
    refetch: () => void,
    // reciter: accept or reject (suppress) each article; resolves true when every write succeeded.
    setFeedback: (articleIds: string[], action: 'ACCEPTED' | 'REJECTED') => Promise<boolean>,
    remove: (articleId: string) => Promise<boolean>,
    // mysql: one lifecycle step for a batch of record ids (all or nothing), and its Undo.
    transition: (ids: number[], to: 'ACCEPTED' | 'REJECTED' | 'REMOVED') => Promise<boolean>,
    undo: (ids: number[]) => Promise<boolean>,
}

export function useExternalArticles(uid: string | undefined): ExternalArticles {
    const [list, setList] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [store, setStore] = useState<ExternalStore | null>(null)
    // external_id -> display names for Scopus rows hydrated via the authors lookup.
    const [authorsCache, setAuthorsCache] = useState<Record<string, string[]>>({})

    const refetch = useCallback(() => {
        if (!uid) return
        setLoading(true)
        fetch(`/api/db/external/${encodeURIComponent(uid)}`, {
            credentials: "same-origin", method: "GET", headers: apiHeaders,
        })
            .then(readJson)
            .then((body) => {
                setStore(body.store === 'mysql' ? 'mysql' : 'reciter')
                setList(Array.isArray(body.external) ? body.external : [])
            })
            .catch(() => setList([]))
            .finally(() => { setLoading(false); setLoaded(true) })
    }, [uid])

    useEffect(() => { refetch() }, [refetch])

    // Batched byline backfill: fetch once per not-yet-attempted id.
    useEffect(() => {
        const ids = new Set<string>()
        list.forEach((row) => {
            if (hasAuthors(row)) return
            const m = SCOPUS_NUMERIC_ID.exec(row.articleId || '')
            if (m && !(m[1] in authorsCache)) ids.add(m[1])
        })
        if (ids.size === 0) return
        const externalIds = [...ids]
        const settle = (byId: Record<string, string | null>) => setAuthorsCache((prev) => {
            const next = { ...prev }
            externalIds.forEach((id) => { next[id] = authorsFromJson(byId[id]) })
            return next
        })
        fetch(`/api/db/authorships/authors`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify({ externalIds }),
        })
            .then(readJson)
            .then((body) => settle(body.authors || {}))
            // Best effort: mark the ids attempted so a failed lookup doesn't refire.
            .catch(() => settle({}))
    }, [list, authorsCache])

    const rows = useMemo(() => list.map((row) => {
        if (hasAuthors(row)) return row
        const m = SCOPUS_NUMERIC_ID.exec(row.articleId || '')
        const names = m ? authorsCache[m[1]] : undefined
        return names && names.length ? { ...row, authors: names } : row
    }), [list, authorsCache])

    // Optimistic: flip suppressed locally, persist each row via the feedback route, reconcile
    // with a refetch. A failed write reverts its row.
    const setFeedback = useCallback((articleIds: string[], action: 'ACCEPTED' | 'REJECTED'): Promise<boolean> => {
        const ids = new Set(articleIds)
        const suppressed = action === 'REJECTED'
        setList((prev) => prev.map((r) => (ids.has(r.articleId) ? { ...r, suppressed } : r)))
        return Promise.all(articleIds.map((articleId) => fetch(`/api/db/external-article/feedback`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify({ uid, articleId, action }),
        })
            .then(readJson)
            .then(() => true)
            .catch((err) => {
                toast.error("Could not update: " + (err.message || err))
                setList((prev) => prev.map((r) => (r.articleId === articleId ? { ...r, suppressed: !suppressed } : r)))
                return false
            })))
            .then((oks) => oks.every(Boolean))
            .finally(() => refetch())
    }, [uid, refetch])

    const remove = useCallback((articleId: string): Promise<boolean> => (
        fetch(`/api/db/external/${encodeURIComponent(uid || '')}?articleId=${encodeURIComponent(articleId)}`, {
            credentials: "same-origin", method: "DELETE", headers: apiHeaders,
        })
            .then(readJson)
            .then(() => { toast.success("Publication removed."); return true })
            .catch((err) => { toast.error("Could not remove: " + (err.message || err)); return false })
            .finally(() => refetch())
    ), [uid, refetch])

    // Store steps: no optimistic flip (the rows carry status, prevStatus and who), so the list is
    // refetched after each write; a refused step (409) or any error toasts and resolves false.
    const storeWrite = useCallback((path: 'transition' | 'undo', body: any, verb: string): Promise<boolean> => (
        fetch(`/api/db/external/${path}`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders, body: JSON.stringify(body),
        })
            .then(readJson)
            .then(() => true)
            .catch((err) => { toast.error(`Could not ${verb}: ` + (err.message || err)); return false })
            .finally(() => refetch())
    ), [refetch])

    const transition = useCallback((ids: number[], to: 'ACCEPTED' | 'REJECTED' | 'REMOVED') =>
        storeWrite('transition', { ids, to }, 'update'), [storeWrite])
    const undo = useCallback((ids: number[]) => storeWrite('undo', { ids }, 'undo'), [storeWrite])

    return { rows, loading, loaded, store, refetch, setFeedback, remove, transition, undo }
}
