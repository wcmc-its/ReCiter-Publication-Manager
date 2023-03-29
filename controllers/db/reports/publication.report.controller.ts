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
        "CALL generatePubsRTF (:uids , :pmids)",
        {
          replacements: { uids: apiBody.personIdentifiers.join(','), pmids: apiBody.pmids.join(',') },
          raw: true,
        }
      );
    } else {

      generatePubsRtfOutput = await sequelize.query(
        "CALL generatePubsNoPeopleRTF ( :pmids)",
        {
          replacements: { pmids: apiBody.pmids.join(',') },
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
        "CALL generatePubsPeopleOnlyRTF (:uids)",
        {
          replacements: { uids: apiBody.personIdentifiers?apiBody.personIdentifiers.join(','):'' },
          raw: true,
        }
      );
      console.log(generatePubsPeopleOnlyRtfOutput)
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
      let isPersonTypeFilter = false;

      const filePath = path.join(process.cwd(), './tempData/pmidcwidDataFile.json');
        const fileContent = await fsPromises.readFile(filePath);
        const pmidJSONObject = JSON.parse(fileContent.toString());
  
        let filteredPersonIdentifiers:any = [ ...pmidJSONObject.personIdentifierList ] 

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
        where: {
          personIdentifier: {
            [Op.in]: filteredPersonIdentifiers
          }
        },
        group: ["AnalysisSummaryAuthor.pmid", "AnalysisSummaryAuthor.personIdentifier"],
        order:sort,
        subQuery: false,
        attributes: [],
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
     
      let isPersonFilterOn = false;
    
      const filePath = path.join(process.cwd(), './tempData/pmidcwidDataFile.json');
        const fileContent = await fsPromises.readFile(filePath);
        const pmidJSONObject = JSON.parse(fileContent.toString());
      

        let filteredPmids:any = [ ...new Set(pmidJSONObject.pmidList) ] 
        
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
      console.log('sort criteria for Article export **********************',sort)
      let articleLevelMetrics = Object.keys(metrics.article).filter(metric => metrics.article[metric]);
      let searchOutput: any[] = [];
      console.log('personType selected',isPersonFilterOn);
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
          where: {
            pmid: {
              [Op.in]: filteredPmids
            }
          },
          group: ["AnalysisSummaryAuthor.pmid"],
          order: sort,
          subQuery: false,
          attributes: [],
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
          where: {
            pmid: {
              [Op.in]: filteredPmids
            }
          },
          group: ["AnalysisSummaryAuthor.pmid"],
          order: sort,
          subQuery: false,
          attributes: [],
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
        attributes: [],
        limit : apiBody.limit,
        benchmark :true
      })
      return searchOutput;
    } catch (e) {
      console.log(e);
      res.status(500).send(e);
    }
  };