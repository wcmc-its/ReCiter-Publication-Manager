// Pure helpers for a /report result row (5a/5b): source badge, alternate ids, WCM first/last
// author and the citation block. No imports so the node tests can load it directly.

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
