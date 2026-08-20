import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'
import models from '../src/db/sequelize'
import { sendEmailNotification } from '../src/utils/emailUtilityHelper'

// PM#771 — proxy the ReCiter external-article API (OpenAlex/Scopus/WoS manual-add).
// Same mechanism as goldstandard.controller / pubmed.controller: PM route gates on
// the app backendApiKey, then this controller calls the Java service with the admin
// api-key header. The target person uid always comes from the route param, and
// addedBy is resolved from the JWT in the route (never trusted from the client).
//
// Faculty dispute (docs/README-other-publications-tab.md): actingUid is resolved
// from the JWT in the route the same way as addedBy above, never trusted from the
// client. See notifyDispute() below for the curator-notification piece (Decision 7).

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

// PATCH the dispute lifecycle: DISPUTE (faculty flags a row not theirs) / RETRACT
// (faculty undoes their own dispute) / RESOLVE (curator clears it). `actingUid` is
// stamped server-side from the JWT — see [uid].ts — never trusted from the request.
export async function updateExternalArticleDispute(
    uid: string,
    articleId: string,
    actingUid: string,
    action: 'DISPUTE' | 'RETRACT' | 'RESOLVE',
    disputeNote: string | undefined,
) {
    const uri = `${base()}?uid=${encodeURIComponent(uid)}&articleId=${encodeURIComponent(articleId)}&actingUid=${encodeURIComponent(actingUid)}`
    return fetch(uri, {
        method: 'PATCH',
        headers: javaHeaders(),
        body: JSON.stringify(disputeNote ? { action, disputeNote } : { action }),
    })
        .then(async (res) => ({ statusCode: res.status, statusText: await readBody(res) }))
        .catch((error) => {
            console.log('ReCiter external-article PATCH is not reachable: ' + error)
            return { statusCode: error.status || 500, statusText: error }
        })
}

// Decision 7 — curator discovery is push, not pull: email the row's addedBy uid when
// a dispute is filed, so the curator who added the row hears about it without having
// to revisit that person's page. Reuses the plain SMTP mailer already used for the
// notification-preference digest (src/utils/emailUtilityHelper) rather than routing
// through AdminNotificationPreference/AdminNotificationLog — that machinery is a
// scheduled accepted/suggested-pmid digest keyed to frequency+threshold, with no
// per-articleId dispute concept, so this is a direct send, not a queued digest entry.
export async function notifyDispute(
    addedBy: string,
    targetUid: string,
    articleTitle: string,
    disputedBy: string,
    disputeNote: string | undefined,
) {
    try {
        const adminUser: any = await models.AdminUser.findOne({
            where: { personIdentifier: addedBy },
            attributes: ['email'],
        })
        const to = adminUser && adminUser.email
        if (!to) {
            console.log('[external-article] no email on file for addedBy ' + addedBy + ' — dispute notification skipped')
            return
        }
        const fromAddress = process.env.NODE_ENV === 'production'
            ? '"Reciter Pub Manager" <publications@med.cornell.edu>'
            : '"Reciter Pub Manager Test" <doNotReply@med.cornell.edu>'
        await sendEmailNotification({
            from: fromAddress,
            to,
            subject: `A publication you added for ${targetUid} was disputed`,
            html: `<div style="font-family: Arial; font-size: 11pt">
                <p>Hello,</p>
                <p><strong>${disputedBy}</strong> disputed a publication you added to their record:</p>
                <p>${articleTitle}</p>
                ${disputeNote ? `<p>Note: ${disputeNote}</p>` : ''}
                <p>Review it on their curate page and resolve the dispute once you've checked it.</p>
            </div>`,
        })
    } catch (e) {
        // Never fail the dispute write over a notification-send problem.
        console.log('[external-article] dispute notification failed: ' + e)
    }
}
