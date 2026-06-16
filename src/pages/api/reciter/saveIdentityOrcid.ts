import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../config/local'
import { saveIdentityOrcid, removeIdentityOrcid } from '../../../../controllers/identity.orcid.controller'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(400).json({ success: false, error: 'HTTP Method supported is POST' })
    }

    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        return res.status(401).json({ success: false, error: 'Authorization header is incorrect' })
    }

    const { personIdentifier, orcid } = req.body
    if (!personIdentifier) {
        return res.status(400).json({ success: false, error: 'personIdentifier is required' })
    }

    const result = orcid
        ? await saveIdentityOrcid(personIdentifier, orcid)
        : await removeIdentityOrcid(personIdentifier)

    if (result.success) {
        res.status(200).json(result)
    } else {
        res.status(500).json(result)
    }
}
