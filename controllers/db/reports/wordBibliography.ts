// The Word (.docx) bibliography export (5g): selection SQL, citation text and grouping. Pure: no
// imports, so `npm test` can load it directly. The controller (word.report.controller.ts) runs
// the queries and turns the segments into docx runs.
//
// The citation follows the retired RTF export (reciterdb.generatePubsRTF): authors (the first six,
// " ... ", the last when there are eight or more; WCM authors bold), title, journal in italics,
// year;volume:pages, PMID. PMID, PMCID and DOI are live links instead of the RTF's "Full text".

export type WordGroupBy = "year" | "type" | "person";
export const WORD_GROUP_BYS: WordGroupBy[] = ["year", "type", "person"];

export type ReportFilters = {
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
  // 5d-1 Peer review ("yes" / "no"); applied through dateTypeSql's clauses, like the 5c filters
  peerReview?: string[];
};

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined && String(x) !== "").map(String) : []);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const AUTHOR_KEYS = ["personIdentifers", "orgUnits", "institutions", "personTypes", "authorPosition"] as const;

const hasAuthorFilter = (f: ReportFilters): boolean => AUTHOR_KEYS.some((k) => list(f[k]).length > 0);

// An export with no filter would be every publication in the database: refuse it. Same set of
// keys the page's search treats as filters.
export const hasReportFilter = (f: ReportFilters | null | undefined): boolean => {
  if (!f) return false;
  return (
    hasAuthorFilter(f) ||
    list(f.sourceTypes).length > 0 ||
    list(f.publicationTypeCanonical).length > 0 ||
    list(f.pubTypes).length > 0 ||
    !!str(f.pubDateLowerBound) ||
    !!str(f.pubDateUpperBound) ||
    list(f.journalTitleVerbose).length > 0 ||
    !!str(f.datePublicationAddedToEntrezLowerBound) ||
    !!str(f.datePublicationAddedToEntrezUpperBound) ||
    num(f.journalImpactScoreLowerBound) !== null ||
    num(f.journalImpactScoreUpperBound) !== null
  );
};

export type Selection = { from: string; where: string; replacements: Record<string, unknown> };

// FROM/WHERE for the rows the /report page lists, with the page's raw-SQL semantics: an author
// filter joins person (and person_person_type for person types); article filters apply to `asa`.
// `authorClause`, `sourceClause` and `dateTypeClauses` come from reportFilterSql
// (authorPositionSql("asu", …), sourceSql("asa", …), dateTypeSql("asa", …)) so Middle, Source,
// the date ranges and the grouped Type match the page exactly. Every value is a replacement except
// those allowlisted fragments. Without `dateTypeClauses` the Date added range falls back to the
// legacy column comparison.
export const buildSelection = (
  f: ReportFilters,
  opts: { authorClause?: string | null; sourceClause?: string | null; dateTypeClauses?: string[]; includeExternal?: boolean } = {}
): Selection => {
  const where: string[] = [];
  const r: Record<string, unknown> = {};
  let from = "analysis_summary_article asa INNER JOIN analysis_summary_author asu ON asu.pmid = asa.pmid";

  if (hasAuthorFilter(f)) from += " INNER JOIN person p ON p.personIdentifier = asu.personIdentifier";
  const personTypes = list(f.personTypes);
  if (personTypes.length) {
    from += " INNER JOIN person_person_type ppt ON ppt.personIdentifier = asu.personIdentifier";
    where.push("ppt.personType IN (:personTypes)");
    r.personTypes = personTypes;
  }

  const people = list(f.personIdentifers);
  if (people.length) {
    where.push("asu.personIdentifier IN (:personIdentifiers)");
    r.personIdentifiers = people;
  }
  const orgs = list(f.orgUnits);
  if (orgs.length) {
    // The page also matches an org unit inside a longer name, "Medicine" in "Medicine (Cardiology)".
    const likes = orgs.map((o, i) => {
      r[`orgLike${i}`] = `%${o}%`;
      return `p.primaryOrganizationalUnit LIKE :orgLike${i}`;
    });
    where.push(`(p.primaryOrganizationalUnit IN (:orgUnits) OR ${likes.join(" OR ")})`);
    r.orgUnits = orgs;
  }
  const insts = list(f.institutions);
  if (insts.length) {
    where.push("p.primaryInstitution IN (:institutions)");
    r.institutions = insts;
  }
  if (opts.authorClause) where.push(opts.authorClause);

  if (opts.dateTypeClauses) {
    where.push(...opts.dateTypeClauses);
  } else {
    const lower = str(f.datePublicationAddedToEntrezLowerBound);
    if (lower) {
      where.push("asa.datePublicationAddedToEntrez > :dateLower");
      r.dateLower = lower;
    }
    const upper = str(f.datePublicationAddedToEntrezUpperBound);
    if (upper) {
      where.push("asa.datePublicationAddedToEntrez < :dateUpper");
      r.dateUpper = upper;
    }
  }
  const types = list(f.publicationTypeCanonical);
  if (types.length) {
    where.push("asa.publicationTypeCanonical IN (:types)");
    r.types = types;
  }
  const journals = list(f.journalTitleVerbose);
  if (journals.length) {
    where.push("asa.journalTitleVerbose IN (:journals)");
    r.journals = journals;
  }
  const jLower = num(f.journalImpactScoreLowerBound);
  if (jLower !== null) {
    where.push("asa.journalImpactScore1 >= :impactLower");
    r.impactLower = jLower;
  }
  const jUpper = num(f.journalImpactScoreUpperBound);
  if (jUpper !== null) {
    where.push("asa.journalImpactScore1 < :impactUpper");
    r.impactUpper = jUpper;
  }
  if (opts.sourceClause) where.push(opts.sourceClause);
  // External works are unioned into the report tables under a negative pmid.
  if (opts.includeExternal === false) where.push("asa.pmid > 0");

  return { from, where: where.length ? where.join(" AND ") : "1 = 1", replacements: r };
};

// ── Authors ──

// `gapBefore`: the stored list was already shortened and " ... " stands before this author.
export type AuthorName = { name: string; wcm: boolean; gapBefore?: boolean };

// analysis_summary_author has one row per WCM author of a paper, each carrying the author list
// with that author wrapped in ((…)). Merge the rows: one list, every WCM author marked. ReCiterDB
// stores long lists already shortened ("A, B, C, D, E, F ... Z"), so " ... " is a separator too;
// splitting on commas alone would glue "F ... Z" into one name and drop the bold from both.
export const mergeAuthors = (rows: Array<string | null | undefined>): AuthorName[] => {
  const strings = rows.filter((s): s is string => typeof s === "string" && s.trim() !== "");
  if (!strings.length) return [];
  const wcm = new Set<string>();
  for (const s of strings) {
    for (const m of s.matchAll(/\(\(([^()]*)\)\)/g)) wcm.add(m[1].trim());
  }
  const out: AuthorName[] = [];
  strings[0]
    .replace(/\(\(|\)\)/g, "")
    .split(/\s*\.\.\.\s*/)
    .forEach((part, k) => {
      const names = part.split(",").map((n) => n.trim()).filter(Boolean);
      names.forEach((name, i) => out.push(k > 0 && i === 0 ? { name, wcm: wcm.has(name), gapBefore: true } : { name, wcm: wcm.has(name) }));
    });
  return out;
};

// The RTF rule: eight or more authors print as the first six, " ...", then the last. A list
// ReCiterDB already shortened keeps its own " ... ".
export const AUTHOR_TRUNCATE_AT = 8;
export const truncateAuthors = (authors: AuthorName[]): Array<AuthorName | "ellipsis"> => {
  if (authors.some((a) => a.gapBefore)) {
    return authors.flatMap((a): Array<AuthorName | "ellipsis"> => (a.gapBefore ? ["ellipsis", a] : [a]));
  }
  return authors.length < AUTHOR_TRUNCATE_AT ? authors : [...authors.slice(0, 6), "ellipsis", authors[authors.length - 1]];
};

// ── Inline title markup ──

export type Segment = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  sub?: boolean;
  sup?: boolean;
  link?: string;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const decodeEntities = (s: string): string =>
  s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    const d = ENTITIES[code.toLowerCase()];
    return d !== undefined ? d : m;
  });

// PubMed titles carry <i>, <sub>, <sup>, <b>. Keep those as run formatting, drop every other tag.
export const inlineSegments = (html: string | null | undefined, base: Omit<Segment, "text"> = {}): Segment[] => {
  const out: Segment[] = [];
  const state = { i: 0, b: 0, sub: 0, sup: 0 };
  const push = (text: string) => {
    if (!text) return;
    const seg: Segment = { ...base, text: decodeEntities(text) };
    if (state.i) seg.italics = !base.italics;
    if (state.b) seg.bold = true;
    if (state.sub) seg.sub = true;
    if (state.sup) seg.sup = true;
    out.push(seg);
  };
  const re = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  const s = String(html || "");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    push(s.slice(last, m.index));
    last = re.lastIndex;
    const delta = m[1] ? -1 : 1;
    const tag = m[2].toLowerCase();
    const key = tag === "i" || tag === "em" ? "i" : tag === "b" || tag === "strong" ? "b" : tag === "sub" ? "sub" : tag === "sup" ? "sup" : null;
    if (key) state[key] = Math.max(0, state[key] + delta);
  }
  push(s.slice(last));
  return out;
};

const plain = (segs: Segment[]) => segs.map((x) => x.text).join("");

// ── Citation ──

export type WordArticle = {
  pmid: number;
  pmcid?: string | null;
  doi?: string | null;
  articleTitle?: string | null;
  journalTitleVerbose?: string | null;
  articleYear?: number | null;
  publicationDateDisplay?: string | null;
  publicationDateStandardized?: string | null;
  publicationTypeCanonical?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  authors: AuthorName[];
};

const has = (v: unknown): v is string => typeof v === "string" && v.trim() !== "" && v.trim().toLowerCase() !== "null";

export const yearOf = (a: Pick<WordArticle, "articleYear" | "publicationDateDisplay" | "publicationDateStandardized">): number | null => {
  if (a.articleYear && a.articleYear > 0) return a.articleYear;
  for (const v of [a.publicationDateDisplay, a.publicationDateStandardized]) {
    const m = has(v) ? v.match(/\b(1[89]\d\d|20\d\d)\b/) : null;
    if (m) return Number(m[1]);
  }
  return null;
};

const endsSentence = (s: string) => /[.?!]["'”’)]*\s*$/.test(s);

// One citation as formatted segments, without the leading number.
export const citationSegments = (a: WordArticle): Segment[] => {
  const segs: Segment[] = [];
  const authors = truncateAuthors(a.authors || []);
  authors.forEach((au, i) => {
    if (au === "ellipsis") {
      segs.push({ text: " ... " });
      return;
    }
    if (i > 0 && authors[i - 1] !== "ellipsis") segs.push({ text: ", " });
    segs.push(au.wcm ? { text: au.name, bold: true } : { text: au.name });
  });
  if (segs.length) segs.push({ text: ". " });

  const title = inlineSegments(a.articleTitle);
  if (title.length) {
    segs.push(...title);
    segs.push({ text: endsSentence(plain(title)) ? " " : ". " });
  }
  if (has(a.journalTitleVerbose)) {
    const j = inlineSegments(a.journalTitleVerbose, { italics: true });
    segs.push(...j);
    segs.push({ text: endsSentence(plain(j)) ? " " : ". " });
  }

  const year = yearOf(a);
  let when = year ? String(year) : "";
  if (has(a.volume) && has(a.pages)) when += `;${a.volume.trim()}:${a.pages.trim()}`;
  else if (has(a.pages)) when += `;${a.pages.trim()}`;
  else if (has(a.volume)) when += `;${a.volume.trim()}`;
  if (when) segs.push({ text: `${when.replace(/^;/, "")}. ` });

  if (a.pmid > 0) {
    segs.push({ text: "PMID: " });
    segs.push({ text: String(a.pmid), link: `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/` });
    segs.push({ text: ". " });
  }
  if (has(a.pmcid)) {
    segs.push({ text: "PMCID: " });
    segs.push({ text: a.pmcid.trim(), link: `https://www.ncbi.nlm.nih.gov/pmc/articles/${a.pmcid.trim()}/` });
    segs.push({ text: ". " });
  }
  if (has(a.doi)) {
    const doi = a.doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
    segs.push({ text: "doi: " });
    segs.push({ text: doi, link: `https://doi.org/${doi}` });
    segs.push({ text: "." });
  }
  // Trim the trailing space of the last plain segment.
  const lastSeg = segs[segs.length - 1];
  if (lastSeg && !lastSeg.link) lastSeg.text = lastSeg.text.replace(/\s+$/, "");
  return segs.filter((x) => x.text !== "");
};

// ── Grouping ──

// CV order for publication types; anything else follows alphabetically.
export const TYPE_ORDER = [
  "Academic Article",
  "Review",
  "Article",
  "Case Report",
  "Conference Paper",
  "Editorial Article",
  "Letter",
  "Comment",
  "Guideline",
  "Book",
  "Book Chapter",
  "Preprint",
  "Erratum",
];
const typeRank = (t: string) => {
  const i = TYPE_ORDER.indexOf(t);
  return i === -1 ? TYPE_ORDER.length : i;
};

// Newest first: standardized date, then year, then pmid.
export const compareNewest = (a: WordArticle, b: WordArticle): number => {
  const da = has(a.publicationDateStandardized) ? a.publicationDateStandardized : "";
  const db = has(b.publicationDateStandardized) ? b.publicationDateStandardized : "";
  if (da !== db) return da < db ? 1 : -1;
  const ya = yearOf(a) || 0;
  const yb = yearOf(b) || 0;
  if (ya !== yb) return yb - ya;
  return b.pmid - a.pmid;
};

export type WordPerson = { personIdentifier: string; firstName?: string | null; lastName?: string | null };
export type WordGroup = { heading: string; articles: WordArticle[] };

export const personHeading = (p: WordPerson): string => {
  const name = [p.lastName, p.firstName].filter(has).join(", ");
  return name ? `${name} (${p.personIdentifier})` : p.personIdentifier;
};

// Year and type group the article set; person groups the (person, pmid) pairs, so a paper with
// two selected people appears under each.
export const groupArticles = (
  articles: WordArticle[],
  groupBy: WordGroupBy,
  people: { pairs: Array<{ personIdentifier: string; pmid: number }>; persons: WordPerson[] } = { pairs: [], persons: [] }
): WordGroup[] => {
  const sorted = [...articles].sort(compareNewest);
  if (groupBy === "person") {
    const byPmid = new Map(sorted.map((a) => [a.pmid, a]));
    const info = new Map(people.persons.map((p) => [p.personIdentifier, p]));
    const groups = new Map<string, WordArticle[]>();
    for (const { personIdentifier, pmid } of people.pairs) {
      const a = byPmid.get(Number(pmid));
      if (!a) continue;
      if (!groups.has(personIdentifier)) groups.set(personIdentifier, []);
      const g = groups.get(personIdentifier)!;
      if (!g.includes(a)) g.push(a);
    }
    const sortKey = (id: string) => {
      const p = info.get(id);
      return `${(p?.lastName || "").toLowerCase()}\u0000${(p?.firstName || "").toLowerCase()}\u0000${id}`;
    };
    return [...groups.keys()]
      .sort((x, y) => (sortKey(x) < sortKey(y) ? -1 : sortKey(x) > sortKey(y) ? 1 : 0))
      .map((id) => ({
        heading: personHeading(info.get(id) || { personIdentifier: id }),
        articles: groups.get(id)!.sort(compareNewest),
      }));
  }

  const groups = new Map<string, WordArticle[]>();
  for (const a of sorted) {
    const key =
      groupBy === "year"
        ? String(yearOf(a) ?? "Year not available")
        : has(a.publicationTypeCanonical)
        ? a.publicationTypeCanonical.trim()
        : "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  const keys = [...groups.keys()];
  if (groupBy === "year") {
    keys.sort((x, y) => (Number(y) || 0) - (Number(x) || 0));
  } else {
    keys.sort((x, y) => typeRank(x) - typeRank(y) || x.localeCompare(y));
  }
  return keys.map((k) => ({ heading: k, articles: groups.get(k)! }));
};

// The export limit (admin setting reportingArticleRTF.maxLimit, stored as a string) clamped to a
// hard ceiling, so a mistyped setting can't build a document that takes the pod down.
export const WORD_LIMIT_DEFAULT = 1000;
export const WORD_LIMIT_CEILING = 10000;
export const wordLimit = (setting: unknown): number => {
  const n = Number(setting);
  if (!Number.isFinite(n) || n <= 0) return WORD_LIMIT_DEFAULT;
  return Math.min(Math.floor(n), WORD_LIMIT_CEILING);
};

export const GROUP_LABELS: Record<WordGroupBy, string> = { year: "year", type: "publication type", person: "person" };
