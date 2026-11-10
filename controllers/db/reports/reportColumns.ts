import sequelize from "../../../src/db/db";

// analysis_summary_article.source_type / article_id arrived with ReCiterDB v1.6 / v1.7. The PM
// model doesn't declare them, and a database that predates them (the dev DB) must keep working,
// so look once per process and only select or filter on the columns that exist.
type ArticleColumns = { sourceType: boolean; articleId: boolean };

let cached: Promise<ArticleColumns> | null = null;

export const articleColumns = (): Promise<ArticleColumns> => {
  if (!cached) {
    cached = sequelize
      .query(
        "SELECT column_name AS name FROM information_schema.columns " +
          "WHERE table_schema = DATABASE() AND table_name = 'analysis_summary_article' " +
          "AND column_name IN ('source_type', 'article_id')",
        { raw: true, plain: false }
      )
      .then(([rows]: any) => {
        const names = new Set((rows || []).map((r: any) => String(r.name || r.NAME || r.COLUMN_NAME).toLowerCase()));
        return { sourceType: names.has("source_type"), articleId: names.has("article_id") };
      })
      .catch((e) => {
        cached = null; // retry on the next request
        console.log("[reports] column probe failed", e?.message);
        return { sourceType: false, articleId: false };
      });
  }
  return cached;
};

// Extra AnalysisSummaryArticle attributes for result rows: the Source badge and the external id.
export const articleExtraAttributes = async (): Promise<[string, string][]> => {
  const cols = await articleColumns();
  const out: [string, string][] = [];
  if (cols.sourceType) out.push(["source_type", "sourceType"]);
  if (cols.articleId) out.push(["article_id", "articleId"]);
  return out;
};
