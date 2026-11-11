import type { NextApiRequest, NextApiResponse } from 'next'
import { apiKeyOk, send, sessionOf, dupVerdictExternal, firstParam } from '../../../../../controllers/db/external.controller'

// Plan 3b-3e, 3c/3e (EXTERNAL_STORE=mysql only; 409 otherwise). "Different papers" verdicts.
//   GET    ?uid=<uid>                                    the verdicts that apply to this curator
//   POST   {uid, a, b, verdict: 'DIFFERENT', scope?}     record one (scope 'curator' default, or 'global')
//   DELETE {uid, a, b, scope?}                           undo it
// a / b are record keys: PMID:<n> or EXT:<articleId>; the pair is stored in code-point order.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = req.method || ''
  if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
    return res.status(400).send({ statusCode: 400, message: 'HTTP Methods supported are GET, POST, DELETE' })
  }
  if (!apiKeyOk(req, res)) return
  const uid = method === 'GET' ? firstParam(req.query.uid) : req.body?.uid
  if (typeof uid !== 'string' || !uid) return res.status(400).send({ statusCode: 400, message: 'uid is required' })
  try {
    return send(res, await dupVerdictExternal(method, uid, req.body, await sessionOf(req)))
  } catch (err) {
    console.error('[external/dup-verdict] Unhandled error:', err)
    return res.status(500).send({ statusCode: 500, message: 'Internal server error' })
  }
}
