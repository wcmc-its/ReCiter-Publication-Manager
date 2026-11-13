// Raw SQL for the server-side /report Excel export (5f). Pure, no imports, unit-tested: the caller
// passes in the Middle-author / Source fragments from reportFilterSql.ts and the sort column from
// reportSort.ts, so every filter is expressed exactly the way the on-screen search expresses it.
//
// Matching rule, copied from publicationSearchWithFilter's count queries: an article matches when
// it passes every article filter AND at least one of its analysis_summary_author rows passes every
// author filter at once (the page joins one author row per article row and applies one WHERE).
// The page always inner-joins analysis_summary_author, and inner-joins person whenever an author
// filter is on, except for the Person type-only case (no org / institution / person filter), where
// it joins person_person_type but not person. Those joins are reproduced inside an EXISTS below so
// COUNT(DISTINCT asa.pmid) here equals the page's articlesCount.

export type ReportExportFilters = {
  personIdentifers?: string[];
  orgUnits?: string[];
  institutions?: string[];
  personTypes?: string[];
  authorPosition?: string[];
  sourceTypes?: string[];
  datePublicationAddedToEntrezLowerBound?: string;
  datePublicationAddedToEntrezUpperBound?: string;
  publicationTypeCanonical?: string[];
  journalTitleVerbose?: string[];
  journalImpactScoreLowerBound?: number | string;
  journalImpactScoreUpperBound?: number | string;
  // 5c
  pubDateLowerBound?: string;
  pubDateUpperBound?: string;
  pubTypes?: string[];
  // 5d-1: "yes" / "no" (one of them; neither or both = Any)
  peerReview?: string[];
};

// Pre-built fragments, aliased `asu` / `asa` (authorPositionSql("asu", …), sourceSql("asa", …),
// dateTypeSql("asa", …)). `dateType` carries the Date added / Publication date / grouped Type
// conditions; without it the Date added range falls back to the legacy column comparison.
export type ReportExportFragments = { authorPosition: string | null; source: string | null; dateType?: string[] };

export type ReportExportWhere = {
  // conditions on `asa` (analysis_summary_article), already ANDed; "1 = 1" when none
  articleSql: string;
  // conditions on one author row: `asu` plus `p` (person) when joinPerson; "1 = 1" when none
  authorSql: string;
  joinPerson: boolean;
  hasAuthorFilter: boolean;
  replacements: Record<string, unknown>;
};

// Excel tops out at 1,048,576 rows a sheet. These keep a download to a few minutes and a few MB.
export const XLSX_MAX_ARTICLES = 25000;
export const XLSX_MAX_AUTHORSHIPS = 100000;

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined && String(x) !== "").map(String) : []);
const present = (v: unknown): boolean => v !== null && v !== undefined && String(v).trim() !== "" && String(v) !== "undefined";

// True when the request narrows the result set at all. An unfiltered export is refused: the
// unfiltered CSV path is what OOM-killed prod on 10-01.
// When the caller passes `fragments.dateType` (the built Date added / Publication date / grouped Type
// clauses), only those count for the three: a bound that isn't a date, or a type the search drops
// (no pubType column, or not one of the 18), yields no clause and so must not unlock the export.
export const hasAnyFilter = (f?: ReportExportFilters | null, fragments?: ReportExportFragments): boolean => {
  if (!f) return false;
  const dateTypeBuilt = !!(fragments && fragments.dateType);
  return (
    list(f.personIdentifers).length > 0 ||
    list(f.orgUnits).length > 0 ||
    list(f.institutions).length > 0 ||
    list(f.personTypes).length > 0 ||
    list(f.publicationTypeCanonical).length > 0 ||
    list(f.journalTitleVerbose).length > 0 ||
    (!dateTypeBuilt && (
      list(f.pubTypes).length > 0 ||
      present(f.pubDateLowerBound) ||
      present(f.pubDateUpperBound) ||
      present(f.datePublicationAddedToEntrezLowerBound) ||
      present(f.datePublicationAddedToEntrezUpperBound)
    )) ||
    (present(f.journalImpactScoreLowerBound) && present(f.journalImpactScoreUpperBound)) ||
    !!(fragments && (fragments.authorPosition || fragments.source || (fragments.dateType && fragments.dateType.length)))
  );
};

export const buildReportExportWhere = (f: ReportExportFilters, fragments: ReportExportFragments): ReportExportWhere => {
  const article: string[] = [];
  const author: string[] = [];
  const replacements: Record<string, unknown> = {};

  const journals = list(f.journalTitleVerbose);
  if (journals.length) { article.push("asa.journalTitleVerbose IN (:journals)"); replacements.journals = journals; }
  if (fragments.dateType) {
    article.push(...fragments.dateType);
  } else {
    if (present(f.datePublicationAddedToEntrezLowerBound)) {
      article.push("asa.datePublicationAddedToEntrez > :dateLower");
      replacements.dateLower = f.datePublicationAddedToEntrezLowerBound;
    }
    if (present(f.datePublicationAddedToEntrezUpperBound)) {
      article.push("asa.datePublicationAddedToEntrez < :dateUpper");
      replacements.dateUpper = f.datePublicationAddedToEntrezUpperBound;
    }
  }
  const types = list(f.publicationTypeCanonical);
  if (types.length) { article.push("asa.publicationTypeCanonical IN (:pubTypes)"); replacements.pubTypes = types; }
  if (fragments.source) article.push(fragments.source);
  // The page applies Journal Rank only when both bounds are set (the presets always send both).
  if (present(f.journalImpactScoreLowerBound) && present(f.journalImpactScoreUpperBound)) {
    article.push("asa.journalImpactScore1 >= :sjrLower AND asa.journalImpactScore1 < :sjrUpper");
    replacements.sjrLower = Number(f.journalImpactScoreLowerBound);
    replacements.sjrUpper = Number(f.journalImpactScoreUpperBound);
  }

  const people = list(f.personIdentifers);
  const orgs = list(f.orgUnits);
  const insts = list(f.institutions);
  const personTypes = list(f.personTypes);
  if (people.length) { author.push("asu.personIdentifier IN (:people)"); replacements.people = people; }
  if (fragments.authorPosition) author.push(fragments.authorPosition);
  if (orgs.length) {
    // The page matches an org exactly or as a substring (`%org%`, `%(org)%`); bound, not inlined.
    const likes = orgs.map((_, i) => `p.primaryOrganizationalUnit LIKE :orgLike${i} OR p.primaryOrganizationalUnit LIKE :orgParen${i}`);
    orgs.forEach((o, i) => { replacements[`orgLike${i}`] = `%${o}%`; replacements[`orgParen${i}`] = `%(${o})%`; });
    author.push(`(p.primaryOrganizationalUnit IN (:orgs) OR ${likes.join(" OR ")})`);
    replacements.orgs = orgs;
  }
  if (insts.length) { author.push("p.primaryInstitution IN (:institutions)"); replacements.institutions = insts; }
  if (personTypes.length) {
    author.push("EXISTS (SELECT 1 FROM person_person_type ppt WHERE ppt.personIdentifier = asu.personIdentifier AND ppt.personType IN (:personTypes))");
    replacements.personTypes = personTypes;
  }

  const hasAuthorFilter = author.length > 0;
  const orgOrInst = people.length > 0 || orgs.length > 0 || insts.length > 0;
  const joinPerson = hasAuthorFilter && (personTypes.length === 0 || orgOrInst);

  return {
    articleSql: article.length ? article.join(" AND ") : "1 = 1",
    authorSql: author.length ? author.join(" AND ") : "1 = 1",
    joinPerson,
    hasAuthorFilter,
    replacements,
  };
};

const authorExists = (w: ReportExportWhere): string =>
  "EXISTS (SELECT 1 FROM analysis_summary_author asu" +
  (w.joinPerson ? " INNER JOIN person p ON p.personIdentifier = asu.personIdentifier" : "") +
  ` WHERE asu.pmid = asa.pmid AND ${w.authorSql})`;

// Same number the page shows as "N publications".
export const articleCountSql = (w: ReportExportWhere): string =>
  `SELECT COUNT(DISTINCT asa.pmid) AS n FROM analysis_summary_article asa WHERE ${w.articleSql} AND ${authorExists(w)}`;

// Matching pmids in report order (nulls last, then newest first, then pmid for a stable order).
// `sortColumn` is a REPORT_SORT_COLUMNS column (qualified with asa. here) or an expression from
// reportSortExpr(key, "asa", cols); it is inlined, so anything else falls back to the default.
// The caller dedupes pmids.
export const articlePmidsSql = (w: ReportExportWhere, sortColumn: string | null, sortOrder: string | undefined, limit: number): string => {
  const expr = !sortColumn
    ? null
    : /^[A-Za-z0-9_]+$/.test(sortColumn)
      ? `asa.${sortColumn}`
      : /^[A-Za-z0-9_.,'() ]+$/.test(sortColumn) && !/;|--/.test(sortColumn)
        ? sortColumn
        : null;
  const col = expr || "asa.datePublicationAddedToEntrez";
  const dir = expr && String(sortOrder || "").toUpperCase() === "ASC" ? "ASC" : "DESC";
  const lim = Math.max(1, Math.floor(Number(limit) || 1));
  return (
    `SELECT asa.pmid FROM analysis_summary_article asa WHERE ${w.articleSql} AND ${authorExists(w)} ` +
    `ORDER BY isnull(${col}), ${col} ${dir}, asa.pmid DESC LIMIT ${lim}`
  );
};

// Authorships: known (non-blank personIdentifier) author rows with a person record, on a matching
// article, passing the author filters. Like the authorship CSV, person is always inner-joined.
const authorshipFrom = (w: ReportExportWhere): string =>
  "FROM analysis_summary_author asu INNER JOIN person p ON p.personIdentifier = asu.personIdentifier " +
  `WHERE asu.personIdentifier <> '' AND ${w.authorSql}`;

export const authorshipCountSql = (w: ReportExportWhere): string =>
  `SELECT COUNT(*) AS n ${authorshipFrom(w)} AND asu.pmid IN (SELECT asa.pmid FROM analysis_summary_article asa WHERE ${w.articleSql} AND ${authorExists(w)})`;

// One chunk of authorship rows for pmids already known to match (`:chunk`).
export const authorshipRowsSql = (w: ReportExportWhere): string =>
  "SELECT asu.pmid, asu.personIdentifier, asu.authorPosition, asu.authors, p.firstName, p.lastName, " +
  "p.primaryOrganizationalUnit, p.primaryInstitution, " +
  "(SELECT GROUP_CONCAT(DISTINCT t.personType ORDER BY t.personType SEPARATOR '|') FROM person_person_type t " +
  "WHERE t.personIdentifier = asu.personIdentifier) AS personTypes " +
  `${authorshipFrom(w)} AND asu.pmid IN (:chunk) ORDER BY asu.pmid, asu.personIdentifier`;

// Article-level WCM author facts for a chunk, from every known author on the paper (unfiltered).
export const articleAuthorFactsSql = (): string =>
  "SELECT asu.pmid, MAX(asu.authors) AS authors, " +
  "MAX(asu.authorPosition = 'first') AS wcmFirst, MAX(asu.authorPosition = 'last') AS wcmLast, " +
  "GROUP_CONCAT(DISTINCT CASE WHEN asu.personIdentifier <> '' THEN asu.personIdentifier END ORDER BY asu.personIdentifier SEPARATOR '; ') AS wcmAuthors " +
  "FROM analysis_summary_author asu WHERE asu.pmid IN (:chunk) GROUP BY asu.pmid";

// Human-readable filter lines for the About sheet.
export const describeFilters = (f: ReportExportFilters): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  const add = (label: string, v: string[]) => { if (v.length) out.push([label, v.join("; ")]); };
  add("Author (personIdentifier)", list(f.personIdentifers));
  add("Organization", list(f.orgUnits));
  add("Institution", list(f.institutions));
  add("Person type", list(f.personTypes));
  add("Author position", list(f.authorPosition));
  add("Source", list(f.sourceTypes));
  if (present(f.datePublicationAddedToEntrezLowerBound)) out.push(["Added on or after", String(f.datePublicationAddedToEntrezLowerBound)]);
  if (present(f.datePublicationAddedToEntrezUpperBound)) out.push(["Added on or before", String(f.datePublicationAddedToEntrezUpperBound)]);
  if (present(f.pubDateLowerBound)) out.push(["Published on or after", String(f.pubDateLowerBound)]);
  if (present(f.pubDateUpperBound)) out.push(["Published on or before", String(f.pubDateUpperBound)]);
  add("Publication type", [...list(f.pubTypes), ...list(f.publicationTypeCanonical)]);
  const peer = Array.from(new Set(list(f.peerReview).map((v) => v.toLowerCase()).filter((v) => v === "yes" || v === "no")));
  if (peer.length === 1) out.push(["Peer review", peer[0] === "yes" ? "Peer-reviewed" : "Not peer-reviewed"]);
  add("Journal", list(f.journalTitleVerbose));
  if (present(f.journalImpactScoreLowerBound) && present(f.journalImpactScoreUpperBound)) {
    out.push(["Journal rank (SJR)", `${f.journalImpactScoreLowerBound} and above`]);
  }
  return out;
};
