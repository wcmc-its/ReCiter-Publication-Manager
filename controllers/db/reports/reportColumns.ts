import sequelize from "../../../src/db/db";

// Optional analysis_summary_article columns: source_type / article_id (ReCiterDB v1.6 / v1.7) and
// the 5c columns (v3.7: pubType, pubTypeGroup, pubDate, dateAdded, publisher, isbn, editors, ...)
// and the 5d-1 peer-review columns (v3.10: peerReviewed, peerReviewedSource).
// The PM model declares none of them, and a database that predates them (the dev DB, or prod
// before the DDL) must keep working, so look once per process and only select, filter or sort on
// the columns that exist.
export type ArticleColumns = {
  sourceType: boolean;
  articleId: boolean;
  pubType: boolean;
  pubTypeGroup: boolean;
  pubDate: boolean;
  pubDatePrecision: boolean;
  dateAdded: boolean;
  publisher: boolean;
  isbn: boolean;
  editors: boolean;
  peerReviewed: boolean;
  peerReviewedSource: boolean;
};

// [column name, ArticleColumns key = result-row attribute name]
const PROBED: Array<[string, keyof ArticleColumns]> = [
  ["source_type", "sourceType"],
  ["article_id", "articleId"],
  ["pubType", "pubType"],
  ["pubTypeGroup", "pubTypeGroup"],
  ["pubDate", "pubDate"],
  ["pubDatePrecision", "pubDatePrecision"],
  ["dateAdded", "dateAdded"],
  ["publisher", "publisher"],
  ["isbn", "isbn"],
  ["editors", "editors"],
  ["peerReviewed", "peerReviewed"],
  ["peerReviewedSource", "peerReviewedSource"],
];

const none = (): ArticleColumns => Object.fromEntries(PROBED.map(([, key]) => [key, false])) as ArticleColumns;

// A probe that finds every column is kept for the life of the process. One that finds some missing
// is re-run after PROBE_RECHECK_MS, so a pod started before a ReCiterDB DDL (v3.7, v3.10) picks the
// new columns up without a restart.
export const PROBE_RECHECK_MS = 10 * 60 * 1000;

let cached: Promise<ArticleColumns> | null = null;
let cachedRecheckAt = 0;

export const articleColumns = (): Promise<ArticleColumns> => {
  if (cached && cachedRecheckAt && Date.now() >= cachedRecheckAt) cached = null;
  if (!cached) {
    cachedRecheckAt = 0;
    cached = sequelize
      .query(
        "SELECT column_name AS name FROM information_schema.columns " +
          "WHERE table_schema = DATABASE() AND table_name = 'analysis_summary_article' " +
          `AND column_name IN (${PROBED.map(([col]) => `'${col}'`).join(", ")})`,
        { raw: true, plain: false }
      )
      .then(([rows]: any) => {
        const names = new Set((rows || []).map((r: any) => String(r.name || r.NAME || r.COLUMN_NAME).toLowerCase()));
        const out = none();
        for (const [col, key] of PROBED) out[key] = names.has(col.toLowerCase());
        if (PROBED.some(([, key]) => !out[key])) cachedRecheckAt = Date.now() + PROBE_RECHECK_MS;
        return out;
      })
      .catch((e) => {
        cached = null; // retry on the next request
        console.log("[reports] column probe failed", e?.message);
        return none();
      });
  }
  return cached;
};

// Extra AnalysisSummaryArticle attributes for result rows: the Source badge, the external id and
// the 5c type / date / venue fields and the 5d-1 peer-review fields.
export const articleExtraAttributes = async (): Promise<[string, string][]> => {
  const cols = await articleColumns();
  return PROBED.filter(([, key]) => cols[key]).map(([col, key]) => [col, key] as [string, string]);
};

// analysis_summary_author.role (ReCiterDB v3.10, 5d-1): the person's role on the work. Same
// once-per-process probe, so the author lists work on a database without it.
let authorCached: Promise<{ role: boolean }> | null = null;
let authorRecheckAt = 0;

export const authorColumns = (): Promise<{ role: boolean }> => {
  if (authorCached && authorRecheckAt && Date.now() >= authorRecheckAt) authorCached = null;
  if (!authorCached) {
    authorRecheckAt = 0;
    authorCached = sequelize
      .query(
        "SELECT column_name AS name FROM information_schema.columns " +
          "WHERE table_schema = DATABASE() AND table_name = 'analysis_summary_author' AND column_name = 'role'",
        { raw: true, plain: false }
      )
      .then(([rows]: any) => {
        const role = (rows || []).length > 0;
        if (!role) authorRecheckAt = Date.now() + PROBE_RECHECK_MS;
        return { role };
      })
      .catch((e) => {
        authorCached = null; // retry on the next request
        console.log("[reports] author column probe failed", e?.message);
        return { role: false };
      });
  }
  return authorCached;
};
