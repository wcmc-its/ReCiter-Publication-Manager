import type { NextApiRequest, NextApiResponse } from "next";
import { Op, fn, col } from "sequelize";
import { getToken } from "next-auth/jwt";
import models from "../../src/db/sequelize";
import { reciterConfig } from "../../config/local";
import { updatePendingArticleCount } from "./person.controller";
import { addExternalArticle, deleteExternalArticle } from "../externalArticle.controller";
import { getRejectedPmidsByCwid } from "../../src/lib/goldStandardRejections";
import { assignGate } from "../../src/lib/assignGate";
import { DynamoDBClient, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";

// Columns returned to the Authorships tab (one row per unassigned WCM authorship).
// Multi-source: `source`/`external_id`/`pub_type`/`container_id` drive the Scopus lane
// (documents not in PubMed → curators Accept them as ExternalArticle, no PMID).
const LIST_ATTRIBUTES = [
  "id", "source", "pmid", "external_id", "author_key", "wcm_author", "author_position_label", "author_affiliation",
  "entrez_date", "title", "journal", "doi", "pub_type", "container_id", "classification",
  "top_cwid", "top_name", "top_person_type", "top_dept",
  "top_fg_score", "top_io_score", "top_confidence", "top_cohort_size",
  "top_given_match", "top_affil_match", "n_candidates", "single_candidate",
  "candidate_cwids_json", "authors_json", "dup_flag", "dup_reason", "accept_conflict", "status", "snooze_until", "reviewer", "resolved_at",
];

const todayStr = () => new Date().toISOString().slice(0, 10);

// A no-DOI scopus row can't yet be verified against PubMed (aar_universe_scopus.py's
// re-check needs either a DOI or, past this floor, a title/author fallback search).
// Scopus routinely indexes a doc before PubMed does and before Scopus itself backfills
// its DOI, so a *fresh* no-DOI row is more likely still settling than genuinely
// PubMed-absent. Hold it out of every view until it clears the floor — the producer's
// monthly re-check keeps running underneath regardless, so a row that resolves to PubMed
// in the meantime is auto-dismissed before a curator ever sees it.
const SCOPUS_NO_DOI_MATURITY_DAYS = 60;
const maturityCutoffStr = () =>
  new Date(Date.now() - SCOPUS_NO_DOI_MATURITY_DAYS * 86400000).toISOString().slice(0, 10);

const SORTS: Record<string, any[]> = {
  // default: single-candidate (high-precision) first, then identity-only score desc.
  // ["pmid","DESC"] is a secondary key so same-paper pubmed authorships land adjacent.
  precision: [["single_candidate", "DESC"], ["top_io_score", "DESC"], ["pmid", "DESC"]],
  confidence: [["top_confidence", "DESC"], ["pmid", "DESC"]],
  io: [["top_io_score", "DESC"], ["pmid", "DESC"]],
  fg: [["top_fg_score", "DESC"], ["pmid", "DESC"]],
  date: [["entrez_date", "DESC"], ["pmid", "DESC"]],
};

// Status-view predicate for the current view ("open" | "snoozed" | "dismissed"), or null
// when feed="all". Factored out so the per-paper sibling count respects the same view.
function openStatusWhere(body: any): any {
  if (body.feed === "all") return null;
  const view = body.statusView || "open";
  const today = todayStr();
  if (view === "snoozed") {
    return { status: "snoozed", snooze_until: { [Op.gt]: today } };
  } else if (view === "dismissed") {
    return { status: "dismissed" };
  } else if (view === "duplicates") {
    // Rows whose Accept came back 409 from ExternalArticleDupCheck — a fuzzy title+year
    // collision (its WARNING level), which CAN pair two genuinely distinct works. Held out
    // of the open queue so a bulk accept never silently forces past one; still status="open",
    // so resolving a row anywhere drops it out of this view with no cleanup needed.
    return { status: "open", accept_conflict: { [Op.ne]: null } };
  }
  // open queue: truly open, plus snoozes whose timer has lapsed (or has no wake date).
  // accept_conflict rows are excluded here — they live in the "duplicates" view above.
  return {
    accept_conflict: null,
    [Op.or]: [
      { status: "open" },
      { status: "snoozed", snooze_until: { [Op.lte]: today } },
      { status: "snoozed", snooze_until: null as any },
    ],
  };
}

function buildWhere(body: any): any {
  const and: any[] = [];

  const status = openStatusWhere(body);
  if (status) and.push(status);
  // source segment: "all" (default) | "pubmed" | "scopus"
  if (body.source && body.source !== "all") {
    and.push({ source: body.source });
  }
  // classification lane: buried | suggested | absent
  if (body.classification && body.classification !== "all") {
    and.push({ classification: body.classification });
  }
  // precision lane: only single-candidate (near-certain) authorships
  if (body.precision === "single") {
    and.push({ single_candidate: true });
  } else if (body.precision === "fullname") {
    // "Unique and full given-name match": the one class curators have never once rejected.
    // Across 4,723 resolved decisions with single_candidate + top_given_match="full" there
    // are 0 rejections, in both sources and all three classifications; the same curators
    // rejected 373 of 3,251 single-candidate rows whose given name matched on INITIAL only,
    // on the same days. Rule of three puts the upper bound on this class's error at 0.064%.
    and.push({ single_candidate: true, top_given_match: "full" });
  }
  // publication-type filter (multiselect): Scopus subtypeDescription
  if (Array.isArray(body.pubTypes) && body.pubTypes.length > 0) {
    and.push({ pub_type: { [Op.in]: body.pubTypes } });
  }
  // person-type filter (multiselect): the proposed identity's person type(s)
  if (Array.isArray(body.personTypes) && body.personTypes.length > 0) {
    and.push({ top_person_type: { [Op.in]: body.personTypes } });
  }
  // free-text search across author name, proposed identity, pmid, doi, and Scopus id
  const search = (body.searchTextInput || "").trim();
  if (search) {
    const like = `%${search}%`;
    const or: any[] = [
      { wcm_author: { [Op.like]: like } },
      { top_name: { [Op.like]: like } },
      { top_cwid: { [Op.like]: like } },
      { doi: { [Op.like]: like } },
      { external_id: { [Op.like]: like } },
    ];
    if (/^\d+$/.test(search)) or.push({ pmid: Number(search) });
    and.push({ [Op.or]: or });
  }
  // publication-date range (entrez_date is DATEONLY → compare YYYY-MM-DD strings)
  const dateFrom = (body.dateFrom || "").trim();
  const dateTo = (body.dateTo || "").trim();
  if (dateFrom && dateTo) {
    and.push({ entrez_date: { [Op.between]: [dateFrom, dateTo] } });
  } else if (dateFrom) {
    and.push({ entrez_date: { [Op.gte]: dateFrom } });
  } else if (dateTo) {
    and.push({ entrez_date: { [Op.lte]: dateTo } });
  }
  // hold immature no-DOI scopus rows out of every view until they clear the floor above.
  // entrez_date is nullable (aar_universe_scopus.py has no coverDate fallback) — a bare
  // Op.gt against NULL evaluates to NULL, and NOT(NULL) is NULL too, so an unguarded
  // clause here would make a missing-date row vanish permanently instead of just holding
  // it. Require entrez_date to be non-null before comparing, so a NULL date falls through
  // to "show the row" rather than "hide it forever."
  and.push({
    [Op.not]: {
      source: "scopus",
      doi: null,
      entrez_date: { [Op.and]: [{ [Op.ne]: null }, { [Op.gt]: maturityCutoffStr() }] },
    },
  });

  return and.length ? { [Op.and]: and } : {};
}

// same-document sibling key: pubmed → pmid, scopus → external_id (co-authorships on one doc).
const siblingKey = (r: any) =>
  r.source === "scopus" ? String(r.external_id || "") : String(r.pmid ?? "");

// Which of these cwids have a ReCiter identity? Asks DynamoDB `Identity` directly — the same
// table ReCiter's own ExternalArticleController.findByUid consults before it will accept an
// ExternalArticle, so this answer and the accept path's answer cannot disagree. Needed because
// the AAR producer matches against the wider IDM `identity` universe, so top_cwid can name
// someone ReCiter doesn't track; accepting those 404s at the ExternalArticle endpoint and
// orphans gold-standard writes. Checked at read time, not produce time, because people also
// leave WCM after a row is produced.
//
// This used to read reciterdb's `person` mirror, gated on the row having a name, on the theory
// that a null-name person row was stale sync debris and so couldn't be a valid identity. That
// premise is wrong. `person` gets names from a SECOND loader pass (ReCiterDB
// updateReciterDB.py `update_person`, an INNER join against person_temp, skipped entirely on
// incremental runs), so a null name means "the name loader hasn't covered this cwid", not "not
// in ReCiter". Measured 2026-08-29: 173 of 187 null-name person rows (92.5%) ARE in DynamoDB
// Identity, and `person` is missing 1,915 uids DynamoDB has. Across the 18,892 open rows the
// mirror flagged 1,048 cwids / 2,723 rows, of which 74 cwids / 254 rows were false — Accept
// hidden from curators who could legitimately have used it (brf9046 being the reported case:
// null-name person row, full identity in DynamoDB, /curate/brf9046 renders fine because that
// page asks ReCiter's REST identity endpoint instead of this mirror). DynamoDB flags the 974
// genuinely-absent cwids and nothing else. Errors in the other direction were already zero,
// so this change only ever un-blocks.
//
// No try/catch on purpose: an AWS failure propagates to the caller's existing 500 handler.
// Failing OPEN would let the pubmed lane write orphan GoldStandard rows (POST
// /reciter/goldstandard has no identity check of its own — this is the only backstop);
// failing CLOSED would silently pill the entire queue with a claim that isn't true. A visible
// 500 is the honest third option and costs no code.
//
// ponytail: point lookups per request, no cache — ~20 ms for a 25-row page and ~0.6 s for the
// 5,000-row selectable page (17 batches), the same order as the getRejectedPmidsByCwid call
// two lines below. Unprocessed keys throw rather than retry: throttling a key-only projection
// is vanishingly rare, and a 500 beats silently reporting a present identity as absent.
// Ceiling: PM is duplicating a check that belongs server-side. Upgrade path is to add the
// Identity check to ReCiter's POST /reciter/goldstandard (ReCiterController.java validates
// only that the body is non-null), after which this becomes advisory rather than load-bearing.
// Deliberately NOT fixed here: personNames() below still reads the same lossy `person` mirror,
// so a null-name row still falls back to top_name; and the `person` loader gap itself is a
// ReCiterDB-side follow-up the app must not depend on being repaired.
const identityDdb = new DynamoDBClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1" });

async function reciterIdentitySet(cwids: Array<string | undefined | null>): Promise<Set<string>> {
  const wanted = [...new Set(cwids.filter(Boolean).map(String))];
  if (wanted.length === 0) return new Set();
  const out = new Set<string>();
  for (let i = 0; i < wanted.length; i += 100) { // 100 = BatchGetItem hard limit
    const resp = await identityDdb.send(new BatchGetItemCommand({
      RequestItems: {
        Identity: {
          Keys: wanted.slice(i, i + 100).map((uid) => ({ uid: { S: uid } })),
          ProjectionExpression: "uid",
        },
      },
    }));
    if (resp.UnprocessedKeys?.Identity?.Keys?.length) throw new Error("Identity BatchGetItem throttled");
    for (const it of resp.Responses?.Identity ?? []) if (it.uid?.S) out.add(it.uid.S);
  }
  return out;
}

// Display name per cwid from the same `person` mirror, "First Middle Last" — the shape the
// AAR producer bakes into top_name/candidate_cwids_json, so a looked-up name reads the same
// as a produced one.
// ponytail: app-side IN() rather than a SQL JOIN — the person/authorship_review collations
// differ (general_ci vs unicode_ci), which breaks and de-indexes a direct join. Note this
// mirror is lossy (see reciterIdentitySet above): a null-name row yields no name here and
// the caller falls back to top_name.
async function personNames(cwids: Array<string | undefined | null>): Promise<Record<string, string>> {
  const wanted = [...new Set(cwids.filter(Boolean).map(String))];
  if (wanted.length === 0) return {};
  const found: any[] = await models.Person.findAll({
    where: { personIdentifier: { [Op.in]: wanted } },
    attributes: ["personIdentifier", "firstName", "middleName", "lastName"], raw: true,
  });
  const out: Record<string, string> = {};
  found.forEach((p) => {
    const name = [p.firstName, p.middleName, p.lastName].map((v) => String(v || "").trim()).filter(Boolean).join(" ");
    if (name) out[String(p.personIdentifier)] = name;
  });
  return out;
}

// "Given Middle Surname · Department" for ONE curator-typed cwid, from the IDM roster table
// `identity` — the same table the AAR producer builds candidate_cwids_json from, so this
// reads identically to a produced top_name/dept instead of a second, subtly different name.
// Deliberately NOT personNames() above: the `person` mirror carries stale rows whose name
// columns are NULL even though the person is live (187/33,152 as of 2026-08-29 — brf9046 has
// a null-name person row and a complete identity row), and this string is the only thing
// standing between the curator and an authoritative write into someone's publication record.
// Empty string when there is no roster row — the caller falls back to the bare cwid rather
// than inventing a name. Same no-join lookup as above: identity.cwid is utf8mb4_general_ci
// against authorship_review.top_cwid's utf8mb4_unicode_ci, so a direct join throws 1267.
async function identityLabel(cwid: string): Promise<string> {
  const row: any = await models.Identity.findOne({
    where: { cwid },
    attributes: ["givenName", "middleName", "surname", "primaryAcademicDepartment"], raw: true,
  });
  if (!row) return "";
  const name = [row.givenName, row.middleName, row.surname].map((v) => String(v || "").trim()).filter(Boolean).join(" ");
  if (!name) return "";
  const dept = String(row.primaryAcademicDepartment || "").trim();
  return dept ? `${name} · ${dept}` : name;
}

// POST /api/db/authorships — paginated, filtered list of unassigned WCM authorships.
export const listAuthorships = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const body = req.body || {};
    const limit = Number(body.limit) || 25;
    const offset = Number(body.offset) || 0;
    const order = SORTS[body.sort] || SORTS.precision;

    const { count, rows } = await models.AuthorshipReview.findAndCountAll({
      attributes: LIST_ATTRIBUTES,
      where: buildWhere(body),
      order,
      offset,
      limit,
    });

    // Per-document sibling count, scoped to the active status-view. Two grouped COUNTs —
    // pubmed by pmid, scopus by external_id — so mixed-source pages stay accurate even
    // when siblings are off-page. (Book-level "N chapters" is a separate tab feature.)
    const status = openStatusWhere(body);
    const scope = (w: any) => (status ? { [Op.and]: [w, status] } : w);
    const pmids = [...new Set(rows.filter((r: any) => r.source !== "scopus" && r.pmid != null).map((r: any) => Number(r.pmid)))];
    const scopusIds = [...new Set(rows.filter((r: any) => r.source === "scopus" && r.external_id).map((r: any) => String(r.external_id)))];
    let pmidSib: Record<string, number> = {};
    let scopusSib: Record<string, number> = {};
    if (pmids.length) {
      const sib: any[] = await models.AuthorshipReview.findAll({
        attributes: ["pmid", [fn("COUNT", col("id")), "n"]],
        where: scope({ source: "pubmed", pmid: { [Op.in]: pmids } }),
        group: ["pmid"], raw: true,
      });
      pmidSib = Object.fromEntries(sib.map((s) => [String(s.pmid), Number(s.n)]));
    }
    if (scopusIds.length) {
      const sib: any[] = await models.AuthorshipReview.findAll({
        attributes: ["external_id", [fn("COUNT", col("id")), "n"]],
        where: scope({ source: "scopus", external_id: { [Op.in]: scopusIds } }),
        group: ["external_id"], raw: true,
      });
      scopusSib = Object.fromEntries(sib.map((s) => [String(s.external_id), Number(s.n)]));
    }
    const knownIdentities = await reciterIdentitySet(rows.map((r: any) => r.top_cwid));

    // Cross-check pubmed rows' candidates + top_cwid against GoldStandard.rejectedpmids: a
    // candidate who already rejected this EXACT pmid via their own /curate page must never be
    // silently recommended as the lead candidate or accepted through the single-candidate
    // card — top_cwid/candidate_cwids_json are computed once at AAR producer time and never
    // cross-checked against gold standard otherwise. Scopus rows have no pmid, so this can
    // never apply to them (same reasoning as "scopus reject = local dismissal, never gold
    // standard" on the reject action below). candidateCwidsFromRow gives the exact
    // top_cwid+candidates union already used for reject/reopen. Purely additive/annotative
    // here, like identity_in_reciter above — no re-ranking, no dropped rows, no count change;
    // the frontend decides what to do visually.
    const pubmedRows = rows.filter((r: any) => r.source !== "scopus" && r.pmid != null);
    const rejectionCwids = new Set<string>();
    for (const r of pubmedRows) candidateCwidsFromRow(r).forEach((c) => rejectionCwids.add(c));
    const rejectedByCwid = await getRejectedPmidsByCwid([...rejectionCwids]);
    const rejectionCheckIds = new Set(pubmedRows.map((r: any) => r.id));

    const out = rows.map((r: any) => {
      const map = r.source === "scopus" ? scopusSib : pmidSib;
      const json: any = r.toJSON();
      if (rejectionCheckIds.has(r.id)) {
        const pmidNum = Number(r.pmid);
        let candidates: any[] = [];
        try { candidates = JSON.parse(json.candidate_cwids_json || "[]"); } catch { candidates = []; }
        if (Array.isArray(candidates)) {
          json.candidate_cwids_json = JSON.stringify(candidates.map((c: any) => {
            if (!c || typeof c !== "object" || !c.cwid) return c;
            return rejectedByCwid[String(c.cwid)]?.has(pmidNum) ? { ...c, already_rejected: true } : c;
          }));
        }
        if (r.top_cwid && rejectedByCwid[String(r.top_cwid)]?.has(pmidNum)) {
          json.top_already_rejected = true;
        }
      }
      return {
        ...json,
        pmid_sibling_count: map[siblingKey(r)] || 1,
        // false → the proposed identity can't be accepted into ReCiter (UI hides Accept)
        identity_in_reciter: !r.top_cwid || knownIdentities.has(String(r.top_cwid)),
      };
    });

    res.send({ rows: out, count, limit, offset });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// POST /api/db/authorships/selectable — every bulk-selectable row matching the caller's
// filters, not just the current page, so "Select all N matching" can act on the whole set.
//
// Returns the slim shape the bulk accept loop needs, NOT the list shape: the list carries
// authors_json and candidate_cwids_json, which are longtext, and shipping those for a few
// thousand rows is megabytes to no purpose.
//
// Eligibility is recomputed here rather than trusted from the client, and it is the same
// three tests the card enforces — single-candidate, the proposed identity exists in ReCiter,
// and that identity has not already rejected this exact pmid. A row failing any of them is
// omitted, so it can never enter a bulk selection by way of this endpoint.
const SELECTABLE_CAP = 5000;

export const authorshipSelectable = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const body = { ...(req.body || {}), statusView: "open" };
    const rows = await models.AuthorshipReview.findAll({
      attributes: ["id", "source", "pmid", "wcm_author", "top_name", "top_cwid", "single_candidate", "candidate_cwids_json"],
      where: { [Op.and]: [buildWhere(body), { single_candidate: true }] },
      order: SORTS[body.sort] || SORTS.precision,
      limit: SELECTABLE_CAP + 1,
    });
    const capped = rows.length > SELECTABLE_CAP;
    const page = capped ? rows.slice(0, SELECTABLE_CAP) : rows;

    const knownIdentities = await reciterIdentitySet(page.map((r: any) => r.top_cwid));
    const pubmedRows = page.filter((r: any) => r.source !== "scopus" && r.pmid != null);
    const rejectionCwids = new Set<string>();
    for (const r of pubmedRows) candidateCwidsFromRow(r).forEach((c) => rejectionCwids.add(c));
    const rejectedByCwid = await getRejectedPmidsByCwid([...rejectionCwids]);

    const out = page
      .filter((r: any) => !r.top_cwid || knownIdentities.has(String(r.top_cwid)))
      .filter((r: any) => !(r.source !== "scopus" && r.pmid != null && r.top_cwid
        && rejectedByCwid[String(r.top_cwid)]?.has(Number(r.pmid))))
      .map((r: any) => ({
        id: r.id, source: r.source, wcm_author: r.wcm_author, top_name: r.top_name,
        single_candidate: true, identity_in_reciter: true,
      }));

    res.send({ rows: out, capped, cap: SELECTABLE_CAP });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// POST /api/db/authorships/summary — counts for the tab headers. Ignores the
// segment/classification/precision/person-type filters so each facet shows its own total.
export const authorshipSummary = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const body = { ...(req.body || {}), source: "all", classification: "all", precision: "all", personTypes: [], pubTypes: [] };
    const where = buildWhere(body);
    // The duplicates facet counts its own view, so it needs a where built with that statusView
    // rather than the caller's (the open-queue where excludes exactly the rows it counts).
    const dupWhere = buildWhere({ ...body, statusView: "duplicates" });
    const [total, single, fullname, duplicates, byClass, byType, bySrc, byPub] = await Promise.all([
      models.AuthorshipReview.count({ where }),
      models.AuthorshipReview.count({ where: { [Op.and]: [where, { single_candidate: true }] } }),
      models.AuthorshipReview.count({ where: { [Op.and]: [where, { single_candidate: true, top_given_match: "full" }] } }),
      models.AuthorshipReview.count({ where: dupWhere }),
      models.AuthorshipReview.findAll({ attributes: ["classification", [fn("COUNT", col("id")), "n"]], where, group: ["classification"], raw: true }),
      models.AuthorshipReview.findAll({ attributes: ["top_person_type", [fn("COUNT", col("id")), "n"]], where, group: ["top_person_type"], raw: true }),
      models.AuthorshipReview.findAll({ attributes: ["source", [fn("COUNT", col("id")), "n"]], where, group: ["source"], raw: true }),
      models.AuthorshipReview.findAll({ attributes: ["pub_type", [fn("COUNT", col("id")), "n"]], where: { [Op.and]: [where, { source: "scopus" }] }, group: ["pub_type"], raw: true }),
    ]);
    const classes: Record<string, number> = {};
    (byClass as any[]).forEach((r) => { classes[r.classification] = Number(r.n); });
    const bySource: Record<string, number> = {};
    (bySrc as any[]).forEach((r) => { bySource[r.source] = Number(r.n); });
    const personTypes = (byType as any[]).filter((r) => r.top_person_type).map((r) => ({ type: r.top_person_type as string, n: Number(r.n) })).sort((a, b) => b.n - a.n);
    const pubTypes = (byPub as any[]).filter((r) => r.pub_type).map((r) => ({ type: r.pub_type as string, n: Number(r.n) })).sort((a, b) => b.n - a.n);
    res.send({ total, single_candidate: single, fullname, duplicates, classes, personTypes, bySource, pubTypes });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// POST /api/db/authorships/recent-activity — the 15 most-recently-resolved authorships across
// the whole queue. accept/assign/reject/dismiss all stamp resolved_at (reopen clears it back
// to null; snooze never sets it), so filtering on resolved_at IS NOT NULL is exactly those four
// terminal curator actions. Global and cross-curator/cross-session (unlike the per-person
// /curate "Recent activity" panel, which reads AdminFeedbackLog for one uid) — once a row here
// leaves the open/snoozed/dismissed status views it has no other view on the page, so this is
// the only lookback for "what did curators just do". Fixed-size feed, no filters/pagination —
// mirrors summary.ts's simplicity; body is accepted but ignored.
export const authorshipRecentActivity = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const rows: any[] = await models.AuthorshipReview.findAll({
      attributes: ["id", "title", "wcm_author", "top_name", "top_cwid", "resolution_cwid", "status", "reviewer", "resolved_at", "source", "pmid", "external_id"],
      where: { resolved_at: { [Op.ne]: null } },
      order: [["resolved_at", "DESC"]],
      limit: 15,
      raw: true,
    });
    // top_name is the *top-ranked candidate's* name, which is the wrong person the moment a
    // curator assigns to a non-top candidate — the entire point of "Pick one" on a homonym
    // row. The panel links resolution_cwid, so send that identity's own name alongside it and
    // the two can't disagree (#928). One extra IN() lookup for at most 15 cwids. reject and
    // dismiss never set resolution_cwid and top_name is right there, so the client picks
    // per-row rather than swapping wholesale.
    const names = await personNames(rows.map((r) => r.resolution_cwid));
    rows.forEach((r) => { r.resolution_name = r.resolution_cwid ? names[String(r.resolution_cwid)] : undefined; });
    res.send({ rows });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// ---- Phase C: curator actions -------------------------------------------------
// Resolve the curator's identity server-side from the next-auth JWT. On dev the /api
// routes are gated by the shared backendApiKey and the page by middleware; the per-route
// Superuser/Curator_All authz (getEffectiveRolesScope) is a dev_Upd-only feature not on
// this branch, so we match dev's backendApiKey-only convention and stamp the audit
// identity (curatedBy / reviewer / addedBy) from the real signed-in AdminUser.
// ponytail: no in-endpoint role gate — page middleware + backendApiKey + a resolvable
// active AdminUser are the trust boundary here; add a role check if dev is hardened.
async function resolveCurator(req: NextApiRequest): Promise<{ userID?: number; cwid?: string }> {
  const token: any = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return {};
  const cwid: string | undefined = token.username ? String(token.username) : undefined;
  let userID: number | undefined = token.databaseUser?.userID;
  if (!userID && cwid) {
    const au: any = await models.AdminUser.findOne({ where: { personIdentifier: cwid }, attributes: ["userID"] });
    userID = au?.userID;
  }
  return { userID, cwid };
}

// Gold-standard MERGE/DELETE via the ReCiter Java endpoint (pubmed rows only), tagged with
// the AAR source and the curator's numeric userID. Returns the upstream HTTP status.
async function writeGoldStandard(
  uid: string, pmid: number, kind: "known" | "rejected", flag: "UPDATE" | "DELETE", curatedBy?: number,
): Promise<number> {
  const body: any = { uid };
  if (kind === "known") body.knownPmids = [pmid]; else body.rejectedPmids = [pmid];
  const curatedByQ = curatedBy != null ? `&curatedBy=${curatedBy}` : "";
  try {
    const resp = await fetch(
      `${reciterConfig.reciter.reciterUpdateGoldStandardEndpoint}?goldStandardUpdateFlag=${flag}&source=adversarial-attribution-review&entryPath=PM_AUTHOR${curatedByQ}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": reciterConfig.reciter.adminApiKey,
          "User-Agent": "reciter-pub-manager-server",
        },
        body: JSON.stringify(body),
      },
    );
    return resp.status;
  } catch (e) {
    console.log("[authorships] gold-standard write failed:", e);
    return 500;
  }
}

// Append an AdminFeedbackLog row (pubmed accept/reject/assign only — PMID-keyed).
async function appendFeedbackLog(userID: number, personIdentifier: string, pmid: number, feedback: "ACCEPTED" | "REJECTED") {
  const active: any = await models.AdminUser.findOne({ where: { userID, status: 1 }, attributes: ["userID"] });
  if (!active) throw new Error(`userID ${userID} is not an active AdminUser`);
  await models.AdminFeedbackLog.create({
    userID, personIdentifier, articleIdentifier: pmid, feedback, createTimestamp: new Date(),
  });
  await updatePendingArticleCount(personIdentifier, feedback);
}

// Interpret a 409 dup-conflict body from the ExternalArticle add. BLOCKED = the article is
// already in the person's record (ALREADY_ADDED, or a PMID/DOI match to an attributed
// article) — ReCiter ignores force for BLOCKED, so the accept's end state already exists
// and the caller should resolve the row as accepted instead of bouncing forever. (Dev and
// prod PM share one DynamoDB ExternalArticle table but have separate review queues, so a
// row accepted in one env stays open in the other and re-accepting it lands here.)
// WARNING = fuzzy title+year match the curator may force; surface its human message.
//
// `matches` is passed through structurally (type/matchedId/detail, plus title/journal/
// pubYear once ReCiter#705 ships) instead of being collapsed to a bare id — the client
// renders the real conflict context instead of a number nobody can act on.
function dupConflict(body: any): { blocked: boolean; message: string; matches: any[] } {
  return {
    blocked: body?.status === "BLOCKED",
    message: body?.message || "Possible duplicate.",
    matches: Array.isArray(body?.matches) ? body.matches : [],
  };
}

// Full byline from authors_json ([{given,surname}, ...], every author on the document) as
// "Given Surname" strings — undefined if the field is empty/absent, unparseable, or parses
// to a non-array/empty array, so the ExternalArticle payload just omits `authors` rather
// than sending a malformed value.
function scopusAuthorsFromRow(row: any): string[] | undefined {
  if (!row.authors_json) return undefined;
  let parsed: any;
  try {
    parsed = JSON.parse(row.authors_json);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const names = parsed
    .map((a: any) => {
      const given = (a?.given || "").trim();
      const surname = (a?.surname || "").trim();
      if (given && surname) return `${given} ${surname}`;
      return given || surname || "";
    })
    .filter(Boolean);
  return names.length ? names : undefined;
}

// ExternalArticle payload for a scopus row (no PMID → not gold standard). articleId is
// "SCOPUS:<numericId>" where numericId = external_id (dc:identifier minus SCOPUS_ID:).
function scopusExternalPayload(row: any) {
  return {
    articleId: `SCOPUS:${row.external_id}`,
    sourceType: "SCOPUS",
    method: "scopus-authorships-tab",
    doi: row.doi || undefined,
    title: row.title || undefined,
    journalOrVenue: row.journal || undefined,
    pubDate: row.entrez_date || undefined,
    publicationType: row.pub_type || undefined,
    authors: scopusAuthorsFromRow(row),
  };
}

// POST /api/db/authorships/authors — batched authors_json lookup by Scopus external_id,
// for the Curate per-source "Scopus" tab (SourceArticleTab) to backfill a display byline
// on rows accepted before scopusExternalPayload() started sending `authors` natively
// (rows whose ExternalArticle payload has no authors key at all). Body: { externalIds:
// string[] }. Response: { authors: { [external_id]: authors_json | null } } — the raw
// column value, left for the client to parse the same way AuthorshipsTabs does, since
// the client is what actually renders the byline.
export const authorshipsAuthorsByExternalId = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const externalIds: string[] = Array.isArray(req.body?.externalIds)
      ? [...new Set<string>(req.body.externalIds.map((v: any) => String(v)).filter(Boolean))]
      : [];
    if (!externalIds.length) return res.send({ authors: {} });

    const rows = await models.AuthorshipReview.findAll({
      attributes: ["external_id", "authors_json"],
      where: { source: "scopus", external_id: { [Op.in]: externalIds } },
      raw: true,
    });

    const authors: Record<string, string | null> = {};
    (rows as any[]).forEach((r) => {
      if (r.external_id) authors[String(r.external_id)] = r.authors_json || null;
    });
    res.send({ authors });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// Every candidate identity a row was proposed against (top_cwid + candidate_cwids_json,
// deduped) — the full set "None of these" rejects and reopen() un-rejects.
function candidateCwidsFromRow(row: any): string[] {
  let parsed: any[] = [];
  try { parsed = JSON.parse(row.candidate_cwids_json || "[]"); } catch { parsed = []; }
  const list = Array.isArray(parsed)
    ? parsed.map((c: any) => (typeof c === "string" ? c : c?.cwid)).filter(Boolean).map(String)
    : [];
  return Array.from(new Set([row.top_cwid, ...list].filter(Boolean).map(String)));
}

// POST /api/db/authorships/action — single-row curator action.
// body: { id, action: "accept"|"reject"|"snooze"|"dismiss"|"assign"|"reopen", cwid?, force? }
// cwid is required only for "assign"; force retries a scopus Accept past a 409 WARNING.
export const authorshipAction = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const curator = await resolveCurator(req);
    if (!curator.userID) return res.status(401).send("Could not resolve curator identity");

    const body = req.body || {};
    const id = Number(body.id);
    const action = String(body.action || "");
    if (!id || !action) return res.status(400).send("id and action are required");

    const row: any = await models.AuthorshipReview.findByPk(id);
    if (!row) return res.status(404).send("Authorship not found");

    const isScopus = row.source === "scopus";
    const pmid = row.pmid != null ? Number(row.pmid) : null;
    const cwid = row.top_cwid as string | undefined;
    const reviewer = curator.cwid || String(curator.userID);
    const force = String(body.force) === "true";

    switch (action) {
      case "accept": {
        if (!cwid) return res.status(409).send("No proposed identity to accept");
        if (!row.single_candidate) return res.status(409).send("Multiple candidates — use \"Pick one\" to assign");
        // 422 (not 409) so the client's scopus force-add prompt doesn't fire for this
        if (!(await reciterIdentitySet([cwid])).size) {
          return res.status(422).send(`${row.top_name || cwid} has no record in ReCiter's Identity table, so there is nothing to add this authorship to — dismiss it instead`);
        }
        if (isScopus) {
          const resp = await addExternalArticle(cwid, scopusExternalPayload(row), reviewer, force);
          if (resp.statusCode === 409) {
            const dup = dupConflict(resp.statusText);
            // BLOCKED → already in the record: fall through and resolve the row as accepted
            if (!dup.blocked) {
              // Persist the WARNING so the row leaves the open queue for the "Possible
              // duplicates" view instead of sitting back in the feed to be re-attempted.
              // Session-scoped conflictLog state already showed this to the curator who hit
              // it; the column is what survives a refresh, another curator, and a bulk run.
              await models.AuthorshipReview.update(
                { accept_conflict: String(dup.message).slice(0, 500) }, { where: { id } });
              return res.status(409).json({ message: dup.message, matches: dup.matches });
            }
          } else if (resp.statusCode !== 201 && resp.statusCode !== 200) {
            return res.status(502).send(`ExternalArticle add failed (${resp.statusCode})`);
          }
          await models.AuthorshipReview.update({ status: "accepted", resolution_cwid: cwid, reviewer, resolved_at: new Date() }, { where: { id } });
          break; // no AdminFeedbackLog / pending-count for scopus (PMID-keyed)
        }
        // Data-integrity guard: never let an accept add pmid to knownpmids while it's still
        // sitting in rejectedpmids for the same identity (see goldStandardRejections.ts).
        if ((await getRejectedPmidsByCwid([cwid]))[cwid]?.has(pmid as number)) {
          return res.status(409).send(`${row.top_name || cwid} already rejected this article — cannot accept without reviewing that rejection first`);
        }
        const gs = await writeGoldStandard(cwid, pmid as number, "known", "UPDATE", curator.userID);
        if (gs !== 200) return res.status(502).send(`Gold-standard write failed (${gs})`);
        await models.AuthorshipReview.update({ status: "accepted", resolution_cwid: cwid, reviewer, resolved_at: new Date() }, { where: { id } });
        try { await appendFeedbackLog(curator.userID, cwid, pmid as number, "ACCEPTED"); }
        catch (e) { console.log("[authorships] feedbacklog (accept) non-fatal:", e); }
        break;
      }
      case "assign": {
        const chosen = String(body.cwid || "");
        if (!chosen) return res.status(400).send("cwid is required for assign");
        if (!/^[A-Za-z0-9]{1,32}$/.test(chosen)) return res.status(400).send("cwid must be alphanumeric");
        // Trust boundary: `chosen` is client-supplied and can drive an authoritative
        // GoldStandard write, so the server establishes two facts about it — is it one of
        // this authorship's produced candidates, and does ReCiter know it at all — and
        // assignGate turns them into which path runs. Neither fact BLOCKS the assign any
        // more (#925 opened the no-identity one, this change opens off-candidate); being on
        // the wrong side of either one costs a confirm round-trip instead.
        const allowed = new Set(candidateCwidsFromRow(row));
        const offCandidate = !allowed.has(chosen);
        const hasIdentity = (await reciterIdentitySet([chosen])).size > 0;
        const gate = assignGate({
          offCandidate, hasIdentity,
          confirmNoIdentity: String(body.confirmNoIdentity) === "true",
          confirmOffCandidate: String(body.confirmOffCandidate) === "true",
        });
        // Not every WCM author has an identity record. Master's students, visiting
        // researchers, and any person type outside the identity feed never get one, and
        // since the AAR producer builds its candidate list FROM `identity`, such a person
        // can never be a produced candidate either — so for them the candidate check is
        // unsatisfiable by construction and is deliberately bypassed. Before #925 the only
        // offer was "dismiss it instead", which throws a real attribution away.
        //
        // Deliberate, not silent: an unrecognised cwid is still far more likely to be a
        // typo than a Master's student, so the #861 guard keeps its purpose. The client
        // re-sends with confirmNoIdentity after showing the curator what it means.
        if (gate === "confirm_no_identity") {
          return res.status(422).json({
            code: "NO_RECITER_IDENTITY",
            localOnly: true,
            cwid: chosen,
            offCandidate,
            message: `${chosen} has no ReCiter identity. Assigning anyway records your decision on `
              + "this row only — it will NOT be added to the person's publication record, because there "
              + "is no identity to add it to. Confirm to proceed.",
          });
        }
        // A real person the producer simply didn't propose — the common case being a
        // single-candidate row where the producer was confidently wrong and the curator knows
        // who actually wrote it. This used to be a flat 400, which made the typed-cwid box a
        // no-identity escape hatch rather than a general assign tool. It is still a trust
        // boundary (a client-supplied cwid driving a GoldStandard write), so it becomes an
        // explicit confirm rather than an absent check: the server looks the person up and
        // hands back their NAME, so the curator confirms against a human being and not a
        // string they might have typo'd.
        // ponytail: confirm-on-submit, not a typeahead — the name has to cross the wire on
        // this 422 anyway, so a search endpoint + debounce + dropdown would buy nothing the
        // round-trip doesn't already provide. Upgrade path if curators start typing cwids
        // they don't actually know: add GET /api/db/authorships/lookup?cwid= over the same
        // identityLabel() and drive a datalist off it.
        if (gate === "confirm_off_candidate") {
          const who = await identityLabel(chosen);
          return res.status(422).json({
            code: "OFF_CANDIDATE",
            cwid: chosen,
            offCandidate: true,
            message: `${who ? `${who} · ${chosen}` : `${chosen} (not in the IDM roster — no name to show)`}`
              + " was not one of the candidates proposed for this authorship. Confirming ADDS this article "
              + "to that person's publication record — the same write an Accept makes. Check the identifier.",
          });
        }
        if (gate === "local_only") {
          // Local record only. No writeGoldStandard, no addExternalArticle, no
          // appendFeedbackLog: every one of those targets an identity that does not exist,
          // and faking one would put a publication in a record nobody can see or correct.
          // This preserves the curator's judgment without pretending the person exists
          // downstream. If the identity is created later (PM#104 / IC#148), this row is
          // the record of what was already decided.
          await models.AuthorshipReview.update({
            status: "assigned", resolution_cwid: chosen, reviewer, resolved_at: new Date(),
            note: `${row.note ? `${row.note} | ` : ""}assigned to ${chosen} `
              + `(no ReCiter identity) — local record only, nothing written to the publication record`,
          }, { where: { id } });
          break;
        }
        // gate === "write": everything below is the authoritative assign, unchanged. An
        // off-candidate assign that got confirmed lands here and is byte-for-byte an
        // on-candidate one — same rejectedpmids guard, same gold-standard write, same
        // feedback log — which is also what keeps `reopen` sound: it has an identity, so
        // reopen's "no identity == it was local-only" inference still holds and the
        // gold-standard DELETE it does is exactly the write this made.
        if (isScopus) {
          const resp = await addExternalArticle(chosen, scopusExternalPayload(row), reviewer, force);
          if (resp.statusCode === 409) {
            const dup = dupConflict(resp.statusText);
            if (!dup.blocked) return res.status(409).json({ message: dup.message, matches: dup.matches });
          } else if (resp.statusCode !== 201 && resp.statusCode !== 200) {
            return res.status(502).send(`ExternalArticle add failed (${resp.statusCode})`);
          }
          await models.AuthorshipReview.update({ status: "assigned", resolution_cwid: chosen, reviewer, resolved_at: new Date() }, { where: { id } });
          break;
        }
        // Data-integrity guard: never let an assign add pmid to knownpmids while it's still
        // sitting in rejectedpmids for the same identity (see goldStandardRejections.ts).
        if ((await getRejectedPmidsByCwid([chosen]))[chosen]?.has(pmid as number)) {
          return res.status(409).send(`${chosen} already rejected this article — cannot assign without reviewing that rejection first`);
        }
        const gs = await writeGoldStandard(chosen, pmid as number, "known", "UPDATE", curator.userID);
        if (gs !== 200) return res.status(502).send(`Gold-standard write failed (${gs})`);
        await models.AuthorshipReview.update({ status: "assigned", resolution_cwid: chosen, reviewer, resolved_at: new Date() }, { where: { id } });
        try { await appendFeedbackLog(curator.userID, chosen, pmid as number, "ACCEPTED"); }
        catch (e) { console.log("[authorships] feedbacklog (assign) non-fatal:", e); }
        break;
      }
      case "reject": {
        if (!cwid) return res.status(409).send("No proposed identity to reject");
        if (isScopus) {
          // scopus reject = local dismissal, never gold standard (no PMID to reject).
          await models.AuthorshipReview.update({ status: "rejected", reviewer, resolved_at: new Date() }, { where: { id } });
          break;
        }
        // "None of these" on a multi-candidate row asserts none of them wrote it — reject
        // every candidate, not just top_cwid. reopen() reverses the same set, recomputed
        // from candidate_cwids_json (stable once a row leaves "open" — see aar_db.py: the
        // producer never revisits an already-resolved row's upsert).
        const targets = row.single_candidate ? [cwid] : candidateCwidsFromRow(row);
        for (const target of targets) {
          const gs = await writeGoldStandard(target, pmid as number, "rejected", "UPDATE", curator.userID);
          if (gs !== 200) return res.status(502).send(`Gold-standard write failed for ${target} (${gs})`);
        }
        await models.AuthorshipReview.update({ status: "rejected", reviewer, resolved_at: new Date() }, { where: { id } });
        for (const target of targets) {
          try { await appendFeedbackLog(curator.userID, target, pmid as number, "REJECTED"); }
          catch (e) { console.log("[authorships] feedbacklog (reject) non-fatal:", e); }
        }
        break;
      }
      case "snooze": {
        const wake = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
        await models.AuthorshipReview.update({ status: "snoozed", snooze_until: wake, reviewer }, { where: { id } });
        break;
      }
      case "dismiss": {
        await models.AuthorshipReview.update({ status: "dismissed", reviewer, resolved_at: new Date() }, { where: { id } });
        break;
      }
      case "reopen": {
        const reverseCwid = row.resolution_cwid || cwid;
        if (isScopus) {
          // undo a scopus accept/assign = revoke the ExternalArticle (reject/dismiss wrote none).
          if ((row.status === "accepted" || row.status === "assigned") && reverseCwid) {
            const resp = await deleteExternalArticle(reverseCwid, `SCOPUS:${row.external_id}`);
            if (resp.statusCode !== 200) return res.status(502).send(`ExternalArticle revoke failed (${resp.statusCode})`);
          }
        } else if ((row.status === "accepted" || row.status === "assigned") && reverseCwid) {
          // A #925 local-only assign wrote no gold standard, so there is nothing to delete
          // — and asking ReCiter to DELETE for a uid it has no Identity row for 404s, which
          // would strand the row as un-reopenable. No identity == it was local-only, since
          // that is the only branch that resolves a row without an authoritative write.
          // ponytail: this INFERS "local-only" from a live identity check rather than reading a
          // marker, so it silently flips to a destructive GoldStandard DELETE for any
          // local-only row whose identity later appears (IC#148 backfills ~1,595). Exposure
          // today is zero rows (status='assigned' AND note LIKE '%no ReCiter identity%' → 0,
          // PM#935 only just shipped), and swapping the oracle does not change that, so it is
          // left alone. Upgrade path: key off the note/marker the local-only branch writes.
          if (!(await reciterIdentitySet([reverseCwid])).size) {
            console.log(`[authorships] reopen ${id}: ${reverseCwid} has no ReCiter identity — local-only assign, nothing to undo`);
          } else {
            const gs = await writeGoldStandard(reverseCwid, pmid as number, "known", "DELETE", curator.userID);
            if (gs !== 200) return res.status(502).send(`Gold-standard undo failed (${gs})`);
          }
        } else if (row.status === "rejected") {
          const targets = row.single_candidate ? (reverseCwid ? [reverseCwid] : []) : candidateCwidsFromRow(row);
          for (const target of targets) {
            const gs = await writeGoldStandard(target, pmid as number, "rejected", "DELETE", curator.userID);
            if (gs !== 200) return res.status(502).send(`Gold-standard undo failed for ${target} (${gs})`);
          }
        }
        await models.AuthorshipReview.update({ status: "open", snooze_until: null, resolved_at: null, resolution_cwid: null, reviewer }, { where: { id } });
        break;
      }
      default:
        return res.status(400).send(`Unknown action: ${action}`);
    }

    const updated = await models.AuthorshipReview.findByPk(id, { attributes: LIST_ATTRIBUTES });
    return res.send({ ok: true, row: updated });
  } catch (e) {
    console.log(e);
    return res.status(500).send(String(e));
  }
};
