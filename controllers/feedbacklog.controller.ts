import { reciterConfig } from '../config/local'

/**
 * Phase 34: fetch curation audit history (FeedbackLog + ArticleProvenance) for a uid
 * from the ReCiter engine. Returns { statusCode, data } on success or
 * { statusCode, statusText } on error. Never throws.
 */
export async function getFeedbackLog(uid: string): Promise<{ statusCode: number; data?: any; statusText?: string }> {
    return fetch(`${reciterConfig.reciter.reciterFeedbackLogEndpoint}${encodeURIComponent(uid)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'api-key': reciterConfig.reciter.adminApiKey,
            'User-Agent': 'reciter-pub-manager-server'
        }
    })
        .then(async (res) => {
            if (res.status !== 200) {
                return { statusCode: res.status, statusText: await res.text() }
            }
            const data: any = await res.json()
            return { statusCode: 200, data }
        })
        .catch((error) => {
            console.log('ReCiter feedback-log api is not reachable: ' + error)
            return { statusCode: error.status || 500, statusText: String(error) }
        })
}
