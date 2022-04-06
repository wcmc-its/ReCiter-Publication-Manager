import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";
import {
    AuthorFilter,
    JournalFilter
} from "../../../types/publication.report.filter";

export const authorFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let apiBody: AuthorFilter = req.body;
    const persons = await models.Person.findAll({
      //order: [["personType", "ASC"]],
      attributes: [
        "personIdentifier",
        "firstName",
        "lastName",
        "primaryOrganizationalUnit",
      ],
      where: {
        [Op.or]: [
          {
            personIdentifier: {
              [Op.like]: `%${apiBody.authorFilter}%`,
            },
          },
          {
            firstName: {
              [Op.like]: `%${apiBody.authorFilter}%`,
            },
          },
          {
            middleName: {
              [Op.like]: `%${apiBody.authorFilter}%`,
            },
          },
          {
            lastName: {
              [Op.like]: `%${apiBody.authorFilter}%`,
            },
          },
        ],
      },
      limit: 20,
    });

    res.send(persons);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const dateFilter = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const dateRange = await models.AnalysisSummaryArticle.findAll({
      attributes: [
        [
          Sequelize.fn("MIN", Sequelize.col("datePublicationAddedToEntrez")),
          "minDate",
        ],
        [
          Sequelize.fn("MAX", Sequelize.col("datePublicationAddedToEntrez")),
          "maxDate",
        ],
      ],
    });
    res.send(dateRange);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const articleTypeFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const articleTypes = await models.AnalysisSummaryArticle.findAll({
      attributes: [
        [
          Sequelize.fn("DISTINCT", Sequelize.col("publicationTypeCanonical")),
          "publicationTypeCanonical",
        ],
      ],
    });
    res.send(articleTypes);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const journalFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let where = {};
    let apiBody: JournalFilter = req.body;
    if (apiBody && apiBody.journalFilter) {
      where = {
        journalTitleVerbose: {
          [Op.like]: `%${apiBody.journalFilter}%`,
        },
      };
    }
    const journalTitles = await models.AnalysisSummaryArticle.findAll({
      attributes: [
        [
          Sequelize.fn("DISTINCT", Sequelize.col("journalTitleVerbose")),
          "journalTitleVerbose",
        ],
      ],
      where: where,
      order: [["journalTitleVerbose", "ASC"]],
      limit: 20,
    });
    res.send(journalTitles);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const journalRankFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const journalRank = await models.AnalysisSummaryArticle.findAll({
      attributes: [
        [Sequelize.literal("0"), "minJournalRank"],
        [
          Sequelize.fn("MAX", Sequelize.col("journalImpactScore1")),
          "maxJournalRank",
        ],
      ],
    });
    res.send(journalRank);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};