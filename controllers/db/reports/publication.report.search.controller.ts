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
//import getConfig from 'next/config';
//import path from 'path';
//import fsPromises from 'fs/promises';
//import {useSession} from 'next-auth/react'									   
import sequelize from "../../../src/db/db";
import { QueryConstants } from "../../../src/utils/namedQueryConstants";
import { buildReportSort, DEFAULT_REPORT_SORT } from "./reportSort";
import { authorPositionSql, sourceSql, dateTypeSql } from "./reportFilterSql";
import { PUB_TYPES } from "../../../src/lib/pubTypes";
import { bylineAuthors } from "../../../src/utils/externalByline";
import { articleColumns, articleExtraAttributes, authorColumns } from "./reportColumns";


import "./reportAssociations";
//models.AnalysisSummaryAuthor.belongsTo(models.AnalysisSummaryArticle);

//const fs = require("fs")

export const publicationSearchWithFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let apiBody: PublicationSearchFilter = req.body;
    const cols = await articleColumns();
    const hasSourceColumn = cols.sourceType;
    const extraAttrs = await articleExtraAttributes();
    if (apiBody.filters) {
      apiBody.filters.authorPosition = (apiBody.filters.authorPosition || []).filter((p) => !!authorPositionSql("x", [p]));
    }
    
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
        where[Op.and].push(Sequelize.literal(authorPositionSql("AnalysisSummaryAuthor", apiBody.filters.authorPosition)));
        whereForOnlyAuthors[Op.and].push(Sequelize.literal(authorPositionSql("AnalysisSummaryAuthor", apiBody.filters.authorPosition)));

        joinWhereAuthorsFilters[Op.and].push(Sequelize.literal(authorPositionSql("AnalysisSummaryAuthor", apiBody.filters.authorPosition)));

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
      // Date added, Publication date and grouped Type (5c): shared fragments, see reportFilterSql.ts.
      const dateTypeClauses = dateTypeSql("AnalysisSummaryArticle", apiBody.filters, cols, PUB_TYPES);
      for (const clause of dateTypeClauses) {
        where[Op.and].push(Sequelize.literal(clause));
        whereForOnlyArticles[Op.and].push(Sequelize.literal(clause));
      }
      if (dateTypeClauses.length) isArticleFilter = true;
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
      const sourceClause = sourceSql("AnalysisSummaryArticle", apiBody.filters.sourceTypes, hasSourceColumn);
      if (sourceClause) {
        where[Op.and].push(Sequelize.literal(sourceClause));
        whereForOnlyArticles[Op.and].push(Sequelize.literal(sourceClause));
        isArticleFilter = true;
      }
      if (
        apiBody.filters.journalImpactScoreLowerBound &&
        apiBody.filters.journalImpactScoreUpperBound
      ) {
        where[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore1$": {
            [Op.gte]: apiBody.filters.journalImpactScoreLowerBound,
          },
        });
        where[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore1$": {
            [Op.lt]: apiBody.filters.journalImpactScoreUpperBound,
          },
        });
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore1$": {
            [Op.gte]: apiBody.filters.journalImpactScoreLowerBound,
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

    const sort = buildReportSort((apiBody && apiBody.sort) || DEFAULT_REPORT_SORT, cols);
	
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
                  whereAuthorsSql.push(" " + authorPositionSql("asu", apiBody.filters.authorPosition));
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
                     whereAuthorsSql.push(" " + authorPositionSql("asu", apiBody.filters.authorPosition));
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
                  whereAuthorsSql.push(" " + authorPositionSql("asu", apiBody.filters.authorPosition));
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
          attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('AnalysisSummaryArticle.pmid')), 'pmid'], `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`, ...extraAttrs],
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
                      whereAuthorsSql.push(" " + authorPositionSql("asu", apiBody.filters.authorPosition));
                      let authorPosition = apiBody.filters.authorPosition;
                      replaceOfAuthPos = {"authorPosition": [authorPosition]};
              
            }
            for (const clause of dateTypeSql("asa", apiBody.filters, cols, PUB_TYPES)) whereArticlesSql.push(" " + clause);
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
               whereArticlesSql.push(" asa.journalImpactScore1 >= :journalImpactScore1Lower");
               let journalImpactScore1LowerBound = apiBody.filters.journalImpactScoreLowerBound;
               replaceJounrnalImpactScoreLowerBound = {"journalImpactScore1Lower" : [journalImpactScore1LowerBound]}
             }
             if(apiBody.filters.journalImpactScoreUpperBound && apiBody.filters.journalImpactScoreUpperBound > 0)
             {
               whereArticlesSql.push(" asa.journalImpactScore1 < :journalImpactScore1Upper");
               let journalImpactScore1UpperBound = apiBody.filters.journalImpactScoreUpperBound;
               replaceJounrnalImpactScoreUpperBound = {"journalImpactScore1Upper" : [journalImpactScore1UpperBound]}
             }
             const rawSourceClause = sourceSql("asa", apiBody.filters.sourceTypes, hasSourceColumn);
             if (rawSourceClause) whereArticlesSql.push(" " + rawSourceClause);
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
                 whereAuthorsSql.push(" " + authorPositionSql("asu", apiBody.filters.authorPosition));
                  let authorPosition = apiBody.filters.authorPosition;
                  replaceOfAuthPos = {"authorPosition": [authorPosition]};
             }
			 
             if(apiBody.filters.personTypes && apiBody.filters.personTypes.length > 0)
                 {
                   whereAuthorsSql.push(" ppt.personType IN  :personTypes ");
                    let personTypes = apiBody.filters.personTypes;
                     replaceOfPersonTypes = {"personTypes": [personTypes]};
                 }

               for (const clause of dateTypeSql("asa", apiBody.filters, cols, PUB_TYPES)) whereArticlesSql.push(" " + clause);
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
                    whereArticlesSql.push(" asa.journalImpactScore1 >= :journalImpactScore1Lower");
                    let journalImpactScore1LowerBound = apiBody.filters.journalImpactScoreLowerBound;
                    replaceJounrnalImpactScoreLowerBound = {"journalImpactScore1Lower" : [journalImpactScore1LowerBound]}
                  }
                  if(apiBody.filters.journalImpactScoreUpperBound && apiBody.filters.journalImpactScoreUpperBound > 0)
                  {
                    whereArticlesSql.push(" asa.journalImpactScore1 < :journalImpactScore1Upper");
                    let journalImpactScore1UpperBound = apiBody.filters.journalImpactScoreUpperBound;
                    replaceJounrnalImpactScoreUpperBound = {"journalImpactScore1Upper" : [journalImpactScore1UpperBound]}
                  }
                  const rawSourceClause = sourceSql("asa", apiBody.filters.sourceTypes, hasSourceColumn);
                  if (rawSourceClause) whereArticlesSql.push(" " + rawSourceClause);
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
               whereAuthorsSql.push(" " + authorPositionSql("asu", apiBody.filters.authorPosition));
                     let authorPosition = apiBody.filters.authorPosition;
                      replaceOfAuthPos = {"authorPosition": [authorPosition]};
           }

           for (const clause of dateTypeSql("asa", apiBody.filters, cols, PUB_TYPES)) whereArticlesSql.push(" " + clause);
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
              whereArticlesSql.push(" asa.journalImpactScore1 >= :journalImpactScore1Lower");
              let journalImpactScore1LowerBound = apiBody.filters.journalImpactScoreLowerBound;
              replaceJounrnalImpactScoreLowerBound = {"journalImpactScore1Lower" : [journalImpactScore1LowerBound]}
            }
            if(apiBody.filters.journalImpactScoreUpperBound && apiBody.filters.journalImpactScoreUpperBound > 0)
            {
              whereArticlesSql.push(" asa.journalImpactScore1 < :journalImpactScore1Upper");
              let journalImpactScore1UpperBound = apiBody.filters.journalImpactScoreUpperBound;
              replaceJounrnalImpactScoreUpperBound = {"journalImpactScore1Upper" : [journalImpactScore1UpperBound]}
            }
            const rawSourceClause = sourceSql("asa", apiBody.filters.sourceTypes, hasSourceColumn);
            if (rawSourceClause) whereArticlesSql.push(" " + rawSourceClause);

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
              attributes: [`id`, `pmid`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`, ...extraAttrs],
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

        attributes:[[Sequelize.fn('DISTINCT', Sequelize.col("AnalysisSummaryAuthor.pmid")), 'pmid'],
              `id`, `pmcid`, `publicationDateDisplay`, `publicationDateStandardized`, `datePublicationAddedToEntrez`, `articleTitle`, `articleTitleRTF`, `publicationTypeCanonical`, `publicationTypeNIH`, `journalTitleVerbose`, `issn`, `journalImpactScore1`, `journalImpactScore2`, `articleYear`, `doi`, `volume`, `issue`, `pages`, `citationCountScopus`, `citationCountNIH`, `percentileNIH`, `relativeCitationRatioNIH`, `readersMendeley`, `trendingPubsScore`, ...extraAttrs],
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
    // External rows (synthetic negative pmids) have no author_list rows; their byline lives in
    // analysis_summary_author.authors. Fill in any external pmid the author_list query missed.
    const found = new Set(searchOutput.map((r) => Number(r.pmid)));
    const externalPmids = (apiBody?.pmids || []).map(Number).filter((p) => p < 0 && !found.has(p));
    if (externalPmids.length) {
      const bylineRows: any[] = await models.AnalysisSummaryAuthor.findAll({
        attributes: ["pmid", "personIdentifier", "authors"],
        where: { pmid: { [Op.in]: externalPmids }, authors: { [Op.ne]: null } },
        raw: true,
      });
      const byPmid: Record<string, any[]> = {};
      bylineRows.forEach((r) => { (byPmid[r.pmid] = byPmid[r.pmid] || []).push(r); });
      Object.keys(byPmid).forEach((pmid) => {
        const authors = bylineAuthors(byPmid[pmid]);
        if (authors.length) searchOutput.push({ pmid, authors });
      });
    }
    // 5d-1: each WCM person's role on the work (analysis_summary_author.role, ReCiterDB v3.10),
    // for the note after their name. Only roles other than Author matter, and only when the
    // column exists.
    const { role: hasRole } = await authorColumns();
    const rolePmids = (apiBody?.pmids || []).map(Number).filter((p) => Number.isFinite(p) && p !== 0);
    if (hasRole && rolePmids.length && searchOutput.length) {
      const [roleRows]: any = await sequelize.query(
        "SELECT pmid, personIdentifier, role FROM analysis_summary_author " +
          "WHERE pmid IN (:pmids) AND role IS NOT NULL AND role <> 'Author' AND personIdentifier IS NOT NULL",
        { replacements: { pmids: rolePmids }, raw: true, plain: false }
      );
      const roleOf = new Map<string, string>();
      for (const r of roleRows || []) roleOf.set(`${Number(r.pmid)}|${r.personIdentifier}`, String(r.role));
      if (roleOf.size) {
        for (const entry of searchOutput) {
          for (const a of entry.authors || []) {
            const pid = typeof a?.get === "function" ? a.get("personIdentifier") : a?.personIdentifier;
            const role = pid ? roleOf.get(`${Number(entry.pmid)}|${pid}`) : undefined;
            if (!role) continue;
            if (typeof a.setDataValue === "function") a.setDataValue("role", role);
            else a.role = role;
          }
        }
      }
    }
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
    const cols = await articleColumns();
    const hasSourceColumn = cols.sourceType;
    if (apiBody.filters) {
      apiBody.filters.authorPosition = (apiBody.filters.authorPosition || []).filter((p) => !!authorPositionSql("x", [p]));
    }
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
        where[Op.and].push(Sequelize.literal(authorPositionSql("AnalysisSummaryAuthor", apiBody.filters.authorPosition)));
        whereForOnlyAuthors[Op.and].push(Sequelize.literal(authorPositionSql("AnalysisSummaryAuthor", apiBody.filters.authorPosition)));

        joinWhereAuthorsFilters[Op.and].push(Sequelize.literal(authorPositionSql("AnalysisSummaryAuthor", apiBody.filters.authorPosition)));

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
      // Date added, Publication date and grouped Type (5c): shared fragments, see reportFilterSql.ts.
      const dateTypeClauses = dateTypeSql("AnalysisSummaryArticle", apiBody.filters, cols, PUB_TYPES);
      for (const clause of dateTypeClauses) {
        where[Op.and].push(Sequelize.literal(clause));
        whereForOnlyArticles[Op.and].push(Sequelize.literal(clause));
      }
      if (dateTypeClauses.length) isArticleFilter = true;
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
      const sourceClause = sourceSql("AnalysisSummaryArticle", apiBody.filters.sourceTypes, hasSourceColumn);
      if (sourceClause) {
        where[Op.and].push(Sequelize.literal(sourceClause));
        whereForOnlyArticles[Op.and].push(Sequelize.literal(sourceClause));
        isArticleFilter = true;
      }
      if (
        apiBody.filters.journalImpactScoreLowerBound &&
        apiBody.filters.journalImpactScoreUpperBound
      ) {
        where[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore1$": {
            [Op.gte]: apiBody.filters.journalImpactScoreLowerBound,
          },
        });
        where[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore2$": {
            [Op.lt]: apiBody.filters.journalImpactScoreUpperBound,
          },
        });
        whereForOnlyArticles[Op.and].push({
          "$AnalysisSummaryArticle.journalImpactScore1$": {
            [Op.gte]: apiBody.filters.journalImpactScoreLowerBound,
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
	
    const sort = buildReportSort((apiBody && apiBody.sort) || DEFAULT_REPORT_SORT, cols);
	
    let results:any  =[];
    let resultsCount;

    if (isAuthorFilter || isArticleFilter) {
    
      if(!isAuthorFilter && isArticleFilter){   // Filter Only with Articles and not Authors
        for (const clause of dateTypeSql("asa", apiBody.filters, cols, PUB_TYPES)) whereArticlesSql.push(" " + clause);
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
           whereArticlesSql.push(" asa.journalImpactScore1 >= :journalImpactScore1Lower");
           let journalImpactScore1LowerBound = apiBody.filters.journalImpactScoreLowerBound;
           replaceJounrnalImpactScoreLowerBound = {"journalImpactScore1Lower" : [journalImpactScore1LowerBound]}
        }
        if(apiBody.filters.journalImpactScoreUpperBound && apiBody.filters.journalImpactScoreUpperBound > 0)
        {
           whereArticlesSql.push(" asa.journalImpactScore1 < :journalImpactScore1Upper");
           let journalImpactScore1UpperBound = apiBody.filters.journalImpactScoreUpperBound;
           replaceJounrnalImpactScoreUpperBound = {"journalImpactScore1Upper" : [journalImpactScore1UpperBound]}
        }
        const rawSourceClause = sourceSql("asa", apiBody.filters.sourceTypes, hasSourceColumn);
        if (rawSourceClause) whereArticlesSql.push(" " + rawSourceClause);

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
       
        // Unfiltered: one row per authorship across the whole table. Only pmid and the row count
        // are used, so select just pmid as plain rows -- the 25-column model instances OOM-killed
        // the prod pod (2Gi) when CSV/RTF was opened on an unfiltered report.
        attributes: [`pmid`],
        raw: true,
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
