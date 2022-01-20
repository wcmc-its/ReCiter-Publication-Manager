import models from '../../src/db/sequelize'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Sequelize, Op } from "sequelize"
import { Person } from '../../src/db/models/Person'

models.Person.hasOne(models.PersonPersonType)
models.PersonPersonType.hasMany(models.Person)

export const findAll = async (req: NextApiRequest, res: NextApiResponse, offset: string, limit: string) => {
    
    try {
        let persons: Person[] = []
        if(offset && limit) {
            persons = await models.Person.findAll({
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
                offset: Number.parseInt(offset),
                limit: Number.parseInt(limit)
            });
        } else {
            persons = await models.Person.findAll({
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
                'dateAdded', 'dateUpdated', 'precision', 'recall', 'countSuggestedArticles' , 'countPendingArticles', 'overallAccuracy', 'mode']
            });
        }
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


export const findOnePerson = async (uid: string) => {
    
    try {
        const person = await models.Person.findOne({
            where: {
                personIdentifier: uid
            },
            attributes: ["id", "personIdentifier", "firstName", "middleName", "lastName", "title"]
        });
        return person
    } catch (e) {
        console.log(e)
    }
    
};

export const updatePendingArticleCount = async (uid: string, feedback: string) => {
    try {
        if(feedback == "ACCEPTED" || feedback == "REJECTED") {
            const articleCountUpdate = await models.Person.increment({
                countPendingArticles: -1
                }, 
                {
                    where: {
                        personIdentifier: uid,
                        countPendingArticles: {
                            [Op.gt]: 0
                        } 

                    }
            })
            console.log('countPendingArticles decreased(ACCEPTED || REJECTED) in person table for uid ' + uid + ' by ' + articleCountUpdate)
        } else {
            const articleCountUpdate = await models.Person.increment({
                countPendingArticles: 1
                }, 
                {
                    where: {
                        personIdentifier: uid,
                        countPendingArticles: {
                            [Op.gt]: 0
                        }
                    }
            })
            console.log('countPendingArticles inreased(NULL) in person table for uid ' + uid + ' by ' + articleCountUpdate)
        }

    } catch (e) {
        console.log(e)
    }
};
