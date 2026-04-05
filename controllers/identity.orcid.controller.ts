import { reciterConfig } from '../config/local'

/**
 * Get the confirmed ORCID from ReCiter Identity (DynamoDB).
 * Returns the orcid string or null if not set.
 */
export async function getIdentityOrcid(uid: string): Promise<string | null> {
    try {
        const res = await fetch(
            `${reciterConfig.reciter.reciterIdentityEndpoints.identityByUid}?uid=${uid}`,
            {
                method: 'GET',
                headers: {
                    'api-key': reciterConfig.reciter.adminApiKey,
                    'User-Agent': 'reciter-pub-manager-server',
                },
            }
        )
        if (res.status !== 200) return null
        const identity = await res.json()
        return identity.orcid || null
    } catch (error) {
        console.log('Failed to get Identity ORCID:', error)
        return null
    }
}

/**
 * Save an ORCID to the ReCiter Identity (DynamoDB).
 * GETs the current identity, sets the orcid field, POSTs it back.
 */
export async function saveIdentityOrcid(uid: string, orcid: string): Promise<{ success: boolean; error?: string }> {
    try {
        // GET current identity
        const getRes = await fetch(
            `${reciterConfig.reciter.reciterIdentityEndpoints.identityByUid}?uid=${uid}`,
            {
                method: 'GET',
                headers: {
                    'api-key': reciterConfig.reciter.adminApiKey,
                    'User-Agent': 'reciter-pub-manager-server',
                },
            }
        )
        if (getRes.status !== 200) {
            return { success: false, error: `Identity lookup failed with status ${getRes.status}` }
        }
        const identity = await getRes.json()

        // Update orcid field
        identity.orcid = orcid

        // POST updated identity back
        const saveRes = await fetch(
            `${reciterConfig.reciter.reciterApiBaseUrl}/reciter/save/identity`,
            {
                method: 'POST',
                headers: {
                    'api-key': reciterConfig.reciter.adminApiKey,
                    'Content-Type': 'application/json',
                    'User-Agent': 'reciter-pub-manager-server',
                },
                body: JSON.stringify(identity),
            }
        )
        if (saveRes.status !== 200) {
            return { success: false, error: `Identity save failed with status ${saveRes.status}` }
        }
        return { success: true }
    } catch (error) {
        console.log('Failed to save Identity ORCID:', error)
        return { success: false, error: String(error) }
    }
}

/**
 * Remove the ORCID from the ReCiter Identity (DynamoDB).
 * Sets the orcid field to empty string.
 */
export async function removeIdentityOrcid(uid: string): Promise<{ success: boolean; error?: string }> {
    return saveIdentityOrcid(uid, '')
}
