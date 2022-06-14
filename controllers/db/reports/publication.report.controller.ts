import type { NextApiRequest, NextApiResponse } from "next";
import sequelize from "../../../src/db/db";
import { GeneratePubsApiBody, GeneratePubsPeopleOnlyApiBody } from "../../../types/publication.report.body";
import { PublicationSearchFilter } from '../../../types/publication.report.search';
import { Op, Sequelize } from "sequelize";
import { limits, metrics } from "../../../config/report";
import {
  AnalysisSummaryArticle,
  PersonArticleAuthor
} from "../../../src/db/models/init-models";
import models from "../../../src/db/sequelize";

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
    const generatePubsRtfOutput: any = await sequelize.query(
      "CALL generatePubsRTF (:uids , :pmids)",
      {
        replacements: { uids: apiBody.personIdentifiers.join(','), pmids: apiBody.pmids.join(',') },
        raw: true,
      }
    );
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
      const where = {};
      let limit = limits.maxCountPubsReturn;
      let articleLevelMetrics = Object.keys(metrics).filter(metric => metrics[metric]);
      let doiUrl = 'https://dx.doi.org/';
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
              [Sequelize.fn("CONCAT", doiUrl, Sequelize.col("doi")), "doi"],
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
        group: ["AnalysisSummaryAuthor.pmid", "AnalysisSummaryAuthor.personIdentifier"],
        order: [],
        limit: 100,
        subQuery: false,
        attributes: []
      })
      return searchOutput;
    } catch (e) {
      console.log(e);
      res.status(500).send(e);
    }
  };