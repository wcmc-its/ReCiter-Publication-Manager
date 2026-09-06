import { authorshipReports } from "../../../../../controllers/db/authorships.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../config/local'

// Deliberately a byte-for-byte mirror of ./summary.ts — same backendApiKey gate, same method
// handling, same export shape — so this route inherits the /api/db/** next-auth gate and the
// api-key check on exactly the same terms as every sibling. Validating the `report` key is the
// controller's job, not this file's: keeping the route identical to summary.ts is what makes it
// obvious at a glance that no auth path was invented here.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "POST") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await authorshipReports(req, res)
        } else if (req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Method supported is POST')
    }
}
