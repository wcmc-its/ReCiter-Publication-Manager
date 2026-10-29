// authorship_review.source lanes. 'pubmed' is the only lane with a PMID behind it (gold
// standard, FeedbackLog, production scores). Every other lane — the Scopus AF-ID sweep and the
// OpenAlex conference-abstract/preprint sweep — is a not-in-PubMed record keyed by external_id
// that a curator accepts as an ExternalArticle. Ask "is this external?" here rather than
// comparing against one lane's name, so a new lane does not fall into the PubMed branches.
// Dependency-free so the client card, the controller and the node check scripts can all import it.
export type AuthorshipSource = "pubmed" | "scopus" | "openalex";

// A row with no source is a PubMed row (the column's default), same as before this helper.
export const isExternalSource = (r: { source?: string | null } | null | undefined): boolean =>
  (r?.source ?? "pubmed") !== "pubmed";

// OpenAlex work id as stored in external_id ("W2741809807"), tolerating the full URL form.
export const openalexWorkId = (externalId?: string | null): string =>
  String(externalId || "").replace(/^https?:\/\/openalex\.org\//i, "");

export const openalexRecordUrl = (externalId?: string | null): string | undefined => {
  const id = openalexWorkId(externalId);
  return id ? `https://openalex.org/${id}` : undefined;
};

// Display name of an external lane, for copy shared by every external lane (the PubMed-twin
// panel, the same-work 422, the twin chip). Unknown/legacy external values read as Scopus,
// the lane that existed before this helper.
export const externalSourceLabel = (r: { source?: string | null } | null | undefined): string =>
  r?.source === "openalex" ? "OpenAlex" : "Scopus";
