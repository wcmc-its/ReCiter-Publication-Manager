import { Sequelize } from "sequelize";
import { dateAddedExpr, pubDateExpr, type ReportDateTypeColumns } from "./reportFilterSql";

// Sort keys the reports UI can send (config/report.js sortOptions) -> AnalysisSummaryArticle
// column. Shared by the on-screen search and the CSV exports so the two can't drift apart.
export const REPORT_SORT_COLUMNS: Record<string, string> = {
  datePublicationAddedToEntrez: "datePublicationAddedToEntrez",
  citationCountNIH: "citationCountNIH",
  journalImpactScore1: "journalImpactScore1",
  journalImpactScore2: "journalImpactScore2",
  percentileNIH: "percentileNIH",
  publicationDateStandardized: "publicationDateStandardized",
  // legacy admin_settings reportingWebViewSort key spelling (see config/report.js)
  publicationDateStandarized: "publicationDateStandardized",
  readersMendeley: "readersMendeley",
  trendingPubsScore: "trendingPubsScore",
  citationCountScopus: "citationCountScopus",
  relativeCitationRatioNIH: "relativeCitationRatioNIH",
};

// Date sorts that follow the 5c columns (ReCiterDB v3.7) when the probe finds them: the legacy
// "Date added" and "Publication date" keys, plus the new key names. Without the columns each
// falls back to the column in REPORT_SORT_COLUMNS, so the order is exactly what it was.
export const REPORT_DATE_SORTS: Record<string, "dateAdded" | "pubDate"> = {
  datePublicationAddedToEntrez: "dateAdded",
  dateAdded: "dateAdded",
  publicationDateStandardized: "pubDate",
  publicationDateStandarized: "pubDate",
  pubDate: "pubDate",
};

const isKey = (map: Record<string, unknown>, key?: string): boolean =>
  !!key && Object.prototype.hasOwnProperty.call(map, key);

export const isReportSortKey = (key?: string): boolean => isKey(REPORT_SORT_COLUMNS, key) || isKey(REPORT_DATE_SORTS, key);

// The SQL expression a sort key orders by. `alias` qualifies the columns ("" = bare names, as in
// the Sequelize queries; "asa" in raw SQL). Undefined for an unknown key.
export const reportSortExpr = (key: string | undefined, alias: string, cols: ReportDateTypeColumns = {}): string | undefined => {
  const a = alias ? `${alias}.` : "";
  if (isKey(REPORT_DATE_SORTS, key)) {
    if (REPORT_DATE_SORTS[key] === "dateAdded") return dateAddedExpr(alias, cols);
    return cols.pubDate ? pubDateExpr(alias, cols) : `${a}publicationDateStandardized`;
  }
  if (isKey(REPORT_SORT_COLUMNS, key)) return `${a}${REPORT_SORT_COLUMNS[key]}`;
  return undefined;
};

// What the page sorts by when the request names no sort: newest added first.
export const DEFAULT_REPORT_SORT = { type: "datePublicationAddedToEntrez", order: "DESC" };

// Nulls last in either direction, as before. Unknown sort types add no ordering. `alias` qualifies
// the columns: the exports in publication.report.controller.ts join `person`, which has its own
// `dateAdded`, so there a bare name is ambiguous and they pass "AnalysisSummaryArticle".
export const buildReportSort = (apiSort?: { type?: string; order?: string }, cols: ReportDateTypeColumns = {}, alias = ""): any[] => {
  const sort = [];
  const expr = apiSort ? reportSortExpr(apiSort.type, alias, cols) : undefined;
  if (expr) {
    const sortOrder = apiSort.order && apiSort.order.toUpperCase() === "ASC" ? "ASC" : "DESC";
    sort.push([Sequelize.literal(`isnull(${expr}), ${expr} ${sortOrder}`)]);
  }
  return sort;
};
