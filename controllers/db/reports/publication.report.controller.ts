import type { NextApiRequest, NextApiResponse } from "next";
import sequelize from "../../../src/db/db";
import { GeneratePubsApiBody, GeneratePubsPeopleOnlyApiBody } from "../../../types/publication.report.body";
import { PublicationSearchFilter} from '../../../types/publication.report.search';
import { Op, Sequelize } from "sequelize";
import {metrics } from "../../../config/report";
		
						 
					 
											
import models from "../../../src/db/sequelize";
import path from 'path';
import fsPromises from 'fs/promises';

models.AnalysisSummaryAuthor.hasOne(models.Person, { constraints: false });
models.AnalysisSummaryAuthor.hasMany(models.PersonPersonType, {
  constraints: false,
});
models.AnalysisSummaryAuthor.hasOne(models.AnalysisSummaryArticle, {
  constraints: false,
});
models.AnalysisSummaryArticle.hasOne(models.AnalysisSummaryAuthor, {
  constraints: false,
});

export const generatePubsRtf = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let apiBody: GeneratePubsApiBody = JSON.parse(req.body);
    let generatePubsRtfOutput: any = [];
								
    if (apiBody.personIdentifiers && apiBody.personIdentifiers.length > 0) {
      generatePubsRtfOutput = await sequelize.query(
        "CALL generatePubsRTF (:uids , :pmids, :limit)",
        {
          replacements: { uids: apiBody.personIdentifiers.join(','), pmids: apiBody.pmids.join(','), limit: apiBody.limit },
          raw: true,
        }
      );
    } else {

																	   
      generatePubsRtfOutput = await sequelize.query(
        "CALL generatePubsNoPeopleRTF ( :pmids, :limit)",
        {
          replacements: { pmids: apiBody.pmids.join(','), limit: apiBody.limit },
          raw: true,
        }
      );
    }
    
    return Array.isArray(generatePubsRtfOutput) &&
      generatePubsRtfOutput.length > 0
      ? generatePubsRtfOutput[0].x
      : "Error creating the file";
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const generatePubsPeopleOnlyRtf = async (
    req: NextApiRequest,
    res: NextApiResponse
  ) => {
    try {
      let apiBody: GeneratePubsPeopleOnlyApiBody = JSON.parse(req.body);
      const generatePubsPeopleOnlyRtfOutput: any = await sequelize.query(
        "CALL generatePubsPeopleOnlyRTF (:uids, :limit)",
        {
          replacements: { uids: apiBody.personIdentifiers?apiBody.personIdentifiers.join(','):'', limit: apiBody.limit },
          raw: true,
        }
      );
      return Array.isArray(generatePubsPeopleOnlyRtfOutput) &&
      generatePubsPeopleOnlyRtfOutput.length > 0
        ? generatePubsPeopleOnlyRtfOutput[0].x
        : "Error creating the file";
    } catch (e) {
      console.log(e);
      res.status(500).send(e);
    }
  };

  export const generateAuthorshipReportCSV = async (
    req: NextApiRequest,
    res: NextApiResponse
  ) => {
    try {
      let apiBody: PublicationSearchFilter = req.body;
      const where = {};
      const joinOrgWhere ={};
								   
      let isPersonTypeFilter = false;



      if (apiBody.filters) {
        where[Op.and] = [];
        joinOrgWhere[Op.or] =[];
        if (
          apiBody.filters.journalTitleVerbose &&
          apiBody.filters.journalTitleVerbose.length > 0
        ) {
          where[Op.and].push({
            "$AnalysisSummaryArticle.journalTitleVerbose$": {
              [Op.in]: apiBody.filters.journalTitleVerbose,
            },
          });
        }
        if (
          apiBody.filters.personIdentifers &&
          apiBody.filters.personIdentifers.length > 0
        ) {
								 
          where[Op.and].push({
            "$AnalysisSummaryAuthor.personIdentifier$": {
              [Op.in]: apiBody.filters.personIdentifers,
            },
          });
        }
        if (
          apiBody.filters.authorPosition &&
          apiBody.filters.authorPosition.length > 0
        ) {
								 
          where[Op.and].push({
            "$AnalysisSummaryAuthor.authorPosition$": {
              [Op.in]: apiBody.filters.authorPosition,
            },
          });
        }
        if (apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0) {
								 
          joinOrgWhere[Op.or].push({
            "$Person.primaryOrganizationalUnit$": {
              [Op.in]: apiBody.filters.orgUnits,
            },
          });
        
          apiBody.filters.orgUnits.forEach((orgName: string) => {
            joinOrgWhere[Op.or].push(({[Op.or]:[{'$Person.primaryOrganizationalUnit$': { [Op.like]: `%${orgName}%`}},
            {'$Person.primaryOrganizationalUnit$': { [Op.like]: `%(${orgName})%`}}]}))
          });

          where[Op.and].push(joinOrgWhere);
        }

        if (
          apiBody.filters.institutions &&
          apiBody.filters.institutions.length > 0
        ) {
								 
          where[Op.and].push({
            "$Person.primaryInstitution$": {
              [Op.in]: apiBody.filters.institutions,
            },
          });
        }
        if (apiBody.filters.datePublicationAddedToEntrezLowerBound) 
         {
								  
          where[Op.and].push({
            "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
              [Op.gt]: apiBody.filters.datePublicationAddedToEntrezLowerBound,
            },
          });
        }
        if (apiBody.filters.datePublicationAddedToEntrezUpperBound)
         {
								  
          where[Op.and].push({
            "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
              [Op.lt]: apiBody.filters.datePublicationAddedToEntrezUpperBound,
            },
          });
        }
        if (
          apiBody.filters.publicationTypeCanonical &&
          apiBody.filters.publicationTypeCanonical.length > 0
        ) {
								  
          where[Op.and].push({
            "$AnalysisSummaryArticle.publicationTypeCanonical$": {
              [Op.in]: apiBody.filters.publicationTypeCanonical,
            },
          });
        }
        if (
          apiBody.filters.journalImpactScoreLowerBound 
        ) {
								  
          where[Op.and].push({
            "$AnalysisSummaryArticle.journalImpactScore1$": {
              [Op.gt]: apiBody.filters.journalImpactScoreLowerBound,
            },
          });
        }
        if(apiBody.filters.journalImpactScoreUpperBound)  
        {
          where[Op.and].push({
            "$AnalysisSummaryArticle.journalImpactScore1$": {
              [Op.lt]: apiBody.filters.journalImpactScoreUpperBound,
            },
          });
        }
        if (
          apiBody.filters.personTypes &&
          apiBody.filters.personTypes.length > 0
        ) {
          // No need to add personTypes for the export as they are expecting all the personType should be included in excel
         /*  where[Op.and].push({
             "$PersonPersonTypes.personType$": {
               [Op.in]: apiBody.filters.personTypes,
             },
          });*/
          isPersonTypeFilter = true;
        }
        where[Op.and].push({
          "$AnalysisSummaryAuthor.personIdentifier$": {
            [Op.ne]: '',
          },
        });

      }
      const sort = [];
      if (apiBody && apiBody.sort) {
        let sortType = apiBody.sort.type;
        let sortOrder = apiBody.sort.order ? apiBody.sort.order.toUpperCase() : "DESC"; 
        if (sortType === 'datePublicationAddedToEntrez')
          sort.push([Sequelize.literal('isnull(datePublicationAddedToEntrez), datePublicationAddedToEntrez '+sortOrder)]) 
  
        if (sortType === 'citationCountNIH')
          sort.push([Sequelize.literal('isnull(citationCountNIH), citationCountNIH '+sortOrder)])

        if (sortType === 'journalImpactScore1')
          sort.push([Sequelize.literal('isnull(journalImpactScore1), journalImpactScore1 '+sortOrder)])
  
        if (sortType === 'percentileNIH') 
          sort.push([Sequelize.literal('isnull(percentileNIH), percentileNIH '+sortOrder)])
  
        if (sortType === 'publicationDateStandarized')
          sort.push([Sequelize.literal('isnull(publicationDateStandarized), publicationDateStandarized '+sortOrder)])
  
        if (sortType === 'readersMendeley') 
          sort.push([Sequelize.literal('isnull(readersMendeley), readersMendeley '+sortOrder)])
        if (sortType === 'trendingPubsScore')
          sort.push([Sequelize.literal('isnull(trendingPubsScore), trendingPubsScore '+sortOrder)])
      }
      let articleLevelMetrics = Object.keys(metrics.article).filter(metric => metrics.article[metric]);
      let searchOutput: any[] = [];

      searchOutput = await models.AnalysisSummaryAuthor.findAll({
        include: [
          {
            model: models.AnalysisSummaryArticle,
            as: "AnalysisSummaryArticle",
            required: true,
            on: {
              col: Sequelize.where(
                Sequelize.col("AnalysisSummaryArticle.pmid"),
                "=",
                Sequelize.col("AnalysisSummaryAuthor.pmid")
              ),
            },
            attributes: [
              "pmid",
              "articleTitle",
              "pmcid",
              "articleYear",
              "publicationDateDisplay",
              "publicationDateStandardized",
              "datePublicationAddedToEntrez",
              "journalTitleVerbose",
              "issue",
              "pages",
              "volume",
              [Sequelize.literal('CASE WHEN  doi !=""  THEN concat("https://dx.doi.org/",doi) ELSE "" END'), 'doi'],
              ...articleLevelMetrics
            ],
          },
          {
            model: models.Person,
            as: "Person",
            required: true,
            on: {
              col: Sequelize.where(
                Sequelize.col("Person.personIdentifier"),
                "=",
                Sequelize.col("AnalysisSummaryAuthor.personIdentifier")
              )
            },
            attributes: ["firstName", "lastName", "primaryOrganizationalUnit", "primaryInstitution", "personIdentifier"]
          },
          {
            model: models.PersonPersonType,
            as: "PersonPersonTypes",
            required: isPersonTypeFilter,
            on: {
              col1: Sequelize.where(
                Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                "=",
                Sequelize.col("PersonPersonTypes.personIdentifier"),
              ),
              col2: Sequelize.where(
                Sequelize.col("Person.personIdentifier"),
                "=",
                Sequelize.col("PersonPersonTypes.personIdentifier"),
              ),
            },
            attributes: [[Sequelize.fn("GROUP_CONCAT", Sequelize.col('PersonPersonTypes.personType')),"personType",]],
          }
        ],
        where: where,
        group: ["AnalysisSummaryAuthor.pmid", "AnalysisSummaryAuthor.personIdentifier"],
        having:(apiBody.filters.personTypes && apiBody.filters.personTypes.toString()!='' && apiBody.filters.personTypes.toString()!='undefined')?Sequelize.fn("FIND_IN_SET",`${apiBody.filters.personTypes}`, Sequelize.literal("`PersonPersonTypes.personType`")):null,
        order:sort,
        subQuery: false,
        attributes: ["authors","authorPosition"],
        limit : apiBody.limit
      })
      return searchOutput;
    } catch (e) {
      console.log(e);
      res.status(500).send(e);
    }
  };

  export const generateArticleReportCSV = async (
    req: NextApiRequest,
    res: NextApiResponse
  ) => {
    try {
      let apiBody: PublicationSearchFilter = req.body;
      const where = {};
      const joinOrgWhere ={};
      let isPersonFilterOn = false;
      if (apiBody.filters) {
        where[Op.and] = [];
        joinOrgWhere[Op.or] =[]; 

        if (
          apiBody.filters.journalTitleVerbose &&
          apiBody.filters.journalTitleVerbose.length > 0
        ) {
          where[Op.and].push({
            "$AnalysisSummaryArticle.journalTitleVerbose$": {
              [Op.in]: apiBody.filters.journalTitleVerbose,
            },
          });
        }
        if (
          apiBody.filters.personIdentifers &&
          apiBody.filters.personIdentifers.length > 0
        ) {
          where[Op.and].push({
            "$AnalysisSummaryAuthor.personIdentifier$": {
              [Op.in]: apiBody.filters.personIdentifers,
            },
          });
        }
        if (
          apiBody.filters.authorPosition &&
          apiBody.filters.authorPosition.length > 0
        ) {
          where[Op.and].push({
            "$AnalysisSummaryAuthor.authorPosition$": {
              [Op.in]: apiBody.filters.authorPosition,
            },
          });
        }
        if (apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0) {
          joinOrgWhere[Op.or].push({
            "$Person.primaryOrganizationalUnit$": {
              [Op.in]: apiBody.filters.orgUnits,
            },
          });
        
          apiBody.filters.orgUnits.forEach((orgName: string) => {
            joinOrgWhere[Op.or].push(({[Op.or]:[{'$Person.primaryOrganizationalUnit$': { [Op.like]: `%${orgName}%`}},
            {'$Person.primaryOrganizationalUnit$': { [Op.like]: `%(${orgName})%`}}]}))
          });
          where[Op.and].push(joinOrgWhere)
        }

        if (
          apiBody.filters.institutions &&
          apiBody.filters.institutions.length > 0
        ) {
          where[Op.and].push({
            "$Person.primaryInstitution$": {
              [Op.in]: apiBody.filters.institutions,
            },
          });
        }
        if (
          apiBody.filters.datePublicationAddedToEntrezLowerBound &&
          apiBody.filters.datePublicationAddedToEntrezUpperBound
        ) {
          where[Op.and].push({
            "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
              [Op.gt]: apiBody.filters.datePublicationAddedToEntrezLowerBound,
            },
          });
          where[Op.and].push({
            "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
              [Op.lt]: apiBody.filters.datePublicationAddedToEntrezUpperBound,
            },
          });
        }
        else if(apiBody.filters.datePublicationAddedToEntrezLowerBound )
          {
            where[Op.and].push({
              "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
                [Op.gt]: apiBody.filters.datePublicationAddedToEntrezLowerBound,
              },
            });
          }
          else if(apiBody.filters.datePublicationAddedToEntrezUpperBound )
          {
            where[Op.and].push({
              "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
                [Op.gt]: apiBody.filters.datePublicationAddedToEntrezUpperBound,
              },
            });
          }  

        if (
          apiBody.filters.publicationTypeCanonical &&
          apiBody.filters.publicationTypeCanonical.length > 0
        ) {
          where[Op.and].push({
            "$AnalysisSummaryArticle.publicationTypeCanonical$": {
              [Op.in]: apiBody.filters.publicationTypeCanonical,
            },
          });
        }
        if (
          apiBody.filters.journalImpactScoreLowerBound &&
          apiBody.filters.journalImpactScoreUpperBound
        ) {
          where[Op.and].push({
            "$AnalysisSummaryArticle.journalImpactScore1$": {
              [Op.gt]: apiBody.filters.journalImpactScoreLowerBound,
            },
          });
          where[Op.and].push({
            "$AnalysisSummaryArticle.journalImpactScore1$": {
              [Op.lt]: apiBody.filters.journalImpactScoreUpperBound,
            },
          });
        }
        if (
          apiBody.filters.personTypes &&
          apiBody.filters.personTypes.length > 0
        ) {
          where[Op.and].push({
            "$PersonPersonTypes.personType$": {
              [Op.in]: apiBody.filters.personTypes,
            },
          });
          isPersonFilterOn = true;
        }
      }
      const sort = [];
      if (apiBody && apiBody.sort) {
        let sortType = apiBody.sort.type;
        let sortOrder = apiBody.sort.order ? apiBody.sort.order.toUpperCase() : "DESC"; 
        if (sortType === 'datePublicationAddedToEntrez') 
          sort.push([Sequelize.literal('isnull(datePublicationAddedToEntrez), datePublicationAddedToEntrez '+sortOrder)])    
  
        if (sortType === 'citationCountNIH')
          sort.push([Sequelize.literal('isnull(citationCountNIH), citationCountNIH '+sortOrder)]) 
  
        if (sortType === 'journalImpactScore1')
          sort.push([Sequelize.literal('isnull(journalImpactScore1), journalImpactScore1 '+sortOrder)])
  
        if (sortType === 'percentileNIH') 
          sort.push([Sequelize.literal('isnull(percentileNIH), percentileNIH '+sortOrder)])
  
        if (sortType === 'publicationDateStandarized')
          sort.push([Sequelize.literal('isnull(publicationDateStandarized), publicationDateStandarized '+sortOrder)])
  
        if (sortType === 'readersMendeley') 
          sort.push([Sequelize.literal('isnull(readersMendeley), readersMendeley '+sortOrder)])
  
        if (sortType === 'trendingPubsScore')
          sort.push([Sequelize.literal('isnull(trendingPubsScore), trendingPubsScore '+sortOrder)])
      }
      let articleLevelMetrics = Object.keys(metrics.article).filter(metric => metrics.article[metric]);
										 
      let searchOutput: any[] = [];
      if(isPersonFilterOn)
      {
        
        searchOutput = await models.AnalysisSummaryAuthor.findAll({
          include: [
            {
              model: models.AnalysisSummaryArticle,
              as: "AnalysisSummaryArticle",
              required: true,
              on: {
                col: Sequelize.where(
                  Sequelize.col("AnalysisSummaryArticle.pmid"),
                  "=",
                  Sequelize.col("AnalysisSummaryAuthor.pmid")
                ),
              },
              attributes: [
                "pmid",
                "articleTitle",
                "pmcid",
                "articleYear",
                "publicationDateDisplay",
                "publicationDateStandardized",
                "datePublicationAddedToEntrez",
                "journalTitleVerbose",
                "issue",
                "pages",
                "volume",
                [Sequelize.literal('CASE WHEN  doi !=""  THEN concat("https://dx.doi.org/",doi) ELSE "" END'), 'doi'],
                ...articleLevelMetrics
              ],
            },
            {
              model: models.Person,
              as: "Person",
              required: true,
              on: {
                col: Sequelize.where(
                  Sequelize.col("Person.personIdentifier"),
                  "=",
                  Sequelize.col("AnalysisSummaryAuthor.personIdentifier")
                )
              },
              attributes: []
            },
            {
              model: models.PersonPersonType,
              as: "PersonPersonTypes",
              required: true,
              on: {
                col1: Sequelize.where(
                  Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                  "=",
                  Sequelize.col("PersonPersonTypes.personIdentifier"),
                ),
                col2: Sequelize.where(
                  Sequelize.col("Person.personIdentifier"),
                  "=",
                  Sequelize.col("PersonPersonTypes.personIdentifier"),
                ),
              },
              attributes: ["personType"]
            }
          ],
          where: where,
          group: ["AnalysisSummaryAuthor.pmid"],
          order: sort,
          subQuery: false,
          attributes: ["authors","authorPosition"],
          limit : apiBody.limit
        })
      }
      else
      {
        searchOutput = await models.AnalysisSummaryAuthor.findAll({
          include: [
            {
              model: models.AnalysisSummaryArticle,
              as: "AnalysisSummaryArticle",
              required: true,
              on: {
                col: Sequelize.where(
                  Sequelize.col("AnalysisSummaryArticle.pmid"),
                  "=",
                  Sequelize.col("AnalysisSummaryAuthor.pmid")
                ),
              },
              attributes: [
                "pmid",
                "articleTitle",
                "pmcid",
                "articleYear",
                "publicationDateDisplay",
                "publicationDateStandardized",
                "datePublicationAddedToEntrez",
                "journalTitleVerbose",
                "issue",
                "pages",
                "volume",
              [Sequelize.literal('CASE WHEN  doi !=""  THEN concat("https://dx.doi.org/",doi) ELSE "" END'), 'doi'],
                ...articleLevelMetrics
              ],
            },
            {
              model: models.Person,
              as: "Person",
              required: true,
              on: {
                col: Sequelize.where(
                  Sequelize.col("Person.personIdentifier"),
                  "=",
                  Sequelize.col("AnalysisSummaryAuthor.personIdentifier")
                )
              },
              attributes: []
            },
            {
              model: models.PersonPersonType,
              as: "PersonPersonTypes",
              required: false,
              on: {
                col1: Sequelize.where(
                  Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                  "=",
                  Sequelize.col("PersonPersonTypes.personIdentifier"),
                ),
                col2: Sequelize.where(
                  Sequelize.col("Person.personIdentifier"),
                  "=",
                  Sequelize.col("PersonPersonTypes.personIdentifier"),
                ),
              },
              attributes: ["personType"]
            }

          ],
          where: where,
          group: ["AnalysisSummaryAuthor.pmid"],
          order: sort,
          subQuery: false,
          attributes: ["authors","authorPosition"],
          limit : apiBody.limit,
          benchmark :true
        })
      }
      return searchOutput;
    } catch (e) {
      console.log(e);
      res.status(500).send(e);
    }
  };

  export const generatePersonArticleReportCSV = async (
    req: NextApiRequest,
    res: NextApiResponse
  ) => {
    try {
      let apiBody: any = req.body;
      const where = {};
					  
      if (apiBody?.personIdentifiers && apiBody.personIdentifiers.length > 0) {
        where[Op.and] = [];
        where[Op.and].push({
          "$AnalysisSummaryAuthor.personIdentifier$": {
            [Op.in]: apiBody.personIdentifiers,
          },
        });
      }
											
      let articleLevelMetrics = Object.keys(metrics.article).filter(metric => metrics.article[metric]);
										 
      let searchOutput: any[] = [];
      searchOutput = await models.AnalysisSummaryAuthor.findAll({
        include: [
          {
            model: models.AnalysisSummaryArticle,
            as: "AnalysisSummaryArticle",
            required: true,
            on: {
              col: Sequelize.where(
                Sequelize.col("AnalysisSummaryArticle.pmid"),
                "=",
                Sequelize.col("AnalysisSummaryAuthor.pmid")
              ),
            },
            attributes: [
              "pmid",
              "articleTitle",
              "pmcid",
              "articleYear",
              "publicationDateDisplay",
              "publicationDateStandardized",
              "datePublicationAddedToEntrez",
              "journalTitleVerbose",
              "issue",
              "pages",
              "volume",
              [Sequelize.literal('CASE WHEN  doi !=""  THEN concat("https://dx.doi.org/",doi) ELSE "" END'), 'doi'],
              ...articleLevelMetrics
            ],
          },
          {
            model: models.Person,
            as: "Person",
            required: true,
            on: {
              col: Sequelize.where(
                Sequelize.col("Person.personIdentifier"),
                "=",
                Sequelize.col("AnalysisSummaryAuthor.personIdentifier")
              )
            },
            attributes: []
          },
          {
            model: models.PersonPersonType,
            as: "PersonPersonTypes",
            required: false,
            on: {
              col1: Sequelize.where(
                Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                "=",
                Sequelize.col("PersonPersonTypes.personIdentifier"),
              ),
              col2: Sequelize.where(
                Sequelize.col("Person.personIdentifier"),
                "=",
                Sequelize.col("PersonPersonTypes.personIdentifier"),
              ),
            },
            attributes: ["personType"]
          }
        ],
        where: where,
        group: ["AnalysisSummaryAuthor.pmid"],
        order: [],
        subQuery: false,
        attributes: ["authors","authorPosition"],
        limit : apiBody.limit,
        benchmark :true
      })
      return searchOutput;
    } catch (e) {
      console.log(e);
      res.status(500).send(e);
    }
  };