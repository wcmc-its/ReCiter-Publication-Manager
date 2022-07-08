import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize } from "sequelize";
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

models.AnalysisSummaryArticle.hasOne(models.Person, { constraints: false });
models.AnalysisSummaryArticle.hasMany(models.PersonPersonType, {
  constraints: false,
  foreignKey: 'id'
});
models.AnalysisSummaryArticle.hasOne(models.AnalysisSummaryAuthor, {
  constraints: false,
  foreignKey: 'id'
});
// models.AnalysisSummaryAuthor.hasOne(models.AnalysisSummaryAuthor, {
//   constraints: false,
//   foreignKey: 'id'
// });

export const publicationSearchWithFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let apiBody: PublicationSearchFilter = req.body;
    const where = {};
    if (apiBody.filters) {
      where[Op.and] = [];
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
        where[Op.and].push({
          "$Person.primaryOrganizationalUnit$": {
            [Op.in]: apiBody.filters.orgUnits,
          },
        });
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
    let searchOutput: { count?: number; rows?: AnalysisSummaryArticle[] } = {};
    if (apiBody.filters) {
      let results = await models.AnalysisSummaryArticle.findAndCountAll({
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
            attributes: [],
          },
        ],
        where: where,
        subQuery: false,
        limit: apiBody.limit,
        offset: apiBody.offset,
        order: sort,
        group: ["AnalysisSummaryAuthor.pmid"],
        distinct: true
      });
      searchOutput = { 
        ...results,
        count: results.count.length
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
            [Op.lte]: 60,
          }
        ),
        limit: apiBody.limit,
        offset: apiBody.offset,
        order: sort,
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
    if (apiBody.filters) {
      where[Op.and] = [];
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
        where[Op.and].push({
          "$Person.primaryOrganizationalUnit$": {
            [Op.in]: apiBody.filters.orgUnits,
          },
        });
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
    let searchOutput: any  = [];
    if (apiBody.filters) {
      let results = await models.AnalysisSummaryArticle.findAll({
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
            attributes: [],
          },
        ],
        where: where,
        subQuery: false,
        order: sort,
        group: ["AnalysisSummaryAuthor.pmid"],
        attributes: ["pmid"]
      });
      let pmids = results.map(result => result.pmid);
      let personIdentifiers: any[] = [];
      if (pmids && pmids.length > 0) {
        // get personIdentifiers
        const whereAuthors = {};
        whereAuthors[Op.and] = [];
        whereAuthors[Op.and].push({
          "$AnalysisSummaryAuthorList.pmid$": {
            [Op.in]: pmids,
          },
        });
        personIdentifiers = await models.AnalysisSummaryAuthorList.findAll({
          attributes: [
            "personIdentifier",
          ],
          where: whereAuthors,
          group: ["personIdentifier"]
        }).then((output) => {
          return output.map(result => result.personIdentifier);
        })
      }
      // searchOutput = results.map(result => result.pmid);
      searchOutput = { personIdentifiers, pmids };
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
      });
      searchOutput = results.map(result => result.pmid);
    }
    return searchOutput;
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};
