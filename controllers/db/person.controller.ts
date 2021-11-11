import models from '../../src/db/sequelize'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Sequelize, Op } from "sequelize"

export const findAll = async (req: NextApiRequest, res: NextApiResponse, offset: number, limit: number) => {
    
    try {
        const persons = await models.Person.findAll({
            order: [["personIdentifier", "ASC"]],
            offset: offset,
            limit: limit
        });

        res.send(persons);
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
};

export const findAllOrgUnits = async (req: NextApiRequest, res: NextApiResponse) => {
    
    try {
        const persons = await models.Person.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('primaryOrganizationalUnit')), 'primaryOrganizationalUnit']
            ],
            where: {
                [Op.and]: [
                    {
                        primaryOrganizationalUnit:  {
                            [Op.ne]: ''
                        }
                    },
                    {
                        primaryOrganizationalUnit: {
                            [Op.ne]: null
                        }
                    }
                ]
            }
        });

        res.send(persons);
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
};

export const findAllInstitutions = async (req: NextApiRequest, res: NextApiResponse) => {
    
    try {
        const persons = await models.Person.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('primaryInstitution')), 'primaryInstitution'],

            ],
            where: {
                [Op.and]: [
                    {
                        primaryInstitution:  {
                            [Op.ne]: ''
                        }
                    },
                    {
                        primaryInstitution: {
                            [Op.ne]: null
                        }
                    }
                ]
            }
        });

        res.send(persons);
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
};
