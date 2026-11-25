// What the duplicate check matched when an Authorships Accept was parked (authorship_review
// .accept_conflict_matches, ReCiterDB v3.12). accept_conflict keeps only the check's message, so
// without this the "Duplicate records" queue cannot say what the paper supposedly duplicates.
//
// Written by authorships.controller (the Accept that came back 409) and by
// scripts/backfill-accept-conflict-matches.mjs (rows parked before the column existed); read by
// AuthorshipsTabs (DupPair's "Existing record" box and the card's conflict prompt).
//
// Matches come from either duplicate check, which share one shape ({type, matchedId, detail,
// title?, journal?, pubYear?}): ReCiter's ExternalArticleDupCheck (EXTERNAL_STORE unset) or PM's
// src/lib/externalDupCheck.ts (EXTERNAL_STORE=mysql, and the backfill).
//
// Dependency-free so the client, the controller and the node scripts can all import it.

export type ConflictWhere = "record" | "candidates" | "rejected";

export interface StoredConflictMatch {
  source: string;        // "PubMed", "Scopus", "OpenAlex", "Crossref", ...
  type: string | null;   // the check's match type, e.g. TITLE_YEAR_MATCH
  id: string | null;     // PMID, EID, OpenAlex id, DOI, ...
  idLabel: string | null;
  doi: string | null;
  title: string | null;
  journal: string | null;
  pubYear: string | null;
  where: ConflictWhere;  // where the match sits for `uid`
  detail: string | null;
}

export interface StoredConflict {
  v: 1;
  uid: string | null;    // whose record the check looked in (the cwid the Accept was for)
  name: string | null;
  via: "accept" | "backfill";
  checked_at: string;
  matches: StoredConflictMatch[];
}

const MAX_MATCHES = 10;
const PUBMED_TYPES = new Set(["PMID_IN_GOLD_STANDARD", "PMID_REJECTED_IN_GOLD_STANDARD", "PMID_IN_CANDIDATES", "DOI_MATCH", "TITLE_YEAR_MATCH"]);
const CANDIDATE_TYPES = new Set(["PMID_IN_CANDIDATES", "DOI_MATCH", "TITLE_YEAR_MATCH"]);
const REJECTED_TYPES = new Set(["PMID_REJECTED_IN_GOLD_STANDARD", "REJECTION_MEMORY"]);
const SOURCE_NAME: Record<string, string> = {
  SCOPUS: "Scopus", OPENALEX: "OpenAlex", CROSSREF: "Crossref", WOS: "Web of Science", MANUAL: "Manual entry", ORCID: "ORCID",
};

const text = (v: unknown, max: number): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

// Source, id and id label of one match. PubMed-keyed types carry a PMID in matchedId; the others
// carry an external article_id ("SCOPUS:85123", "OPENALEX:W123", "CROSSREF:10.1/x").
export function matchIdentity(m: { type?: unknown; matchedId?: unknown }): { source: string; id: string | null; idLabel: string | null } {
  const type = String(m?.type || "");
  const raw = text(m?.matchedId, 255);
  if (PUBMED_TYPES.has(type)) return { source: "PubMed", id: raw, idLabel: raw ? "PMID" : null };
  if (!raw) return { source: "Existing record", id: null, idLabel: null };
  const i = raw.indexOf(":");
  const prefix = i > 0 ? raw.slice(0, i).toUpperCase() : "";
  const rest = i > 0 ? raw.slice(i + 1) : raw;
  if (prefix === "SCOPUS") return { source: "Scopus", id: /^\d+$/.test(rest) ? `2-s2.0-${rest}` : rest, idLabel: "EID" };
  if (prefix === "OPENALEX") return { source: "OpenAlex", id: rest, idLabel: "OpenAlex" };
  if (prefix === "CROSSREF") return { source: "Crossref", id: rest, idLabel: "DOI" };
  if (prefix === "PMID" || /^\d+$/.test(raw)) return { source: "PubMed", id: rest, idLabel: "PMID" };
  if (SOURCE_NAME[prefix]) return { source: SOURCE_NAME[prefix], id: rest, idLabel: "ID" };
  // REJECTION_MEMORY without a record: "DOI:10.1/x", "TITLE_YEAR:..."
  if (prefix === "DOI") return { source: "Existing record", id: rest, idLabel: "DOI" };
  return { source: "Existing record", id: raw, idLabel: null };
}

export function whereOf(type: unknown): ConflictWhere {
  const t = String(type || "");
  if (CANDIDATE_TYPES.has(t)) return "candidates";
  if (REJECTED_TYPES.has(t)) return "rejected";
  return "record";
}

export function storedMatchOf(m: any): StoredConflictMatch {
  const { source, id, idLabel } = matchIdentity(m);
  return {
    source, type: text(m?.type, 64), id, idLabel,
    doi: text(m?.doi, 255) ?? (idLabel === "DOI" ? id : null),
    title: text(m?.title, 500),
    journal: text(m?.journal, 255),
    pubYear: text(m?.pubYear, 8),
    where: whereOf(m?.type),
    detail: text(m?.detail, 300),
  };
}

// The column value for a parked row, or null when the check returned no matches (the column
// stays NULL, so a later backfill run can try again).
export function storedConflictJson(
  uid: string | null | undefined, name: string | null | undefined, via: StoredConflict["via"], matches: unknown, now: Date = new Date(),
): string | null {
  const list = Array.isArray(matches) ? matches.filter((m) => m && typeof m === "object") : [];
  if (!list.length) return null;
  const out: StoredConflict = {
    v: 1, uid: text(uid, 32), name: text(name, 128), via, checked_at: now.toISOString(),
    matches: list.slice(0, MAX_MATCHES).map(storedMatchOf),
  };
  return JSON.stringify(out);
}

// Read side: tolerant of a NULL/absent column, a string or an already-parsed object, and junk.
export function parseStoredConflict(raw: unknown): StoredConflict | null {
  let v: any = raw;
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return null; }
  }
  if (!v || typeof v !== "object" || !Array.isArray(v.matches)) return null;
  const matches = v.matches.filter((m: any) => m && typeof m === "object").map((m: any) => ({
    ...storedMatchOf({}),
    ...m,
    where: m.where === "candidates" || m.where === "rejected" ? m.where : "record",
    source: text(m.source, 64) || "Existing record",
  })) as StoredConflictMatch[];
  if (!matches.length) return null;
  return {
    v: 1, uid: text(v.uid, 32), name: text(v.name, 128), via: v.via === "backfill" ? "backfill" : "accept",
    checked_at: String(v.checked_at || ""), matches,
  };
}

// "PMID 12345", "EID 2-s2.0-85…", or just the id.
export const matchIdText = (m: Pick<StoredConflictMatch, "id" | "idLabel">): string =>
  m.id ? (m.idLabel ? `${m.idLabel} ${m.id}` : m.id) : "";

// Whose record the match sits in, as a sentence fragment for the curator.
export function matchWhereText(m: Pick<StoredConflictMatch, "where" | "source">, who: string | null | undefined): string {
  const whose = who ? `${who}'s` : "this person's";
  if (m.where === "candidates") return `In ${whose} PubMed candidates`;
  if (m.where === "rejected") return `Previously rejected or removed from ${whose} record`;
  return `Already in ${whose} record`;
}

// The duplicate check's own message names an API flag ("Retry with force=true to add anyway."),
// which means nothing to a curator. Strip it wherever the message is shown.
export function curatorConflictMessage(message: unknown): string {
  const s = String(message ?? "")
    .replace(/\s*Retry with force\s*=\s*true[^.]*\.?/gi, "")
    .replace(/\s*\(?force\s*=\s*true\)?/gi, "")
    .trim();
  return s || "Possible duplicate.";
}
