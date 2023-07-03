import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize } from "sequelize";
import {
  AnalysisSummaryArticle
} from "../../../src/db/models/init-models";
import models from "../../../src/db/sequelize";
import {
  PublicationAuthorSearchFilter,
  PublicationSearchFilter
} from "../../../types/publication.report.search";
import getConfig from 'next/config';
import path from 'path';
import fsPromises from 'fs/promises';
import {getSession} from 'next-auth/client'									   


models.AnalysisSummaryArticle.hasOne(models.Person, { constraints: false, foreignKey: 'AnalysisSummaryArticleId' });
models.AnalysisSummaryArticle.hasMany(models.PersonPersonType, {
  constraints: false,
  foreignKey: 'AnalysisSummaryArticleId'  
});
models.AnalysisSummaryArticle.hasOne(models.AnalysisSummaryAuthor, {
  constraints: false,
  foreignKey: 'AnalysisSummaryArticleId'
});

const fs = require("fs")

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
    let joinWhereOrganizations ={};
    
    let isAuthorFilter = false;
    let isArticleFilter = false;
    let isPersonTypeFilter = false;
    let isOrgORInstitues = false;

  
    if (apiBody.filters) {
      where[Op.and] = [];
      whereForOnlyAuthors [Op.and] = [];
      whereForOnlyArticles [Op.and] = [];
      joinWhereAuthorsFilters [Op.and] = [];
      joinWherePersonTypes [Op.and] = [];
      joinWhereOrganizations [Op.or] = [];

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
        joinWhereOrganizations[Op.or].push({
          "$Person.primaryOrganizationalUnit$": {
            [Op.in]: apiBody.filters.orgUnits,
          },
        });
        apiBody.filters.orgUnits.forEach((orgName: string) => {
          joinWhereOrganizations [Op.or].push(({[Op.or]:[{'$Person.primaryOrganizationalUnit$': { [Op.like]: `%${orgName}%`}},
          {'$Person.primaryOrganizationalUnit$': { [Op.like]: `%(${orgName})%`}}]}))
      });
      
       joinWhereAuthorsFilters[Op.and].push(joinWhereOrganizations);
       where[Op.and].push(joinWhereOrganizations);

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
        where[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore2$": {
            [Op.lt]: apiBody.filters.journalImpactScoreUpperBound,
          },
        });
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore1$": {
            [Op.gt]: apiBody.filters.journalImpactScoreLowerBound,
          },
        });
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore2$": {
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
      if (sortType === 'citationCountScopus')
        sort.push([Sequelize.literal('isnull(citationCountScopus), citationCountScopus '+sortOrder)])
      if (sortType === 'relativeCitationRatioNIH')
        sort.push([Sequelize.literal('isnull(relativeCitationRatioNIH), relativeCitationRatioNIH '+sortOrder)])
      if (sortType === 'journalImpactScore2')
        sort.push([Sequelize.literal('isnull(journalImpactScore2), journalImpactScore2 '+sortOrder)])
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
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        },
                      attributes: {exclude:[`AnalysisSummaryArticleId`,`PersonId`,`AnalysisSummaryAuthorId`]},
                    },
                  ],
                  where: whereForOnlyAuthors,
                  subQuery: false,
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
                      attributes: [],
                    },
                    {
                      model: models.PersonPersonType,
                      as: "PersonPersonTypes",
                      required: true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier'))
                        },
                      attributes: [`personIdentifier`],
                    },
                  ],
                  where: joinWhereAuthorsFilters,
                  subQuery: false,
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
                      attributes: [],
                    }
                  ],
                  where: joinWhereAuthorsFilters,
                  subQuery: false,
                  benchmark: true
                });
              }
      }else if(!isAuthorFilter && isArticleFilter){   // Filter Only with Articles and not Authors
        results = await models.AnalysisSummaryArticle.findAndCountAll({
          where: whereForOnlyArticles,
          subQuery: false,
          limit: apiBody.limit,
          offset: apiBody.offset,
          order: sort,
          distinct: true,
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
                    col1: Sequelize.where( 
                      Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
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
                  on: {
                    col1: Sequelize.where( 
                      Sequelize.col("Person.personIdentifier"),
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
        });
        let personIdentifiersList =[];
        authorsResults?.rows?.map((rowData) => {
          personIdentifiersList.push(rowData?.dataValues?.personIdentifier)
        });
		 let jsonData = {
          pmidList : pmidList,
          personIdentifierList : personIdentifiersList
        }
        const jsonString = JSON.stringify(jsonData)
        const session = await getSession({req});
        
        let articleResults ={};
        if(pmidList && pmidList.length > 0)
        {
            // Get additional data about articles by PMIDS 
             articleResults = await models.AnalysisSummaryArticle.findAll({ 
              where: { pmid: pmidList },
              subQuery: false,
              limit: apiBody.limit,
              offset: apiBody.offset,
              order:sort,
              attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
              benchmark:true
            });
        }
        let articlesDetails:any =[];
        if(Object.keys(articleResults).length > 0 )
        {
          articlesDetails['rows'] = articleResults; 
        }
        else
        {
        articlesDetails['rows'] = [];
        }
        searchOutput = {
          ... articlesDetails,
          count: authorsResults?.count,
          pmidList:pmidList,
          personIdentifiersList : personIdentifiersList
        }
      } else if(!isAuthorFilter && isArticleFilter) {
																			   
        searchOutput = {
          ...results,
          count: results?.count
        }
      }else if(isAuthorFilter && isArticleFilter){
																			   
        searchOutput = {
          ...results,
          count: typeof(results?.count) === "number" ?  results?.count : results?.count?.length
        }
      }
    } else {
      searchOutput = await models.AnalysisSummaryArticle.findAndCountAll({
       
        limit: apiBody.limit,
        offset: apiBody.offset,
        distinct : true,
        order: sort,
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
    let joinWhereOrganizations ={};
    
    let isAuthorFilter = false;
    let isArticleFilter = false;
    let isPersonTypeFilter = false;
    let isOrgORInstitues = false;
  
    if (apiBody.filters) {
      where[Op.and] = [];
      whereForOnlyAuthors [Op.and] = [];
      whereForOnlyArticles [Op.and] = [];
      joinWhereAuthorsFilters [Op.and] = [];
      joinWherePersonTypes [Op.and] = [];
      joinWhereOrganizations [Op.or] = [];

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

        apiBody.filters.orgUnits.forEach((orgName: string) => {
          joinWhereOrganizations [Op.or].push(({[Op.or]:[{'$Person.primaryOrganizationalUnit$': { [Op.like]: `%${orgName}%`}},
          {'$Person.primaryOrganizationalUnit$': { [Op.like]: `%(${orgName})%`}}]}))
      });
      
       joinWhereAuthorsFilters[Op.and].push(joinWhereOrganizations);
       where[Op.and].push(joinWhereOrganizations);

        
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
        where[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore2$": {
            [Op.lt]: apiBody.filters.journalImpactScoreUpperBound,
          },
        });
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore1$": {
            [Op.gt]: apiBody.filters.journalImpactScoreLowerBound,
          },
        });
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore2$": {
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
      if (sortType === 'citationCountScopus')
        sort.push([Sequelize.literal('isnull(citationCountScopus), citationCountScopus '+sortOrder)])
      if (sortType === 'relativeCitationRatioNIH')
        sort.push([Sequelize.literal('isnull(relativeCitationRatioNIH), relativeCitationRatioNIH '+sortOrder)])
      if (sortType === 'journalImpactScore2')
        sort.push([Sequelize.literal('isnull(journalImpactScore2), journalImpactScore2 '+sortOrder)])
    }
    else
    {
      sort.push(["datePublicationAddedToEntrez","DESC"]);
    }
	
    let results:any  =[];

    if (isAuthorFilter || isArticleFilter) {
     /* if(isAuthorFilter && !isArticleFilter)
      { // Filter Only with Authors and not Articles
            models.AnalysisSummaryAuthor.hasOne(models.Person, { constraints: false, foreignKey: 'personIdentifier' });
            models.AnalysisSummaryAuthor.hasMany(models.PersonPersonType, {constraints: false, foreignKey: 'personIdentifier' }); 

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
                        },
                      attributes: {exclude:[`AnalysisSummaryArticleId`,`PersonId`,`AnalysisSummaryAuthorId`]},
                    },
                  ],
                  where: whereForOnlyAuthors,
                  subQuery: false,
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
                      attributes: [],
                    },
                    {
                      model: models.PersonPersonType,
                      as: "PersonPersonTypes",
                      required: true,
                      on: {
                        col1: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.personIdentifier'), "=", Sequelize.col('PersonPersonTypes.personIdentifier')),
                        },
                      attributes: [`personIdentifier`],
                    },
                  ],
                  where: joinWhereAuthorsFilters,
                  subQuery: false,
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
                      attributes: [],
                    }
                  ],
                  where: joinWhereAuthorsFilters,
                  subQuery: false,
                  benchmark: true
                });
              }
      }*/
      if(!isAuthorFilter && isArticleFilter){   // Filter Only with Articles and not Authors
        results = await models.AnalysisSummaryArticle.findAndCountAll({
          include:[{
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
            attributes: ["personIdentifier","pmid"],
          }],
          where: whereForOnlyArticles,
          subQuery: false,
          order: sort,
          attributes:[],
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
                  attributes: ["personIdentifier"],
                },
                {
                  model: models.PersonPersonType,
                  as: "PersonPersonTypes",
                  required: false, // changed to same as search one earlier it was true
                  on: {
                    col1: Sequelize.where( 
                      Sequelize.col("AnalysisSummaryAuthor.personIdentifier"),
                      "=",
                      Sequelize.col("PersonPersonTypes.personIdentifier"),
                    ),
                  },
                  attributes:[]
                },
              ],
              where: where,
              subQuery: false,
              order: sort,
             // group: ["AnalysisSummaryAuthor.pmid"],
              attributes: ["pmid"],
             // distinct:true,
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
                  attributes: ["personIdentifier"],
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
                  on: {
                    col1: Sequelize.where( 
                      Sequelize.col("Person.personIdentifier"),
                      "=",
                      Sequelize.col("PersonPersonTypes.personIdentifier"),
                    ),
                  },
                  attributes:[]
                },
              ],
              where: where,
              subQuery: false,
              order: sort,
             // group: ["AnalysisSummaryAuthor.pmid"],
              attributes: ["pmid"],
           //   distinct:true,
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
                attributes: ["personIdentifier"],
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
            order: sort,
          //  group: ["AnalysisSummaryAuthor.pmid"],
            attributes: ["id"],
          //  distinct: true,
            col:'id',
            benchmark: true
          });
        }
      }
      let personIdentifiers = [];
      let pmids = [];

      if (isAuthorFilter && !isArticleFilter) { 
				
        const session = await getSession({req});
														

      }else if(!isAuthorFilter && isArticleFilter){
       pmids = results.rows?.length && results.rows?.map(data => data.dataValues.AnalysisSummaryAuthor.dataValues.pmid);
        personIdentifiers =  results.rows?.length && results.rows?.map(data =>  data.dataValues.AnalysisSummaryAuthor.dataValues.personIdentifier);
      }else{
        pmids = results.rows?.length && results.rows?.map(data => data.dataValues.pmid);
        personIdentifiers =  results.rows?.length && results.rows?.map(data =>  data.dataValues.AnalysisSummaryAuthor.dataValues.personIdentifier);
      }
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
