import { Sequelize } from "sequelize";

// Sort keys the reports UI can send (config/report.js sortOptions) -> AnalysisSummaryArticle
// column. Shared by the on-screen search and the CSV exports so the two can't drift apart.
export const REPORT_SORT_COLUMNS: Record<string, string> = {
  datePublicationAddedToEntrez: "datePublicationAddedToEntrez",
  citationCountNIH: "citationCountNIH",
  journalImpactScore1: "journalImpactScore1",
  journalImpactScore2: "journalImpactScore2",
  percentileNIH: "percentileNIH",
  publicationDateStandardized: "publicationDateStandardized",
  readersMendeley: "readersMendeley",
  trendingPubsScore: "trendingPubsScore",
  citationCountScopus: "citationCountScopus",
  relativeCitationRatioNIH: "relativeCitationRatioNIH",
};

// Nulls last in either direction, as before. Unknown sort types add no ordering.
export const buildReportSort = (apiSort?: { type?: string; order?: string }): any[] => {
  const sort = [];
  const column = apiSort && Object.prototype.hasOwnProperty.call(REPORT_SORT_COLUMNS, apiSort.type)
    ? REPORT_SORT_COLUMNS[apiSort.type]
    : undefined;
  if (column) {
    const sortOrder = apiSort.order && apiSort.order.toUpperCase() === "ASC" ? "ASC" : "DESC";
    sort.push([Sequelize.literal(`isnull(${column}), ${column} ${sortOrder}`)]);
  }
  return sort;
};
