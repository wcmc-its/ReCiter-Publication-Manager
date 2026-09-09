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
  /** First of `depts`, kept as its own field because the mint payload writes exactly one
   *  primaryOrganizationalUnit and every existing caller reads this. */
  dept: string | null;
  /** ED department attributes are multi-valued and a person can genuinely hold several
   *  (joint appointments). `dept` alone silently dropped all but the first. */
  depts: string[];
  /** `weillCornellEduPrimaryOrg` — the organisation the person primarily belongs to, WCM ED's
   *  own answer rather than one derived from which directory answered. This is NOT 1:1 with
   *  `source`: ou=people carries NewYork-Presbyterian people too (gallric is NYP), so a WCM ED
   *  hit is not evidence of a WCM appointment. Null on Cornell, which publishes no equivalent. */
  primaryOrg: string | null;
  /** When the directory record itself was created, `YYYY-MM-DD`, or null. Operational
   *  attributes are only returned when named explicitly, and the two server families spell it
   *  differently (`createTimestamp` per RFC 4512, `whenCreated` on Active Directory), so both
   *  are requested and whichever comes back wins. Null is an ordinary answer — a directory may
   *  also withhold operational attributes from this bind. */
  created: string | null;
  emails: string[];
  /** Directory-native person types, in each directory's OWN vocabulary: WCM's ED codes
   *  unprefixed (`affiliate-cornell`), Cornell's `cornell-`-prefixed (`cornell-faculty`).
   *  Deliberately not source-prefixed — the readers downstream match `cornell-%` as a prefix,
   *  which already separates the two namespaces, and a `wcm-` prefix would put a second
   *  spelling of every WCM type into Identity. Never empty — ReCiter hides people with an
   *  empty personTypes (see project memory: empty personTypes hides ~34k accepted articles). */
  personTypes: string[];
  /** Cornell only: `cornellEduCWID`, published for people who ALSO hold a WCM identity. This is
   *  the duplicate-person bridge — 273 of 15,030 Ithaca people carry one, 57 of those cwids
   *  already have a ReCiter identity, and Martin Wells (mtw1 / maw2065) is already split across
   *  two identities in production because of it. Resolved at assign time in the controller. */
  wcmCwid: string | null;
  /** WCM only: this cwid has been RETIRED by ED (`weillCornellEduStatus: retired-cwid`) — the
   *  person was re-recorded under a different cwid and this identifier is a dead end. 2,880 of
   *  them exist in ED (2026-09-09 census), so this is a routine state, not an oddity.
   *
   *  It is emphatically NOT the same as "no longer employed": ED also publishes lifecycle
   *  statuses like `faculty:expired` / `employee:expired` / `affiliate:expired`, and a person can
   *  be fully expired on a cwid that is still their live one (ssy9009 is). Only `retired-cwid`
   *  means "use a different identifier for this human", which is the one that must never be
   *  assigned to. Everything else is history, and history is exactly what ReCiter attributes. */
  retiredCwid: boolean;
  /** The cwid that SUPERSEDED this one, when ED names it. Found by the reverse lookup
   *  `(weillCornellEduCWIDRetired=<this id>)` — the pointer lives on the successor's record, not
   *  on the retired one, so it costs one extra search and is resolved only for ids actually
   *  marked `retiredCwid`. Null when nothing claims the succession (49 of the 2,880 retired
   *  records had no claimant in that same census). */
  supersededBy: string | null;
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

// LDAP generalizedTime -> YYYY-MM-DD. Both spellings this file requests use it
// ("20240115123456.0Z", "20240115123456Z"), so the leading 8 digits are the whole job; anything
// that does not start with a plausible 8-digit date is discarded rather than half-parsed. AD's
// 18-digit FILETIME integers appear on other attributes, never on whenCreated, and are rejected
// here by the year bound rather than silently rendering as a year in the 1300s.
export function ldapDate(v: unknown): string | null {
  const s = first(v);
  const m = s && /^(\d{4})(\d{2})(\d{2})/.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  if (year < 1970 || year > 2100 || +mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo}-${d}`;
}

// The two operational spellings, requested on every search. A server that does not know one
// simply omits it from the result; naming both costs nothing and avoids a per-directory branch.
// Probed against prod 2026-09-09: BOTH directories answer `createTimestamp` (ED returned
// "20150505214246Z", Cornell "20010804100020Z"); neither needed `whenCreated`, which is kept for
// an Active Directory source.
const CREATED_ATTRS = ["createTimestamp", "whenCreated"] as const;

/** Read an attribute by its BASE name, ignoring case and any LDAP attribute options.
 *
 *  Two things make a direct `e.someAttr` read unreliable here, and both fail SILENTLY — an empty
 *  column forever, never an error:
 *
 *  1. Case. LDAP attribute names are case-insensitive by spec and these directories do not agree
 *     on how they echo them; `cornelleduprefgivenname` and `cornellEduCWID` sit side by side in
 *     CORNELL_ATTRS because that is the case each actually came back in.
 *  2. Options. A returned key may carry `;option` suffixes (RFC 4512) — ED really does return
 *     `weillCornellEduPrimaryOrganization;affiliate` alongside the bare form, observed on the
 *     2026-09-09 prod probe.
 */
function attrValues(e: Record<string, unknown>, base: string): string[] {
  const want = base.toLowerCase();
  const out: string[] = [];
  for (const k of Object.keys(e)) {
    if (k.toLowerCase().split(";")[0] === want) out.push(...all(e[k]));
  }
  return out;
}
const attrFirst = (e: Record<string, unknown>, base: string) => attrValues(e, base)[0] ?? null;

const createdOf = (e: Record<string, unknown>) => {
  for (const a of CREATED_ATTRS) {
    const d = ldapDate(attrValues(e, a));
    if (d) return d;
  }
  return null;
};

// ---------------------------------------------------------------- WCM Enterprise Directory

const WCM_ATTRS = [
  "uid", "weillCornellEduCWID", "displayName", "givenName", "weillCornellEduMiddleName", "sn",
  "mail", "weillCornellEduDepartment", "weillCornellEduPersonTypeCode", "title",
  // BOTH org spellings. gallric carries `weillCornellEduPrimaryOrg` bare and
  // `weillCornellEduPrimaryOrganization;affiliate` (2026-09-09 prod probe), and the
  // Institutional Client reads the LONGER one — so asking for only one of them would disagree
  // with the nightly job about who an author works for.
  "weillCornellEduPrimaryOrg", "weillCornellEduPrimaryOrganization",
  "weillCornellEduPrimaryDepartment",
  // Lifecycle. Multi-valued and mixed in kind: `retired-cwid` says THIS IDENTIFIER is dead and
  // the human lives under another cwid, while `faculty:expired` / `employee:expired` /
  // `affiliate:expired` say only that an appointment ended. shy2013 carries both kinds at once
  // (2026-09-09 probe: `affiliate:expired` AND `retired-cwid`, superseded by ssy9009 — which is
  // itself faculty:expired, employee:expired and affiliate:expired, and is still the live cwid).
  // Only the first kind may block an assignment; see DirectoryPerson.retiredCwid.
  "weillCornellEduStatus",
  ...CREATED_ATTRS,
] as const;

// ED marks the retired record and points at it FROM the successor, so the two halves live on
// different entries: `weillCornellEduStatus: retired-cwid` on the dead one,
// `weillCornellEduCWIDRetired: <dead cwid>` on the live one.
const RETIRED_CWID_STATUS = "retired-cwid";
const isRetiredCwid = (e: Record<string, unknown>): boolean =>
  clean(all(e.weillCornellEduStatus)).some((s) => s.toLowerCase() === RETIRED_CWID_STATUS);

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
  // ED publishes a primary department SEPARATELY from the department attribute (both present on
  // gallric, 2026-09-09 probe), so read both and let clean() collapse them when they agree. The
  // primary leads, because it is the one the mint writes as primaryOrganizationalUnit.
  // `weillCornellEduDepartment` came back single-valued on that probe; all() covers the
  // multi-valued case without asserting it happens.
  const depts = clean([
    ...attrValues(e, "weillCornellEduPrimaryDepartment"),
    ...attrValues(e, "weillCornellEduDepartment"),
  ]);
  return {
    id, source: "wcm",
    name: first(e.displayName) || clean([given, sn]).join(" ") || id,
    givenName: given, middleName: first(e.weillCornellEduMiddleName), familyName: sn,
    title: first(e.title),
    dept: depts[0] ?? null,
    depts,
    // Prefer a token this app can actually resolve to an institution. gallric carries the same
    // "NYP" in both attributes, but if they ever disagree, the one we can map is the useful
    // answer and the bare attribute is only the tie-break.
    primaryOrg: [
      attrFirst(e, "weillCornellEduPrimaryOrg"),
      attrFirst(e, "weillCornellEduPrimaryOrganization"),
    ].find((o) => institutionForPrimaryOrg(o))
      ?? attrFirst(e, "weillCornellEduPrimaryOrg")
      ?? attrFirst(e, "weillCornellEduPrimaryOrganization"),
    created: createdOf(e),
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
    retiredCwid: isRetiredCwid(e),
    // Filled in by resolveSupersededBy() over the whole result set — the pointer is on another
    // entry, so it cannot be projected from this one.
    supersededBy: null,
  };
}

/** Fill in `supersededBy` for every retired cwid in `people`, with ONE extra search for the
 *  whole set (`(|(weillCornellEduCWIDRetired=a)(weillCornellEduCWIDRetired=b)…)`) rather than
 *  one per person. Retired hits are rare, so the common case does no search at all.
 *
 *  Best-effort by design: a curator being told "retired" is the part that must not fail, and
 *  naming the replacement is the bonus. A directory error here leaves supersededBy null and the
 *  row still correctly blocked, which is why this swallows rather than rejects. */
export async function resolveSupersededBy(people: DirectoryPerson[]): Promise<void> {
  const retired = people.filter((p) => p.source === "wcm" && p.retiredCwid);
  if (!retired.length) return;
  const wcm = wcmEnv();
  if (!wcm) return;
  const filter = `(|${retired.map((p) => `(weillCornellEduCWIDRetired=${escapeLdapFilter(p.id)})`).join("")})`;
  const entries = await safe("wcm succession lookup", () => search(
    wcm, WCM_BASE, filter,
    ["uid", "weillCornellEduCWID", "weillCornellEduCWIDRetired"] as const,
    retired.length,
  ), [] as Record<string, unknown>[]);   // see doc comment: the block stands without the replacement
  const successorOf = new Map<string, string>();
  for (const e of entries) {
    const successor = first(e.weillCornellEduCWID) ?? first(e.uid);
    if (!successor) continue;
    for (const old of clean(all(e.weillCornellEduCWIDRetired))) {
      successorOf.set(old.toLowerCase(), successor);
    }
  }
  for (const p of retired) p.supersededBy = successorOf.get(p.id.toLowerCase()) ?? null;
}

// ------------------------------------------------------------------- Cornell Ithaca directory

const CORNELL_ATTRS = [
  "uid", "displayName", "givenName", "sn", "cornelleduprefgivenname", "cornelleduprefsn",
  "edupersonnickname", "cornelleduwrkngtitle1", "cornelleduunivtitle1", "cornelledudeptname1",
  "cornellEduOrganizationalUnitName", "mail", "cornelledupublishedemail",
  "cornelleduprimaryaffiliation", "cornelleduaffiliation", "cornelledutype", "cornellEduCWID",
  "cornelledudeptname2", ...CREATED_ATTRS,
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
  // Ithaca numbers its department slots rather than multi-valuing one attribute, so a joint
  // appointment is deptname1 + deptname2; the org-unit name is the fallback when neither is set.
  const depts = clean([
    ...attrValues(e, "cornelledudeptname1"), ...attrValues(e, "cornelledudeptname2"),
    ...attrValues(e, "cornellEduOrganizationalUnitName"),
  ]);
  return {
    id, source: "cornell",
    name: first(e.displayName) || clean([given, sn]).join(" ") || id,
    givenName: given, middleName: null, familyName: sn,
    title: first(e.cornelleduwrkngtitle1) || first(e.cornelleduunivtitle1),
    dept: depts[0] ?? null,
    depts,
    // Cornell publishes no primary-org equivalent; the campus marker in personTypes is the
    // nearest thing and is already carried there.
    primaryOrg: null,
    created: createdOf(e),
    emails: clean([first(e.cornelledupublishedemail), ...all(e.mail)]).map((m) => m.toLowerCase()),
    // `cornell-ithaca` is always present as the campus marker, and is what a future
    // /authorships campus filter derives from without needing a new authorship_review column.
    personTypes: ["cornell-ithaca", ...types],
    wcmCwid: first(e.cornellEduCWID),
    // Ithaca publishes no cwid-succession concept — `cornelleduprimaryaffiliation: alumni` is a
    // former ROLE, not a dead identifier, and those are deliberately still assignable (see
    // buildNameFilter's "no alumni exclusion" note). So never blocked from here.
    retiredCwid: false,
    supersededBy: null,
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

// Same bind, but pages through the WHOLE result set instead of stopping at the server's cap.
// ED returns 500 entries per page and simply truncates a plain search at that boundary with no
// error, so the retired-cwid census (2,880 entries) read through search() above would come back
// silently 83% short — and a short block-list under-blocks, which is the failure that looks like
// it works. Only the census needs this; every other call here is a lookup capped well under 500.
async function searchPaged(
  src: Src, base: string, filter: string, attributes: readonly string[],
): Promise<Record<string, unknown>[]> {
  const client = new Client({ url: src.url, timeout: 30_000, connectTimeout: 5_000 });
  try {
    await client.bind(src.bindDn, src.password);
    const { searchEntries } = await client.search(base, {
      scope: "sub", filter, attributes: [...attributes], paged: { pageSize: 500 },
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
    if (p) { await resolveSupersededBy([p]); return p; }
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
  const people = [
    ...w.map(projectWcmPerson), ...c.map(projectCornellPerson),
  ].filter((p): p is DirectoryPerson => p !== null).slice(0, limit * 2);
  // One extra search, and only when this page actually holds a retired cwid — so the ordinary
  // search pays nothing. Awaited rather than fired-and-forgotten: the successor's name is what
  // makes the blocked row actionable ("retired — use ssy9009") instead of a dead end.
  await resolveSupersededBy(people);
  return people;
}

/** True when at least one directory is configured. Lets a caller tell "nobody by that name"
 *  apart from "this deployment has no directory wired up". */
export const directoryConfigured = () => wcmEnv() !== null || cornellEnv() !== null;

// --------------------------------------------------------------- retired-cwid set (cached)

// Every cwid ED has retired, as one set. The authorship queue needs this per PAGE and per
// CANDIDATE — candidate_cwids_json is baked by the AAR producer and carries no directory state
// at all — so a per-row lookup is out of the question and a whole-directory snapshot on a timer
// is the same shape absentCwidSet() already uses in authorships.controller.ts, for the same
// reason. 2,880 entries on the 2026-09-09 census; one search per refresh, then O(1) membership.
//
// ponytail: plain module-level Set + timestamp, no cache lib — one key, one process. Tradeoff:
// a cwid retired mid-window keeps being offered for up to the TTL, and an un-retired one keeps
// being blocked just as long. Both self-heal on the next refresh with no action required.
// Keyed by the retired cwid (lowercased), valued by the cwid that superseded it, or null when
// ED names no successor (49 of 2,880 on that census). A Map rather than a Set because every
// caller that blocks a retired cwid immediately wants to say what to use instead, and the answer
// costs nothing extra once both halves are being read anyway.
const RETIRED_TTL_MS = 30 * 60 * 1000;   // ED lifecycle changes are HR-paced, not minute-paced
let retiredCache: { index: Map<string, string | null>; expires: number } | null = null;
// SINGLE-FLIGHT. The refresh is two paged searches and measured 2.8s cold against live ED
// (2026-09-09), while every /authorships page load calls this — so without holding the in-flight
// promise, the moment the TTL lapses every concurrent request starts its own full census. Await
// the same one instead. Cleared in a finally so one failure cannot wedge the refresh forever.
let retiredInFlight: Promise<Map<string, string | null>> | null = null;

export function retiredCwidIndex(): Promise<Map<string, string | null>> {
  if (retiredCache && retiredCache.expires > Date.now()) return Promise.resolve(retiredCache.index);
  if (retiredInFlight) return retiredInFlight;
  retiredInFlight = refreshRetiredCwidIndex().finally(() => { retiredInFlight = null; });
  return retiredInFlight;
}

async function refreshRetiredCwidIndex(): Promise<Map<string, string | null>> {
  const wcm = wcmEnv();
  if (!wcm) return new Map();
  // The two halves live on different entries, so this is two searches: which cwids are dead,
  // and who replaced them. Run together so one TTL covers both and they can never be half-stale.
  const [dead, successors] = await Promise.all([
    safe("wcm retired-cwid census", () => searchPaged(
      wcm, WCM_BASE, `(weillCornellEduStatus=${RETIRED_CWID_STATUS})`, ["uid", "weillCornellEduCWID"],
    ), [] as Record<string, unknown>[]),
    safe("wcm cwid-succession census", () => searchPaged(
      wcm, WCM_BASE, "(weillCornellEduCWIDRetired=*)",
      ["uid", "weillCornellEduCWID", "weillCornellEduCWIDRetired"],
    ), [] as Record<string, unknown>[]),
  ]);
  // An EMPTY answer is not evidence that nothing is retired — it is also what a failed, refused,
  // or timed-out search looks like, and caching it would silently un-block every retired cwid
  // for the whole window. Keep the previous snapshot (even a stale one) and retry next call.
  if (!dead.length) return retiredCache?.index ?? new Map();
  const successorOf = new Map<string, string>();
  for (const e of successors) {
    const successor = first(e.weillCornellEduCWID) ?? first(e.uid);
    if (!successor) continue;
    for (const old of clean(all(e.weillCornellEduCWIDRetired))) successorOf.set(old.toLowerCase(), successor);
  }
  const index = new Map<string, string | null>();
  for (const e of dead) {
    const id = first(e.weillCornellEduCWID) ?? first(e.uid);
    if (id) index.set(id.toLowerCase(), successorOf.get(id.toLowerCase()) ?? null);
  }
  retiredCache = { index, expires: Date.now() + RETIRED_TTL_MS };
  return index;
}

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
/** ED's primary-org attribute is a short token ("NYP"); `person.primaryInstitution` is curated
 *  free text. This maps token -> institution.
 *
 *  PORTED VERBATIM from the Institutional Client, which has owned this mapping all along:
 *  ReCiter-Institutional-Client `LdapIdentityDaoImpl.getVerbosePrimaryOrganization()`
 *  (~line 1327), all 30 cases. That job writes the same `primaryInstitution` field on the same
 *  DynamoDB records every night, so a person who is minted here and later appears in the ED
 *  academic roster must not have their institution rewritten to a different spelling of the same
 *  place. Keep the two identical — the same rule cornellPersonTypes() lives under, and for the
 *  same reason: two spellings of one institution silently split it across two buckets in every
 *  report that groups by institution (INSTITUTION_BUCKETS in authorships.controller.ts).
 *
 *  Deliberately an allow-list, not a passthrough. An unrecognised token falls back to the
 *  directory-derived label rather than writing a raw ED string into a curated vocabulary, so a
 *  new org code cannot invent a distinct primaryInstitution value on its own. */
export const PRIMARY_ORG_INSTITUTION: Record<string, string> = {
  MSKCC: "Memorial Sloan Kettering Cancer Center",
  WCMC: "Weill Cornell Medical College",
  CUCPS: "Columbia University College of Physicians and Surgeons",
  NYP: "New York-Presbyterian Hospital",
  "WCMC-Q": "Weill Cornell Medical College in Qatar",
  NYMH: "New York Methodist Hospital",
  HSS: "Hospital for Special Surgery",
  NYPQ: "New York Presbyterian - Queens",
  RI: "Rogosin Institute",
  SIDRA: "SIDRA Medical and Research Center",
  HMC: "Hamad Medical Corporation",
  WMBMRI: "Winifred Masterson Burke Medical Research Institute",
  HMH: "Houston Methodist Hospital",
  RU: "Rockefeller University",
  LMMHC: "Lincoln Medical and Mental Health Center",
  Cornell: "Cornell University",
  AspH: "Aspetar Hospital",
  CMCIthaca: "Cayuga Medical Center of Ithaca",
  PHCC: "Primary Health Care Corporation (Qatar)",
  BHC: "The Brooklyn Hospital Center",
  FMMP: "Feto-Maternal Medical Polyclinic (Qatar)",
  HMRI: "Houston Methodist Research Institute",
  JamaicaH: "Jamaica Hospital",
  ANH: "Amsterdam Nursing Home",
  Lenox: "Lenox Hill Hospital",
  "CU GHS": "Cornell University Gannette Health Services",
  FlushHMC: "Flushing Hospital Medical Center",
  AHP: "American Hospital of Paris",
  LaGuardH: "La Guardia Hospital",
  UGMA: "University Group Medical Associates",
};

// Tokens are mixed-case in ED ("AspH", "CMCIthaca", "CU GHS"), and the two attributes that carry
// them do not have to agree on case, so match case-insensitively rather than trusting the
// spelling above to be what comes back.
const ORG_INSTITUTION_BY_KEY = new Map(
  Object.entries(PRIMARY_ORG_INSTITUTION).map(([k, v]) => [k.trim().toUpperCase(), v]));
export const institutionForPrimaryOrg = (org: string | null): string | null =>
  (org && ORG_INSTITUTION_BY_KEY.get(org.trim().toUpperCase())) || null;

export function directoryIdentityPayload(p: DirectoryPerson): Record<string, any> | null {
  const given = String(p.givenName || "").trim(), family = String(p.familyName || "").trim();
  if (!given || !family) return null;
  const primaryName: Record<string, string> = {
    firstName: given, firstInitial: given[0], lastName: family,
  };
  const mid = String(p.middleName || "").trim();
  if (mid) { primaryName.middleName = mid; primaryName.middleInitial = mid[0]; }

  // The person's OWN org decides the institution where ED gives one we can spell; only then does
  // it fall back to which directory answered. ou=people holds NewYork-Presbyterian people, so
  // deriving this from `source` alone minted gallric as "Weill Cornell Medicine" and
  // authorships.controller's `wcm` bucket counted him as WCM in reporting.
  const institution = institutionForPrimaryOrg(p.primaryOrg)
    || (p.source === "wcm" ? "Weill Cornell Medicine" : "Cornell University");
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
