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

// ReCiterDB v3.7 (5c) adds analysis_summary_article.pubType / pubTypeGroup / pubDate / dateAdded
// and friends. reportColumns.ts probes for them; every fragment below falls back to the older
// columns when they're absent, so one PM build works before and after the DDL.
export type ReportDateTypeColumns = { pubType?: boolean; pubDate?: boolean; dateAdded?: boolean };

// Filter keys. The "Date added" range keeps its old key names so saved links and admin settings
// still work; `publicationTypeCanonical` (the old flat Type list) is still honored too.
export type ReportDateTypeFilters = {
  datePublicationAddedToEntrezLowerBound?: string | null;
  datePublicationAddedToEntrezUpperBound?: string | null;
  pubDateLowerBound?: string | null;
  pubDateUpperBound?: string | null;
  pubTypes?: string[] | null;
};

// A bound is a calendar date. Anything else is dropped, which also makes it safe to inline.
export const isoDateOf = (v: unknown): string | null => {
  const m = String(v ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

// "Date added where present, else publication date" (Nov 9 decision). The legacy column is the
// last fallback, for the window between the DDL and the first nightly that fills the new ones.
// Without the new columns it's the legacy column alone, as before. The pieces are DATE or
// 'YYYY-MM-DD' strings, so comparing against an inlined 'YYYY-MM-DD' is right either way.
export const dateAddedExpr = (alias: string, cols: ReportDateTypeColumns): string => {
  const a = alias ? `${alias}.` : "";
  if (!cols.dateAdded) return `${a}datePublicationAddedToEntrez`;
  return `COALESCE(${a}dateAdded, ${cols.pubDate ? `${a}pubDate, ` : ""}NULLIF(${a}datePublicationAddedToEntrez, ''))`;
};

// Publication date: the normalized DATE when present, else the YYYY-MM-DD string ReCiterDB has
// always stored. Year-only strings ('2024', one Crossref row) fall outside any range.
export const pubDateExpr = (alias: string, cols: ReportDateTypeColumns): string => {
  const a = alias ? `${alias}.` : "";
  return cols.pubDate
    ? `COALESCE(${a}pubDate, NULLIF(${a}publicationDateStandardized, ''))`
    : `NULLIF(${a}publicationDateStandardized, '')`;
};

// Inclusive on both ends: "To 11/10" includes Nov 10. Null when neither bound is a date.
export const dateRangeSql = (expr: string, lower?: unknown, upper?: unknown): string | null => {
  const lo = isoDateOf(lower);
  const hi = isoDateOf(upper);
  const parts: string[] = [];
  if (lo) parts.push(`${expr} >= '${lo}'`);
  if (hi) parts.push(`${expr} <= '${hi}'`);
  return parts.length ? `(${parts.join(" AND ")})` : null;
};

// Grouped Type filter: values are matched against `allowed` (PUB_TYPES from src/lib/pubTypes.ts)
// and inlined. Without the pubType column there is nothing to match, so no filter.
export const pubTypeSql = (alias: string, types: unknown, hasColumn: boolean, allowed: readonly string[]): string | null => {
  if (!hasColumn || !Array.isArray(types)) return null;
  const picked = Array.from(new Set(types.map(String).filter((t) => allowed.includes(t))));
  if (!picked.length) return null;
  return `(${alias}.pubType IN (${picked.map((t) => `'${t.replace(/'/g, "''")}'`).join(", ")}))`;
};

// Every 5c article fragment for one query: Date added, Publication date and grouped Type.
export const dateTypeSql = (
  alias: string,
  f: ReportDateTypeFilters | null | undefined,
  cols: ReportDateTypeColumns,
  allowedTypes: readonly string[]
): string[] => {
  if (!f) return [];
  return [
    dateRangeSql(dateAddedExpr(alias, cols), f.datePublicationAddedToEntrezLowerBound, f.datePublicationAddedToEntrezUpperBound),
    dateRangeSql(pubDateExpr(alias, cols), f.pubDateLowerBound, f.pubDateUpperBound),
    pubTypeSql(alias, f.pubTypes, !!cols.pubType, allowedTypes),
  ].filter((s): s is string => !!s);
};
