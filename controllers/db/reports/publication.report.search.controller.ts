import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize } from "sequelize";
import { AnalysisSummaryArticle } from "../../../src/db/models/init-models";
import models from "../../../src/db/sequelize";
import { PublicationSearchFilter } from "../../../types/publication.report.search";

models.AnalysisSummaryArticle.hasOne(models.Person, {constraints: false})
models.AnalysisSummaryArticle.hasMany(models.PersonPersonType, {constraints: false})
models.AnalysisSummaryArticle.hasOne(models.AnalysisSummaryAuthor, {constraints: false})
models.AnalysisSummaryAuthor.hasOne(models.AnalysisSummaryAuthor, {constraints: false})

export const publicationSearchWithFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let apiBody: PublicationSearchFilter = req.body;
    const where = {}
    if(apiBody && apiBody.filters) {
      where[Op.and] = []
      if(apiBody.filters.journalTitleVerbose && apiBody.filters.journalTitleVerbose.length > 0) {
        where[Op.and].push({'$AnalysisSummaryArticle.journalTitleVerbose$' : { [Op.in]: apiBody.filters.journalTitleVerbose}})
      }
      if(apiBody.filters.personIdentifers && apiBody.filters.personIdentifers.length > 0) {
        where[Op.and].push({'$AnalysisSummaryAuthor.personIdentifier$' : { [Op.in]: apiBody.filters.personIdentifers}})
      }
      if(apiBody.filters.authorPosition && apiBody.filters.authorPosition.length > 0) {
        where[Op.and].push({'$AnalysisSummaryAuthor.authorPosition$' : { [Op.in]: apiBody.filters.authorPosition}})
      }
      if(apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0) {
        where[Op.and].push({'$Person.primaryOrganizationalUnit$' : { [Op.in]: apiBody.filters.orgUnits}})
      }
      if(apiBody.filters.institutions && apiBody.filters.institutions.length > 0) {
        where[Op.and].push({'$Person.primaryInstitution$' : { [Op.in]: apiBody.filters.institutions}})
      }
      if(apiBody.filters.datePublicationAddedToEntrezLowerBound && apiBody.filters.datePublicationAddedToEntrezUpperBound) {
        where[Op.and].push({'$AnalysisSummaryArticle.datePublicationAddedToEntrez$' : { [Op.gt]: apiBody.filters.datePublicationAddedToEntrezLowerBound}})
        where[Op.and].push({'$AnalysisSummaryArticle.datePublicationAddedToEntrez$' : { [Op.lt]: apiBody.filters.datePublicationAddedToEntrezUpperBound}})
      }
      if(apiBody.filters.publicationTypeCanonical && apiBody.filters.publicationTypeCanonical.length > 0) {
        where[Op.and].push({'$AnalysisSummaryArticle.publicationTypeCanonical$' : { [Op.in]: apiBody.filters.publicationTypeCanonical}})
      }
      if(apiBody.filters.journalImpactScoreLowerBound && apiBody.filters.journalImpactScoreUpperBound) {
        where[Op.and].push({'$AnalysisSummaryArticle.journalImpactScore1$' : { [Op.gt]: apiBody.filters.journalImpactScoreLowerBound}})
        where[Op.and].push({'$AnalysisSummaryArticle.journalImpactScore1$' : { [Op.lt]: apiBody.filters.journalImpactScoreUpperBound}})
      }
      if(apiBody.filters.personTypes && apiBody.filters.personTypes.length > 0) {
        where[Op.and].push({'$PersonPersonTypes.personType$' : { [Op.in]: apiBody.filters.personTypes}})
      }
    }
    let searchOutput: {count?: number, rows?: AnalysisSummaryArticle[]} = {}
    if(apiBody.limit !=undefined && apiBody.offset != undefined) {
      searchOutput = await models.AnalysisSummaryArticle.findAndCountAll({
      include: [
        {
          model: models.AnalysisSummaryAuthor, 
          as: 'AnalysisSummaryAuthor',
          required: true,
          on: {
              col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.pmid'), "=", Sequelize.col('AnalysisSummaryArticle.pmid'))
          },
          attributes: [
          ]
          
      },
        {
            model: models.Person, 
            as: 'Person',
            required: true,
            on: {
                col: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('AnalysisSummaryAuthor.personIdentifier'))
            },
            attributes: [
            ]
            
        },
        {
          model: models.PersonPersonType, 
          as: 'PersonPersonTypes',
          required: true,
          on: {
              col: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
          },
          attributes: [
          ]
          
      },
    ],
      where: where,
      subQuery: false,
      limit: apiBody.limit,
      offset: apiBody.offset
    })
  } else {
    searchOutput = await models.AnalysisSummaryArticle.findAndCountAll({
      include: [
        {
          model: models.AnalysisSummaryAuthor, 
          as: 'AnalysisSummaryAuthor',
          required: true,
          on: {
              col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.pmid'), "=", Sequelize.col('AnalysisSummaryArticle.pmid'))
          },
          attributes: [
          ]
          
      },
        {
            model: models.Person, 
            as: 'Person',
            required: true,
            on: {
                col: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('AnalysisSummaryAuthor.personIdentifier'))
            },
            attributes: [
            ]
            
        },
        {
          model: models.PersonPersonType, 
          as: 'PersonPersonTypes',
          required: true,
          on: {
              col: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
          },
          attributes: [
          ]
          
      },
    ],
      where: where,
      subQuery: false
    })
  }
    return searchOutput;
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};
