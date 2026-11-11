import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";
import { articleColumns } from "./reportColumns";
import { dateAddedExpr, pubDateExpr } from "./reportFilterSql";
import { groupedTypeOptions } from "../../../src/utils/reportRow";
import { PUB_TYPE_GROUPS } from "../../../src/lib/pubTypes";
import  {reciterConstants}  from "../../../src/utils/constants";
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
    let authorFilterArray =[];
    if(authorFilter.indexOf(',') > 0)
       authorFilterArray = (authorFilter as string).split(',')
    else
      authorFilterArray = (authorFilter as string).split(' ')

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
  else if(authorFilterArray && Array.isArray(authorFilterArray) && authorFilterArray.length > 0)
  {
    const where = {}
    where[Op.and] = []
    if(authorFilterArray && authorFilterArray.length > reciterConstants.nameCWIDSpaceCountThreshold) {
      where[Op.and].push({[Op.or]:[
          {'$Person.personIdentifier$': { [Op.in]: authorFilterArray }},
      ]})
 
     }
    else if(where[Op.and] && authorFilterArray && authorFilterArray.length <= reciterConstants.nameCWIDSpaceCountThreshold) {
        authorFilterArray.forEach((name: string) => {
                where[Op.and].push({[Op.or]:[{'$Person.firstName$': { [Op.like]: `%${name}%`}},
              {'$Person.middleName$': { [Op.like]: `%${name}%`}},
                {'$Person.lastName$': { [Op.like]: `%${name}%`}},
                {'$Person.personIdentifier$': { [Op.like]: `%${name}%`}}]})
            })
        }
    persons = await models.Person.findAll({
      //order: [["personType", "ASC"]],
      attributes: [
        "personIdentifier",
        "firstName",
        "lastName",
        "primaryOrganizationalUnit",
      ],
      where: where,
      order: [
          Sequelize.fn('isnull', Sequelize.col('lastName')),
          ['lastName', 'ASC'],
          Sequelize.fn('isnull', Sequelize.col('firstName')),
          ['firstName', 'ASC']
      ],
    
     // limit: limit
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

// Bounds for the two date ranges. minDate / maxDate (Date added) keep their names for the
// DatePicker; minPubDate / maxPubDate feed the Publication date range. Same expressions as the
// search, so the bounds match what the filters compare against.
export const dateFilter = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const cols = await articleColumns();
    const [rows]: any = await sequelize.query(
      `SELECT MIN(${dateAddedExpr("", cols)}) AS minDate, MAX(${dateAddedExpr("", cols)}) AS maxDate, ` +
        `MIN(${pubDateExpr("", cols)}) AS minPubDate, MAX(${pubDateExpr("", cols)}) AS maxPubDate ` +
        "FROM analysis_summary_article",
      { raw: true, plain: false }
    );
    res.send((rows || []).map((r: any) => ({
      minDate: dateText(r.minDate),
      maxDate: dateText(r.maxDate),
      minPubDate: dateText(r.minPubDate),
      maxPubDate: dateText(r.maxPubDate),
    })));
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

// mysql2 hands a DATE back as a JS Date at local midnight; keep the calendar day.
const dateText = (v: any): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  return String(v);
};

// Type filter options. With the 5c columns filled: one row per (pubTypeGroup, pubType) with a
// count, which the client renders as the grouped checklist (filter key `pubTypes`). Otherwise, or
// while the columns are still empty (the DDL lands before the nightly that fills them), the old
// flat list of publicationTypeCanonical values (filter key `publicationTypeCanonical`).
export const articleTypeFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const cols = await articleColumns();
    if (cols.pubType && cols.pubTypeGroup) {
      const [rows]: any = await sequelize.query(
        "SELECT pubTypeGroup, pubType, COUNT(*) AS count FROM analysis_summary_article " +
          "WHERE pubType IS NOT NULL GROUP BY pubTypeGroup, pubType",
        { raw: true, plain: false }
      );
      const grouped = groupedTypeOptions(rows || [], PUB_TYPE_GROUPS);
      if (grouped.length) {
        res.send(grouped);
        return;
      }
    }
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
    // NULL titles sort first under ASC and crash the dropdown's label filter.
    let where: any = { journalTitleVerbose: { [Op.ne]: null } };
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
    let journalTitles = [];
    if(journalFilter){
       journalTitles = await models.AnalysisSummaryArticle.findAll({
        attributes: [
          [
            Sequelize.fn("DISTINCT", Sequelize.col("journalTitleVerbose")),
            "journalTitleVerbose",
          ],
        ],
        where: where,
        order: [["journalTitleVerbose", "ASC"]],
        // limit: limit,
      });
    }else{
       journalTitles = await models.AnalysisSummaryArticle.findAll({
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
    }

    
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
