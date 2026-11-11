// Server-side Excel export for /report (5f): one streamed .xlsx with Publications, Authorships and
// About sheets. Rows are read in pmid chunks and committed to the response as they are written, so
// memory holds one chunk plus the (capped) pmid list, never the whole result set.
import type { NextApiResponse } from "next";
import { QueryTypes } from "sequelize";
import Excel from "exceljs";
import sequelize from "../../../src/db/db";
import { metrics, labels } from "../../../config/report";
import { stripHtml } from "../../../src/utils/htmlText";
import { authorPositionSql, sourceSql } from "./reportFilterSql";
import { REPORT_SORT_COLUMNS } from "./reportSort";
import { articleColumns } from "./reportColumns";
import {
  ReportExportFilters,
  ReportExportWhere,
  XLSX_MAX_ARTICLES,
  XLSX_MAX_AUTHORSHIPS,
  articleAuthorFactsSql,
  articleCountSql,
  articlePmidsSql,
  authorshipCountSql,
  authorshipRowsSql,
  buildReportExportWhere,
  describeFilters,
  hasAnyFilter,
} from "./reportExportSql";

const CHUNK = 1000;

export type XlsxExportBody = {
  filters?: ReportExportFilters;
  sort?: { type?: string; order?: string };
};

export type XlsxExportPlan = {
  where: ReportExportWhere;
  filters: ReportExportFilters;
  sortColumn: string | null;
  sortOrder?: string;
  articleCount: number;
  authorshipCount: number;
};

export class ExportRequestError extends Error {}

const SOURCE_LABELS: Record<string, string> = {
  PUBMED: "PubMed", SCOPUS: "Scopus", OPENALEX: "OpenAlex", CROSSREF: "Crossref", WOS: "Web of Science",
};

const sourceLabel = (row: any): string => {
  const t = row.source_type ? String(row.source_type).toUpperCase() : "";
  if (SOURCE_LABELS[t]) return SOURCE_LABELS[t];
  const prefix = row.article_id ? String(row.article_id).split(":")[0].toUpperCase() : "";
  if (SOURCE_LABELS[prefix]) return SOURCE_LABELS[prefix];
  return Number(row.pmid) > 0 ? "PubMed" : "External";
};

const text = (v: unknown): string => (v === null || v === undefined ? "" : stripHtml(String(v)));
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const doiUrl = (doi: unknown): string => (doi && String(doi).trim() ? `https://dx.doi.org/${String(doi).trim()}` : "");
const pmidCell = (pmid: unknown): number | null => (Number(pmid) > 0 ? Number(pmid) : null);
// The byline string arrives wrapped in brackets/parens from ReCiterDB; the CSV export strips them too.
const byline = (v: unknown): string => text(v).replace(/[\])}[{(]/g, "");

const ARTICLE_METRICS = Object.keys(metrics.article).filter((m) => (metrics.article as any)[m]);
const metricColumns = ARTICLE_METRICS.map((key) => ({ header: (labels.article as any)[key] || key, key, width: 14 }));

// Same columns as the article CSV (articleInfo + metrics + authors), plus Source, external id and
// the WCM first/last author flags. The CSV's per-row "Author Position" is meaningless per article,
// so it becomes the two WCM flags here.
const PUBLICATION_COLUMNS = [
  { header: "PMID", key: "pmid", width: 11 },
  { header: "Source", key: "source", width: 12 },
  { header: "Article ID", key: "articleId", width: 22 },
  { header: "Article title", key: "articleTitle", width: 60 },
  { header: "Article year", key: "articleYear", width: 9 },
  { header: "PMCID", key: "pmcid", width: 13 },
  { header: "Publication date display", key: "publicationDateDisplay", width: 16 },
  { header: "Date standardized", key: "publicationDateStandardized", width: 14 },
  { header: "Date added", key: "datePublicationAddedToEntrez", width: 12 },
  { header: "Publication type", key: "publicationTypeCanonical", width: 18 },
  { header: "Journal", key: "journalTitleVerbose", width: 36 },
  { header: "DOI", key: "doi", width: 34 },
  { header: "Issue", key: "issue", width: 8 },
  { header: "Pages", key: "pages", width: 10 },
  { header: "Volume", key: "volume", width: 8 },
  ...metricColumns,
  { header: "Authors", key: "authors", width: 60 },
  { header: "WCM authors (personIdentifier)", key: "wcmAuthors", width: 28 },
  { header: "WCM first author", key: "wcmFirst", width: 10 },
  { header: "WCM last author", key: "wcmLast", width: 10 },
];

// The authorship CSV's columns: person, article info, metrics, authors + this author's position.
const AUTHORSHIP_COLUMNS = [
  { header: "personIdentifier", key: "personIdentifier", width: 14 },
  { header: "Last Name", key: "lastName", width: 16 },
  { header: "First Name", key: "firstName", width: 16 },
  { header: "Organization", key: "primaryOrganizationalUnit", width: 30 },
  { header: "Institution", key: "primaryInstitution", width: 24 },
  { header: "Person types", key: "personTypes", width: 30 },
  { header: "Author Position", key: "authorPosition", width: 10 },
  { header: "PMID", key: "pmid", width: 11 },
  { header: "Source", key: "source", width: 12 },
  { header: "Article ID", key: "articleId", width: 22 },
  { header: "Article title", key: "articleTitle", width: 60 },
  { header: "Article year", key: "articleYear", width: 9 },
  { header: "PMCID", key: "pmcid", width: 13 },
  { header: "Publication date display", key: "publicationDateDisplay", width: 16 },
  { header: "Date standardized", key: "publicationDateStandardized", width: 14 },
  { header: "Date added", key: "datePublicationAddedToEntrez", width: 12 },
  { header: "Publication type", key: "publicationTypeCanonical", width: 18 },
  { header: "Journal", key: "journalTitleVerbose", width: 36 },
  { header: "DOI", key: "doi", width: 34 },
  { header: "Issue", key: "issue", width: 8 },
  { header: "Pages", key: "pages", width: 10 },
  { header: "Volume", key: "volume", width: 8 },
  ...metricColumns,
  { header: "Authors", key: "authors", width: 60 },
];

const countOf = async (sql: string, replacements: Record<string, unknown>): Promise<number> => {
  const rows: any[] = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT, raw: true });
  return Number(rows && rows[0] ? rows[0].n : 0) || 0;
};

// Validates the body and counts both sheets. Throws ExportRequestError (-> 400) when unfiltered.
export const planXlsxExport = async (body: XlsxExportBody): Promise<XlsxExportPlan> => {
  const filters: ReportExportFilters = (body && body.filters) || {};
  const hasSourceColumn = (await articleColumns()).sourceType;
  const fragments = {
    authorPosition: authorPositionSql("asu", filters.authorPosition),
    source: sourceSql("asa", filters.sourceTypes, hasSourceColumn),
  };
  if (!hasAnyFilter(filters, fragments)) {
    throw new ExportRequestError("Add at least one filter before exporting. An export of every publication is too large to generate.");
  }
  const where = buildReportExportWhere(filters, fragments);
  const sort = body && body.sort;
  const sortColumn = sort && Object.prototype.hasOwnProperty.call(REPORT_SORT_COLUMNS, sort.type) ? REPORT_SORT_COLUMNS[sort.type] : null;
  const [articleCount, authorshipCount] = await Promise.all([
    countOf(articleCountSql(where), where.replacements),
    countOf(authorshipCountSql(where), where.replacements),
  ]);
  return { where, filters, sortColumn, sortOrder: sort && sort.order, articleCount, authorshipCount };
};

const articleSelect = async (): Promise<string> => {
  const cols = await articleColumns();
  const extra = [cols.sourceType ? "asa.source_type" : "NULL AS source_type", cols.articleId ? "asa.article_id" : "NULL AS article_id"];
  return (
    "SELECT asa.pmid, asa.articleTitle, asa.articleYear, asa.pmcid, asa.publicationDateDisplay, " +
    "asa.publicationDateStandardized, asa.datePublicationAddedToEntrez, asa.publicationTypeCanonical, " +
    "asa.journalTitleVerbose, asa.doi, asa.issue, asa.pages, asa.volume, " +
    ARTICLE_METRICS.map((m) => `asa.${m}`).join(", ") + ", " + extra.join(", ") +
    " FROM analysis_summary_article asa WHERE asa.pmid IN (:chunk)"
  );
};

const articleCells = (a: any) => {
  const out: Record<string, unknown> = {
    pmid: pmidCell(a.pmid),
    source: sourceLabel(a),
    articleId: a.article_id || (Number(a.pmid) > 0 ? `PUBMED:${a.pmid}` : ""),
    articleTitle: text(a.articleTitle),
    articleYear: num(a.articleYear),
    pmcid: text(a.pmcid),
    publicationDateDisplay: text(a.publicationDateDisplay),
    publicationDateStandardized: text(a.publicationDateStandardized),
    datePublicationAddedToEntrez: text(a.datePublicationAddedToEntrez),
    publicationTypeCanonical: text(a.publicationTypeCanonical),
    journalTitleVerbose: text(a.journalTitleVerbose),
    doi: doiUrl(a.doi),
    issue: text(a.issue),
    pages: text(a.pages),
    volume: text(a.volume),
  };
  ARTICLE_METRICS.forEach((m) => { out[m] = num(a[m]); });
  return out;
};

const styleHeader = (ws: any) => {
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF1F5" } };
  header.commit();
};

const byPmid = (rows: any[]): Map<number, any> => {
  const m = new Map<number, any>();
  rows.forEach((r) => { if (!m.has(Number(r.pmid))) m.set(Number(r.pmid), r); });
  return m;
};

// Streams the workbook into `res`. Headers must not have been sent yet.
export const streamXlsxExport = async (plan: XlsxExportPlan, res: NextApiResponse, fileName: string) => {
  const { where } = plan;
  const pmidRows: any[] = await sequelize.query(articlePmidsSql(where, plan.sortColumn, plan.sortOrder, XLSX_MAX_ARTICLES), {
    replacements: where.replacements, type: QueryTypes.SELECT, raw: true,
  });
  const seen = new Set<number>();
  const pmids: number[] = [];
  pmidRows.forEach((r) => { const p = Number(r.pmid); if (!seen.has(p)) { seen.add(p); pmids.push(p); } });
  const select = await articleSelect();

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Export-Articles", String(pmids.length));

  const wb = new Excel.stream.xlsx.WorkbookWriter({ stream: res as any, useStyles: true, useSharedStrings: false });
  wb.creator = "ReCiter Publication Manager";
  wb.created = new Date();

  // Sheet 1: Publications
  const pubs = wb.addWorksheet("Publications", { views: [{ state: "frozen", ySplit: 1 }] });
  pubs.columns = PUBLICATION_COLUMNS as any;
  styleHeader(pubs);
  let pubRows = 0;
  for (let i = 0; i < pmids.length; i += CHUNK) {
    const chunk = pmids.slice(i, i + CHUNK);
    const [articles, facts]: any[] = await Promise.all([
      sequelize.query(select, { replacements: { chunk }, type: QueryTypes.SELECT, raw: true }),
      sequelize.query(articleAuthorFactsSql(), { replacements: { chunk }, type: QueryTypes.SELECT, raw: true }),
    ]);
    const aMap = byPmid(articles);
    const fMap = byPmid(facts);
    for (const pmid of chunk) {
      const a = aMap.get(pmid);
      if (!a) continue;
      const f = fMap.get(pmid) || {};
      pubs.addRow({
        ...articleCells(a),
        authors: byline(f.authors),
        wcmAuthors: f.wcmAuthors || "",
        wcmFirst: Number(f.wcmFirst) === 1 ? "Yes" : "No",
        wcmLast: Number(f.wcmLast) === 1 ? "Yes" : "No",
      }).commit();
      pubRows++;
    }
  }
  pubs.commit();

  // Sheet 2: Authorships, in the same article order
  const auths = wb.addWorksheet("Authorships", { views: [{ state: "frozen", ySplit: 1 }] });
  auths.columns = AUTHORSHIP_COLUMNS as any;
  styleHeader(auths);
  let authRows = 0;
  let authCapped = false;
  const authSql = authorshipRowsSql(where);
  for (let i = 0; i < pmids.length && !authCapped; i += CHUNK) {
    const chunk = pmids.slice(i, i + CHUNK);
    const [articles, people]: any[] = await Promise.all([
      sequelize.query(select, { replacements: { chunk }, type: QueryTypes.SELECT, raw: true }),
      sequelize.query(authSql, { replacements: { ...where.replacements, chunk }, type: QueryTypes.SELECT, raw: true }),
    ]);
    const aMap = byPmid(articles);
    const byArticle = new Map<number, any[]>();
    people.forEach((r: any) => {
      const k = Number(r.pmid);
      if (!byArticle.has(k)) byArticle.set(k, []);
      byArticle.get(k).push(r);
    });
    for (const pmid of chunk) {
      const a = aMap.get(pmid);
      const rows = byArticle.get(pmid);
      if (!a || !rows) continue;
      for (const r of rows) {
        if (authRows >= XLSX_MAX_AUTHORSHIPS) { authCapped = true; break; }
        auths.addRow({
          ...articleCells(a),
          personIdentifier: r.personIdentifier,
          lastName: text(r.lastName),
          firstName: text(r.firstName),
          primaryOrganizationalUnit: text(r.primaryOrganizationalUnit),
          primaryInstitution: text(r.primaryInstitution),
          personTypes: r.personTypes || "",
          authorPosition: r.authorPosition ? String(r.authorPosition) : "middle",
          authors: byline(r.authors),
        }).commit();
        authRows++;
      }
      if (authCapped) break;
    }
  }
  auths.commit();

  // Sheet 3: About
  const about = wb.addWorksheet("About");
  about.columns = [{ header: "Item", key: "k", width: 34 }, { header: "Value", key: "v", width: 90 }] as any;
  styleHeader(about);
  const line = (k: string, v: unknown) => about.addRow({ k, v }).commit();
  line("Report", "ReCiter Publication Manager: publication report");
  line("Generated at", new Date().toISOString());
  line("Publications matching the filters", plan.articleCount);
  line("Publications in this file", pubRows);
  line("Authorships matching the filters", plan.authorshipCount);
  line("Authorships in this file", authRows);
  line("Row limit", `At most ${XLSX_MAX_ARTICLES.toLocaleString("en-US")} publications and ${XLSX_MAX_AUTHORSHIPS.toLocaleString("en-US")} authorships per file.` +
    (plan.articleCount > pubRows || plan.authorshipCount > authRows ? " This file hit the limit: narrow the filters to get the rest." : ""));
  line("Sort", plan.sortColumn ? `${plan.sortColumn} ${String(plan.sortOrder || "").toUpperCase() === "ASC" ? "ascending" : "descending"}` : "Date added, newest first");
  line("", "");
  line("Filters applied", "");
  describeFilters(plan.filters).forEach(([k, v]) => line(`  ${k}`, v));
  line("", "");
  line("Column notes", "");
  line("  Publications", "One row per publication, the same set and count as the Reports page.");
  line("  Authorships", "One row per known (WCM) author on a matching publication who also passes the people filters. Only authors with a person record are listed.");
  line("  PMID", "Blank for publications that are not in PubMed (Scopus, OpenAlex, Crossref, Web of Science); see Article ID.");
  line("  Source", "Where the record came from. Non-PubMed records have no NIH metrics.");
  line("  Author Position", "first, last or middle for that author on that publication.");
  line("  WCM first / last author", "Yes when the publication's first or last listed author is a known WCM person.");
  line("  WCM authors", "personIdentifiers of every known author on the publication, not only those matching the filters.");
  line("  Scimago Journal Rank", "SJR of the journal (journalImpactScore1).");
  about.commit();

  await wb.commit();
};
