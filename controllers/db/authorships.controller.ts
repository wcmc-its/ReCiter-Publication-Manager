import type { NextApiRequest, NextApiResponse } from "next";
import { Op, fn, col } from "sequelize";
import models from "../../src/db/sequelize";

// Columns returned to the Authorships tab (one row per unassigned WCM authorship).
const LIST_ATTRIBUTES = [
  "id", "pmid", "author_key", "wcm_author", "author_position_label",
  "entrez_date", "title", "journal", "doi", "classification",
  "top_cwid", "top_name", "top_person_type", "top_dept",
  "top_fg_score", "top_io_score", "top_confidence", "top_cohort_size",
  "top_given_match", "top_affil_match", "n_candidates", "single_candidate",
  "candidate_cwids_json", "status",
];

const SORTS: Record<string, any[]> = {
  // default: single-candidate (high-precision) first, then identity-only score desc
  precision: [["single_candidate", "DESC"], ["top_io_score", "DESC"]],
  confidence: [["top_confidence", "DESC"]],
  io: [["top_io_score", "DESC"]],
  fg: [["top_fg_score", "DESC"]],
  date: [["entrez_date", "DESC"]],
};

function buildWhere(body: any): any {
  const and: any[] = [];

  // feed: unassigned (open/snoozed) is the default; "all" drops the status filter
  if (body.feed !== "all") {
    and.push({ status: { [Op.in]: ["open", "snoozed"] } });
  }
  // classification lane: buried | suggested | absent
  if (body.classification && body.classification !== "all") {
    and.push({ classification: body.classification });
  }
  // precision lane: only single-candidate (near-certain) authorships
  if (body.precision === "single") {
    and.push({ single_candidate: true });
  }
  // free-text search across author name, proposed identity, and pmid
  const search = (body.searchTextInput || "").trim();
  if (search) {
    const like = `%${search}%`;
    const or: any[] = [
      { wcm_author: { [Op.like]: like } },
      { top_name: { [Op.like]: like } },
      { top_cwid: { [Op.like]: like } },
    ];
    if (/^\d+$/.test(search)) or.push({ pmid: Number(search) });
    and.push({ [Op.or]: or });
  }
  // publication-date range (entrez_date is DATEONLY → compare YYYY-MM-DD strings)
  const dateFrom = (body.dateFrom || "").trim();
  const dateTo = (body.dateTo || "").trim();
  if (dateFrom && dateTo) {
    and.push({ entrez_date: { [Op.between]: [dateFrom, dateTo] } });
  } else if (dateFrom) {
    and.push({ entrez_date: { [Op.gte]: dateFrom } });
  } else if (dateTo) {
    and.push({ entrez_date: { [Op.lte]: dateTo } });
  }

  return and.length ? { [Op.and]: and } : {};
}

// POST /api/db/authorships — paginated, filtered list of unassigned WCM authorships.
export const listAuthorships = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const body = req.body || {};
    const limit = Number(body.limit) || 25;
    const offset = Number(body.offset) || 0;
    const order = SORTS[body.sort] || SORTS.precision;

    const { count, rows } = await models.AuthorshipReview.findAndCountAll({
      attributes: LIST_ATTRIBUTES,
      where: buildWhere(body),
      order,
      offset,
      limit,
    });

    res.send({ rows, count, limit, offset });
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

// POST /api/db/authorships/summary — counts per classification + precision lane, for the
// tab headers. Honours the same feed/search filters but ignores classification/precision so
// each lane shows its own total.
export const authorshipSummary = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const body = { ...(req.body || {}), classification: "all", precision: "all" };
    const where = buildWhere(body);
    const [total, single, byClass] = await Promise.all([
      models.AuthorshipReview.count({ where }),
      models.AuthorshipReview.count({ where: { [Op.and]: [where, { single_candidate: true }] } }),
      models.AuthorshipReview.findAll({
        attributes: [
          "classification",
          [fn("COUNT", col("id")), "n"],
        ],
        where,
        group: ["classification"],
        raw: true,
      }),
    ]);
    const classes: Record<string, number> = {};
    (byClass as any[]).forEach((r) => { classes[r.classification] = Number(r.n); });
    res.send({ total, single_candidate: single, classes });
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};
