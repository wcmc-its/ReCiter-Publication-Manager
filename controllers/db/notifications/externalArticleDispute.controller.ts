import models from '../../../src/db/sequelize'
import { sendEmailNotification } from '../../../src/utils/emailUtilityHelper'

// Decision 7 (docs/README-other-publications-tab.md): curator discovery of a faculty
// dispute is push, not pull. When a non-curator logs a REJECTED on an external row,
// email the curator who added it (the row's addedBy CWID -> admin_users.email) and
// append an admin_notification_log row — same infra as the accepted/suggested digest,
// new event type. No new subsystem; the digest stored proc is publication-specific,
// so this calls sendEmailNotification directly (like sendNotifiationPrefEmail does).
//
// Failures here must never fail the dispute itself: every skip logs and returns.
// Note: admin_notification_log.pmid is INTEGER — a "SCOPUS:..." articleId does not fit,
// so the article reference travels in the email body and the FeedbackLog row instead.

const escapeHtml = (value: any): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export async function notifyExternalArticleDisputed(params: {
    uid: string,
    articleId: string,
    title?: string,
    actorPersonIdentifier: string,
    addedBy: string,
    note?: string,
    origin?: string,
}): Promise<void> {
    const { uid, articleId, title, actorPersonIdentifier, addedBy, note, origin } = params

    const adminUser: any = await models.AdminUser.findOne({
        where: { personIdentifier: addedBy },
        attributes: ['userID', 'email'],
    })
    if (!adminUser || !adminUser.email) {
        console.log(`[external-article] dispute notification skipped — no admin user email for addedBy ${addedBy}`)
        return
    }

    const fromAddress = process.env.NODE_ENV === 'production'
        ? '"Reciter Pub Manager" <publications@med.cornell.edu>'
        : '"Reciter Pub Manager Test" <doNotReply@med.cornell.edu>'

    const curateLink = origin ? `${origin}/curate/${encodeURIComponent(uid)}` : ''
    const emailBody = `<div style="font-family: Arial; font-size: 11pt">
        <p>${escapeHtml(actorPersonIdentifier)} has disputed an external publication that was added to ${escapeHtml(uid)}'s profile:</p>
        <p><b>${escapeHtml(title || articleId)}</b><br/>ID: ${escapeHtml(articleId)}</p>
        ${note ? `<p>Note from ${escapeHtml(actorPersonIdentifier)}: &ldquo;${escapeHtml(note)}&rdquo;</p>` : ''}
        <p>The publication is now hidden from the profile and flagged for curator review.${curateLink
            ? ` Review it at <a href="${escapeHtml(curateLink)}" style="text-decoration:none" target="_blank">${escapeHtml(curateLink)}</a>.`
            : ''}</p>
    </div>`

    const sent = await sendEmailNotification({
        from: fromAddress,
        to: adminUser.email,
        subject: `Disputed external publication on ${uid}'s profile`,
        html: emailBody,
    })
    if (!sent) {
        console.error(`[external-article] dispute notification email to ${adminUser.email} failed for ${articleId}`)
        return
    }

    // Log only after a successful send, matching saveNotificationsLog.
    await models.AdminNotificationLog.create({
        userID: adminUser.userID,
        email: adminUser.email,
        dateSent: new Date(),
        createTimestamp: new Date(),
        notificationType: 'ExternalArticleDisputed',
    })
}
