import type { NextApiRequest, NextApiResponse } from "next";
import { Op, fn, col } from "sequelize";
import { getToken } from "next-auth/jwt";
import models from "../../src/db/sequelize";
import { reciterConfig } from "../../config/local";
import { updatePendingArticleCount } from "./person.controller";
import { addExternalArticle, deleteExternalArticle } from "../externalArticle.controller";

// Columns returned to the Authorships tab (one row per unassigned WCM authorship).
// Multi-source: `source`/`external_id`/`pub_type`/`container_id` drive the Scopus lane
// (documents not in PubMed → curators Accept them as ExternalArticle, no PMID).
const LIST_ATTRIBUTES = [
  "id", "source", "pmid", "external_id", "author_key", "wcm_author", "author_position_label", "author_affiliation",
  "entrez_date", "title", "journal", "doi", "pub_type", "container_id", "classification",
  "top_cwid", "top_name", "top_person_type", "top_dept",
  "top_fg_score", "top_io_score", "top_confidence", "top_cohort_size",
  "top_given_match", "top_affil_match", "n_candidates", "single_candidate",
  "candidate_cwids_json", "status", "snooze_until", "reviewer", "resolved_at",
];

const todayStr = () => new Date().toISOString().slice(0, 10);

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
  }
  // open queue: truly open, plus snoozes whose timer has lapsed (or has no wake date)
  return {
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

  return and.length ? { [Op.and]: and } : {};
}

// same-document sibling key: pubmed → pmid, scopus → external_id (co-authorships on one doc).
const siblingKey = (r: any) =>
  r.source === "scopus" ? String(r.external_id || "") : String(r.pmid ?? "");

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
    const out = rows.map((r: any) => {
      const map = r.source === "scopus" ? scopusSib : pmidSib;
      return { ...r.toJSON(), pmid_sibling_count: map[siblingKey(r)] || 1 };
    });

    res.send({ rows: out, count, limit, offset });
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
    const [total, single, byClass, byType, bySrc, byPub] = await Promise.all([
      models.AuthorshipReview.count({ where }),
      models.AuthorshipReview.count({ where: { [Op.and]: [where, { single_candidate: true }] } }),
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
    res.send({ total, single_candidate: single, classes, personTypes, bySource, pubTypes });
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

// ExternalArticle payload for a scopus row (no PMID → not gold standard). articleId is
// "SCOPUS:<numericId>" where numericId = external_id (dc:identifier minus SCOPUS_ID:).
function scopusExternalPayload(row: any) {
  return {
    articleId: `SCOPUS:${row.external_id}`,
    sourceType: "SCOPUS",
    method: "scopus-authorships-tab",
    doi: row.doi || undefined,
    title: row.title || undefined,
    venue: row.journal || undefined,
    pubDate: row.entrez_date || undefined,
    publicationType: row.pub_type || undefined,
  };
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
        if (isScopus) {
          const resp = await addExternalArticle(cwid, scopusExternalPayload(row), reviewer, force);
          if (resp.statusCode === 409) return res.status(409).send(resp.statusText);
          if (resp.statusCode !== 201 && resp.statusCode !== 200) return res.status(502).send(`ExternalArticle add failed (${resp.statusCode})`);
          await models.AuthorshipReview.update({ status: "accepted", resolution_cwid: cwid, reviewer, resolved_at: new Date() }, { where: { id } });
          break; // no AdminFeedbackLog / pending-count for scopus (PMID-keyed)
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
        // Integrity boundary: the server verifies the chosen cwid is a real candidate for
        // this authorship before any authoritative write (client can't spoof an identity).
        let candidateCwids: string[] = [];
        try {
          const parsed = JSON.parse(row.candidate_cwids_json || "[]");
          if (Array.isArray(parsed)) candidateCwids = parsed.map((c: any) => (typeof c === "string" ? c : c?.cwid)).filter(Boolean).map(String);
        } catch { candidateCwids = []; }
        const allowed = new Set([row.top_cwid, ...candidateCwids].filter(Boolean).map(String));
        if (!allowed.has(chosen)) return res.status(400).send("cwid is not a candidate for this authorship");
        if (isScopus) {
          const resp = await addExternalArticle(chosen, scopusExternalPayload(row), reviewer, force);
          if (resp.statusCode === 409) return res.status(409).send(resp.statusText);
          if (resp.statusCode !== 201 && resp.statusCode !== 200) return res.status(502).send(`ExternalArticle add failed (${resp.statusCode})`);
          await models.AuthorshipReview.update({ status: "assigned", resolution_cwid: chosen, reviewer, resolved_at: new Date() }, { where: { id } });
          break;
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
        if (!row.single_candidate) return res.status(409).send("Multiple candidates — use \"Pick one\" to assign");
        if (isScopus) {
          // scopus reject = local dismissal, never gold standard (no PMID to reject).
          await models.AuthorshipReview.update({ status: "rejected", reviewer, resolved_at: new Date() }, { where: { id } });
          break;
        }
        const gs = await writeGoldStandard(cwid, pmid as number, "rejected", "UPDATE", curator.userID);
        if (gs !== 200) return res.status(502).send(`Gold-standard write failed (${gs})`);
        await models.AuthorshipReview.update({ status: "rejected", reviewer, resolved_at: new Date() }, { where: { id } });
        try { await appendFeedbackLog(curator.userID, cwid, pmid as number, "REJECTED"); }
        catch (e) { console.log("[authorships] feedbacklog (reject) non-fatal:", e); }
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
          const gs = await writeGoldStandard(reverseCwid, pmid as number, "known", "DELETE", curator.userID);
          if (gs !== 200) return res.status(502).send(`Gold-standard undo failed (${gs})`);
        } else if (row.status === "rejected" && reverseCwid) {
          const gs = await writeGoldStandard(reverseCwid, pmid as number, "rejected", "DELETE", curator.userID);
          if (gs !== 200) return res.status(502).send(`Gold-standard undo failed (${gs})`);
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
