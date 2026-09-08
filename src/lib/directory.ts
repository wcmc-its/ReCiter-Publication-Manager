// Live directory lookup for people ReCiter has never heard of — the "long shot" behind the
// typed-cwid box on /authorships.
//
// WHY THIS EXISTS. The AAR producer builds its candidate list from reciterdb `identity`, which
// is fed by reciter-inst-client's ED roster query — and that query is
// `(&(objectClass=eduPerson)(weillCornellEduPersonTypeCode=academic))`
// (ReCiter-Institutional-Client LdapIdentityDaoImpl.java:545). WCM STAFF ARE STRUCTURALLY
// ABSENT, as are Cornell Ithaca people, who are in a different directory entirely. Those are
// exactly the people a curator reaches for when the producer proposed nobody, and before this
// the only way to name one was to already know their identifier, and the only outcome was a
// local-only row that wrote nothing (assignGate.ts's `local_only`).
//
// Two independent LDAPS sources, both OPTIONAL: if a source's env vars are unset it is simply
// absent and the caller degrades to the pre-existing behaviour. A directory that is down must
// never turn an assign into a 500 — see safeSearch/safeLookup below.
//
//   WCM_ED_LDAP_URL / _BIND_DN / _BIND_PASSWORD          ldaps://ed.weill.cornell.edu:636
//   CORNELL_LDAP_URL / _BIND_DN / _BIND_PASSWORD         ldaps://query.directory.cornell.edu:636
//
// None of these may be named NEXT_PUBLIC_* — that prefix ships the value to the browser, and
// config/local.js:168 already does that deliberately for the backend api key. Bind credentials
// are server-only.
//
// ponytail: two small clients in one file rather than a source abstraction with two
// implementations. They share a shape, not a schema — different bases, different attribute
// namespaces, different notions of a person type — and a common interface would be a lie that
// costs more than the duplication. Ceiling: a third directory. Split then, not before.
import { Client } from "ldapts";

export const WCM_BASE = "ou=people,dc=weill,dc=cornell,dc=edu";
export const CORNELL_BASE = "ou=People,o=Cornell University,c=us";

// One person, from either directory, in the shape the assign path needs: enough to show a
// curator who they are picking, and enough to MINT a full ReCiter identity for them.
export type DirectoryPerson = {
  /** The identifier a curator types and every downstream write keys on — a WCM cwid or a bare
   *  Cornell netid. Both are bare alphanumerics, so both already pass the
   *  /^[A-Za-z0-9]{1,32}$/ gate on the assign route; nothing about this feature widens it. */
  id: string;
  source: "wcm" | "cornell";
  name: string;
  givenName: string | null;
  middleName: string | null;
  familyName: string | null;
  title: string | null;
  dept: string | null;
  emails: string[];
  /** Directory-native person types, prefixed by source so WCM's and Cornell's vocabularies can
   *  never be mistaken for each other downstream. Never empty — ReCiter hides people with an
   *  empty personTypes (see project memory: empty personTypes hides ~34k accepted articles). */
  personTypes: string[];
  /** Cornell only: `cornellEduCWID`, published for people who ALSO hold a WCM identity. This is
   *  the duplicate-person bridge — 273 of 15,030 Ithaca people carry one, 57 of those cwids
   *  already have a ReCiter identity, and Martin Wells (mtw1 / maw2065) is already split across
   *  two identities in production because of it. Resolved at assign time in the controller. */
  wcmCwid: string | null;
};

// RFC 4515. Applied to every value that reaches a filter, so a literal `*` a curator types is a
// literal `*` and not a wildcard.
export function escapeLdapFilter(s: string): string {
  return s.replace(/[\\*()\0]/g, (c) =>
    ({ "\\": "\\5c", "*": "\\2a", "(": "\\28", ")": "\\29", "\0": "\\00" }[c] as string));
}

function first(v: unknown): string | null {
  if (Array.isArray(v)) { const f = v.find((x) => typeof x === "string"); return (f as string) ?? null; }
  return typeof v === "string" ? v : null;
}
function all(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return typeof v === "string" ? [v] : [];
}
const clean = (xs: (string | null | undefined)[]) =>
  [...new Set(xs.map((x) => String(x || "").trim()).filter(Boolean))];

// ---------------------------------------------------------------- WCM Enterprise Directory

const WCM_ATTRS = [
  "uid", "weillCornellEduCWID", "displayName", "givenName", "weillCornellEduMiddleName", "sn",
  "mail", "weillCornellEduDepartment", "weillCornellEduPersonTypeCode", "title",
] as const;

export function projectWcmPerson(e: Record<string, unknown>): DirectoryPerson | null {
  const id = first(e.weillCornellEduCWID) ?? first(e.uid);
  if (!id) return null;
  const given = first(e.givenName), sn = first(e.sn);
  // NO PREFIX. `weillCornellEduPersonTypeCode` already carries ReCiter's own person-type
  // vocabulary verbatim -- "academic-faculty-weillfulltime", "affiliate-cornell",
  // "employee-exempt" -- confirmed 2026-09-08 against both ED (17 distinct values over 400
  // people, none containing whitespace) and a live Identity record: paa2013 holds exactly
  // these strings unprefixed. Prefixing them invents a parallel vocabulary that no cohort
  // filter matches, and `affiliate-cornell` (live on 483 people) is one of the strings it
  // would break.
  const types = clean(all(e.weillCornellEduPersonTypeCode)).map((t) => t.toLowerCase());
  return {
    id, source: "wcm",
    name: first(e.displayName) || clean([given, sn]).join(" ") || id,
    givenName: given, middleName: first(e.weillCornellEduMiddleName), familyName: sn,
    title: first(e.title),
    dept: first(e.weillCornellEduDepartment),
    emails: clean(all(e.mail)).map((m) => m.toLowerCase()),
    // ponytail: `wcm-directory` is deliberately NOT a real ReCiter person type, and is the one
    // invented string left in this file. 45 of the 61 WCM people minted on 2026-09-08 landed
    // here, because ED genuinely returns no weillCornellEduPersonTypeCode for them (verified
    // per-uid: skt2001 and evakiani have an ED entry and zero codes). An empty personTypes is
    // the worse failure -- it hides accepted articles from reporting, ~34k of them across
    // 1,521 uids on the last measurement -- so a non-empty placeholder wins. It is prefixed so
    // it can never be mistaken for a real type. Replace it once someone decides what an
    // ED-typeless person should actually be.
    personTypes: types.length ? types : ["wcm-directory"],
    wcmCwid: null,
  };
}

// ------------------------------------------------------------------- Cornell Ithaca directory

const CORNELL_ATTRS = [
  "uid", "displayName", "givenName", "sn", "cornelleduprefgivenname", "cornelleduprefsn",
  "edupersonnickname", "cornelleduwrkngtitle1", "cornelleduunivtitle1", "cornelledudeptname1",
  "cornellEduOrganizationalUnitName", "mail", "cornelledupublishedemail",
  "cornelleduprimaryaffiliation", "cornelleduaffiliation", "cornelledutype", "cornellEduCWID",
] as const;

// The canonical Cornell person-type vocabulary, and the only place it is spelled in this repo.
// It must stay identical to sync_cornell_ithaca_identities.AFFILIATION_VALUES, because both
// write `personTypes` on the same DynamoDB Identity records and ReCiterDB's
// identity_index.CORNELL_PERSON_TYPES reads whichever got there first. Two spellings of one
// concept means the label silently degrades to the "Cornell Ithaca" floor.
//
// ORDER IS LOAD-BEARING — longest first, and each hit is cut out of the string before the next
// is tried, so "retired faculty" cannot also be read as "faculty" and "former postdoc" cannot
// also be read as... nothing else, but the same rule protects both. This mirrors the Python
// scanner exactly; the Cornell attribute is properly multi-valued here rather than the
// undelimited xlsx blob the sync has to cope with, but the vocabulary must still match.
const CORNELL_AFFILIATION_VALUES = [
  "retired faculty", "former postdoc", "email list", "temporary", "affiliate",
  "exception", "emeritus", "academic", "student", "retiree", "faculty",
  "alumni", "staff",
] as const;

// A directory value that matches nothing known still has to become a well-formed token: raw
// values carry spaces and slashes ("exception - w/sponsor"), and `cornell-exception - w/sponsor`
// is not something any consumer can match on. Runs of non-alphanumerics collapse to one hyphen.
const slugType = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function cornellPersonTypes(raw: string[]): string[] {
  const out = new Set<string>();
  for (const value of raw) {
    let s = value.toLowerCase();
    let matched = false;
    for (const known of CORNELL_AFFILIATION_VALUES) {
      if (s.includes(known)) {
        s = s.split(known).join("|");          // cut it out, as the Python scanner does
        out.add(`cornell-${known.replace(/ /g, "-")}`);
        matched = true;
      }
    }
    if (!matched) {
      const slug = slugType(value);
      if (slug) out.add(`cornell-${slug}`);
    }
  }
  return [...out].sort();
}

export function projectCornellPerson(e: Record<string, unknown>): DirectoryPerson | null {
  const id = first(e.uid);
  if (!id) return null;
  // Preferred name leads the legal one: it is the name that appears on a byline. `marty` for
  // Martin Wells is real matching signal, and it is the only name form the Oct-2025 xlsx the
  // Ithaca onboarding plan relies on does not carry at all.
  const given = first(e.cornelleduprefgivenname) || first(e.givenName);
  const sn = first(e.cornelleduprefsn) || first(e.sn);
  const types = cornellPersonTypes(clean([
    ...all(e.cornelleduaffiliation), first(e.cornelleduprimaryaffiliation), first(e.cornelledutype),
  ]));
  return {
    id, source: "cornell",
    name: first(e.displayName) || clean([given, sn]).join(" ") || id,
    givenName: given, middleName: null, familyName: sn,
    title: first(e.cornelleduwrkngtitle1) || first(e.cornelleduunivtitle1),
    dept: first(e.cornelledudeptname1) || first(e.cornellEduOrganizationalUnitName),
    emails: clean([first(e.cornelledupublishedemail), ...all(e.mail)]).map((m) => m.toLowerCase()),
    // `cornell-ithaca` is always present as the campus marker, and is what a future
    // /authorships campus filter derives from without needing a new authorship_review column.
    personTypes: ["cornell-ithaca", ...types],
    wcmCwid: first(e.cornellEduCWID),
  };
}

// ---------------------------------------------------------------------------------- transport

type Src = { url: string; bindDn: string; password: string };
const wcmEnv = (): Src | null => {
  const url = process.env.WCM_ED_LDAP_URL, bindDn = process.env.WCM_ED_LDAP_BIND_DN,
    password = process.env.WCM_ED_LDAP_BIND_PASSWORD;
  return url && bindDn && password ? { url, bindDn, password } : null;
};
const cornellEnv = (): Src | null => {
  const url = process.env.CORNELL_LDAP_URL, bindDn = process.env.CORNELL_LDAP_BIND_DN,
    password = process.env.CORNELL_LDAP_BIND_PASSWORD;
  return url && bindDn && password ? { url, bindDn, password } : null;
};

async function search(
  src: Src, base: string, filter: string, attributes: readonly string[], limit: number,
): Promise<Record<string, unknown>[]> {
  const client = new Client({ url: src.url, timeout: 10_000, connectTimeout: 5_000 });
  try {
    await client.bind(src.bindDn, src.password);
    const { searchEntries } = await client.search(base, {
      scope: "sub", filter, attributes: [...attributes], sizeLimit: limit,
    });
    return searchEntries as unknown as Record<string, unknown>[];
  } finally {
    try { await client.unbind(); } catch { /* non-fatal */ }
  }
}

// Every directory call goes through this. A directory being slow, unreachable, or refusing the
// bind must degrade the feature to "we couldn't find them", never fail the request that asked —
// the opposite stance from reciterIdentitySet(), which fails loudly on purpose because a wrong
// answer there causes an orphaned gold-standard write. A wrong answer here only costs a curator
// the enrichment they would have got.
async function safe<T>(what: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch (e) { console.log(`[directory] ${what} failed (non-fatal):`, e); return fallback; }
}

// ------------------------------------------------------------------------------- public API

/** Exact-identifier lookup. WCM ED is asked first: a bare alphanumeric is far more likely to be
 *  a cwid than an Ithaca netid, and a WCM hit is the one that can carry a real publication
 *  record today. */
export async function lookupDirectoryPerson(id: string): Promise<DirectoryPerson | null> {
  if (!/^[A-Za-z0-9]{1,32}$/.test(id)) return null;
  const esc = escapeLdapFilter(id);
  const wcm = wcmEnv(), cornell = cornellEnv();
  if (wcm) {
    const hits = await safe("wcm lookup", () => search(
      wcm, WCM_BASE, `(&(objectClass=eduPerson)(|(uid=${esc})(weillCornellEduCWID=${esc})))`,
      WCM_ATTRS, 1), [] as Record<string, unknown>[]);
    const p = hits.length ? projectWcmPerson(hits[0]) : null;
    if (p) return p;
  }
  if (cornell) {
    const hits = await safe("cornell lookup", () => search(
      cornell, CORNELL_BASE, `(uid=${esc})`, CORNELL_ATTRS, 1), [] as Record<string, unknown>[]);
    const p = hits.length ? projectCornellPerson(hits[0]) : null;
    if (p) return p;
  }
  return null;
}

// Tokens are AND-ed and matched as PREFIXES (`token*`, never `*token*`) so the query stays an
// indexed scan — Cornell's directory enforces a hard 200-entry cap per search and is a lookup
// interface, not a bulk one.
export function buildNameFilter(q: string, objectClause: string, extra: string[]): string {
  const tokens = q.trim().split(/\s+/).filter(Boolean).map(escapeLdapFilter);
  const per = (t: string) => `(|${["givenName", "sn", "displayName", ...extra].map((a) => `(${a}=${t}*)`).join("")})`;
  return `(&${objectClause}${tokens.map(per).join("")})`;
}

/** Name search across both directories. Deliberately NO alumni/affiliation exclusion: Scholars'
 *  Cornell client centralizes `(!(cornelleduprimaryaffiliation=alumni))`, which is right for a
 *  public profile system and wrong here — a 2021 paper still needs attributing to whoever wrote
 *  it, and one of the 67 people already sitting in the local-only backlog (mh2482) is alumni. */
export async function searchDirectoryPeople(q: string, limit = 8): Promise<DirectoryPerson[]> {
  const term = q.trim();
  if (term.length < 3) return [];
  const wcm = wcmEnv(), cornell = cornellEnv();
  const [w, c] = await Promise.all([
    wcm ? safe("wcm search", () => search(
      wcm, WCM_BASE, buildNameFilter(term, "(objectClass=eduPerson)", ["weillCornellEduCWID"]),
      WCM_ATTRS, limit), [] as Record<string, unknown>[]) : Promise.resolve([]),
    cornell ? safe("cornell search", () => search(
      cornell, CORNELL_BASE, buildNameFilter(term, "(objectClass=person)", ["uid"]),
      CORNELL_ATTRS, limit), [] as Record<string, unknown>[]) : Promise.resolve([]),
  ]);
  return [
    ...w.map(projectWcmPerson), ...c.map(projectCornellPerson),
  ].filter((p): p is DirectoryPerson => p !== null).slice(0, limit * 2);
}

/** True when at least one directory is configured. Lets a caller tell "nobody by that name"
 *  apart from "this deployment has no directory wired up". */
export const directoryConfigured = () => wcmEnv() !== null || cornellEnv() !== null;

// ------------------------------------------------------------------------------ mint payload

/** The ReCiter Identity body for POST /reciter/identity/, built from a directory record.
 *  Pure — asserted directly by scripts/check-directory.mjs, which is the only way to exercise
 *  it, since every caller ends in a DynamoDB write.
 *
 *  Mandatory fields are `uid,firstName,firstInitial,lastName`
 *  (ReCiter application.properties:391, enforced by IdentityController.validateMandatoryFields);
 *  a record missing a given or family name therefore cannot be minted and returns null rather
 *  than sending a body the API will 500 on. Field shape follows
 *  scripts/sync_cornell_ithaca_identities.py's build_identity() so a person minted here and the
 *  same person loaded by the bulk Ithaca sync are byte-comparable records. */
export function directoryIdentityPayload(p: DirectoryPerson): Record<string, any> | null {
  const given = String(p.givenName || "").trim(), family = String(p.familyName || "").trim();
  if (!given || !family) return null;
  const primaryName: Record<string, string> = {
    firstName: given, firstInitial: given[0], lastName: family,
  };
  const mid = String(p.middleName || "").trim();
  if (mid) { primaryName.middleName = mid; primaryName.middleInitial = mid[0]; }

  const institution = p.source === "wcm" ? "Weill Cornell Medicine" : "Cornell University";
  const out: Record<string, any> = {
    uid: p.id,
    primaryName,
    primaryInstitution: institution,
    institutions: [institution],
    personTypes: p.personTypes.length ? p.personTypes : [`${p.source}-directory`],
  };
  if (p.emails.length) { out.primaryEmail = p.emails[0]; out.emails = p.emails; }
  if (p.title) out.title = p.title;
  if (p.dept) {
    out.primaryOrganizationalUnit = p.dept;
    out.organizationalUnits = [{ organizationalUnitLabel: p.dept, organizationalUnitType: "DEPARTMENT" }];
  }
  return out;
}
