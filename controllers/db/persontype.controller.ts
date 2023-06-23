import models from '../../src/db/sequelize'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Sequelize, Op } from "sequelize"

export const findAllPersonTypes = async (req: NextApiRequest, res: NextApiResponse) => {
    
    try {
        const personTypes = await models.PersonPersonType.findAll({
            order: [["personType", "ASC"]],
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('personType')), 'personType']
            ],
            where: {
                [Op.and]: [
                    {
                        personType:  {
                            [Op.ne]: ''
                        }
                    },
                    {
                        personType: {
                            [Op.ne]: null
                        }
                    }
                ]
            }
        });

        res.send(personTypes);
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
};