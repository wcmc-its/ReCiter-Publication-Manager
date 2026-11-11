// Word (.docx) bibliography for /report (5g). Replaces the RTF stored procedures: the selection is
// built from the same filters as the page (wordBibliography.buildSelection + reportFilterSql), the
// citations are formatted here, and the document is generated with the `docx` package. Raw SQL
// only: no Sequelize associations (those live in reportAssociations.ts and must not be re-registered).
import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TabStopType, TextRun } from "docx";
import sequelize from "../../../src/db/db";
import { authorPositionSql, sourceSql, dateTypeSql } from "./reportFilterSql";
import { PUB_TYPES } from "../../../src/lib/pubTypes";
import { articleColumns } from "./reportColumns";
import {
  GROUP_LABELS,
  ReportFilters,
  Segment,
  WORD_GROUP_BYS,
  WordArticle,
  WordGroup,
  WordGroupBy,
  WordPerson,
  buildSelection,
  citationSegments,
  groupArticles,
  hasReportFilter,
  mergeAuthors,
  wordLimit,
} from "./wordBibliography";

export type WordExportBody = { filters?: ReportFilters; groupBy?: string; includeExternal?: boolean };

export class WordExportError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type WordExportResult = {
  buffer: Buffer;
  entries: number; // citations written (person grouping counts a paper once per person)
  articles: number; // distinct publications in the document
  total: number; // matching entries before the limit
  limit: number;
  groupBy: WordGroupBy;
};

const q = async (sql: string, replacements: Record<string, unknown>): Promise<any[]> => {
  const [rows] = await sequelize.query(sql, { replacements, raw: true });
  return rows as any[];
};

// reportingArticleRTF.maxLimit, the setting the RTF export used (shown as "Word export" in
// Configuration). Read server-side so a client can't lift the cap.
const exportLimit = async (): Promise<number> => {
  try {
    const rows = await q("SELECT viewAttributes FROM admin_settings WHERE viewName = 'reportingArticleRTF' LIMIT 1", {});
    const attrs = rows[0]?.viewAttributes;
    const parsed = typeof attrs === "string" ? JSON.parse(attrs) : attrs;
    const withLimit = Array.isArray(parsed) ? parsed.find((a: any) => a && a.maxLimit) : null;
    return wordLimit(withLimit?.maxLimit);
  } catch (e) {
    console.log("[word export] limit lookup failed", (e as Error)?.message);
    return wordLimit(null);
  }
};

export const loadArticles = async (pmids: number[]): Promise<WordArticle[]> => {
  if (!pmids.length) return [];
  const rows = await q(
    "SELECT pmid, pmcid, doi, articleTitle, journalTitleVerbose, articleYear, publicationDateDisplay, " +
      "publicationDateStandardized, publicationTypeCanonical, volume, issue, pages " +
      "FROM analysis_summary_article WHERE pmid IN (:pmids) ORDER BY id",
    { pmids }
  );
  const authorRows = await q("SELECT pmid, authors FROM analysis_summary_author WHERE pmid IN (:pmids) ORDER BY id", { pmids });
  const authorsByPmid = new Map<number, string[]>();
  for (const r of authorRows) {
    const k = Number(r.pmid);
    if (!authorsByPmid.has(k)) authorsByPmid.set(k, []);
    authorsByPmid.get(k)!.push(r.authors);
  }
  const seen = new Set<number>();
  const out: WordArticle[] = [];
  for (const r of rows) {
    const pmid = Number(r.pmid);
    if (seen.has(pmid)) continue;
    seen.add(pmid);
    out.push({ ...r, pmid, articleYear: Number(r.articleYear) || null, authors: mergeAuthors(authorsByPmid.get(pmid) || []) });
  }
  return out;
};

export const generateWordBibliography = async (body: WordExportBody): Promise<WordExportResult> => {
  const filters: ReportFilters = (body && body.filters) || {};
  if (!hasReportFilter(filters)) {
    throw new WordExportError(400, "Add a filter (a person, organization, date, type or journal) before exporting to Word.");
  }
  const groupBy: WordGroupBy = WORD_GROUP_BYS.includes(body.groupBy as WordGroupBy) ? (body.groupBy as WordGroupBy) : "year";
  const includeExternal = body.includeExternal !== false;

  const cols = await articleColumns();
  const dateTypeClauses = dateTypeSql("asa", filters, cols, PUB_TYPES);
  // The date ranges and grouped Type count only when they built a clause (a bound that isn't a
  // date, or a type the search drops, must not unlock an unfiltered export).
  const otherFilters: ReportFilters = {
    ...filters,
    datePublicationAddedToEntrezLowerBound: undefined,
    datePublicationAddedToEntrezUpperBound: undefined,
    pubDateLowerBound: undefined,
    pubDateUpperBound: undefined,
    pubTypes: undefined,
  };
  if (!dateTypeClauses.length && !hasReportFilter(otherFilters)) {
    throw new WordExportError(400, "Add a filter (a person, organization, date, type or journal) before exporting to Word.");
  }
  const sel = buildSelection(filters, {
    authorClause: authorPositionSql("asu", filters.authorPosition),
    sourceClause: sourceSql("asa", filters.sourceTypes, cols.sourceType),
    dateTypeClauses,
    includeExternal,
  });
  const limit = await exportLimit();
  const r = { ...sel.replacements, cap: limit };

  let pmids: number[];
  let total: number;
  let pairs: Array<{ personIdentifier: string; pmid: number }> = [];
  let persons: WordPerson[] = [];

  if (groupBy === "person") {
    total = Number((await q(`SELECT COUNT(DISTINCT asu.personIdentifier, asa.pmid) AS n FROM ${sel.from} WHERE ${sel.where}`, r))[0]?.n || 0);
    pairs = (
      await q(
        `SELECT asu.personIdentifier, asa.pmid FROM ${sel.from} WHERE ${sel.where} ` +
          "GROUP BY asu.personIdentifier, asa.pmid ORDER BY asu.personIdentifier, MAX(asa.publicationDateStandardized) DESC LIMIT :cap",
        r
      )
    ).map((x) => ({ personIdentifier: String(x.personIdentifier), pmid: Number(x.pmid) }));
    pmids = [...new Set(pairs.map((x) => x.pmid))];
    const ids = [...new Set(pairs.map((x) => x.personIdentifier))];
    persons = ids.length ? await q("SELECT personIdentifier, firstName, lastName FROM person WHERE personIdentifier IN (:ids)", { ids }) : [];
  } else {
    total = Number((await q(`SELECT COUNT(DISTINCT asa.pmid) AS n FROM ${sel.from} WHERE ${sel.where}`, r))[0]?.n || 0);
    pmids = (
      await q(
        `SELECT asa.pmid FROM ${sel.from} WHERE ${sel.where} ` +
          "GROUP BY asa.pmid ORDER BY MAX(asa.publicationDateStandardized) DESC, asa.pmid DESC LIMIT :cap",
        r
      )
    ).map((x) => Number(x.pmid));
  }

  const articles = await loadArticles(pmids);
  const groups = groupArticles(articles, groupBy, { pairs, persons });
  const entries = groups.reduce((n, g) => n + g.articles.length, 0);
  const buffer = await buildDocx(groups, { groupBy, entries, total, limit });
  return { buffer, entries, articles: articles.length, total, limit, groupBy };
};

// ── docx ──

const FONT = "Arial";
const HYPERLINK_COLOR = "1F5FA8";

const runsOf = (segs: Segment[]) =>
  segs.map((s) => {
    const run = new TextRun({
      text: s.text,
      bold: s.bold || undefined,
      italics: s.italics || undefined,
      subScript: s.sub || undefined,
      superScript: s.sup || undefined,
      ...(s.link ? { color: HYPERLINK_COLOR, underline: {} } : {}),
    });
    return s.link ? new ExternalHyperlink({ link: s.link, children: [run] }) : run;
  });

export const buildDocx = async (
  groups: WordGroup[],
  meta: { groupBy: WordGroupBy; entries: number; total: number; limit: number; date?: string }
): Promise<Buffer> => {
  const date = meta.date || new Date().toISOString().slice(0, 10);
  const fmt = new Intl.NumberFormat("en-US");
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Publications")] }),
    new Paragraph({
      style: "ReportMeta",
      children: [
        new TextRun(
          `${fmt.format(meta.entries)} ${meta.entries === 1 ? "citation" : "citations"}, grouped by ${GROUP_LABELS[meta.groupBy]}. ` +
            `ReCiter Publication Manager, ${date}. Authors at Weill Cornell Medicine are in bold.`
        ),
      ],
    }),
  ];
  if (meta.total > meta.entries) {
    children.push(
      new Paragraph({
        style: "ReportMeta",
        children: [new TextRun(`Limited to the first ${fmt.format(meta.entries)} of ${fmt.format(meta.total)} matching citations (export limit ${fmt.format(meta.limit)}). Narrow the filters to include the rest.`)],
      })
    );
  }
  for (const g of groups) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(g.heading)] }));
    g.articles.forEach((a, i) => {
      children.push(
        new Paragraph({
          style: "Citation",
          tabStops: [{ type: TabStopType.LEFT, position: 480 }],
          children: [new TextRun(`${i + 1}.\t`), ...runsOf(citationSegments(a))],
        })
      );
    });
  }

  const doc = new Document({
    creator: "ReCiter Publication Manager",
    title: "Publications",
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 32, bold: true }, paragraph: { spacing: { after: 120 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true } },
        { id: "ReportMeta", name: "Report note", basedOn: "Normal", run: { font: FONT, size: 18, color: "595959" }, paragraph: { spacing: { after: 120 } } },
        { id: "Citation", name: "Citation", basedOn: "Normal", run: { font: FONT, size: 22 }, paragraph: { indent: { left: 480, hanging: 480 }, spacing: { after: 120 } } },
      ],
    },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  });
  return Packer.toBuffer(doc);
};
