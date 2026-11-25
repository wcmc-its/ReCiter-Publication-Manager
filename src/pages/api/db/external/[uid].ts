import type { NextApiRequest, NextApiResponse } from 'next'
import { apiKeyOk, send, sessionOf, listExternal, addExternal, removeExternal, firstParam } from '../../../../../controllers/db/external.controller'

// Plan 3b-3e, 3c: a person's external and manual records, in either store (EXTERNAL_STORE).
//   GET    /api/db/external/<uid>                     list; `store` says which store answered
//   POST   /api/db/external/<uid>[?force=true]  body  add (201, or 409 BLOCKED/WARNING)
//   DELETE /api/db/external/<uid>?articleId=<id>      reciter: Java delete; mysql: soft Remove
// Behind the /api/db session gate (middleware) and the backendApiKey; writes take canCurate.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = req.method || ''
  if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
    return res.status(400).send({ statusCode: 400, message: 'HTTP Methods supported are GET, POST, DELETE' })
  }
  if (!apiKeyOk(req, res)) return
  const uid = firstParam(req.query.uid)
  if (!uid) return res.status(400).send({ statusCode: 400, message: 'uid is required' })
  try {
    if (method === 'GET') return send(res, await listExternal(uid))
    const s = await sessionOf(req)
    if (method === 'DELETE') {
      const articleId = firstParam(req.query.articleId)
      if (!articleId) return res.status(400).send({ statusCode: 400, message: 'articleId is required for delete' })
      return send(res, await removeExternal(uid, articleId, s))
    }
    return send(res, await addExternal(uid, req.body, s, firstParam(req.query.force) === 'true'))
  } catch (err) {
    console.error('[external] Unhandled error:', err)
    return res.status(500).send({ statusCode: 500, message: 'Internal server error' })
  }
}
