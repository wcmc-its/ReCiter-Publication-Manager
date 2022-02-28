import type { NextApiRequest, NextApiResponse } from 'next'
import { Op, Sequelize } from "sequelize"
import { Person } from '../../src/db/models/Person'
import models from '../../src/db/sequelize'
import { PersonApiBody } from '../../types/personapi.body'
import { findUserFeedback } from '../userfeedback.controller'

models.Person.hasMany(models.PersonPersonType, {constraints: false})
models.PersonPersonType.belongsTo(models.Person, {constraints: false})

export const findAll = async (req: NextApiRequest, res: NextApiResponse) => {
    
    try {
        let apiBody:PersonApiBody =  req.body
        const where = {}
        if(apiBody.filters) {
            if(apiBody.filters.personTypes || apiBody.filters.institutions || apiBody.filters.orgUnits || apiBody.filters.nameOrUids || apiBody.filters.showOnlyPending) {
                where[Op.and] = []
                if(apiBody.filters.nameOrUids && apiBody.filters.nameOrUids.length > 0) {
                    where[Op.and].push({[Op.or]:[
                        {'$Person.personIdentifier$': { [Op.in]: apiBody.filters.nameOrUids }},
                    ]})
                    if(where[Op.and][0][Op.or]) {
                        apiBody.filters.nameOrUids.forEach((name: string) => {
                            where[Op.and][0][Op.or].push({'$Person.firstName$': { [Op.like]: `%${name}%`}})
                            where[Op.and][0][Op.or].push({'$Person.middleName$': { [Op.like]: `%${name}%`}})
                            where[Op.and][0][Op.or].push({'$Person.lastName$': { [Op.like]: `%${name}%`}})
                        })
                     }
                }
                if(apiBody.filters.institutions) {
                    where[Op.and].push({'$Person.primaryInstitution$': { [Op.in]: apiBody.filters.institutions }})
                }
                if(apiBody.filters.orgUnits) {
                    where[Op.and].push({'$Person.primaryOrganizationalUnit$': { [Op.in]: apiBody.filters.orgUnits }})
                }
                if(apiBody.filters.showOnlyPending) {
                    where[Op.and].push({'$Person.countPendingArticles$': { [Op.gt]: 0 }})
                }
            }
        }
        let joinWhere = {}
        if(apiBody.filters && apiBody.filters.personTypes) {
            joinWhere = {
                personType: {
                    [Op.in]: apiBody.filters.personTypes
                }
            }
        }
        let persons: Person[] = []
        if(apiBody.limit != undefined && apiBody.offset != undefined) {
            persons = await models.Person.findAll({
                include: [
                    {
                        model: models.PersonPersonType, 
                        as: 'PersonPersonTypes',
                        required: true,
                        on: {
                            col: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        },
                        where: joinWhere,
                        attributes: [
                        ]
                        
                    },
                ],
                where: where,
                order: [["personIdentifier", "ASC"],["countPendingArticles", "DESC"]],
                offset: apiBody.offset,
                limit: apiBody.limit,
                subQuery: false
            });
        } else {
            persons = await models.Person.findAll({
                include: [
                    {
                        model: models.PersonPersonType, 
                        as: 'PersonPersonTypes',
                        required: true,
                        on: {
                            col: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        },
                        where: joinWhere,
                        attributes: [
                        ]
                        
                    },
                ],
                where: where,
                order: [["personIdentifier", "ASC"],["countPendingArticles", "DESC"]],
                subQuery: false
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
        const userfeedback = await findUserFeedback(uid)
        let totalPendingCount: number = 0
        if(userfeedback.statusCode && userfeedback.statusCode == 200) {
            if(feedback == "ACCEPTED" || feedback == "REJECTED") {
                if(userfeedback.statusCode && userfeedback.statusCode.rejectedPmids) {
                    totalPendingCount = totalPendingCount + userfeedback.statusCode.rejectedPmids.length
                }
                if(userfeedback.statusCode && userfeedback.statusCode.acceptedPmids) {
                    totalPendingCount = totalPendingCount + userfeedback.statusCode.acceptedPmids.length
                }
                const articleCountUpdate = await models.Person.increment({
                    countPendingArticles: -totalPendingCount
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
                    countPendingArticles: totalPendingCount
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
        }
    } catch (e) {
        console.log(e)
    }
};
