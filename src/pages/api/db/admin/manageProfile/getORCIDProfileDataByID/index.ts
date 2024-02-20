import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../../config/local'
import { AdminUser } from '../../../../../../db/models/AdminUser'
import { getManageProfileByID } from '../../../../../../../controllers/db/manage-profile/manageProfile.controller'

export default async function handler(req: NextApiRequest,
  res: NextApiResponse<AdminUser | string>) {
  if (req.method === "GET") {
    if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
      await getManageProfileByID(req, res)
    } else if (req.headers.authorization === undefined) {
      res.status(400).send("Authorization header is needed")
    } else {
      res.status(401).send("Authorization header is incorrect")
    }
  } else {
    // Default this to a bad request for now
    res.status(400).send('HTTP Supported method is GET')
  }
}