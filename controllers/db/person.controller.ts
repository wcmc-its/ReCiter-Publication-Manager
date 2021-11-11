import models from '../../src/db/sequelize'
import type { NextApiRequest, NextApiResponse } from 'next'

export const findAll = async (req: NextApiRequest, res: NextApiResponse) => {
    
    try {
        const persons = await models.Person.findAll({
            order: [["personIdentifier", "ASC"]],
            limit: 20
        });

        res.send(persons);
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
};
