import type { NextApiRequest, NextApiResponse } from 'next'
import { Op, Sequelize } from "sequelize"
import { Person } from '../../src/db/models/Person'
import models from '../../src/db/sequelize'
import { PersonApiBody } from '../../types/personapi.body'
import { findUserFeedback } from '../userfeedback.controller'
import  {reciterConstants}  from "../../src/utils/constants";

models.Person.hasMany(models.PersonPersonType, {constraints: false})
models.PersonPersonType.belongsTo(models.Person, {constraints: false})

export const findAll  = async (req: NextApiRequest, res: NextApiResponse) => {
    
    try {
        let apiBody:PersonApiBody =  req.body
        const where = {}
        if(apiBody.filters) {
            if(apiBody.filters.personTypes || apiBody.filters.institutions || apiBody.filters.orgUnits || apiBody.filters.nameOrUids || apiBody.filters.showOnlyPending) {
                where[Op.and] = []
                if(apiBody.filters.nameOrUids && apiBody.filters.nameOrUids.length > reciterConstants.nameCWIDSpaceCountThreshold) {
                    where[Op.and].push({[Op.or]:[
                        {'$Person.personIdentifier$': { [Op.in]: apiBody.filters.nameOrUids }},
                    ]})
                
                }
                else if(where[Op.and] && apiBody.filters.nameOrUids && apiBody.filters.nameOrUids.length <= reciterConstants.nameCWIDSpaceCountThreshold) {
                    apiBody.filters.nameOrUids.forEach((name: string) => {
                            where[Op.and].push({[Op.or]:[{'$Person.firstName$': { [Op.like]: `%${name}%`}},
                          {'$Person.middleName$': { [Op.like]: `%${name}%`}},
                            {'$Person.lastName$': { [Op.like]: `%${name}%`}},
                            {'$Person.personIdentifier$': { [Op.like]: `%${name}%`}}]})
                        })
                     }
               // }
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

            // When proxyPersonIds are provided, combine scope+proxy with OR logic
            if (apiBody.filters?.proxyPersonIds && apiBody.filters.proxyPersonIds.length > 0) {
                // Collect any existing scope conditions that were applied
                const existingConditions = where[Op.and] ? [...where[Op.and]] : [];

                if (existingConditions.length > 0) {
                    // Replace the AND conditions with: (scope AND conditions) OR (personIdentifier IN proxyPersonIds)
                    where[Op.and] = [{
                        [Op.or]: [
                            { [Op.and]: existingConditions },
                            { personIdentifier: { [Op.in]: apiBody.filters.proxyPersonIds } }
                        ]
                    }];
                } else {
                    // No scope conditions -- just filter to proxy persons
                    where[Op.and] = where[Op.and] || [];
                    where[Op.and].push({
                        personIdentifier: { [Op.in]: apiBody.filters.proxyPersonIds }
                    });
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

        var users= {};


        if(apiBody.filters?.personTypes) {
            const { count,rows } =  await models.Person.findAndCountAll({
                attributes: ['id','personIdentifier','firstName','middleName','lastName','title','primaryOrganizationalUnit','primaryInstitution','dateAdded',
                'dateUpdated','precision','recall','countSuggestedArticles','countPendingArticles','overallAccuracy','mode','primaryEmail'],
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
                group: ["personIdentifier"],
                order: [["personIdentifier", "ASC"],["countPendingArticles", "DESC"]],
                offset: apiBody.offset,
                limit: apiBody.limit,
                subQuery: false
            });
            users['persons'] = rows;
            users['totalPersonsCount'] = count;
            
        } else if (apiBody.includeScopeData) {
            // Include PersonPersonTypes for scope checking on client side
            const { count,rows } =  await models.Person.findAndCountAll({
                attributes: ['id','personIdentifier','firstName','middleName','lastName','title','primaryOrganizationalUnit','primaryInstitution','dateAdded',
                'dateUpdated','precision','recall','countSuggestedArticles','countPendingArticles','overallAccuracy','mode','primaryEmail'],
                include: [
                    {
                        model: models.PersonPersonType,
                        as: 'PersonPersonTypes',
                        required: false,
                        on: {
                            col: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        },
                        attributes: ['personType']
                    },
                ],
                where: where,
                group: ["personIdentifier"],
                order: [["personIdentifier", "ASC"],["countPendingArticles", "DESC"]],
                offset: apiBody.offset,
                limit: apiBody.limit,
                subQuery: false
            });
            users['persons'] = rows;
            users['totalPersonsCount'] = count;

        } else {
            let { count,rows } =  await models.Person.findAndCountAll({
                attributes: ['id','personIdentifier','firstName','middleName','lastName','title','primaryOrganizationalUnit','primaryInstitution','dateAdded',
                'dateUpdated','precision','recall','countSuggestedArticles','countPendingArticles','overallAccuracy','mode','primaryEmail'],
                where: where,
                group: ["personIdentifier"],
                order: [["personIdentifier", "ASC"],["countPendingArticles", "DESC"]],
                offset: apiBody.offset,
                limit: apiBody.limit,
                subQuery: false
            });
            users['persons'] = rows;
            users['totalPersonsCount'] = count;

        }
        res.send(users);
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


/**
 * Get a person's org unit and person types for scope checking.
 * Lightweight query used by API-level scope enforcement.
 */
export const getPersonWithTypes = async (uid: string) => {
    try {
        const person = await models.Person.findOne({
            where: { personIdentifier: uid },
            attributes: ["personIdentifier", "primaryOrganizationalUnit"],
        });
        if (!person) return null;

        const personTypes = await models.PersonPersonType.findAll({
            where: { personIdentifier: uid },
            attributes: ["personType"],
        });

        return {
            personIdentifier: person.personIdentifier,
            primaryOrganizationalUnit: person.primaryOrganizationalUnit,
            personTypes: personTypes.map((pt: any) => pt.personType),
        };
    } catch (e) {
        console.log('[AUTH] ERROR: getPersonWithTypes failed for', uid, e);
        return null;
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
            }
        }
    } catch (e) {
        console.log(e)
    }
};
