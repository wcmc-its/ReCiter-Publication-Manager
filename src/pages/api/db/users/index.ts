import { findAll } from "../../../../../controllers/db/person.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { Person } from '../../../../db/models/Person'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<Person | string>) {
    if (req.method === "GET") {
        await findAll(req, res);
    } else {
        // Default this to a bad request for now
        res.status(400).send('Bad request');
    }
}