import type { NextApiRequest, NextApiResponse } from 'next'
import { apiKeyOk, send, sessionOf, dupCheckExternal } from '../../../../../controllers/db/external.controller'

// Plan 3b-3e, 3c (EXTERNAL_STORE=mysql only; 409 otherwise).
// POST {uid, record, excludeId?}: dry-run of the add-time duplicate check (the manual-entry dialog, 3d).
// Answers 200 with {level: OK|WARNING|BLOCKED, conflict, matches}; writes nothing. excludeId (an
// Edit) leaves that record out of the comparison.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(400).send({ statusCode: 400, message: 'HTTP Method supported is POST' })
  if (!apiKeyOk(req, res)) return
  const { uid, record, excludeId } = req.body || {}
  if (typeof uid !== 'string' || !uid) return res.status(400).send({ statusCode: 400, message: 'uid is required' })
  if (excludeId != null && !(Number.isInteger(Number(excludeId)) && Number(excludeId) > 0)) {
    return res.status(400).send({ statusCode: 400, message: 'excludeId must be a record id' })
  }
  try {
    return send(res, await dupCheckExternal(uid, record, await sessionOf(req), excludeId == null ? null : Number(excludeId)))
  } catch (err) {
    console.error('[external/dupcheck] Unhandled error:', err)
    return res.status(500).send({ statusCode: 500, message: 'Internal server error' })
  }
}
