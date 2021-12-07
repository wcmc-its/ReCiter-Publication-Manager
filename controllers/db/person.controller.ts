import models from '../../src/db/sequelize'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Sequelize, Op } from "sequelize"

models.Person.hasOne(models.PersonPersonType)
models.PersonPersonType.hasMany(models.Person)

export const findAll = async (req: NextApiRequest, res: NextApiResponse, offset: number, limit: number) => {
    
    try {
        const persons = await models.Person.findAll({
            attributes: {
                include: [
                    [Sequelize.fn('GROUP_CONCAT', Sequelize.literal("PersonPersonType.personType SEPARATOR ','")), 'groupPersonTypes']
                ],
                exclude: [
                    'PersonPersonTypeId'
                ]
            },
            include: [
                {
                    model: models.PersonPersonType, required: false,
                    on: {
                        col: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('PersonPersonType.personIdentifier'))
                    },
                    attributes: []
                },
            ],
            order: [["personIdentifier", "ASC"]],
            group: ['id', 'personIdentifier', 'firstName', 'middleName', 'lastName', 'title', 'primaryOrganizationalUnit', 'primaryInstitution',
            'dateAdded', 'dateUpdated', 'precision', 'recall', 'countSuggestedArticles' , 'countPendingArticles', 'overallAccuracy', 'mode'],
            offset: offset,
            limit: limit
        });

        res.send(persons);
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
};

export const countPersons = async (req: NextApiRequest, res: NextApiResponse) => {
    
    try {
        const persons = await models.Person.findAll({
            attributes: [
                [Sequelize.fn('COUNT', Sequelize.col('personIdentifier')), 'countPersonIdentifier'],
            ]
        });

        res.send(persons[0]);
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
};

export const findAllOrgUnits = async (req: NextApiRequest, res: NextApiResponse) => {
    
    try {
        const persons = await models.Person.findAll({
            order: [["primaryOrganizationalUnit", "ASC"]],
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
            order: [["primaryInstitution", "ASC"]],
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
