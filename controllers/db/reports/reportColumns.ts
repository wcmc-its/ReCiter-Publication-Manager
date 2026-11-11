import sequelize from "../../../src/db/db";

// Optional analysis_summary_article columns: source_type / article_id (ReCiterDB v1.6 / v1.7) and
// the 5c columns (v3.7: pubType, pubTypeGroup, pubDate, dateAdded, publisher, isbn, editors, ...)
// and the 5e OpenAlex citation count (v3.9: citationCountOpenAlex).
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
  citationCountOpenAlex: boolean;
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
  ["citationCountOpenAlex", "citationCountOpenAlex"],
];

const none = (): ArticleColumns => Object.fromEntries(PROBED.map(([, key]) => [key, false])) as ArticleColumns;

let cached: Promise<ArticleColumns> | null = null;

export const articleColumns = (): Promise<ArticleColumns> => {
  if (!cached) {
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
// the 5c type / date / venue fields and the 5e OpenAlex citation count.
export const articleExtraAttributes = async (): Promise<[string, string][]> => {
  const cols = await articleColumns();
  return PROBED.filter(([, key]) => cols[key]).map(([col, key]) => [col, key] as [string, string]);
};
