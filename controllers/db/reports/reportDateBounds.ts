// Sequelize where clauses for the /report "date added to PubMed" range: strictly after the lower
// bound and strictly before the upper bound, each applied on its own when only one is set.
import { Op } from "sequelize";

const COLUMN = "$AnalysisSummaryArticle.datePublicationAddedToEntrez$";

export const entrezDateBoundClauses = (lower?: string | null, upper?: string | null): object[] => {
  const clauses: object[] = [];
  if (lower) clauses.push({ [COLUMN]: { [Op.gt]: lower } });
  if (upper) clauses.push({ [COLUMN]: { [Op.lt]: upper } });
  return clauses;
};
