import type { NextApiRequest, NextApiResponse } from 'next'
import { apiKeyOk, send, sessionOf, getExternalRecord, editExternal, firstParam } from '../../../../../../controllers/db/external.controller'

// Plan 3b-3e, 3c (EXTERNAL_STORE=mysql only; 409 otherwise). One external record.
//   GET   the record and its event history
//   PATCH {field: value, ...} edit whitelisted fields; the diff goes to the event table and the
//         status never changes
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = req.method || ''
  if (method !== 'GET' && method !== 'PATCH') {
    return res.status(400).send({ statusCode: 400, message: 'HTTP Methods supported are GET, PATCH' })
  }
  if (!apiKeyOk(req, res)) return
  const id = Number(firstParam(req.query.id))
  if (!Number.isInteger(id) || id <= 0) return res.status(400).send({ statusCode: 400, message: 'id must be a record id' })
  try {
    const s = await sessionOf(req)
    return send(res, method === 'GET' ? await getExternalRecord(id, s) : await editExternal(id, req.body, s))
  } catch (err) {
    console.error('[external/record] Unhandled error:', err)
    return res.status(500).send({ statusCode: 500, message: 'Internal server error' })
  }
}
