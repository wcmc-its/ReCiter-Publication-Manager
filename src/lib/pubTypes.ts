// Publication type taxonomy for external (Scopus, OpenAlex, Crossref, ORCID) and manual records:
// the 4 groups and 18 types, peer-review and role defaults, source-type mapping, the venue line
// by type, and the duplicate tests. Ported from the Publication Manager UI refresh prototype
// (app_logic.js: R_FAMILIES, prDefault/prOf, roleDefault, venueOf, normT/titleSim/sameIds/
// fuzzyTwin) and its developer handoff (Nov 9, 2026). Where the two disagree the handoff wins,
// and the spot is marked "Handoff:".
// Dependency-free so the client, the controllers and the node check scripts can all import it.

export const PUB_TYPE_GROUPS = [
  { key: "journal", label: "Journal articles", types: ["Academic Article", "Review", "Letter", "Editorial"] },
  { key: "conf", label: "Conference papers and proceedings", types: ["Conference Paper", "Conference Abstract", "Conference Proceedings"] },
  { key: "book", label: "Books, chapters and reference works", types: ["Book", "Edited Book", "Book Chapter", "Reference Entry"] },
  {
    key: "other",
    label: "Preprints and other works",
    types: ["Preprint", "Report", "Educational Material", "Non-Peer-Reviewed Writing", "Dataset", "Dissertation", "Software"],
  },
] as const;

export type PubTypeGroup = (typeof PUB_TYPE_GROUPS)[number];
export type PubTypeGroupKey = PubTypeGroup["key"];
export type PubType = PubTypeGroup["types"][number];

export const PUB_TYPES: readonly PubType[] = PUB_TYPE_GROUPS.flatMap((g) => [...g.types]);

export const isPubType = (t: unknown): t is PubType => PUB_TYPES.includes(t as PubType);

export const typeGroupOf = (type: string): PubTypeGroupKey | undefined =>
  PUB_TYPE_GROUPS.find((g) => (g.types as readonly string[]).includes(type))?.key;

// Peer review: a default per type; a record can override it (e.g. a refereed encyclopedia entry).
const PEER_REVIEWED_BY_DEFAULT: ReadonlySet<string> = new Set(["Academic Article", "Review", "Conference Paper"]);

// Non-Peer-Reviewed Writing can never be marked peer reviewed; every other type can be overridden.
export const canBePeerReviewed = (type: string): boolean => type !== "Non-Peer-Reviewed Writing";

// Educational Material defaults to peer reviewed only when its repository is MedEdPORTAL
// (the prototype tests the record's journal/repository field with /mededportal/i).
export const defaultPeerReviewed = (type: string, opts: { repository?: string | null } = {}): boolean => {
  if (!canBePeerReviewed(type)) return false;
  if (type === "Educational Material") return /mededportal/i.test(opts.repository || "");
  return PEER_REVIEWED_BY_DEFAULT.has(type);
};

// Effective peer-review status: an explicit boolean wins over the type default.
// Handoff: Non-Peer-Reviewed Writing is never peer reviewed, even with a stored `pr: true`. The
// prototype's prOf would honor a stored true; only its manual-entry save forced false.
export const peerReviewedOf = (rec: { type: string; pr?: boolean | null; journal?: string | null }): boolean => {
  if (!canBePeerReviewed(rec.type)) return false;
  return typeof rec.pr === "boolean" ? rec.pr : defaultPeerReviewed(rec.type, { repository: rec.journal });
};

export const PUB_ROLES = ["Author", "Editor", "Section editor", "Translator"] as const;
export type PubRole = (typeof PUB_ROLES)[number];

// The person's role on the work: Editor for edited books and proceedings, else Author.
export const defaultRole = (type: string): PubRole =>
  type === "Edited Book" || type === "Conference Proceedings" ? "Editor" : "Author";

// Source type mapping
//
// disposition:
//   publication  — lands in `type` and counts like any other record
//   presentation — talks and posters: out of scope, hidden by default and not counted
//   out-of-scope — patents, peer reviews, grants and the like (handoff "Out of scope for now")
//   not-counted  — errata and retractions; recommended: link to the original and flag it
//   unmapped     — no confident mapping; a curator picks the type (type is required)
export type SourceTypeDisposition = "publication" | "presentation" | "out-of-scope" | "not-counted" | "unmapped";

export interface SourceTypeMapping {
  type: PubType | null;
  disposition: SourceTypeDisposition;
  hidden: boolean; // hidden from Pending by default and left out of counts
  kind?: string; // suggested Kind for Non-Peer-Reviewed Writing / Educational Material
  notice?: "erratum" | "retraction";
}

export type PubSource = "Crossref" | "OpenAlex" | "Scopus" | "PubMed" | "ORCID";

const pub = (type: PubType, kind?: string): SourceTypeMapping =>
  kind ? { type, disposition: "publication", hidden: false, kind } : { type, disposition: "publication", hidden: false };
const PRESENTATION: SourceTypeMapping = { type: null, disposition: "presentation", hidden: true };
const OUT_OF_SCOPE: SourceTypeMapping = { type: null, disposition: "out-of-scope", hidden: true };
const ERRATUM: SourceTypeMapping = { type: null, disposition: "not-counted", hidden: true, notice: "erratum" };
const RETRACTION: SourceTypeMapping = { type: null, disposition: "not-counted", hidden: true, notice: "retraction" };
const UNMAPPED: SourceTypeMapping = { type: null, disposition: "unmapped", hidden: false };

// Keys are normalized with normSourceType: lower case, spaces/underscores as hyphens.
const CROSSREF: Record<string, SourceTypeMapping> = {
  "journal-article": pub("Academic Article"),
  "book-chapter": pub("Book Chapter"),
  "book-part": pub("Book Chapter"),
  "book-section": pub("Book Chapter"),
  book: pub("Book"),
  monograph: pub("Book"),
  "reference-book": pub("Book"),
  "edited-book": pub("Edited Book"),
  "proceedings-article": pub("Conference Paper"),
  proceedings: pub("Conference Proceedings"),
  "posted-content": pub("Preprint"),
  "reference-entry": pub("Reference Entry"),
  dataset: pub("Dataset"),
  dissertation: pub("Dissertation"),
  report: pub("Report"),
  "report-component": pub("Report"),
  "peer-review": OUT_OF_SCOPE,
  grant: OUT_OF_SCOPE,
};

const OPENALEX: Record<string, SourceTypeMapping> = {
  article: pub("Academic Article"),
  review: pub("Review"),
  letter: pub("Letter"),
  editorial: pub("Editorial"),
  "book-chapter": pub("Book Chapter"),
  book: pub("Book"),
  preprint: pub("Preprint"),
  "reference-entry": pub("Reference Entry"),
  dataset: pub("Dataset"),
  dissertation: pub("Dissertation"),
  report: pub("Report"),
  erratum: ERRATUM,
  retraction: RETRACTION,
  "peer-review": OUT_OF_SCOPE,
  grant: OUT_OF_SCOPE,
};

// Scopus subtypeDescription, plus the two-letter subtype codes.
const SCOPUS: Record<string, SourceTypeMapping> = {
  article: pub("Academic Article"),
  ar: pub("Academic Article"),
  "data-paper": pub("Academic Article"),
  dp: pub("Academic Article"),
  review: pub("Review"),
  re: pub("Review"),
  "short-survey": pub("Review"),
  sh: pub("Review"),
  letter: pub("Letter"),
  le: pub("Letter"),
  editorial: pub("Editorial"),
  ed: pub("Editorial"),
  "book-chapter": pub("Book Chapter"),
  ch: pub("Book Chapter"),
  book: pub("Book"),
  bk: pub("Book"),
  "conference-paper": pub("Conference Paper"),
  cp: pub("Conference Paper"),
  report: pub("Report"),
  rp: pub("Report"),
  erratum: ERRATUM,
  er: ERRATUM,
  retracted: RETRACTION,
  tb: RETRACTION,
};

// PubMed publication types, highest priority first (a record carries several, e.g.
// "Journal Article" + "Review"). Anything else PubMed indexes is a journal article.
const PUBMED_PRIORITY: [string, SourceTypeMapping][] = [
  ["published-erratum", ERRATUM],
  ["retraction-of-publication", RETRACTION],
  ["retraction-notice", RETRACTION],
  ["preprint", pub("Preprint")],
  ["systematic-review", pub("Review")],
  ["meta-analysis", pub("Review")],
  ["review", pub("Review")],
  ["editorial", pub("Editorial")],
  ["letter", pub("Letter")],
];

const ORCID: Record<string, SourceTypeMapping> = {
  "journal-article": pub("Academic Article"),
  review: pub("Review"),
  book: pub("Book"),
  "edited-book": pub("Edited Book"),
  "book-chapter": pub("Book Chapter"),
  "dictionary-entry": pub("Reference Entry"),
  "encyclopedia-entry": pub("Reference Entry"),
  "conference-paper": pub("Conference Paper"),
  "conference-abstract": pub("Conference Abstract"),
  "conference-proceedings": pub("Conference Proceedings"),
  preprint: pub("Preprint"),
  "working-paper": pub("Report"),
  report: pub("Report"),
  "data-set": pub("Dataset"),
  "dissertation-thesis": pub("Dissertation"),
  dissertation: pub("Dissertation"),
  software: pub("Software"),
  "research-tool": pub("Software"),
  "learning-object": pub("Educational Material"),
  "magazine-article": pub("Non-Peer-Reviewed Writing", "Magazine or newsletter article"),
  "newsletter-article": pub("Non-Peer-Reviewed Writing", "Magazine or newsletter article"),
  "newspaper-article": pub("Non-Peer-Reviewed Writing", "Op-ed or commentary"),
  "blog-post": pub("Non-Peer-Reviewed Writing", "Blog post"),
  "lecture-speech": PRESENTATION,
  "conference-poster": PRESENTATION,
  "conference-presentation": PRESENTATION,
  "public-speech": PRESENTATION,
  patent: OUT_OF_SCOPE,
  invention: OUT_OF_SCOPE,
  disclosure: OUT_OF_SCOPE,
  license: OUT_OF_SCOPE,
  "peer-review": OUT_OF_SCOPE,
};

const normSourceType = (t: string | null | undefined): string =>
  String(t || "").trim().toLowerCase().replace(/[\s_]+/g, "-");

// Map one source's work type onto ours. PubMed takes its whole publication-type list.
// Unknown values come back unmapped (type null) rather than guessed.
// Prototype: hid ORCID 'Lecture', 'Poster', 'Presentation' and 'Other' from Pending. Handoff:
// only talks and posters are out of scope, so 'other' is unmapped (curator picks a type), not hidden.
export const mapSourceType = (source: PubSource | string, sourceType: string | readonly string[] | null | undefined): SourceTypeMapping => {
  const src = String(source || "").toLowerCase();
  if (src === "pubmed") {
    const list = (Array.isArray(sourceType) ? sourceType : [sourceType]).map(normSourceType).filter(Boolean);
    if (!list.length) return UNMAPPED;
    const hit = PUBMED_PRIORITY.find(([k]) => list.includes(k));
    return hit ? hit[1] : pub("Academic Article");
  }
  const key = normSourceType(Array.isArray(sourceType) ? sourceType[0] : (sourceType as string));
  const table =
    src === "crossref" ? CROSSREF : src === "openalex" ? OPENALEX : src === "scopus" ? SCOPUS : src === "orcid" ? ORCID : null;
  return (table && Object.prototype.hasOwnProperty.call(table, key) && table[key]) || UNMAPPED;
};

// Every normalized key one source's map knows. scripts/check-pub-type-map.mjs compares these with
// ReCiterDB's pub_type_map seed (setup/seed_pub_type_map.sql), which is generated from this file.
export const sourceTypeKeys = (source: "crossref" | "openalex" | "scopus" | "orcid"): string[] => {
  const table = source === "crossref" ? CROSSREF : source === "openalex" ? OPENALEX : source === "scopus" ? SCOPUS : ORCID;
  return Object.keys(table);
};

// Venue line

export interface VenueRecord {
  type: string;
  journal?: string | null; // journal, book title, proceedings, reference work, outlet or repository
  publisher?: string | null;
  place?: string | null;
  eds?: readonly string[] | null; // book editors (chapters)
  pages?: string | null;
  volume?: string | null;
  issue?: string | null;
  conf?: string | null;
  kind?: string | null;
  audience?: string | null; // "Students; Residents"
  role?: string | null;
  living?: boolean | string | null; // Reference Entry: updated continuously
  updated?: string | null; // YYYY-MM
  degree?: string | null;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtYM = (v: string | null | undefined): string => {
  const m = String(v || "").match(/^(\d{4})-(\d{1,2})$/);
  return m ? `${m[1]} ${MON[+m[2] - 1]}` : String(v || "");
};
const isLiving = (v: boolean | string | null | undefined): boolean =>
  v === true || (typeof v === "string" && /^(yes|true)$/i.test(v.trim()));

// The venue line, by type (NLM / Citing Medicine order: chapter editors and book, proceedings,
// publisher, pages). Ported from the prototype's venueOf; missing fields read as empty, not "undefined".
export const venueOf = (a: VenueRecord): string => {
  const journal = a.journal || "";
  const pub = a.publisher ? (a.place ? `${a.place}: ${a.publisher}` : a.publisher) : "";
  switch (a.type) {
    case "Book":
    case "Edited Book":
    case "Report":
      return pub || journal;
    case "Book Chapter": {
      const eds = a.eds || [];
      return `In: ${eds.join(", ")}${eds.length ? ", editors. " : ""}${journal}. ${pub}${a.pages ? "; p. " + a.pages : ""}`.trim();
    }
    case "Conference Proceedings":
      return [a.conf, a.publisher].filter(Boolean).join(". ");
    case "Conference Paper":
      return `${journal}${a.publisher ? ". " + a.publisher : ""}${a.pages ? "; p. " + a.pages : ""}`;
    case "Preprint":
      return `${journal} (preprint, not peer reviewed)`;
    case "Dataset":
    case "Software":
      return `${journal} (${a.type.toLowerCase()})`;
    case "Reference Entry":
      return [
        journal + (a.publisher ? ` (${a.publisher})` : ""),
        a.role && a.role !== "Author" ? a.role.toLowerCase() : "",
        isLiving(a.living) ? (a.updated ? "updated " + fmtYM(a.updated) : "updated continuously") : "",
      ]
        .filter(Boolean)
        .join(" · ");
    case "Non-Peer-Reviewed Writing":
      return `${journal}${a.kind ? " (" + a.kind.toLowerCase() + ")" : ""}`;
    case "Educational Material": {
      const parts = [
        a.kind && a.kind.toLowerCase(),
        a.audience &&
          "for " +
            a.audience
              .toLowerCase()
              .split("; ")
              .join(", ")
              .replace(/, ([^,]*)$/, " and $1"),
      ].filter(Boolean);
      return `${journal}${parts.length ? " (" + parts.join(", ") + ")" : ""}`;
    }
    case "Dissertation":
      return `${a.publisher || journal}${a.degree ? " (" + a.degree + ")" : " (dissertation)"}`;
    default:
      return (
        journal +
        (a.volume ? `. ${a.volume}${a.issue ? "(" + a.issue + ")" : ""}` : "") +
        (a.pages ? `${a.volume ? ":" : "; p. "}${a.pages}` : "")
      );
  }
};

// Duplicates
//
// Tiers, as in ReCiter's ExternalArticleDupCheck:
//   definite = a shared PMID, DOI or source id (Scopus EID / OpenAlex W id) -> block, show existing
//   possible = same publication year and >= 85% title word overlap, different identifiers -> warn
// Title alone never counts: a reused title ("Hepatology Highlights") in another year is not a duplicate.

export interface DupRecord {
  pmid?: string | number | null;
  doi?: string | null;
  sourceId?: string | null; // the prototype's `xid`: Scopus EID or OpenAlex work id
  title?: string | null;
  year?: string | number | null;
  date?: string | null; // ISO date; used for the year when `year` is absent
}

export const POSSIBLE_DUPLICATE_TITLE_SIMILARITY = 0.85;

// Title key: case, punctuation and spacing ignored.
export const normTitle = (x: string | null | undefined): string =>
  String(x || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Shared words over all distinct words (Jaccard) of the normalized titles, 0..1.
export const titleSimilarity = (a: string | null | undefined, b: string | null | undefined): number => {
  const A = new Set(normTitle(a).split(" "));
  const B = new Set(normTitle(b).split(" "));
  let n = 0;
  A.forEach((w) => {
    if (B.has(w)) n++;
  });
  return n / Math.max(1, new Set([...A, ...B]).size);
};

// The prototype only lower-cased DOIs; also dropping a doi.org/"doi:" prefix is a small addition.
const normDoi = (d: string | null | undefined): string =>
  String(d || "")
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();

// A blank year (the manual form's empty string) falls back to the date, like a missing one.
const yearOf = (r: DupRecord): string => String(r.year ?? "").trim() || String(r.date || "").slice(0, 4).trim();

// Source ids compare in their bare form: OpenAlex ids are stored both as "W123" and as
// "https://openalex.org/W123" (see src/lib/externalSource.ts openalexWorkId).
const normSourceId = (id: string | null | undefined): string =>
  String(id || "").trim().replace(/^https?:\/\/openalex\.org\//i, "");

// Why two records are definitely the same work ("Same PMID 123", "Same DOI ...",
// "Same OpenAlex id"), or "" when they share no identifier.
export const definiteDuplicateReason = (a: DupRecord, b: DupRecord): string => {
  const pa = String(a.pmid ?? "").trim();
  const pb = String(b.pmid ?? "").trim();
  if (pa && pb && pa === pb) return "Same PMID " + pa;
  const da = normDoi(a.doi);
  if (da && da === normDoi(b.doi)) return "Same DOI " + a.doi;
  const sa = normSourceId(a.sourceId);
  if (sa && sa === normSourceId(b.sourceId)) return "Same " + (sa.startsWith("W") ? "OpenAlex" : "Scopus") + " id";
  return "";
};

export const isDefiniteDuplicate = (a: DupRecord, b: DupRecord): boolean => !!definiteDuplicateReason(a, b);

export const isPossibleDuplicate = (a: DupRecord, b: DupRecord): boolean => {
  if (isDefiniteDuplicate(a, b)) return false;
  const ya = yearOf(a);
  // Two blank titles score 1.0 in titleSimilarity; the prototype never had a titleless record.
  if (!normTitle(a.title) || !normTitle(b.title)) return false;
  return !!ya && ya === yearOf(b) && titleSimilarity(a.title, b.title) >= POSSIBLE_DUPLICATE_TITLE_SIMILARITY;
};

// 2h: accepted external records (Scopus / OpenAlex / Crossref / manual) that duplicate an
// accepted PubMed record. Cross-source only; two PubMed records are never paired (plan, Nov 9).
// Uses the tiers above. Tested in tests/crossSourceDups.test.mjs.

export interface DupPair { pub: any; ext: any; reason: string; definite: boolean }

const SOURCES = ['SCOPUS', 'OPENALEX', 'CROSSREF']
export const extSourceLabel = (e: any): string => {
  const st = String(e?.sourceType || '').toUpperCase()
  return st === 'SCOPUS' ? 'Scopus' : st === 'OPENALEX' ? 'OpenAlex' : st === 'CROSSREF' ? 'Crossref' : 'Manual'
}

const pubRec = (p: any): DupRecord => ({
  pmid: p.pmid, doi: p.doi, title: p.articleTitle,
  date: String(p.publicationDateStandardized || p.publicationDateDisplay || '').match(/\d{4}/)?.[0] || null,
})
const extRec = (e: any): DupRecord => {
  const id = String(e.articleId || ''), i = id.indexOf(':'), src = id.slice(0, i).toUpperCase()
  return {
    pmid: e.pmid, doi: e.doi, title: e.title,
    // Only Scopus / OpenAlex ids are comparable source ids; a Crossref id is its DOI.
    sourceId: SOURCES.includes(src) && src !== 'CROSSREF' ? id.slice(i + 1) : null,
    date: String(e.pubDate || e.publicationDate || e.displayDate || '').match(/\d{4}/)?.[0] || null,
  }
}

// One pair per external record (its best PubMed match: definite before possible).
// ponytail: O(accepted × external); fine at hundreds × tens, bucket by year if a record measures slow.
export const crossSourceDuplicates = (accepted: any[], external: any[]): DupPair[] => {
  const pubs = accepted.map((p) => [p, pubRec(p)] as const)
  const out: DupPair[] = []
  for (const e of external) {
    if (e.suppressed) continue
    const er = extRec(e)
    let best: DupPair | null = null
    for (const [p, pr] of pubs) {
      const why = definiteDuplicateReason(pr, er)
      if (why) { best = { pub: p, ext: e, reason: why, definite: true }; break }
      if (!best && isPossibleDuplicate(pr, er)) best = { pub: p, ext: e, reason: 'Title + year match', definite: false }
    }
    if (best) out.push(best)
  }
  return out
}

// "Different papers" verdicts live in FeedbackLog as PENDING entries (PENDING changes no
// state) whose note carries a marker. The newest marker for a PMID wins, so Undo is just
// another entry. Entries are the feedbacklog slice for one external articleId.
export const notDupNote = (pmid: string | number): string => `Not a duplicate of PMID ${pmid}`
export const reopenDupNote = (pmid: string | number): string => `Duplicate check reopened for PMID ${pmid}`
export const isMarkedDifferent = (entries: any[] | undefined, pmid: string | number): boolean => {
  const newest = [...(entries || [])]
    .filter((e) => e?.note === notDupNote(pmid) || e?.note === reopenDupNote(pmid))
    .sort((a, b) => (Number(b.createTimestamp) || 0) - (Number(a.createTimestamp) || 0))[0]
  return newest?.note === notDupNote(pmid)
}
