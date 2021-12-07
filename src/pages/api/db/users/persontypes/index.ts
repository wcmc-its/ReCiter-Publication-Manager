import { findAllPersonTypes } from "../../../../../../controllers/db/persontype.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { PersonPersonType } from '../../../../../db/models/PersonPersonType'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<PersonPersonType | string>) {
    if (req.method === "GET") {
        await findAllPersonTypes(req, res)
    } else {
        // Default this to a bad request for now
        res.status(400).send('Bad request')
    }
}