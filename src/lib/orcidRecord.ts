// The public ORCID record behind a byline iD, for the opened /authorships row: names,
// employments, educations, work-email domains. Read anonymously from pub.orcid.org by the server
// (authorshipOrcidRecord), one record per opened row. Display only: nothing here reaches Accept,
// assign, bulk selection or the ranking.
//
// Dependency-free: the panel imports the pure helpers and tests/orcidRecord.test.mjs runs it
// under plain node. Parser and redirect rule follow Scholars (etl/orcid-evidence recordFacts,
// etl/orcid-registry/orcid-api.ts primaryFromRedirect).

export interface OrcidAffiliation {
  kind: "employment" | "education";
  org: string;
  dept: string;
  role: string;
  start: number | null;
  end: number | null;
}

export interface OrcidRecord {
  // The record shown: the byline iD, or the one it was merged into.
  orcid: string;
  deprecated: boolean;
  name: string;
  family: string;
  otherNames: string[];
  affiliations: OrcidAffiliation[];
  emailDomains: string[];
}

const PUB = "https://pub.orcid.org/v3.0";
const TIMEOUT_MS = 6000;
// A record carries every work; a prolific author's is a few hundred KB.
const MAX_BYTES = 8_000_000;
const TTL_MS = 24 * 3600e3;
const CACHE_MAX = 500;
// Free text from whoever owns the record, so each field and list is bounded.
const MAX_TEXT = 200;
const MAX_ITEMS = 40;
const CONSUMER_MAIL = /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|qq|163|126|foxmail|protonmail|proton|gmx|mail)\./;

// Shape and ISO 7064 mod 11-2 check digit.
export const isOrcid = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s)) return false;
  const d = s.replace(/-/g, "");
  let t = 0;
  for (const c of d.slice(0, 15)) t = (t + Number(c)) * 2;
  const r = (12 - (t % 11)) % 11;
  return d[15] === (r === 10 ? "X" : String(r));
};

const str = (v: any): string => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "");
const list = (v: any): any[] => (Array.isArray(v) ? v : []);
const year = (d: any): number | null => Number(d?.year?.value) || null;

const affiliations = (groups: any, kind: OrcidAffiliation["kind"]): OrcidAffiliation[] => {
  const out: OrcidAffiliation[] = [];
  for (const g of list(groups?.["affiliation-group"])) {
    // A group is one affiliation as several sources state it; the first is the preferred one.
    const s = list(g?.summaries)[0]?.[`${kind}-summary`];
    const org = str(s?.organization?.name);
    if (org) out.push({ kind, org, dept: str(s["department-name"]), role: str(s["role-title"]), start: year(s["start-date"]), end: year(s["end-date"]) });
  }
  return out;
};

// A degree with no end year is usually just missing it, so only a job is current on that alone.
const isCurrent = (a: OrcidAffiliation): boolean => (a.end == null ? a.kind === "employment" : a.end >= new Date().getFullYear());

// Current jobs, then current degrees, then the past ones, newest first within each.
const rank = (a: OrcidAffiliation) => (isCurrent(a) ? (a.kind === "employment" ? 0 : 1) : 2);
const recency = (a: OrcidAffiliation) => (isCurrent(a) ? a.start : a.end ?? a.start) ?? 0;

// The /record JSON -> what the panel shows. Only public fields are ever in it.
export const parseOrcidRecord = (orcid: string, requested: string, rec: any): OrcidRecord => {
  const n = rec?.person?.name;
  const given = str(n?.["given-names"]?.value), family = str(n?.["family-name"]?.value), credit = str(n?.["credit-name"]?.value);
  const name = `${given} ${family}`.trim() || credit;
  const others = [credit, ...list(rec?.person?.["other-names"]?.["other-name"]).map((o) => str(o?.content))];
  const domains = list(rec?.person?.emails?.email).map((e) => str(e?.email).toLowerCase().split("@")[1] || "");
  const acts = rec?.["activities-summary"];
  return {
    orcid, deprecated: orcid !== requested, name, family,
    otherNames: [...new Set(others)].filter((o) => o && o.toLowerCase() !== name.toLowerCase()).slice(0, MAX_ITEMS),
    affiliations: [...affiliations(acts?.employments, "employment"), ...affiliations(acts?.educations, "education")]
      .sort((a, b) => rank(a) - rank(b) || recency(b) - recency(a)).slice(0, MAX_ITEMS),
    emailDomains: [...new Set(domains)].filter((d) => d && !CONSUMER_MAIL.test(d)).slice(0, MAX_ITEMS),
  };
};

// A merged record answers 3xx and names the primary iD. Only the iD is taken from it, so the next
// request still goes to pub.orcid.org whatever host Location names.
export const primaryFromRedirect = (requested: string, location: string | null): string | null =>
  (String(location || "").match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/g) || []).find((i) => i !== requested && isOrcid(i)) ?? null;

const readCapped = async (resp: Response): Promise<any> => {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = resp.body!.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error("ORCID record too large"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const fetchRecord = async (requested: string, doFetch: typeof fetch): Promise<OrcidRecord | null> => {
  let orcid = requested;
  // At most one hop: the byline iD, then the record it was merged into.
  for (let hop = 0; hop < 2; hop++) {
    const resp = await doFetch(`${PUB}/${orcid}/record`, {
      headers: { Accept: "application/json" }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (resp.ok) return parseOrcidRecord(orcid, requested, await readCapped(resp));
    void resp.body?.cancel().catch(() => undefined);
    if (resp.status === 404 || resp.status === 409) return null; // unknown, or deactivated / locked
    const next = resp.status >= 300 && resp.status < 400 ? primaryFromRedirect(orcid, resp.headers.get("location")) : null;
    if (!next) throw new Error(`ORCID HTTP ${resp.status}`);
    orcid = next;
  }
  throw new Error("ORCID redirect loop");
};

// One request per iD per day per server process, shared while in flight. A failure is dropped so
// the next open retries; "no public record" (null) is kept like any other answer.
const cache = new Map<string, { at: number; p: Promise<OrcidRecord | null> }>();

export const getOrcidRecord = (orcid: string, doFetch: typeof fetch = fetch): Promise<OrcidRecord | null> => {
  const hit = cache.get(orcid);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p;
  const entry = { at: Date.now(), p: fetchRecord(orcid, doFetch) };
  entry.p.catch(() => { if (cache.get(orcid) === entry) cache.delete(orcid); });
  cache.delete(orcid);
  cache.set(orcid, entry);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string); // oldest first
  return entry.p;
};

// ---- panel helpers -------------------------------------------------------------------------

export const isCornellOrg = (s: string): boolean => /\b(cornell|weill)\b/i.test(s);

// "2019 to now", "2012 to 2016", "from 2019", "" when the record gives no year. A degree with no
// end year is not claimed as current.
export const yearsText = (a: OrcidAffiliation): string =>
  a.start && a.end ? (a.start === a.end ? `${a.start}` : `${a.start} to ${a.end}`)
    : a.start ? (a.kind === "employment" ? `${a.start} to now` : `from ${a.start}`)
      : a.end ? `until ${a.end}` : "";

const tokens = (s: string): string[] =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/['’‘.]/g, "").split(/[^a-z]+/).filter(Boolean);

// Whether the record's family name is on the byline, so a wrong iD (a co-author's, usually) can be
// called out. Any part of a compound name counts, and so does the end of any other name the record
// lists. A name with no Latin letters can't be compared and is not called a mismatch.
export const familyOnByline = (rec: Pick<OrcidRecord, "family" | "otherNames">, byline?: string | null): boolean => {
  const have = new Set(tokens(byline || "")), joined = tokens(byline || "").join("");
  const family = tokens(rec.family);
  if (!have.size || !family.length) return true;
  const parts = family.filter((t) => t.length > 2);
  if ((parts.length ? parts : family).some((t) => have.has(t))) return true;
  if (family.join("").length > 4 && joined.includes(family.join(""))) return true;
  return rec.otherNames.some((o) => { const t = tokens(o); const last = t[t.length - 1]; return !!last && last.length > 1 && have.has(last); });
};
