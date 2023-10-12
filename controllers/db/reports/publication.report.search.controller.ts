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
import sequelize from "../../../src/db/db";
import { QueryConstants } from "../../../src/utils/namedQueryConstants";


models.AnalysisSummaryArticle.hasOne(models.Person, { constraints: false, foreignKey: 'AnalysisSummaryArticleId' });
models.AnalysisSummaryArticle.hasMany(models.PersonPersonType, {
  constraints: false,
  foreignKey: 'AnalysisSummaryArticleId'  
});
models.PersonPersonType.belongsToMany(models.AnalysisSummaryArticle,{through: models.AnalysisSummaryAuthor})
models.AnalysisSummaryArticle.hasOne(models.AnalysisSummaryAuthor, {
  constraints: false,
  foreignKey: 'AnalysisSummaryArticleId'
});
//models.AnalysisSummaryAuthor.belongsTo(models.AnalysisSummaryArticle);

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

    let whereAuthorsSql : any =[];
    let replacementWhereAuthorsSql : any = [] ;
    let replacementWhereObj;
    let replaceOfPersonIdentifier;
    let replaceOfOrgs;
    let replaceOfInstitutions;
    let replaceOfAuthPos;
    let replaceOfPersonTypes;

    let whereArticlesSql : any =[];
    let replacementWhereArticleSql : any = [] ;
    let replaceDatePubEntrizeLower; 
    let replaceDatePubEntrizeUpper;
    let replacePublicationTypeCanonical;
    let replaceJournalTitleVerbose;
    let replaceJounrnalImpactScoreLowerBound;
    let replaceJounrnalImpactScoreUpperBound
  
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
          "$AnalysisSummaryArticle.journalImpactScore1$": {
            [Op.lt]: apiBody.filters.journalImpactScoreUpperBound,
          },
        });
        whereForOnlyArticles[Op.and].push({
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
    let articleResults:any  =[];
    let authorsResults:any = [];
    let authorsCount;
		let articleCount;		 

    if (isAuthorFilter || isArticleFilter) {
      if(isAuthorFilter && !isArticleFilter)
      { // Filter Only with Authors and not Articles
            models.AnalysisSummaryAuthor.hasOne(models.Person, { constraints: false, foreignKey: 'personIdentifier' });
           // models.Person.belongsTo(models.AnalysisSummaryAuthor);
            models.AnalysisSummaryAuthor.hasMany(models.PersonPersonType, {constraints: false, foreignKey: 'personIdentifier' }); 
           // models.PersonPersonType.belongsTo(models.AnalysisSummaryAuthor);
           models.Person.hasMany(models.PersonPersonType, {constraints: false, foreignKey: 'personIdentifier' });
            if(isPersonTypeFilter){ // When author filters present and including PersonType
              if( !isOrgORInstitues) /*&& apiBody && apiBody.filters && apiBody.filters.personTypes)*/{
                articleCount = await models.AnalysisSummaryArticle.count({ 
                  attributes: [],
                  distinct:true,
                  col:'pmid',
                  include: [
                    {
                      model: models.AnalysisSummaryAuthor,
                      as: "AnalysisSummaryAuthor",
                      required: true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.pmid'), "=", Sequelize.col('AnalysisSummaryArticle.pmid'))
                        },
                      attributes: {exclude:[`AnalysisSummaryArticleId`,`PersonId`,`AnalysisSummaryAuthorId`]},
                    },
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
                 // subQuery: false,
                  benchmark: true
                });
               // let personTypes = apiBody.filters.personTypes;
                
                if(apiBody.filters.authorPosition && apiBody.filters.authorPosition.length > 0)
                {
                  whereAuthorsSql.push(" asu.authorPosition IN  :authorPosition");
                  let authorPosition = apiBody.filters.authorPosition;
                  replaceOfAuthPos = {"authorPosition": [authorPosition]};
                }
                if(apiBody.filters.personTypes && apiBody.filters.personTypes.length > 0)
                {
                    whereAuthorsSql.push(" ppt.personType IN  :personTypes ");
                    let personTypes = apiBody.filters.personTypes;
                    replaceOfPersonTypes = {"personTypes": [personTypes]};
                
                }
                
                  if(whereAuthorsSql && whereAuthorsSql.length > 0)
                  {
                        replacementWhereObj = {
                          ...replaceOfAuthPos,
                          ...replaceOfPersonTypes
                        }
                        let whereAuthorsSqlReplacements =   whereAuthorsSql.join(' AND ')
                        authorsResults = await sequelize.query(
                          QueryConstants.personTypeWithoutAuthors + whereAuthorsSqlReplacements ,
                          {
                              replacements: replacementWhereObj ,
                              model: models.AnalysisSummaryAuthor,
                              mapToModel : true
                          }
                      );
                    }
                       
              } else if(apiBody && apiBody.filters){
                articleCount = await models.AnalysisSummaryArticle.count({ 
                  attributes: ["pmid"],
                  distinct:true,
                  col:'pmid',
                  include: [
                    {
                      model: models.AnalysisSummaryAuthor,
                      as: "AnalysisSummaryAuthor",
                      required: true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.pmid'), "=", Sequelize.col('AnalysisSummaryArticle.pmid'))
                        },
                      attributes: [],
                    },
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
                        }
                    },
                  ],
                  where: joinWhereAuthorsFilters,
                  benchmark: true
                });
                
                 if(apiBody.filters.personIdentifers && apiBody.filters.personIdentifers.length > 0)
                 {
                     
                     whereAuthorsSql.push(" asu.personIdentifier IN  :personIdentifier");
                     let personIdentifiers = apiBody.filters.personIdentifers;
                     replaceOfPersonIdentifier = {"personIdentifier": [personIdentifiers]};
                 }
                 if(apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0)
                 {
                      let orgUnitsArray = apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0 && apiBody.filters.orgUnits.toString().split(',');
                      let orgUnitsLikeArray:String[]= [];
                      orgUnitsArray.map(orgUnit =>{
                        orgUnitsLikeArray.push("p.primaryOrganizationalUnit LIKE '%"+ orgUnit + "%' OR p.primaryOrganizationalUnit LIKE '%("+ orgUnit +")%'")
                      })
                      let orgUnitsLikeString =  orgUnitsLikeArray.join(' OR ') ;
                      whereAuthorsSql.push(" ((p.primaryOrganizationalUnit IN  :orgUnits OR ("+ orgUnitsLikeString +")))")//OR (p.primaryOrganizationalUnit LIKE :orgUnitsLike OR p.primaryOrganizationalUnit LIKE :orgUnitsLike1 )))");
                      let orgUnits = apiBody.filters.orgUnits;
                      replaceOfOrgs = {"orgUnits": [orgUnits]}//,"orgUnitsLike" : ['%'+ orgUnits + '%'],"orgUnitsLike1" : ['%('+orgUnits +')%']};
                 }
                 if(apiBody.filters.institutions && apiBody.filters.institutions.length > 0)
                 {
                     whereAuthorsSql.push(" p.primaryInstitution IN  :institutions");
                     let institutions = apiBody.filters.institutions
                      replaceOfInstitutions = {"institutions": [institutions]};
                 }
                 if(apiBody.filters.authorPosition && apiBody.filters.authorPosition.length > 0)
                 {
                     whereAuthorsSql.push(" asu.authorPosition IN  :authorPosition");
                     let authorPosition = apiBody.filters.authorPosition;
                      replaceOfAuthPos = {"authorPosition": [authorPosition]};
                 }
                 if(apiBody.filters.personTypes && apiBody.filters.personTypes.length > 0)
                 {
                     whereAuthorsSql.push(" ppt.personType IN  :personTypes ");
                     let personTypes = apiBody.filters.personTypes;
                      replaceOfPersonTypes = {"personTypes": [personTypes]};
                 
                 }
                 if(whereAuthorsSql && whereAuthorsSql.length > 0)
                 {
                  replacementWhereObj = {
                    ...replaceOfPersonIdentifier,
                    ...replaceOfOrgs,
                    ...replaceOfInstitutions,
                    ...replaceOfAuthPos,
                    ...replaceOfPersonTypes
                  }

                      let whereAuthorsSqlReplacements =   whereAuthorsSql.join(' AND ')
                        authorsResults = await sequelize.query(
                          QueryConstants.personTypeWithAuthors + whereAuthorsSqlReplacements ,
                          {
                            replacements: replacementWhereObj,  
                              model: models.AnalysisSummaryAuthor,
                              mapToModel : true
                          }
                      );
                 }
              }
              
            }
            else  { // When author filters present and no PersonType
              console.log('in else statement****************')
              articleCount = await models.AnalysisSummaryArticle.count({ // review commnet:Change this to findAll
                  attributes: ["pmid"],
                  distinct:true,
                  col:'pmid',
                  include: [
                    {
                      model: models.AnalysisSummaryAuthor,
                      as: "AnalysisSummaryAuthor",
                      required: true,
                      on: {
                        col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.pmid'), "=", Sequelize.col('AnalysisSummaryArticle.pmid'))
                        },
                      attributes: [],
                    },
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
                  benchmark: true
                });

              if(apiBody.filters.personIdentifers && apiBody.filters.personIdentifers.length > 0)
              {
                  
                  whereAuthorsSql.push(" asu.personIdentifier IN  :personIdentifier");
                  let personIdentifiers = apiBody.filters.personIdentifers;
                  replaceOfPersonIdentifier = {"personIdentifier": [personIdentifiers]};
              }
              if(apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0)
              {
                   let orgUnitsArray = apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0 && apiBody.filters.orgUnits.toString().split(',');
                   let orgUnitsLikeArray:String[]= [];
                   orgUnitsArray.map(orgUnit =>{
                     orgUnitsLikeArray.push("p.primaryOrganizationalUnit LIKE '%"+ orgUnit + "%' OR p.primaryOrganizationalUnit LIKE '%("+ orgUnit +")%'")
                   })
                   let orgUnitsLikeString =  orgUnitsLikeArray.join(' OR ') ;
                   whereAuthorsSql.push(" ((p.primaryOrganizationalUnit IN  :orgUnits OR ("+ orgUnitsLikeString +")))")//OR (p.primaryOrganizationalUnit LIKE :orgUnitsLike OR p.primaryOrganizationalUnit LIKE :orgUnitsLike1 )))");
                   let orgUnits = apiBody.filters.orgUnits;
                   replaceOfOrgs = {"orgUnits": [orgUnits]}//,"orgUnitsLike" : ['%'+ orgUnits + '%'],"orgUnitsLike1" : ['%('+orgUnits +')%']};
              }
              if(apiBody.filters.institutions && apiBody.filters.institutions.length > 0)
              {
                  whereAuthorsSql.push(" p.primaryInstitution IN  :institutions");
                  let institutions = apiBody.filters.institutions
                  replaceOfInstitutions = {"institutions": [institutions]};
              }
              if(apiBody.filters.authorPosition && apiBody.filters.authorPosition.length > 0)
              {
                  whereAuthorsSql.push(" asu.authorPosition IN  :authorPosition");
                  let authorPosition = apiBody.filters.authorPosition;
                  replaceOfAuthPos = {"authorPosition": [authorPosition]};
              }
              if(whereAuthorsSql && whereAuthorsSql.length > 0)
              {
              replacementWhereObj = {
                ...replaceOfPersonIdentifier,
                ...replaceOfOrgs,
                ...replaceOfInstitutions,
                ...replaceOfAuthPos
                
              }

                let whereAuthorsSqlReplacements =   whereAuthorsSql.join(' AND ')

                    authorsResults = await sequelize.query(
                      QueryConstants.authorsWithoutPersonType + whereAuthorsSqlReplacements +")x",
                      {
                        replacements: replacementWhereObj ,
                          model: models.AnalysisSummaryAuthor,
                          mapToModel : true
                      }
                  );	
                    }											   
            }
      }else if(!isAuthorFilter && isArticleFilter){   // Filter Only with Articles and not Authors
        articleResults = await models.AnalysisSummaryArticle.findAndCountAll({
          include: [
            {
              model: models.AnalysisSummaryAuthor,
              as: "AnalysisSummaryAuthor",
              required: true,
              on: {
                col: Sequelize.where(Sequelize.col('AnalysisSummaryAuthor.pmid'), "=", Sequelize.col('AnalysisSummaryArticle.pmid'))
                },
              attributes: [],
            },
          ],
          where: whereForOnlyArticles,
          subQuery: false,
          limit: apiBody.limit,
          offset: apiBody.offset,
          order: sort,
          distinct: true,
          attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('AnalysisSummaryArticle.pmid')), 'pmid'], `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
          col:'pmid',
          raw:true,
          benchmark: true
        });
      }else if(isAuthorFilter && isArticleFilter){ // Filter with Authors and Articles
        if(isPersonTypeFilter){ // When author filters present and including PersonType
          if( !isOrgORInstitues){
            articleCount = await models.AnalysisSummaryArticle.count({ 
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
              attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
              col: 'pmid',
              distinct : true,
              benchmark: true
            });
            if(apiBody.filters.personIdentifers && apiBody.filters.personIdentifers.length > 0)
            {
                
                whereAuthorsSql.push(" asu.personIdentifier IN  :personIdentifier");
                let personIdentifiers = apiBody.filters.personIdentifers;
                replaceOfPersonIdentifier = {"personIdentifier": [personIdentifiers]};
                
            }
            if(apiBody.filters.personTypes && apiBody.filters.personTypes.length > 0)
            {
                whereAuthorsSql.push(" ppt.personType IN  :personTypes ");
                let personTypes = apiBody.filters.personTypes;
                  replaceOfPersonTypes = {"personTypes": [personTypes]};
              
            
            }
            if(apiBody.filters.authorPosition && apiBody.filters.authorPosition.length > 0)
            {
                      whereAuthorsSql.push(" asu.authorPosition IN  :authorPosition");
                      let authorPosition = apiBody.filters.authorPosition;
                      replaceOfAuthPos = {"authorPosition": [authorPosition]};
              
            }
            if(apiBody.filters.datePublicationAddedToEntrezLowerBound && apiBody.filters.datePublicationAddedToEntrezLowerBound.length > 0)
            {
               whereArticlesSql.push(" asa.datePublicationAddedToEntrez > :datePubEntrezLower");
               let datePubEntrizLower = apiBody.filters.datePublicationAddedToEntrezLowerBound;
               replaceDatePubEntrizeLower = {"datePubEntrezLower" : [datePubEntrizLower]}
            }
            if(apiBody.filters.datePublicationAddedToEntrezUpperBound && apiBody.filters.datePublicationAddedToEntrezUpperBound.length > 0)
            {
               whereArticlesSql.push(" asa.datePublicationAddedToEntrez < :datePubEntrezUpper");
               let datePubEntrizUpper = apiBody.filters.datePublicationAddedToEntrezUpperBound;
               replaceDatePubEntrizeUpper = {"datePubEntrezUpper" : [datePubEntrizUpper]}
               
            }
            if(apiBody.filters.publicationTypeCanonical && apiBody.filters.publicationTypeCanonical.length > 0)
            {
               whereArticlesSql.push(" asa.publicationTypeCanonical IN :publicationTypeCanonical");
               let publicationTypeCanonical = apiBody.filters.publicationTypeCanonical;
               replacePublicationTypeCanonical = {"publicationTypeCanonical" : [publicationTypeCanonical]}
               
            }
            if(apiBody.filters.journalTitleVerbose && apiBody.filters.journalTitleVerbose.length > 0)
            {
               whereArticlesSql.push(" asa.journalTitleVerbose IN :journalTitleVerbose");
               let journalTitleVerbose = apiBody.filters.journalTitleVerbose;
               replaceJournalTitleVerbose = {"journalTitleVerbose" : [journalTitleVerbose]}
                
            }
            if(apiBody.filters.journalImpactScoreLowerBound && apiBody.filters.journalImpactScoreLowerBound > 0)
             {
               whereArticlesSql.push(" asa.journalImpactScore1 > :journalImpactScore1Lower");
               let journalImpactScore1LowerBound = apiBody.filters.journalImpactScoreLowerBound;
               replaceJounrnalImpactScoreLowerBound = {"journalImpactScore1Lower" : [journalImpactScore1LowerBound]}
             }
             if(apiBody.filters.journalImpactScoreUpperBound && apiBody.filters.journalImpactScoreUpperBound > 0)
             {
               whereArticlesSql.push(" asa.journalImpactScore1 < :journalImpactScore1Upper");
               let journalImpactScore1UpperBound = apiBody.filters.journalImpactScoreUpperBound;
               replaceJounrnalImpactScoreUpperBound = {"journalImpactScore1Upper" : [journalImpactScore1UpperBound]}
             }
            if((whereAuthorsSql && whereAuthorsSql.length > 0) ||
                   whereArticlesSql && whereArticlesSql.length > 0)
                    {
                          replacementWhereObj = {
                            ...replaceOfPersonIdentifier,
                            ...replaceOfAuthPos,
                            ...replaceOfPersonTypes,
                            ...replaceDatePubEntrizeLower,
                            ...replaceDatePubEntrizeUpper,
                            ...replacePublicationTypeCanonical,
                            ...replaceJournalTitleVerbose,
                            ...replaceJounrnalImpactScoreLowerBound,
                            ...replaceJounrnalImpactScoreUpperBound
                        }
                    let whereAuthorsSqlReplacements =   whereAuthorsSql.join(' AND ');
                    let whereArticleSqlReplacements =  whereArticlesSql.join(' AND ');    
                    authorsResults = await sequelize.query(
                      QueryConstants.personTypeWitoutCombo  + whereAuthorsSqlReplacements + " AND " + whereArticleSqlReplacements,
                    {
                      replacements: replacementWhereObj ,
                      model: models.AnalysisSummaryArticle,
                      mapToModel : true
                    }
                  );
            }								
          } else{
            articleCount = await models.AnalysisSummaryArticle.count({ 
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
              attributes:[],
              col:'pmid',
              distinct: true,
              benchmark: true
            });

            let whereAuthorsSql : any =[];
            let replacementWhereAuthorsSql : any = [] ;
             if(apiBody.filters.personIdentifers && apiBody.filters.personIdentifers.length > 0)
             {
                 whereAuthorsSql.push(" asu.personIdentifier IN :personIdentifiers");
				          let personIdentifers = apiBody.filters.personIdentifers;
                   replaceOfPersonIdentifier = {"personIdentifiers": [personIdentifers]};
             }
           
             if(apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0)
             {
                  let orgUnitsArray = apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0 && apiBody.filters.orgUnits.toString().split(',');
                  let orgUnitsLikeArray:String[]= [];
                  orgUnitsArray.map(orgUnit =>{
                    orgUnitsLikeArray.push("p.primaryOrganizationalUnit LIKE '%"+ orgUnit + "%' OR p.primaryOrganizationalUnit LIKE '%("+ orgUnit +")%'")
                  })
                  let orgUnitsLikeString =  orgUnitsLikeArray.join(' OR ') ;
                  whereAuthorsSql.push(" ((p.primaryOrganizationalUnit IN  :orgUnits OR ("+ orgUnitsLikeString +")))")//OR (p.primaryOrganizationalUnit LIKE :orgUnitsLike OR p.primaryOrganizationalUnit LIKE :orgUnitsLike1 )))");
                  let orgUnits = apiBody.filters.orgUnits;
                  replaceOfOrgs = {"orgUnits": [orgUnits]}//,"orgUnitsLike" : ['%'+ orgUnits + '%'],"orgUnitsLike1" : ['%('+orgUnits +')%']};
             }
             if(apiBody.filters.institutions && apiBody.filters.institutions.length > 0)
             {
                  whereAuthorsSql.push(" p.primaryInstitution IN  :institutions");
                  let institutions = apiBody.filters.institutions
                  replaceOfInstitutions = {"institutions": [institutions]};
             }
             if(apiBody.filters.authorPosition && apiBody.filters.authorPosition.length > 0)
             {
                 whereAuthorsSql.push(" asu.authorPosition IN  :authorPosition");
                  let authorPosition = apiBody.filters.authorPosition;
                  replaceOfAuthPos = {"authorPosition": [authorPosition]};
             }
			 
             if(apiBody.filters.personTypes && apiBody.filters.personTypes.length > 0)
                 {
                   whereAuthorsSql.push(" ppt.personType IN  :personTypes ");
                    let personTypes = apiBody.filters.personTypes;
                     replaceOfPersonTypes = {"personTypes": [personTypes]};
                 }

               if(apiBody.filters.datePublicationAddedToEntrezLowerBound && apiBody.filters.datePublicationAddedToEntrezLowerBound.length > 0)
                 {
					          whereArticlesSql.push(" asa.datePublicationAddedToEntrez > :datePubEntrezLower");
                    let datePubEntrizLower = apiBody.filters.datePublicationAddedToEntrezLowerBound;
                    replaceDatePubEntrizeLower = {"datePubEntrezLower" : [datePubEntrizLower]}
                 }
                 if(apiBody.filters.datePublicationAddedToEntrezUpperBound && apiBody.filters.datePublicationAddedToEntrezUpperBound.length > 0)
                 {
                    whereArticlesSql.push(" asa.datePublicationAddedToEntrez < :datePubEntrezUpper");
                    let datePubEntrizUpper = apiBody.filters.datePublicationAddedToEntrezUpperBound;
                    replaceDatePubEntrizeUpper = {"datePubEntrezUpper" : [datePubEntrizUpper]}
                    
                 }
                 if(apiBody.filters.publicationTypeCanonical && apiBody.filters.publicationTypeCanonical.length > 0)
                 {
                    whereArticlesSql.push(" asa.publicationTypeCanonical IN :publicationTypeCanonical");
                    let publicationTypeCanonical = apiBody.filters.publicationTypeCanonical;
                    replacePublicationTypeCanonical = {"publicationTypeCanonical" : [publicationTypeCanonical]}
                    
                 }
                 if(apiBody.filters.journalTitleVerbose && apiBody.filters.journalTitleVerbose.length > 0)
                 {
                    whereArticlesSql.push(" asa.journalTitleVerbose IN :journalTitleVerbose");
                    let journalTitleVerbose = apiBody.filters.journalTitleVerbose;
                    replaceJournalTitleVerbose = {"journalTitleVerbose" : [journalTitleVerbose]}
                     
                 }
                 if(apiBody.filters.journalImpactScoreLowerBound && apiBody.filters.journalImpactScoreLowerBound > 0)
                  {
                    whereArticlesSql.push(" asa.journalImpactScore1 > :journalImpactScore1Lower");
                    let journalImpactScore1LowerBound = apiBody.filters.journalImpactScoreLowerBound;
                    replaceJounrnalImpactScoreLowerBound = {"journalImpactScore1Lower" : [journalImpactScore1LowerBound]}
                  }
                  if(apiBody.filters.journalImpactScoreUpperBound && apiBody.filters.journalImpactScoreUpperBound > 0)
                  {
                    whereArticlesSql.push(" asa.journalImpactScore1 < :journalImpactScore1Upper");
                    let journalImpactScore1UpperBound = apiBody.filters.journalImpactScoreUpperBound;
                    replaceJounrnalImpactScoreUpperBound = {"journalImpactScore1Upper" : [journalImpactScore1UpperBound]}
                  }
             if((whereAuthorsSql && whereAuthorsSql.length > 0)
			    || (whereArticlesSql && whereArticlesSql > 0))
             {
                    replacementWhereObj = {
                      ...replaceOfPersonIdentifier,
                      ...replaceOfOrgs,
                      ...replaceOfInstitutions,
                      ...replaceOfAuthPos,
                      ...replaceOfPersonTypes,
                      ...replaceDatePubEntrizeLower,
                      ...replaceDatePubEntrizeUpper,
                      ...replacePublicationTypeCanonical,
                      ...replaceJournalTitleVerbose,
                      ...replaceJounrnalImpactScoreLowerBound,
                      ...replaceJounrnalImpactScoreUpperBound
                      
                    }
                  let whereAuthorsSqlReplacements =   whereAuthorsSql.join(' AND ');
				          let whereArticleSqlReplacements =  whereArticlesSql.join(' AND ');
                  authorsResults = await sequelize.query(
                    QueryConstants.personTypeWithCombo +  whereAuthorsSqlReplacements + " AND " + whereArticleSqlReplacements,
                      {
                          replacements: replacementWhereObj,
                          model: models.AnalysisSummaryArticle,
                          mapToModel : true
                      }
                  );
             }												   
          }
        }else{
          articleCount = await models.AnalysisSummaryArticle.count({ 
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
            distinct:true,
            col:'pmid',
            attributes: [],
            benchmark: true
          });
          let whereAuthorsSql : any =[];
          let replacementWhereAuthorsSql : any = [] ;
           if(apiBody.filters.personIdentifers && apiBody.filters.personIdentifers.length > 0)
           {
                whereAuthorsSql.push(" asu.personIdentifier IN  :personIdentifier");
                    let personIdentifiers = apiBody.filters.personIdentifers;
                    replaceOfPersonIdentifier = {"personIdentifier": [personIdentifiers]};
           }
           if(apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0)
           {
                let orgUnitsArray = apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0 && apiBody.filters.orgUnits.toString().split(',');
                let orgUnitsLikeArray:String[]= [];
                orgUnitsArray.map(orgUnit =>{
                  orgUnitsLikeArray.push("p.primaryOrganizationalUnit LIKE '%"+ orgUnit + "%' OR p.primaryOrganizationalUnit LIKE '%("+ orgUnit +")%'")
                })
                let orgUnitsLikeString =  orgUnitsLikeArray.join(' OR ') ;
                whereAuthorsSql.push(" ((p.primaryOrganizationalUnit IN  :orgUnits OR ("+ orgUnitsLikeString +")))")//OR (p.primaryOrganizationalUnit LIKE :orgUnitsLike OR p.primaryOrganizationalUnit LIKE :orgUnitsLike1 )))");
                let orgUnits = apiBody.filters.orgUnits;
                replaceOfOrgs = {"orgUnits": [orgUnits]}//,"orgUnitsLike" : ['%'+ orgUnits + '%'],"orgUnitsLike1" : ['%('+orgUnits +')%']};
           }
           if(apiBody.filters.institutions && apiBody.filters.institutions.length > 0)
           {
                 whereAuthorsSql.push(" p.primaryInstitution IN  :institutions");
                     let institutions = apiBody.filters.institutions
                      replaceOfInstitutions = {"institutions": [institutions]};
           }
           if(apiBody.filters.authorPosition && apiBody.filters.authorPosition.length > 0)
           {
               whereAuthorsSql.push(" asu.authorPosition IN  :authorPosition");
                     let authorPosition = apiBody.filters.authorPosition;
                      replaceOfAuthPos = {"authorPosition": [authorPosition]};
           }

           if(apiBody.filters.datePublicationAddedToEntrezLowerBound && apiBody.filters.datePublicationAddedToEntrezLowerBound.length > 0)
            {
            whereArticlesSql.push(" asa.datePublicationAddedToEntrez > :datePubEntrezLower");
              let datePubEntrizLower = apiBody.filters.datePublicationAddedToEntrezLowerBound;
              replaceDatePubEntrizeLower = {"datePubEntrezLower" : [datePubEntrizLower]}
              
            }
            if(apiBody.filters.datePublicationAddedToEntrezUpperBound && apiBody.filters.datePublicationAddedToEntrezUpperBound.length > 0)
            {
            whereArticlesSql.push(" asa.datePublicationAddedToEntrez < :datePubEntrezUpper");
              let datePubEntrizUpper = apiBody.filters.datePublicationAddedToEntrezUpperBound;
              replaceDatePubEntrizeUpper = {"datePubEntrezUpper" : [datePubEntrizUpper]}
            }
            if(apiBody.filters.publicationTypeCanonical && apiBody.filters.publicationTypeCanonical.length > 0)
            {
            whereArticlesSql.push(" asa.publicationTypeCanonical IN :publicationTypeCanonical");
              let publicationTypeCanonical = apiBody.filters.publicationTypeCanonical;
              replacePublicationTypeCanonical = {"publicationTypeCanonical" : [publicationTypeCanonical]}    
            }
            if(apiBody.filters.journalTitleVerbose && apiBody.filters.journalTitleVerbose.length > 0)
            {
            whereArticlesSql.push(" asa.journalTitleVerbose IN :journalTitleVerbose");
              let journalTitleVerbose = apiBody.filters.journalTitleVerbose;
              replaceJournalTitleVerbose = {"journalTitleVerbose" : [journalTitleVerbose]}
            }
            if(apiBody.filters.journalImpactScoreLowerBound && apiBody.filters.journalImpactScoreLowerBound > 0)
            {
              whereArticlesSql.push(" asa.journalImpactScore1 > :journalImpactScore1Lower");
              let journalImpactScore1LowerBound = apiBody.filters.journalImpactScoreLowerBound;
              replaceJounrnalImpactScoreLowerBound = {"journalImpactScore1Lower" : [journalImpactScore1LowerBound]}
            }
            if(apiBody.filters.journalImpactScoreUpperBound && apiBody.filters.journalImpactScoreUpperBound > 0)
            {
              whereArticlesSql.push(" asa.journalImpactScore1 < :journalImpactScore1Upper");
              let journalImpactScore1UpperBound = apiBody.filters.journalImpactScoreUpperBound;
              replaceJounrnalImpactScoreUpperBound = {"journalImpactScore1Upper" : [journalImpactScore1UpperBound]}
            }

			 if((whereAuthorsSql && whereAuthorsSql.length > 0)
			    || (whereArticlesSql && whereArticlesSql > 0))
             {
				  replacementWhereObj = {
					  ...replaceOfPersonIdentifier,
					  ...replaceOfOrgs,
					  ...replaceOfInstitutions,
					  ...replaceOfAuthPos,
            ...replaceDatePubEntrizeLower,
            ...replaceDatePubEntrizeUpper,
            ...replacePublicationTypeCanonical,
            ...replaceJournalTitleVerbose,
            ...replaceJounrnalImpactScoreLowerBound,
            ...replaceJounrnalImpactScoreUpperBound
				  } 	 
          let whereAuthorsSqlReplacements =   whereAuthorsSql.join(' AND ');
          let whereArticleSqlReplacements =  whereArticlesSql.join(' AND ');
				  authorsResults = await sequelize.query(
            QueryConstants.comboWithoutPersonType + whereAuthorsSqlReplacements + " AND " + whereArticleSqlReplacements,
					{
					  replacements: replacementWhereObj ,
						model: models.AnalysisSummaryArticle,
						mapToModel : true
					}
				);
			}				
        }
      }
      
      if ((isAuthorFilter && !isArticleFilter) || (isAuthorFilter && isArticleFilter)) {
        //  preparing PMIDS from filtered data

        let pmidList = [];
        let authorsDetails:any =[];
        authorsDetails['rows'] = authorsResults; 
        
        authorsDetails['articleCount'] = articleCount;
        authorsDetails?.rows?.map((rowData) => {
          pmidList.push(rowData?.dataValues?.pmid)
        });
		  let jsonData = {
          pmidList : pmidList,
          authorshipsCount : (authorsDetails && authorsDetails?.rows && authorsDetails.rows.length > 0 )?authorsDetails.rows[0].dataValues.authorsCount : 0
        }
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
          articlesCount: authorsDetails?.articleCount,
          pmidList:pmidList,
          authorshipsCount : jsonData.authorshipsCount 
        }
      } else if(!isAuthorFilter && isArticleFilter) {
																			   
        searchOutput = {
          ...articleResults,
          articlesCount : articleResults?.count
        }
      }
    } else {
      searchOutput = await models.AnalysisSummaryArticle.findAndCountAll({
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
        ],
        limit: apiBody.limit,
        offset: apiBody.offset,
        distinct : true,
        order: sort,
        attributes:[[Sequelize.fn('DISTINCT', sequelize.col("AnalysisSummaryAuthor.pmid")), 'pmid'],
              `id`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
        col:'pmid',
        benchmark: true
      });
	 let formatedSearchOutput = {
      rows : searchOutput.rows,
      articlesCount : searchOutput.count
    }
	searchOutput = formatedSearchOutput;
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

    let whereAuthorsSql : any =[];
    let replacementWhereObj;
    let replaceOfPersonIdentifier;
    let replaceOfOrgs;
    let replaceOfInstitutions;
    let replaceOfAuthPos;
    let replaceOfPersonTypes;

    let whereArticlesSql : any =[];
    let replaceDatePubEntrizeLower; 
    let replaceDatePubEntrizeUpper;
    let replacePublicationTypeCanonical;
    let replaceJournalTitleVerbose;
    let replaceJounrnalImpactScoreLowerBound;
    let replaceJounrnalImpactScoreUpperBound;

  
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
    let resultsCount;

    if (isAuthorFilter || isArticleFilter) {
    
      if(!isAuthorFilter && isArticleFilter){   // Filter Only with Articles and not Authors
        if(apiBody.filters.datePublicationAddedToEntrezLowerBound && apiBody.filters.datePublicationAddedToEntrezLowerBound.length > 0)
        {
             whereArticlesSql.push(" asa.datePublicationAddedToEntrez > :datePubEntrezLower");
             let datePubEntrizLower = apiBody.filters.datePublicationAddedToEntrezLowerBound;
             replaceDatePubEntrizeLower = {"datePubEntrezLower" : [datePubEntrizLower]}
    
        }
        if(apiBody.filters.datePublicationAddedToEntrezUpperBound && apiBody.filters.datePublicationAddedToEntrezUpperBound.length > 0)
        {
             whereArticlesSql.push(" asa.datePublicationAddedToEntrez < :datePubEntrezUpper");
             let datePubEntrizUpper = apiBody.filters.datePublicationAddedToEntrezUpperBound;
             replaceDatePubEntrizeUpper = {"datePubEntrezUpper" : [datePubEntrizUpper]}
         
        }
        if(apiBody.filters.publicationTypeCanonical && apiBody.filters.publicationTypeCanonical.length > 0)
        {
           whereArticlesSql.push(" asa.publicationTypeCanonical IN :publicationTypeCanonical");
           let publicationTypeCanonical = apiBody.filters.publicationTypeCanonical;
           replacePublicationTypeCanonical = {"publicationTypeCanonical" : [publicationTypeCanonical]}

        }
        if(apiBody.filters.journalTitleVerbose && apiBody.filters.journalTitleVerbose.length > 0)
        {
           whereArticlesSql.push(" asa.journalTitleVerbose IN :journalTitleVerbose");
           let journalTitleVerbose = apiBody.filters.journalTitleVerbose;
           replaceJournalTitleVerbose = {"journalTitleVerbose" : [journalTitleVerbose]}
        }
        if(apiBody.filters.journalImpactScoreLowerBound && apiBody.filters.journalImpactScoreLowerBound > 0)
        {
           whereArticlesSql.push(" asa.journalImpactScore1 > :journalImpactScore1Lower");
           let journalImpactScore1LowerBound = apiBody.filters.journalImpactScoreLowerBound;
           replaceJounrnalImpactScoreLowerBound = {"journalImpactScore1Lower" : [journalImpactScore1LowerBound]}
        }
        if(apiBody.filters.journalImpactScoreUpperBound && apiBody.filters.journalImpactScoreUpperBound > 0)
        {
           whereArticlesSql.push(" asa.journalImpactScore1 < :journalImpactScore1Upper");
           let journalImpactScore1UpperBound = apiBody.filters.journalImpactScoreUpperBound;
           replaceJounrnalImpactScoreUpperBound = {"journalImpactScore1Upper" : [journalImpactScore1UpperBound]}
        }

        if(whereArticlesSql && whereArticlesSql.length > 0)
        {
                replacementWhereObj = {
                  ...replaceDatePubEntrizeLower,
                  ...replaceDatePubEntrizeUpper,
                  ...replacePublicationTypeCanonical,
                  ...replaceJournalTitleVerbose,
                  ...replaceJounrnalImpactScoreLowerBound,
                  ...replaceJounrnalImpactScoreUpperBound
                  
                }
              let replacementWhereArticlesSql =  whereArticlesSql.join(' AND ');
                    results = await sequelize.query(
                        "SELECT distinct asu.id,asa.pmid,asu.personIdentifier from analysis_summary_article asa INNER JOIN " +
                        "analysis_summary_author  asu ON asa.pmid = asu.pmid " +
                        "WHERE" +  replacementWhereArticlesSql ,
                        {
                            replacements:  replacementWhereObj, 
                           raw : true
                        }
                    );
           }	

      }
     

      let personIdentifiers = [];
      let pmids = [];
      let authorshipsArray
      let authorshipsCount
      if(!isAuthorFilter && isArticleFilter){
        pmids = results?.length > 0 && results[0]?.map(data => data.pmid);
        personIdentifiers =  results?.length >0 && results[0]?.map(data =>  data.personIdentifier);
         authorshipsArray = results?.length >0 && results[0]?.map(data => data.id ) 
         authorshipsCount = authorshipsArray && authorshipsArray.length;
      }
      finalSearchOutput = { authorshipsCount, pmids }; 
    } 
    else {
      let results = await models.AnalysisSummaryArticle.findAll({
        subQuery:false,
        include :[
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
        ],
       
        attributes: [`AnalysisSummaryAuthor.id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`],
        benchmark: true
      });

      let pmids = results.map(result => result.pmid);
      let authorshipsCount = results && results.length || 0 ;

      finalSearchOutput = { authorshipsCount, pmids }; 

    }
    return finalSearchOutput;
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};
