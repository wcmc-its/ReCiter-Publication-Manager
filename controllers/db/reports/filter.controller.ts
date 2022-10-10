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
    const { authorFilter } = req.query;
    const count = req.query.count as string;
    let limit = parseInt(count) || 10;
    let persons = null as any;
    if(!authorFilter) 
    {
      persons = await models.Person.findAll({
          //order: [["personType", "ASC"]],
          attributes: [
            "personIdentifier",
            "firstName",
            "lastName",
            "primaryOrganizationalUnit",
          ],
          order: [
              Sequelize.fn('isnull', Sequelize.col('lastName')),
              ['lastName', 'ASC'],
              Sequelize.fn('isnull', Sequelize.col('firstName')),
              ['firstName', 'ASC']
          ],
        
          limit: limit
        });
  }
  else
  {
    persons = await models.Person.findAll({
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
              [Op.like]: `%${authorFilter}%`,
            },
          },
          {
            firstName: {
              [Op.like]: `%${authorFilter}%`,
            },
          },
          {
            middleName: {
              [Op.like]: `%${authorFilter}%`,
            },
          },
          {
            lastName: {
              [Op.like]: `%${authorFilter}%`,
            },
          },
        ],
      },
      order: [
          Sequelize.fn('isnull', Sequelize.col('lastName')),
          ['lastName', 'ASC'],
          Sequelize.fn('isnull', Sequelize.col('firstName')),
          ['firstName', 'ASC']
      ],
       
      limit: limit
    });

  }
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
      order: [
        Sequelize.fn('isnull', Sequelize.col('publicationTypeCanonical')),
        ['publicationTypeCanonical', 'ASC']
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
    const { journalFilter } = req.query;
    const count = req.query.count as string;
    let limit = parseInt(count) || 10;
    if (journalFilter) {
      where = {
        journalTitleVerbose: {
          [Op.like]: `%${journalFilter}%`,
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
      limit: limit,
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
