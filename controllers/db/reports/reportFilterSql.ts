// SQL fragments for the /report filters that the older where-builders can't express: Middle author
// position (stored as NULL) and Source (analysis_summary_article.source_type). Values are matched
// against fixed allowlists and inlined, so no replacements or escaping are needed and every query
// path (Sequelize literal or raw SQL) can share one fragment. Pure: no imports, unit-tested.

export const AUTHOR_POSITIONS = ["first", "middle", "last"] as const;

// analysis_summary_article.source_type values (ReCiterDB v1.6; CROSSREF since v3.4).
export const REPORT_SOURCES = ["PUBMED", "SCOPUS", "OPENALEX", "CROSSREF", "WOS"] as const;

// `alias` is the author table's alias in the query: `asu` in raw SQL, `AnalysisSummaryAuthor` in
// Sequelize. PubMed and external rows both store a middle author as NULL (ReCiterDB #250).
// Returns null when nothing valid is selected (no filter).
export const authorPositionSql = (alias: string, positions?: string[] | null): string | null => {
  const picked = (positions || []).filter((p) => (AUTHOR_POSITIONS as readonly string[]).includes(p));
  if (!picked.length) return null;
  const parts: string[] = [];
  const named = picked.filter((p) => p !== "middle");
  if (named.length) parts.push(`${alias}.authorPosition IN (${named.map((p) => `'${p}'`).join(", ")})`);
  if (picked.includes("middle")) parts.push(`${alias}.authorPosition IS NULL`);
  return `(${parts.join(" OR ")})`;
};

// `alias` is the article table's alias: `asa` in raw SQL, `AnalysisSummaryArticle` in Sequelize.
// Without the source_type column (an older ReCiterDB, e.g. the dev DB) the only signal is the pmid:
// external rows are unioned in under a synthetic negative pmid.
export const sourceSql = (alias: string, sources: string[] | null | undefined, hasSourceColumn: boolean): string | null => {
  const picked = (sources || []).filter((s) => (REPORT_SOURCES as readonly string[]).includes(s));
  if (!picked.length) return null;
  if (hasSourceColumn) {
    return `(COALESCE(${alias}.source_type, 'PUBMED') IN (${picked.map((s) => `'${s}'`).join(", ")}))`;
  }
  const pubmed = picked.includes("PUBMED");
  const external = picked.some((s) => s !== "PUBMED");
  if (pubmed && external) return "(1 = 1)";
  return pubmed ? `(${alias}.pmid > 0)` : `(${alias}.pmid < 0)`;
};
