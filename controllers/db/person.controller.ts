import type { NextApiRequest, NextApiResponse } from 'next'
import { Op, Sequelize } from "sequelize"
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
            if(apiBody.filters.personTypes || apiBody.filters.institutions || apiBody.filters.orgUnits || apiBody.filters.nameOrUids || apiBody.filters.showOnlyPending
                || apiBody.filters.scopeOrgUnits || apiBody.filters.scopePersonTypes) {
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

                // Phase 9: Scope filtering (D-11 through D-14)
                // When scope filters are present, restrict to persons matching scope OR in proxy list
                if (apiBody.filters.scopeOrgUnits && apiBody.filters.scopeOrgUnits.length > 0) {
                    const scopeConditions: any[] = [
                        { '$Person.primaryOrganizationalUnit$': { [Op.in]: apiBody.filters.scopeOrgUnits } }
                    ];
                    // D-13: Proxy persons always visible even with scope filter
                    if (apiBody.filters.proxyPersonIds && apiBody.filters.proxyPersonIds.length > 0) {
                        scopeConditions.push(
                            { '$Person.personIdentifier$': { [Op.in]: apiBody.filters.proxyPersonIds } }
                        );
                    }
                    where[Op.and].push({ [Op.or]: scopeConditions });
                }

            }
        }
        let joinWhere = {}
        // Flag to track whether we need the PersonPersonType JOIN
        let needsPersonTypeJoin = false;
        if(apiBody.filters && apiBody.filters.personTypes) {
            joinWhere = {
                personType: {
                    [Op.in]: apiBody.filters.personTypes
                }
            }
            needsPersonTypeJoin = true;
        }
        // Phase 9: scopePersonTypes filter -- uses PersonPersonType join when not already filtering by personTypes
        // When proxyPersonIds are present, the JOIN becomes a left join so proxy persons are not excluded
        let scopePersonTypeJoinRequired = true;
        if (apiBody.filters && apiBody.filters.scopePersonTypes && apiBody.filters.scopePersonTypes.length > 0 && !apiBody.filters.personTypes) {
            joinWhere = {
                personType: {
                    [Op.in]: apiBody.filters.scopePersonTypes
                }
            }
            needsPersonTypeJoin = true;
            // When proxy persons are present, use left join so they are not excluded by person type filter
            if (apiBody.filters.proxyPersonIds && apiBody.filters.proxyPersonIds.length > 0) {
                scopePersonTypeJoinRequired = false;
            }
        }

        var users= {};


        if(needsPersonTypeJoin) {
            const { count,rows } =  await models.Person.findAndCountAll({
                attributes: ['id','personIdentifier','firstName','middleName','lastName','title','primaryOrganizationalUnit','primaryInstitution','dateAdded',
                'dateUpdated','precision','recall','countSuggestedArticles','countPendingArticles','overallAccuracy','mode','primaryEmail'],
                include: [
                    {
                        model: models.PersonPersonType,
                        as: 'PersonPersonTypes',
                        required: scopePersonTypeJoinRequired,
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


export const findOnePerson = async (attrTypes: string[], attrValues: string[]  ) => {
    
    if (!Array.isArray(attrTypes) || !Array.isArray(attrValues)) {
        throw new Error('Both attrTypes and attrValues must be arrays');
      }
    
      if (attrTypes.length !== attrValues.length) {
        throw new Error('attrTypes and attrValues must be the same length');
      }
    
      const allowedFields = ['personIdentifier', 'primaryEmail'];
      const whereConditions: any[] = [];
    
      attrTypes.forEach((field, i) => {
        if (!allowedFields.includes(field)) return;
    
        const value = attrValues[i];
        if (value != null) {
          whereConditions.push({ [field]: value });
        }
      });
    
      if (whereConditions.length === 0) return null;
    
      const person = await models.Person.findOne({
        where: {
          [Op.or]: whereConditions,
        },
        attributes: ['id', 'personIdentifier', 'firstName', 'middleName', 'lastName', 'title'],
      });
      return person ; 
    
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
