import type { NextApiRequest, NextApiResponse } from 'next'
import { Op, Sequelize, literal } from "sequelize"
import models from '../../src/db/sequelize'
import { PersonApiBody } from '../../types/personapi.body'
import  {reciterConstants}  from "../../src/utils/constants";

models.Person.hasMany(models.PersonPersonType, {constraints: false})
models.PersonPersonType.belongsTo(models.Person, {constraints: false})

export const findAll  = async (req: NextApiRequest, res: NextApiResponse) => {
    
    try {
        let apiBody:PersonApiBody =  req.body

        // Curator_Scoped's personType/orgUnit scope, sent by Search.js's "Show only people I
        // can curate" checkbox (checked by default for scoped curators). Combined with an
        // explicit personTypes/orgUnits facet filter by intersection -- not a second join --
        // so a scoped curator narrowing by facet never sees people outside their scope, and a
        // facet that shares nothing with scope correctly returns zero rows rather than being
        // ignored.
        const scopePersonTypes: Array<string> = Array.isArray(apiBody.filters?.scopePersonTypes) ? apiBody.filters.scopePersonTypes : []
        const scopeOrgUnits: Array<string> = Array.isArray(apiBody.filters?.scopeOrgUnits) ? apiBody.filters.scopeOrgUnits : []
        const effectivePersonTypes = scopePersonTypes.length > 0
            ? (apiBody.filters?.personTypes && apiBody.filters.personTypes.length > 0
                ? apiBody.filters.personTypes.filter((pt) => scopePersonTypes.includes(pt))
                : scopePersonTypes)
            : apiBody.filters?.personTypes
        const effectiveOrgUnits = scopeOrgUnits.length > 0
            ? (apiBody.filters?.orgUnits && apiBody.filters.orgUnits.length > 0
                ? apiBody.filters.orgUnits.filter((ou) => scopeOrgUnits.includes(ou))
                : scopeOrgUnits)
            : apiBody.filters?.orgUnits

        const where = {}
        if(apiBody.filters) {
            if(effectivePersonTypes || apiBody.filters.institutions || effectiveOrgUnits || apiBody.filters.nameOrUids || apiBody.filters.showOnlyPending) {
                where[Op.and] = []
                if(apiBody.filters.nameOrUids && apiBody.filters.nameOrUids.length > reciterConstants.nameCWIDSpaceCountThreshold) {
                    where[Op.and].push({[Op.or]:[
                        {'$Person.personIdentifier$': { [Op.in]: apiBody.filters.nameOrUids }},
                    ]})
                
                }
                else if(where[Op.and] && apiBody.filters.nameOrUids && apiBody.filters.nameOrUids.length <= reciterConstants.nameCWIDSpaceCountThreshold) {
                    // ponytail: OR an exact-CWID IN against the existing AND-of-names, so 2-3 pasted CWIDs match (#886).
                    // Strictly additive: name search keeps the same AND semantics, exact-CWID rows are only added.
                    where[Op.and].push({[Op.or]:[
                        {'$Person.personIdentifier$': { [Op.in]: apiBody.filters.nameOrUids }},
                        {[Op.and]: apiBody.filters.nameOrUids.map((name: string) => ({[Op.or]:[
                            {'$Person.firstName$': { [Op.like]: `%${name}%`}},
                            {'$Person.middleName$': { [Op.like]: `%${name}%`}},
                            {'$Person.lastName$': { [Op.like]: `%${name}%`}},
                            {'$Person.personIdentifier$': { [Op.like]: `%${name}%`}}]}))},
                    ]})
                     }
               // }
                if(apiBody.filters.institutions) {
                    where[Op.and].push({'$Person.primaryInstitution$': { [Op.in]: apiBody.filters.institutions }})
                }
                if(effectiveOrgUnits) {
                    where[Op.and].push({'$Person.primaryOrganizationalUnit$': { [Op.in]: effectiveOrgUnits }})
                }
                if(apiBody.filters.showOnlyPending) {
                    where[Op.and].push({'$Person.countPendingArticles$': { [Op.gt]: 0 }})
                }
                
            }
        }
        let joinWhere = {}
        if(apiBody.filters && effectivePersonTypes) {
            joinWhere = {
                personType: {
                    [Op.in]: effectivePersonTypes
                }
            }
        }

        var users= {};


        if(effectivePersonTypes) {
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

// countPendingArticles is fully recomputed by the nightly reciterdb rebuild (source of truth);
// this only tracks the between-runs delta from a curator's own accept/reject/log so the badge
// doesn't go stale until the next rebuild. If the badge is ever seen to drift, the fix is a
// recompute here, not a smarter delta (ponytail: delta not recompute).
export const updatePendingArticleCount = async (uid: string, feedback: string, count = 1) => {

    try {
        const n = Math.max(0, Math.trunc(Number(count) || 0))
        if (n === 0) return
        if(feedback == "ACCEPTED" || feedback == "REJECTED") {
            await models.Person.update({
                countPendingArticles: literal("GREATEST(countPendingArticles - " + n + ", 0)")
                },
                {
                    where: {
                        personIdentifier: uid
                    }
            })
        } else {
            await models.Person.update({
                countPendingArticles: literal("GREATEST(countPendingArticles + " + n + ", 0)")
                },
                {
                    where: {
                        personIdentifier: uid
                    }
            })
        }
    } catch (e) {
        console.log(e)
    }
};
