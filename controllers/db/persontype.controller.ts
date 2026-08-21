import type { NextApiRequest, NextApiResponse } from 'next'
import { queryDistinctPersonTypes } from '../../repositories/db/persontype.repository'

export const findAllPersonTypes = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const personTypes = await queryDistinctPersonTypes()
        res.send(personTypes)
    } catch (e) {
        console.log(e)
        res.status(500).send(e)
    }
}
