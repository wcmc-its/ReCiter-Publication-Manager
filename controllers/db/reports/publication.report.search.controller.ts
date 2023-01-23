import { PermIdentity } from "@mui/icons-material";
import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize } from "sequelize";
import sequelize from "../../../src/db/db";
import {
  AnalysisSummaryArticle,
  PersonArticleAuthor,
  AnalysisSummaryAuthorList
} from "../../../src/db/models/init-models";
import models from "../../../src/db/sequelize";
import {
  PublicationAuthorSearchFilter,
  PublicationSearchFilter
} from "../../../types/publication.report.search";

models.AnalysisSummaryArticle.hasOne(models.Person, { constraints: false, foreignKey: 'AnalysisSummaryArticleId' });
models.AnalysisSummaryArticle.hasMany(models.PersonPersonType, {
  constraints: false,
  foreignKey: 'AnalysisSummaryArticleId'  
});
models.AnalysisSummaryArticle.hasOne(models.AnalysisSummaryAuthor, {
  constraints: false,
  foreignKey: 'AnalysisSummaryArticleId'
});

export const publicationSearchWithFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let apiBody: PublicationSearchFilter = req.body;
    
    const where = {};
    const whereForOnlyAuthors = {};
    const whereForOnlyArticles = {};

    let joinWherePersonTypes = {};
    let joinWhereAuthorsFilters ={};
    let joinWherePersonIdentifiers = {};
    
    var isAuthorFilter = false;
    var isArticleFilter = false;
    var isPersonTypeFilter = false;
    var isOrgORInstitues = false;
    var isPersonIdentifiers = false;

  
    if (apiBody.filters) {
      where[Op.and] = [];
      whereForOnlyAuthors [Op.and] = [];
      whereForOnlyArticles [Op.and] = [];
      joinWhereAuthorsFilters [Op.and] = [];
      joinWherePersonTypes [Op.and] = [];

      if (
        apiBody.filters.journalTitleVerbose &&
        apiBody.filters.journalTitleVerbose.length > 0
      ) {
        where[Op.and].push({
          "$AnalysisSummaryArticle.journalTitleVerbose$": {
            [Op.in]: apiBody.filters.journalTitleVerbose,
          },
        });
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.journalTitleVerbose$": {
            [Op.in]: apiBody.filters.journalTitleVerbose,
          },
        });
        isArticleFilter = true;
      }
      if (
        apiBody.filters.personIdentifers &&
        apiBody.filters.personIdentifers.length > 0
      ) {
        isOrgORInstitues = true;
        where[Op.and].push({
          "$AnalysisSummaryAuthor.personIdentifier$": {
            [Op.in]: apiBody.filters.personIdentifers,
          },
        });
        whereForOnlyAuthors[Op.and].push({
          "$AnalysisSummaryAuthor.personIdentifier$": {
            [Op.in]: apiBody.filters.personIdentifers,
          },
        });
        joinWherePersonIdentifiers = {
          personIdentifier: {
              [Op.in]: apiBody.filters.personIdentifers
          }
        }
        joinWhereAuthorsFilters[Op.and].push({
          "$AnalysisSummaryAuthor.personIdentifier$": {
            [Op.in]: apiBody.filters.personIdentifers,
          },
        });
        isAuthorFilter = true;
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
        whereForOnlyAuthors[Op.and].push({
          "$AnalysisSummaryAuthor.authorPosition$": {
            [Op.in]: apiBody.filters.authorPosition,
          },
        });

        joinWhereAuthorsFilters[Op.and].push({
          "$AnalysisSummaryAuthor.authorPosition$": {
            [Op.in]: apiBody.filters.authorPosition,
          },
        });

        joinWherePersonIdentifiers = {
          autauthorPositionhor: {
              [Op.in]: apiBody.filters.personIdentifers
          }
        }

        isAuthorFilter = true;
      }
      if (apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0) {
        where[Op.and].push({
          "$Person.primaryOrganizationalUnit$": {
            [Op.in]: apiBody.filters.orgUnits,
          },
        });
        whereForOnlyAuthors[Op.and].push({
          "$Person.primaryOrganizationalUnit$": {
            [Op.in]: apiBody.filters.orgUnits,
          },
        });

        joinWhereAuthorsFilters[Op.and].push({
          "$Person.primaryOrganizationalUnit$": {
            [Op.in]: apiBody.filters.orgUnits,
          },
        });
        isAuthorFilter = true;
        isOrgORInstitues = true;

      }
      if (
        apiBody.filters.institutions &&
        apiBody.filters.institutions.length > 0
      ) {

        isOrgORInstitues = true;
        where[Op.and].push({
          "$Person.primaryInstitution$": {
            [Op.in]: apiBody.filters.institutions,
          },
        });

        whereForOnlyAuthors[Op.and].push({
          "$Person.primaryInstitution$": {
            [Op.in]: apiBody.filters.institutions,
          },
        });

        joinWhereAuthorsFilters[Op.and].push({
          "$Person.primaryInstitution$": {
            [Op.in]: apiBody.filters.institutions,
          },
        });
        isAuthorFilter = true;
      }
      if (apiBody.filters.datePublicationAddedToEntrezLowerBound)
       {
        where[Op.and].push({
          "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
            [Op.gt]: apiBody.filters.datePublicationAddedToEntrezLowerBound,
          },
        });

        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
            [Op.gt]: apiBody.filters.datePublicationAddedToEntrezLowerBound,
          },
        });
        isArticleFilter = true;
      }
      if (apiBody.filters.datePublicationAddedToEntrezUpperBound)
       { 
        where[Op.and].push({
          "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
            [Op.lt]: apiBody.filters.datePublicationAddedToEntrezUpperBound,
          },
        });

        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
            [Op.lt]: apiBody.filters.datePublicationAddedToEntrezUpperBound,
          },
        });

        isArticleFilter = true;
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
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.publicationTypeCanonical$": {
            [Op.in]: apiBody.filters.publicationTypeCanonical,
          },
        });
        isArticleFilter = true;
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
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore1$": {
            [Op.lt]: apiBody.filters.journalImpactScoreUpperBound,
          },
        });
        isArticleFilter = true;
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
        whereForOnlyAuthors[Op.and].push({
          "$PersonPersonTypes.personType$": {
            [Op.in]: apiBody.filters.personTypes,
          },
        });

        joinWherePersonTypes[Op.and].push({
          "$PersonPersonType.personType$": {
            [Op.in]: apiBody.filters.personTypes,
          },
        });
        
        // if personType is not a separate:true
        joinWhereAuthorsFilters[Op.and].push({
          "$PersonPersonTypes.personType$": {
            [Op.in]: apiBody.filters.personTypes,
          },
        });

        isAuthorFilter = true;
        isPersonTypeFilter =true;
      }
    }
	
    const sort = [];
    if (apiBody && apiBody.sort) {
      console.log("apiBody.sort********************", apiBody.sort)
      let sortType = apiBody.sort.type;
      let sortOrder = apiBody.sort.order ? apiBody.sort.order.toUpperCase() : "DESC"; 
      if (sortType === 'datePublicationAddedToEntrez')
        sort.push(["datePublicationAddedToEntrez",sortOrder]);

      if (sortType === 'citationCountNIH')
        sort.push(["citationCountNIH", sortOrder]);

      if (sortType === 'journalImpactScore1')
        sort.push(["journalImpactScore1", sortOrder]);

      if (sortType === 'percentileNIH') 
        sort.push(["percentileNIH", sortOrder]);

      if (sortType === 'publicationDateStandarized')
        sort.push(["publicationDateStandarized", sortOrder]);

      if (sortType === 'readersMendeley') 
        sort.push(["readersMendeley", sortOrder]);

      if (sortType === 'trendingPubsScore')
        sort.push(["trendingPubsScore", sortOrder]);
    }
    else
    {
      sort.push(["datePublicationAddedToEntrez","DESC"]);
    }
	
    let searchOutput: { count?: number; rows?: AnalysisSummaryArticle[] } = {};
    let results:any  =[];
    let authorsResults:any = [];

    if (isAuthorFilter || isArticleFilter) {
      if(isAuthorFilter && !isArticleFilter)
      { // Filter Only with Authors and not Articles
            models.AnalysisSummaryAuthor.hasOne(models.Person, { constraints: false, foreignKey: 'personIdentifier' });
           // models.Person.belongsTo(models.AnalysisSummaryAuthor);
            models.AnalysisSummaryAuthor.hasMany(models.PersonPersonType, {constraints: false, foreignKey: 'personIdentifier' }); 
           // models.PersonPersonType.belongsTo(models.AnalysisSummaryAuthor);
           models.Person.hasMany(models.PersonPersonType, {constraints: false, foreignKey: 'personIdentifier' });
            if(isPersonTypeFilter){ // When author filters present and including PersonType
              if( !isOrgORInstitues){
                authorsResults = await models.AnalysisSummaryAuthor.findAndCountAll({ 
                  attributes: ["personIdentifier", "pmid"],
                  distinct:true,
                  col:'pmid',
                  include: [
                    {
                      model: models.PersonPersonType,
                      as: "PersonPersonTypes",
                      required: true,
                      // separate : true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        // col2: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        },
                      // where : joinWherePersonTypes,
                      attributes: {exclude:[`AnalysisSummaryArticleId`,`PersonId`,`AnalysisSummaryAuthorId`]},
                    },
                  ],
                  where: whereForOnlyAuthors,
                  subQuery: false,
                  limit: apiBody.limit,
                  // group: ["AnalysisSummaryAuthor.pmid"],
                  offset: apiBody.offset,
                  benchmark: true
                });
              } else{

                authorsResults = await models.AnalysisSummaryAuthor.findAndCountAll({ 
                  attributes: ["personIdentifier", "pmid"],
                  distinct:true,
                  col:'pmid',
                  include: [
                    {
                      model: models.Person,
                      as: "Person",
                      required: true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('Person.personIdentifier'))
                        },
                      // where : joinWhereAuthorsFilters,
                      attributes: [],
                    },
                    {
                      model: models.PersonPersonType,
                      as: "PersonPersonTypes",
                      required: true,
                      // separate : true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        // col2: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        },
                      // where : joinWherePersonTypes,
                      attributes: [`personIdentifier`],
                    },
                  ],
                  where: joinWhereAuthorsFilters,
                  subQuery: false,
                  limit: apiBody.limit,
                  offset: apiBody.offset,
                  benchmark: true
                });
              }
              
            }
            else  { // When author filters present and no PersonType
        
                authorsResults = await models.AnalysisSummaryAuthor.findAndCountAll({ // review commnet:Change this to findAll
                  attributes: ["personIdentifier", "pmid"],
                  distinct:true,
                  col:'pmid',
                  include: [
                    {
                      model: models.Person,
                      as: "Person",
                      required: true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('Person.personIdentifier'))
                        },
                      // where : joinWhereAuthorsFilters,
                      attributes: [],
                    }
                  ],
                  where: joinWhereAuthorsFilters,
                  subQuery: false,
                  limit: apiBody.limit,
                  offset: apiBody.offset,
                  benchmark: true
                });
              }
      }else if(!isAuthorFilter && isArticleFilter){   // Filter Only with Articles and not Authors
 //       console.log('coming into else block from anchor navigation*********************************')
        results = await models.AnalysisSummaryArticle.findAndCountAll({
          where: whereForOnlyArticles,
          subQuery: false,
          limit: apiBody.limit,
          offset: apiBody.offset,
          order: sort,
         // group: ["AnalysisSummaryArticle.pmid"], // This grouping is not required as we need only count of records statisfies criteria
          distinct: true,
          // attributes: {exclude: ['AnalysisSummaryArticleId']},
          attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
          col:'pmid',
          benchmark: true
        });
      }else if(isAuthorFilter && isArticleFilter){ // Filter with Authors and Articles
        if(isPersonTypeFilter){ // When author filters present and including PersonType
          if( !isOrgORInstitues){
            results = await models.AnalysisSummaryArticle.findAndCountAll({ 
              include: [
                {
                  model: models.AnalysisSummaryAuthor,
                  as: "AnalysisSummaryAuthor",
                  required: true,
                  on: {
                    col: Sequelize.where(
                      Sequelize.col("AnalysisSummaryAuthor.pmid"),
                      "=",
                      Sequelize.col("AnalysisSummaryArticle.pmid")
                    ),
                  },
                  attributes: [],
                },
                {
                  model: models.PersonPersonType,
                  as: "PersonPersonTypes",
                  required: true,
                  // separate : true,
                  on: {
                   /* col1: Sequelize.where( // review commnet: this condition is not required. remove this and tell me what impacts if you remove this
                      Sequelize.col("AnalysisSummaryAuthor.personIdentifier"), 
                      "=",
                      Sequelize.col("PersonPersonTypes.personIdentifier"),
                    ),*/
                    col1: Sequelize.where( 
                      Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                      // Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                      "=",
                      Sequelize.col("PersonPersonTypes.personIdentifier"),
                    ),
                  },
                  attributes:[]
                  // where: joinWherePersonTypes,
                  //  attributes: {exclude:['AnalysisSummaryArticle.AnalysisSummaryArticleId','PersonPersonTypes.PersonId']},
                  // attributes: ["personIdentifier","personType", ], // there is no AnalysisSummaryArticleId in table but y its showing this ?
                },
              ],
              where: where,
              subQuery: false,
              limit: apiBody.limit,
              offset: apiBody.offset,
              order: sort,
             // group: ["AnalysisSummaryAuthor.pmid"],
              // attributes: { exclude: ["AnalysisSummaryAuthorId"]},
              attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
              col: 'pmid',
              distinct : true,
              benchmark: true
            });
          } else{
            results = await models.AnalysisSummaryArticle.findAndCountAll({ 
              include: [
                {
                  model: models.AnalysisSummaryAuthor,
                  as: "AnalysisSummaryAuthor",
                  required: true,
                  on: {
                    col: Sequelize.where(
                      Sequelize.col("AnalysisSummaryAuthor.pmid"),
                      "=",
                      Sequelize.col("AnalysisSummaryArticle.pmid")
                    ),
                  },
                  attributes: [],
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
                    ),
                  },
                  attributes: [],
                },
                {
                  model: models.PersonPersonType,
                  as: "PersonPersonTypes",
                  required: true,
                  // separate : true,
                  on: {
                   /* col1: Sequelize.where( // review commnet: this condition is not required. remove this and tell me what impacts if you remove this
                      Sequelize.col("AnalysisSummaryAuthor.personIdentifier"), 
                      "=",
                      Sequelize.col("PersonPersonTypes.personIdentifier"),
                    ),*/
                    col1: Sequelize.where( 
                      Sequelize.col("Person.personIdentifier"),
                      // Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                      "=",
                      Sequelize.col("PersonPersonTypes.personIdentifier"),
                    ),
                  },
                  attributes:[]
                },
              ],
              where: where,
              subQuery: false,
              limit: apiBody.limit,
              offset: apiBody.offset,
              order: sort,
              group: ["AnalysisSummaryAuthor.pmid"],
              // attributes: { exclude: ["AnalysisSummaryAuthorId"]},
              attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
              col:'pmid',
              distinct: true,
              benchmark: true
            });
          }
        }else{
          results = await models.AnalysisSummaryArticle.findAndCountAll({ 
            include: [
              {
                model: models.AnalysisSummaryAuthor,
                as: "AnalysisSummaryAuthor",
                required: true,
                on: {
                  col: Sequelize.where(
                    Sequelize.col("AnalysisSummaryAuthor.pmid"),
                    "=",
                    Sequelize.col("AnalysisSummaryArticle.pmid")
                  ),
                },
                attributes: [],
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
                  ),
                },
                attributes: [],
              },
            ],
            where: where,
            subQuery: false,
            limit: apiBody.limit,
            offset: apiBody.offset,
            order: sort,
            group: ["AnalysisSummaryAuthor.pmid"],
            // attributes: { exclude: ["AnalysisSummaryAuthorId"]},
            attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
            benchmark: true
          });
        }
      }

      if (isAuthorFilter && !isArticleFilter) {
        //  preparing PMIDS from filtered data
        let pmidList = [];
        authorsResults?.rows?.map((rowData) => {
          pmidList.push(rowData?.dataValues?.pmid)
        })
        let articleResults ={};
        if(pmidList && pmidList.length > 0)
        {
            console.log('Fecthing more information about articles**************************');
            // Get additional data about articles by PMIDS 
             articleResults = await models.AnalysisSummaryArticle.findAll({ // review commnet: change this to findAll and send only attributes being displayed on UI with attributes
              where: { pmid: pmidList },
              subQuery: false,
              limit: apiBody.limit,
              offset: apiBody.offset,
              order:sort,
              attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
              benchmark:true
            });
        }
       // console.log('articleresults before**************************',JSON.stringify(articleResults));
        let articlesDetails:any =[];
        if(Object.keys(articleResults).length > 0 )
        {
          articlesDetails['rows'] = articleResults; 
        }
        else
        {
        articlesDetails['rows'] = [];
        }
       // articleResults = JSON.stringify(articleResults);
        searchOutput = {
          ... articlesDetails,
          count: authorsResults?.count
        }
      } else if(!isAuthorFilter && isArticleFilter) {
        searchOutput = {
          ...results,
          count: results?.count
        }
      }else if(isAuthorFilter && isArticleFilter){
        searchOutput = {
          ...results,
          count: results?.count.length
        }
      }
    } else {
      searchOutput = await models.AnalysisSummaryArticle.findAndCountAll({
        where: Sequelize.where(
          Sequelize.fn(
            "DATEDIFF",
            Sequelize.literal("CURRENT_DATE"),
            Sequelize.fn(
              "STR_TO_DATE",
              Sequelize.col("datePublicationAddedToEntrez"),
              "%Y-%m-%d"
            )
          ),
          {
            [Op.lte]: 30,
          },
        ),
        limit: apiBody.limit,
        offset: apiBody.offset,
        distinct : true,
        order: sort,
        // attributes: { exclude: ['AnalysisSummaryAuthorId']},
        attributes: [`id`,`pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
        col:'pmid',
        benchmark: true
      });
    }
    return searchOutput;
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const publicationAuthorSearchWithFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let apiBody: PublicationAuthorSearchFilter = req.body;
    const where = {};
    if (apiBody && apiBody.pmids && apiBody.pmids.length > 0) {
      where[Op.and] = [];
      where[Op.and].push({
        "$AnalysisSummaryAuthorList.pmid$": {
          [Op.in]: apiBody.pmids,
        },
      });
      if (apiBody.personIdentifers && apiBody.personIdentifers.length > 0) {
        where[Op.and].push({
          "$AnalysisSummaryAuthorList.personIdentifier$": {
            [Op.in]: apiBody.personIdentifers,
          },
        });
      }
    }
    let searchOutput: any[] = [];
    searchOutput = await models.AnalysisSummaryAuthorList.findAll({
      attributes: [
        "pmid",
        ["authorFirstName", "firstName"],
        ["authorLastName", "lastName"],
        "personIdentifier",
        "rank",
      ],
      where: where,
      group: ["pmid", "rank"],
      order: [["pmid", "ASC"],["rank", "ASC"]],
      benchmark: true,
    }).then((output) => {
      const authors = output.reduce((authors, result) => {
        if (!authors[result.pmid]) {
          authors[result.pmid] = [result];
        } else {
          authors[result.pmid].push(result);
        }
        return authors
      }, {});
      const result = Object.keys(authors).map((pmid) => {
        return {
          pmid: pmid,
          authors: authors[pmid],
        }
      })
      return result;
    });
    return searchOutput;
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const publicationSearchWithFilterPmids = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let apiBody: PublicationSearchFilter = req.body;
    const where = {};
    const whereForOnlyAuthors = {};
    const whereForOnlyArticles = {};
    let finalSearchOutput: any  = [];

    let joinWherePersonTypes = {};
    let joinWhereAuthorsFilters ={};
    let joinWherePersonIdentifiers = {};
    
    var isAuthorFilter = false;
    var isArticleFilter = false;
    var isPersonTypeFilter = false;
    var isOrgORInstitues = false;
  
    if (apiBody.filters) {
      where[Op.and] = [];
      whereForOnlyAuthors [Op.and] = [];
      whereForOnlyArticles [Op.and] = [];
      joinWhereAuthorsFilters [Op.and] = [];
      joinWherePersonTypes [Op.and] = [];

      if (
        apiBody.filters.journalTitleVerbose &&
        apiBody.filters.journalTitleVerbose.length > 0
      ) {
        where[Op.and].push({
          "$AnalysisSummaryArticle.journalTitleVerbose$": {
            [Op.in]: apiBody.filters.journalTitleVerbose,
          },
        });
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.journalTitleVerbose$": {
            [Op.in]: apiBody.filters.journalTitleVerbose,
          },
        });
        isArticleFilter = true;
      }
      if (
        apiBody.filters.personIdentifers &&
        apiBody.filters.personIdentifers.length > 0
      ) {
        isOrgORInstitues = true;

        where[Op.and].push({
          "$AnalysisSummaryAuthor.personIdentifier$": {
            [Op.in]: apiBody.filters.personIdentifers,
          },
        });
        whereForOnlyAuthors[Op.and].push({
          "$AnalysisSummaryAuthor.personIdentifier$": {
            [Op.in]: apiBody.filters.personIdentifers,
          },
        });
        joinWherePersonIdentifiers = {
          personIdentifier: {
              [Op.in]: apiBody.filters.personIdentifers
          }
        }
        joinWhereAuthorsFilters[Op.and].push({
          "$AnalysisSummaryAuthor.personIdentifier$": {
            [Op.in]: apiBody.filters.personIdentifers,
          },
        });
        isAuthorFilter = true;

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
        whereForOnlyAuthors[Op.and].push({
          "$AnalysisSummaryAuthor.authorPosition$": {
            [Op.in]: apiBody.filters.authorPosition,
          },
        });

        joinWhereAuthorsFilters[Op.and].push({
          "$AnalysisSummaryAuthor.authorPosition$": {
            [Op.in]: apiBody.filters.authorPosition,
          },
        });

        joinWherePersonIdentifiers = {
          autauthorPositionhor: {
              [Op.in]: apiBody.filters.personIdentifers
          }
        }

        isAuthorFilter = true;
      }
      if (apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0) {
        where[Op.and].push({
          "$Person.primaryOrganizationalUnit$": {
            [Op.in]: apiBody.filters.orgUnits,
          },
        });
        whereForOnlyAuthors[Op.and].push({
          "$Person.primaryOrganizationalUnit$": {
            [Op.in]: apiBody.filters.orgUnits,
          },
        });

        joinWhereAuthorsFilters[Op.and].push({
          "$Person.primaryOrganizationalUnit$": {
            [Op.in]: apiBody.filters.orgUnits,
          },
        });
        isAuthorFilter = true;
        isOrgORInstitues = true;

      }
      if (
        apiBody.filters.institutions &&
        apiBody.filters.institutions.length > 0
      ) {

        isOrgORInstitues = true;
        where[Op.and].push({
          "$Person.primaryInstitution$": {
            [Op.in]: apiBody.filters.institutions,
          },
        });

        whereForOnlyAuthors[Op.and].push({
          "$Person.primaryInstitution$": {
            [Op.in]: apiBody.filters.institutions,
          },
        });

        joinWhereAuthorsFilters[Op.and].push({
          "$Person.primaryInstitution$": {
            [Op.in]: apiBody.filters.institutions,
          },
        });
        isAuthorFilter = true;
      }
      if (apiBody.filters.datePublicationAddedToEntrezLowerBound)
       {
        where[Op.and].push({
          "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
            [Op.gt]: apiBody.filters.datePublicationAddedToEntrezLowerBound,
          },
        });

        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
            [Op.gt]: apiBody.filters.datePublicationAddedToEntrezLowerBound,
          },
        });
        isArticleFilter = true;
      }
      if (apiBody.filters.datePublicationAddedToEntrezUpperBound)
       { 
        where[Op.and].push({
          "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
            [Op.lt]: apiBody.filters.datePublicationAddedToEntrezUpperBound,
          },
        });

        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.datePublicationAddedToEntrez$": {
            [Op.lt]: apiBody.filters.datePublicationAddedToEntrezUpperBound,
          },
        });

        isArticleFilter = true;
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
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.publicationTypeCanonical$": {
            [Op.in]: apiBody.filters.publicationTypeCanonical,
          },
        });
        isArticleFilter = true;
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
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore1$": {
            [Op.lt]: apiBody.filters.journalImpactScoreUpperBound,
          },
        });
        isArticleFilter = true;
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
        whereForOnlyAuthors[Op.and].push({
          "$PersonPersonTypes.personType$": {
            [Op.in]: apiBody.filters.personTypes,
          },
        });

        joinWherePersonTypes[Op.and].push({
          "$PersonPersonType.personType$": {
            [Op.in]: apiBody.filters.personTypes,
          },
        });

        isAuthorFilter = true;
        isPersonTypeFilter =true;
      }
    }
	
    const sort = [];
    if (apiBody && apiBody.sort) {
      let sortType = apiBody.sort.type;
      let sortOrder = apiBody.sort.order ? apiBody.sort.order.toUpperCase() : "DESC"; 
      if (sortType === 'datePublicationAddedToEntrez')
        sort.push(["datePublicationAddedToEntrez",sortOrder]);

      if (sortType === 'citationCountNIH')
        sort.push(["citationCountNIH", sortOrder]);

      if (sortType === 'journalImpactScore1')
        sort.push(["journalImpactScore1", sortOrder]);

      if (sortType === 'percentileNIH') 
        sort.push(["percentileNIH", sortOrder]);

      if (sortType === 'publicationDateStandarized')
        sort.push(["publicationDateStandarized", sortOrder]);

      if (sortType === 'readersMendeley') 
        sort.push(["readersMendeley", sortOrder]);

      if (sortType === 'trendingPubsScore')
        sort.push(["trendingPubsScore", sortOrder]);
    }
    else
    {
      sort.push(["datePublicationAddedToEntrez","DESC"]);
    }
	
    let searchOutput: { count?: number; rows?: AnalysisSummaryArticle[] } = {};
    let results:any  =[];
    let authorsResults:any = [];

    if (isAuthorFilter || isArticleFilter) {
      if(isAuthorFilter && !isArticleFilter)
      { // Filter Only with Authors and not Articles
            models.AnalysisSummaryAuthor.hasOne(models.Person, { constraints: false, foreignKey: 'personIdentifier' });
           // models.Person.belongsTo(models.AnalysisSummaryAuthor);
            models.AnalysisSummaryAuthor.hasMany(models.PersonPersonType, {constraints: false, foreignKey: 'personIdentifier' }); 
           // models.PersonPersonType.belongsTo(models.AnalysisSummaryAuthor);

            if(isPersonTypeFilter){ // When author filters present and including PersonType
              if( !isOrgORInstitues){
                results = await models.AnalysisSummaryAuthor.findAndCountAll({ 
                  attributes: ["personIdentifier", "pmid"],
                  distinct:true,
                  col:'pmid',
                  include: [
                    {
                      model: models.PersonPersonType,
                      as: "PersonPersonTypes",
                      required: true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        // col2: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        },
                      // where : joinWherePersonTypes,
                      attributes: {exclude:[`AnalysisSummaryArticleId`,`PersonId`,`AnalysisSummaryAuthorId`]},
                    },
                  ],
                  where: whereForOnlyAuthors,
                  subQuery: false,
                  // group:["AnalysisSummaryAuthor.pmid", "AnalysisSummaryAuthor.personIdentifier"],
                  // limit: apiBody.limit,
                  // offset: apiBody.offset,
                  benchmark: true
                });

              } else{
                results = await models.AnalysisSummaryAuthor.findAndCountAll({ 
                  attributes: ["personIdentifier", "pmid"],
                  distinct:true,
                  col:'pmid',
                  include: [
                    {
                      model: models.Person,
                      as: "Person",
                      required: true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('Person.personIdentifier'))
                        },
                      // where : joinWhereAuthorsFilters,
                      attributes: [],
                    },
                    {
                      model: models.PersonPersonType,
                      as: "PersonPersonTypes",
                      required: true,
                      // separate : true,
                      on: {
                        col1: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier')),
                        col2: Sequelize.where(Sequelize.col('Person.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        },
                      // where : joinWherePersonTypes,
                      attributes: [`personIdentifier`],
                    },
                  ],
                  where: joinWhereAuthorsFilters,
                  subQuery: false,
                  // limit: apiBody.limit,
                  // offset: apiBody.offset,
                  benchmark: true
                });
              }
            }
            else  { // When author filters present and no PersonType
              results = await models.AnalysisSummaryAuthor.findAndCountAll({ // review commnet:Change this to findAll
                  attributes: ["personIdentifier", "pmid"],
                  distinct:true,
                  col:'pmid',
                  include: [
                    {
                      model: models.Person,
                      as: "Person",
                      required: true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('Person.personIdentifier'))
                        },
                      // where : joinWhereAuthorsFilters,
                      attributes: [],
                    }
                  ],
                  where: joinWhereAuthorsFilters,
                  subQuery: false,
                  // limit: apiBody.limit,
                  // offset: apiBody.offset,
                  benchmark: true
                });
              }
      }else if(!isAuthorFilter && isArticleFilter){   // Filter Only with Articles and not Authors
        results = await models.AnalysisSummaryArticle.findAndCountAll({
          where: whereForOnlyArticles,
          subQuery: false,
          // limit: apiBody.limit,
          // offset: apiBody.offset,
          order: sort,
         // group: ["AnalysisSummaryArticle.pmid"], // This grouping is not required as we need only count of records statisfies criteria
          // distinct: true,
          // attributes: {exclude: ['AnalysisSummaryArticleId']},
          attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
          distinct: true,
          col:'pmid',
          benchmark: true
        });

      }else if(isAuthorFilter && isArticleFilter){ // Filter with Authors and Articles
        if(isPersonTypeFilter){ // When author filters present and including PersonType
          if( !isOrgORInstitues){
            results = await models.AnalysisSummaryArticle.findAndCountAll({ 
              include: [
                {
                  model: models.AnalysisSummaryAuthor,
                  as: "AnalysisSummaryAuthor",
                  required: true,
                  on: {
                    col: Sequelize.where(
                      Sequelize.col("AnalysisSummaryAuthor.pmid"),
                      "=",
                      Sequelize.col("AnalysisSummaryArticle.pmid")
                    ),
                  },
                  attributes: [],
                },
                {
                  model: models.PersonPersonType,
                  as: "PersonPersonTypes",
                  required: true,
                  // separate : true,
                  on: {
                   /* col1: Sequelize.where( // review commnet: this condition is not required. remove this and tell me what impacts if you remove this
                      Sequelize.col("AnalysisSummaryAuthor.personIdentifier"), 
                      "=",
                      Sequelize.col("PersonPersonTypes.personIdentifier"),
                    ),*/
                    col1: Sequelize.where( 
                      Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                      // Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                      "=",
                      Sequelize.col("PersonPersonTypes.personIdentifier"),
                    ),
                  },
                  attributes:[]
                  // where: joinWherePersonTypes,
                  //  attributes: {exclude:['AnalysisSummaryArticle.AnalysisSummaryArticleId','PersonPersonTypes.PersonId']},
                  // attributes: ["personIdentifier","personType", ], // there is no AnalysisSummaryArticleId in table but y its showing this ?
                },
              ],
              where: where,
              subQuery: false,
              // limit: apiBody.limit,
              // offset: apiBody.offset,
              order: sort,
              group: ["AnalysisSummaryAuthor.pmid"],
              attributes: ["pmid"],
              distinct:true,
              col:'pmid',
              benchmark: true
            });
          } else{
            results = await models.AnalysisSummaryArticle.findAndCountAll({ 
              include: [
                {
                  model: models.AnalysisSummaryAuthor,
                  as: "AnalysisSummaryAuthor",
                  required: true,
                  on: {
                    col: Sequelize.where(
                      Sequelize.col("AnalysisSummaryAuthor.pmid"),
                      "=",
                      Sequelize.col("AnalysisSummaryArticle.pmid")
                    ),
                  },
                  attributes: [],
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
                    ),
                  },
                  attributes: [],
                },
                {
                  model: models.PersonPersonType,
                  as: "PersonPersonTypes",
                  required: false,
                  // separate : true,
                  on: {
                   /* col1: Sequelize.where( // review commnet: this condition is not required. remove this and tell me what impacts if you remove this
                      Sequelize.col("AnalysisSummaryAuthor.personIdentifier"), 
                      "=",
                      Sequelize.col("PersonPersonTypes.personIdentifier"),
                    ),*/
                    col1: Sequelize.where( 
                      Sequelize.col("Person.personIdentifier"),
                      // Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                      "=",
                      Sequelize.col("PersonPersonTypes.personIdentifier"),
                    ),
                  },
                  attributes:[]
                },
              ],
              where: where,
              subQuery: false,
              // limit: apiBody.limit,
              // offset: apiBody.offset,
              order: sort,
              group: ["AnalysisSummaryAuthor.pmid"],
              attributes: ["pmid"],
              distinct:true,
              col:'pmid',
              benchmark: true
            });
          }
        }else{
          results = await models.AnalysisSummaryArticle.findAndCountAll({ 
            include: [
              {
                model: models.AnalysisSummaryAuthor,
                as: "AnalysisSummaryAuthor",
                required: true,
                on: {
                  col: Sequelize.where(
                    Sequelize.col("AnalysisSummaryAuthor.pmid"),
                    "=",
                    Sequelize.col("AnalysisSummaryArticle.pmid")
                  ),
                },
                attributes: [],
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
                  ),
                },
                attributes: [],
              },
            ],
            where: where,
            subQuery: false,
            // limit: apiBody.limit,
            // offset: apiBody.offset,
            order: sort,
            group: ["AnalysisSummaryAuthor.pmid"],
            attributes: ["pmid"],
            distinct: true,
            col:'pmid',
            benchmark: true
          });
        }
      }


      

      /* let articleResults =[];
      if (isAuthorFilter && !isArticleFilter) {
        //  preparing PMIDS from filtered data
        let pmidList = [];
        results.map((rowData) => {
          pmidList.push(rowData?.dataValues?.pmid)
        })
        if(pmidList && pmidList.length > 0)
        {
            // Get additional data about articles by PMIDS 
             articleResults = await models.AnalysisSummaryArticle.findAll({ // review commnet: change this to findAll and send only attributes being displayed on UI with attributes
              where: { pmid: pmidList },
              subQuery: false,
              // limit: apiBody.limit,
              // offset: apiBody.offset,
              attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
              // distinct:true,
            });
        }
      } else { // review commnet: when do we need this.
        articleResults = results;
      } */

       let pmids =  results.rows?.length && results.rows?.map(data => data.pmid);
      let personIdentifiers: any[] = [];
      if (pmids && pmids.length > 0) {
        // get personIdentifiers
        const whereAuthors = {};
        whereAuthors[Op.and] = [];
        if (
          apiBody.filters.personIdentifers &&
          apiBody.filters.personIdentifers.length > 0
        ) {
          whereAuthors[Op.and].push({
            "$AnalysisSummaryAuthorList.personIdentifier$": {
              [Op.in]: apiBody.filters.personIdentifers,
            },
          });
         }
        whereAuthors[Op.and].push({
          "$AnalysisSummaryAuthorList.pmid$": {
            [Op.in]: pmids,
          },
        });
        whereAuthors[Op.and].push({
          "$AnalysisSummaryAuthorList.personIdentifier$": {
            [Op.ne]: '',
          },
        });
        //this one is calculating authorship
        personIdentifiers = await models.AnalysisSummaryAuthorList.findAll({
          attributes: ["personIdentifier"],
          where: whereAuthors,
          // group: ["personIdentifier"],
          benchmark: true
        }).then((output) => {
          return output.map(result => result.personIdentifier);
        })
      }
      // searchOutput = results.map(result => result.pmid);
      finalSearchOutput = { personIdentifiers, pmids }; 
    } else {
      let results = await models.AnalysisSummaryArticle.findAll({
        where: Sequelize.where(
          Sequelize.fn(
            "DATEDIFF",
            Sequelize.literal("CURRENT_DATE"),
            Sequelize.fn(
              "STR_TO_DATE",
              Sequelize.col("datePublicationAddedToEntrez"),
              "%Y-%m-%d"
            )
          ),
          {
            [Op.lte]: 60,
          }
        ),
        limit: apiBody.limit,
        offset: apiBody.offset,
        order: sort,
        attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
        benchmark: true
      });
      finalSearchOutput = results.map(result => result.pmid);
    }
    return finalSearchOutput;
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};
