import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'

// PM#771 — proxy the ReCiter external-article API (OpenAlex/Scopus/WoS manual-add).
// Same mechanism as goldstandard.controller / pubmed.controller: PM route gates on
// the app backendApiKey, then this controller calls the Java service with the admin
// api-key header. The target person uid always comes from the route param, and
// addedBy is resolved from the JWT in the route (never trusted from the client).

const base = () => reciterConfig.reciter.reciterExternalArticleEndpoint

function javaHeaders() {
    return {
        'Content-Type': 'application/json',
        'api-key': reciterConfig.reciter.adminApiKey,
        'User-Agent': 'reciter-pub-manager-server',
    }
}

async function readBody(res: Response) {
    try { return await res.json() } catch (e) {
        try { return await res.text() } catch (e2) { return null }
    }
}

// GET all external articles for a person (includes suppressed rows).
export async function getExternalArticles(uid: string) {
    return fetch(`${base()}?uid=${encodeURIComponent(uid)}`, {
        method: 'GET',
        headers: javaHeaders(),
    })
        .then(async (res) => ({ statusCode: res.status, statusText: await readBody(res) }))
        .catch((error) => {
            console.log('ReCiter external-article GET is not reachable: ' + error)
            return { statusCode: error.status || 500, statusText: error }
        })
}

// POST a new external article. `force` maps to the &force=true retry for WARNING dups.
// addedBy is stamped server-side (curator CWID from the JWT).
export async function addExternalArticle(uid: string, body: any, addedBy: string | undefined, force: boolean) {
    // Never trust a client-supplied addedBy; stamp it from the JWT server-side.
    const { addedBy: _ignore, ...rest } = body || {}
    const payload = addedBy ? { ...rest, addedBy } : rest

    let uri = `${base()}?uid=${encodeURIComponent(uid)}`
    if (force) uri += '&force=true'

    return fetch(uri, {
        method: 'POST',
        headers: javaHeaders(),
        body: JSON.stringify(payload),
    })
        .then(async (res) => ({ statusCode: res.status, statusText: await readBody(res) }))
        .catch((error) => {
            console.log('ReCiter external-article POST is not reachable: ' + error)
            return { statusCode: error.status || 500, statusText: error }
        })
}

// DELETE (= revoke) an external article by articleId.
export async function deleteExternalArticle(uid: string, articleId: string) {
    return fetch(`${base()}?uid=${encodeURIComponent(uid)}&articleId=${encodeURIComponent(articleId)}`, {
        method: 'DELETE',
        headers: javaHeaders(),
    })
        .then(async (res) => ({ statusCode: res.status, statusText: await readBody(res) }))
        .catch((error) => {
            console.log('ReCiter external-article DELETE is not reachable: ' + error)
            return { statusCode: error.status || 500, statusText: error }
        })
}
