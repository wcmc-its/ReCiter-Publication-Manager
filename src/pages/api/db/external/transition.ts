import type { NextApiRequest, NextApiResponse } from 'next'
import { apiKeyOk, send, sessionOf, transitionExternal } from '../../../../../controllers/db/external.controller'

// Plan 3b-3e, 3c (EXTERNAL_STORE=mysql only; 409 otherwise).
// POST {ids[], to, note?}: one transaction, all or nothing; returns the new rows (with prevStatus for Undo).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(400).send({ statusCode: 400, message: 'HTTP Method supported is POST' })
  if (!apiKeyOk(req, res)) return
  try {
    return send(res, await transitionExternal(req.body, await sessionOf(req)))
  } catch (err) {
    console.error('[external/transition] Unhandled error:', err)
    return res.status(500).send({ statusCode: 500, message: 'Internal server error' })
  }
}
