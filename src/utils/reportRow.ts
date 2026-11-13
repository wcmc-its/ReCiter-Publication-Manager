// Pure helpers for a /report result row (5a/5b/5c): source badge, alternate ids, WCM first/last
// author, the citation block, the venue record and the grouped Type options. Type-only imports,
// so the node tests can load it directly.

import type { VenueRecord } from "../lib/pubTypes";

export type SourceInfo = { key: string; label: string; tip: string; tone: "slate" | "amber" | "plain" };

const SOURCES: Record<string, SourceInfo> = {
  PUBMED: { key: "PUBMED", label: "PubMed", tip: "Indexed in PubMed", tone: "slate" },
  SCOPUS: { key: "SCOPUS", label: "Scopus", tip: "From Scopus; not in PubMed, so no NIH metrics", tone: "amber" },
  OPENALEX: { key: "OPENALEX", label: "OpenAlex", tip: "From OpenAlex; not in PubMed, so no NIH metrics", tone: "amber" },
  CROSSREF: { key: "CROSSREF", label: "Crossref", tip: "From Crossref; not in PubMed, so no NIH metrics", tone: "plain" },
  WOS: { key: "WOS", label: "Web of Science", tip: "From Web of Science; not in PubMed, so no NIH metrics", tone: "plain" },
};

// sourceType is analysis_summary_article.source_type when the DB has it. Without it, external rows
// are recognisable only by their synthetic negative pmid, and articleId's prefix names the source.
export const sourceOf = (row: { sourceType?: string | null; pmid?: number | string | null; articleId?: string | null }): SourceInfo => {
  const fromCol = row.sourceType && SOURCES[String(row.sourceType).toUpperCase()];
  if (fromCol) return fromCol;
  const prefix = row.articleId ? String(row.articleId).split(":")[0].toUpperCase() : "";
  if (SOURCES[prefix]) return SOURCES[prefix];
  if (Number(row.pmid) > 0) return SOURCES.PUBMED;
  return { key: "EXTERNAL", label: "External", tip: "Not in PubMed, so no NIH metrics", tone: "plain" };
};

export type AltId = { label: string; value: string; href: string };

// The id shown for a non-PubMed row when it has no DOI: Scopus EID or OpenAlex work id, from the
// source-prefixed article_id ("SCOPUS:2-s2.0-…", "OPENALEX:W…").
export const externalIdOf = (row: { pmid?: number | string | null; articleId?: string | null }): AltId | null => {
  if (Number(row.pmid) > 0 || !row.articleId) return null;
  const [prefix, ...rest] = String(row.articleId).split(":");
  const value = rest.join(":");
  if (!value) return null;
  switch (prefix.toUpperCase()) {
    case "SCOPUS": {
      const eid = value.startsWith("2-s2.0-") ? value : `2-s2.0-${value}`;
      return { label: "EID", value: eid, href: `https://www.scopus.com/record/display.uri?eid=${encodeURIComponent(eid)}&origin=resultslist` };
    }
    case "OPENALEX": return { label: "OpenAlex", value, href: `https://openalex.org/${encodeURIComponent(value)}` };
    default: return null;
  }
};

export const pmcidHref = (pmcid?: string | null): string | null => {
  const v = (pmcid || "").trim();
  if (!/^PMC\d+$/i.test(v)) return null;
  return `https://www.ncbi.nlm.nih.gov/pmc/articles/${v.toUpperCase()}/`;
};

// "WCM first author" / "WCM last author" / "WCM first & last author": the byline's first or last
// author is a known person (has a personIdentifier). A single-author paper counts as first only.
export const wcmPositionText = (authors?: Array<{ personIdentifier?: string | null; rank?: number | null }> | null): string => {
  const list = (authors || []).slice().sort((a, b) => (Number(a.rank) || 0) - (Number(b.rank) || 0));
  const n = list.length;
  if (!n) return "";
  const known = (a: any) => !!(a && a.personIdentifier && String(a.personIdentifier).trim());
  const pos: string[] = [];
  if (known(list[0])) pos.push("first");
  if (n > 1 && known(list[n - 1])) pos.push("last");
  return pos.length ? `WCM ${pos.join(" & ")} author` : "";
};

const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

export type CitationBlock = { count: number | null; label: string; pill: string; pillStrong: boolean; tip: string };

// The right-hand citation block: NIH count, else Scopus; an "RCR x · NIH nth pct" pill when either
// metric exists (Slate when RCR >= 2). OpenAlex counts arrive with 5e.
export const citationBlock = (row: {
  citationCountNIH?: number | null; citationCountScopus?: number | null;
  relativeCitationRatioNIH?: number | null; percentileNIH?: number | null; pmid?: number | string | null;
}, opts: { showRcr?: boolean; showPct?: boolean } = {}): CitationBlock => {
  const nih = row.citationCountNIH ?? null;
  const scopus = row.citationCountScopus ?? null;
  const count = nih != null ? nih : scopus;
  const label = nih != null ? "citations (NIH)" : scopus != null ? "citations (Scopus)" : "citations";
  let rcr = opts.showRcr === false || row.relativeCitationRatioNIH == null ? null : Number(row.relativeCitationRatioNIH);
  let pct = opts.showPct === false || row.percentileNIH == null ? null : Number(row.percentileNIH);
  // iCite reports 0 / 0 for papers too new to benchmark; that's "not computed", not a 0th percentile.
  if (!rcr && !pct) { rcr = null; pct = null; }
  const pill = [rcr != null ? `RCR ${rcr.toFixed(2)}` : "", pct != null ? `NIH ${ordinal(Math.round(pct))} pct` : ""].filter(Boolean).join(" · ");
  const tipParts = [
    nih != null ? `${nih} (NIH)` : "",
    scopus != null ? `${scopus} (Scopus)` : "",
  ].filter(Boolean);
  let tip = tipParts.length ? `Citations: ${tipParts.join(" · ")}` : "No citation count yet";
  if (rcr != null) tip += ` · Relative Citation Ratio ${rcr.toFixed(2)}`;
  if (pct != null) tip += ` · NIH percentile ${pct}`;
  else if (Number(row.pmid) > 0) tip += " · NIH percentile not computed for the past two years";
  else tip += " · no NIH metrics outside PubMed";
  return { count, label, pill, pillStrong: rcr != null && rcr >= 2, tip };
};

// analysis_summary_article.editors is a JSON array of "Given Surname" strings (ReCiterDB v3.5);
// tolerate a plain string or junk rather than throw while rendering a row.
const editorsOf = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const text = (v: unknown): string | null => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s ? s : null;
};

// Map a report row onto pubTypes.ts's VenueRecord, so the page and the exports (5f/5g/5h) share
// one venue line (venueOf). Rows without a pubType (no 5c columns yet, errata, unmapped types)
// take venueOf's journal branch: journal. volume(issue):pages. Fields 5c can't fill yet (place,
// conf, kind, audience, degree) stay empty; venueOf skips empty fields.
export const venueRecordOf = (row: {
  pubType?: string | null; journalTitleVerbose?: string | null; publisher?: string | null;
  editors?: unknown; volume?: string | number | null; issue?: string | number | null; pages?: string | null;
}): VenueRecord => ({
  type: text(row.pubType) || "",
  journal: text(row.journalTitleVerbose),
  publisher: text(row.publisher),
  eds: editorsOf(row.editors),
  volume: text(row.volume),
  issue: text(row.issue),
  pages: text(row.pages),
});

export type TypeOption = { group: string; groupLabel: string; type: string; count: number };

// Rows from the Type filter endpoint (pubTypeGroup, pubType, count), put in taxonomy order. A type
// outside the taxonomy, or filed under the wrong group, is dropped: the filter can only send
// values the search accepts. `groups` is PUB_TYPE_GROUPS (src/lib/pubTypes.ts).
export const groupedTypeOptions = (
  rows: Array<{ pubTypeGroup?: string | null; pubType?: string | null; count?: number | string | null }>,
  groups: ReadonlyArray<{ key: string; label: string; types: readonly string[] }>
): TypeOption[] => {
  const counts = new Map<string, number>();
  for (const r of rows || []) {
    const key = `${r.pubTypeGroup}|${r.pubType}`;
    counts.set(key, (counts.get(key) || 0) + (Number(r.count) || 0));
  }
  const out: TypeOption[] = [];
  for (const g of groups) {
    for (const t of g.types) {
      const n = counts.get(`${g.key}|${t}`);
      if (n) out.push({ group: g.key, groupLabel: g.label, type: t, count: n });
    }
  }
  return out;
};

// True when the Type filter options are the grouped kind (vs. the old publicationTypeCanonical list).
export const isGroupedTypeOptions = (options: unknown): options is TypeOption[] =>
  Array.isArray(options) && options.length > 0 && options.every((o: any) => o && typeof o.type === "string" && typeof o.group === "string");

// 5d-1 (ReCiterDB v3.10): peer review and the person's role on the work.

export type PeerReviewOption = { key: "yes" | "no"; label: string; desc: string; count: number };

// Rows from the Peer review filter endpoint (peerReviewed 1 / 0, count) as the filter's two
// options. Empty when nothing is filled yet, which hides the filter.
export const peerReviewOptions = (rows: Array<{ peerReviewed?: number | string | null; count?: number | string | null }>): PeerReviewOption[] => {
  let yes = 0;
  let no = 0;
  for (const r of rows || []) {
    if (r.peerReviewed === null || r.peerReviewed === undefined || r.peerReviewed === "") continue;
    if (Number(r.peerReviewed) === 1) yes += Number(r.count) || 0;
    else if (Number(r.peerReviewed) === 0) no += Number(r.count) || 0;
  }
  if (!yes && !no) return [];
  return [
    { key: "yes", label: "Peer-reviewed", desc: "Peer reviewed by default for the type, or set on the record", count: yes },
    { key: "no", label: "Not peer-reviewed", desc: "Letters, editorials, chapters, preprints and the like", count: no },
  ];
};

// The "Not peer-reviewed" chip: shown only when the row says 0. NULL (no column, or not filled
// yet) shows nothing. The tooltip says where the value came from.
export const notPeerReviewedChip = (row: {
  peerReviewed?: number | string | boolean | null; peerReviewedSource?: string | null; pubType?: string | null;
}): { tip: string } | null => {
  const v = row.peerReviewed;
  if (v === null || v === undefined || v === "" || v === true || Number(v) !== 0) return null;
  if (row.peerReviewedSource === "curator") return { tip: "Set by hand on this record" };
  const type = text(row.pubType);
  return { tip: type ? `Default for ${type}` : "Default when the publication type isn't known" };
};

// Edited books and proceedings: the byline is the editors, so the row says so once, after the
// last name (", editor" / ", editors"), as the prototype does.
const EDITED_TYPES = ["Edited Book", "Conference Proceedings"];

export const bylineRoleSuffix = (pubType: string | null | undefined, authorCount: number): string => {
  if (!authorCount || !EDITED_TYPES.includes(String(pubType || ""))) return "";
  return authorCount > 1 ? ", editors" : ", editor";
};

// The note after one WCM person's name: "(section editor)", "(translator)", "(editor)" when their
// role on the work isn't Author. Not for edited types (the byline suffix covers them) or Reference
// Entry (venueOf puts the role in the venue line).
export const authorRoleNote = (pubType: string | null | undefined, role: string | null | undefined): string => {
  const r = text(role);
  if (!r || r.toLowerCase() === "author") return "";
  const type = String(pubType || "");
  if (EDITED_TYPES.includes(type) || type === "Reference Entry") return "";
  return r.toLowerCase();
};
