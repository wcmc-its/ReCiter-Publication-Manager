import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "react-toastify"
import { reciterConfig } from "../../../../config/local"

// The person's ExternalArticle rows (all sources, incl. suppressed) for Curate's All sources
// tab, with the same reads and writes the former per-source tabs (SourceArticleTab) made:
//   GET    /api/reciter/external-article/{uid}              list
//   POST   /api/db/external-article/feedback                reversible accept / reject (suppress)
//   DELETE /api/reciter/external-article/{uid}?articleId=   permanent delete
//   POST   /api/db/authorships/authors                      byline backfill for older Scopus rows

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

export type ExternalArticles = {
    rows: any[],
    loading: boolean,
    loaded: boolean,
    refetch: () => void,
    // Accept or reject (suppress) each article; resolves true when every write succeeded.
    setFeedback: (articleIds: string[], action: 'ACCEPTED' | 'REJECTED') => Promise<boolean>,
    remove: (articleId: string) => Promise<boolean>,
}

export function useExternalArticles(uid: string | undefined): ExternalArticles {
    const [list, setList] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    // external_id -> display names for Scopus rows hydrated via the authors lookup.
    const [authorsCache, setAuthorsCache] = useState<Record<string, string[]>>({})

    const refetch = useCallback(() => {
        if (!uid) return
        setLoading(true)
        fetch(`/api/reciter/external-article/${encodeURIComponent(uid)}`, {
            credentials: "same-origin", method: "GET", headers: apiHeaders,
        })
            .then(readJson)
            .then((body) => setList(Array.isArray(body.external) ? body.external : []))
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
        fetch(`/api/reciter/external-article/${encodeURIComponent(uid || '')}?articleId=${encodeURIComponent(articleId)}`, {
            credentials: "same-origin", method: "DELETE", headers: apiHeaders,
        })
            .then(readJson)
            .then(() => { toast.success("Publication removed."); return true })
            .catch((err) => { toast.error("Could not remove: " + (err.message || err)); return false })
            .finally(() => refetch())
    ), [uid, refetch])

    return { rows, loading, loaded, refetch, setFeedback, remove }
}
