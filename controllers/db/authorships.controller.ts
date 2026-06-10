import type { NextApiRequest, NextApiResponse } from "next";
import { Op, fn, col } from "sequelize";
import { getToken } from "next-auth/jwt";
import models from "../../src/db/sequelize";
import { reciterConfig } from "../../config/local";
import { updatePendingArticleCount } from "./person.controller";

// Columns returned to the Authorships tab (one row per unassigned WCM authorship).
const LIST_ATTRIBUTES = [
  "id", "pmid", "author_key", "wcm_author", "author_position_label", "author_affiliation",
  "entrez_date", "title", "journal", "doi", "classification",
  "top_cwid", "top_name", "top_person_type", "top_dept",
  "top_fg_score", "top_io_score", "top_confidence", "top_cohort_size",
  "top_given_match", "top_affil_match", "n_candidates", "single_candidate",
  "candidate_cwids_json", "status", "snooze_until", "reviewer", "resolved_at",
];

const todayStr = () => new Date().toISOString().slice(0, 10);

const SORTS: Record<string, any[]> = {
  // default: single-candidate (high-precision) first, then identity-only score desc.
  // ["pmid","DESC"] is appended to every entry as a secondary key so same-paper
  // authorships land adjacent within a sort tie (PR-2 correction 6).
  precision: [["single_candidate", "DESC"], ["top_io_score", "DESC"], ["pmid", "DESC"]],
  confidence: [["top_confidence", "DESC"], ["pmid", "DESC"]],
  io: [["top_io_score", "DESC"], ["pmid", "DESC"]],
  fg: [["top_fg_score", "DESC"], ["pmid", "DESC"]],
  date: [["entrez_date", "DESC"], ["pmid", "DESC"]],
};

// The status-view predicate for the current view ("open" | "snoozed" | "dismissed"),
// or null when feed="all" (no status filter). Factored out of buildWhere so the
// per-paper sibling count (B2) respects the same status view as the list itself.
function openStatusWhere(body: any): any {
  if (body.feed === "all") return null;
  const view = body.statusView || "open";
  const today = todayStr();
  if (view === "snoozed") {
    // still sleeping (wake date in the future)
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

  // status view: "open" (default) | "snoozed" | "dismissed"; feed="all" drops the status filter
  const status = openStatusWhere(body);
  if (status) and.push(status);
  // classification lane: buried | suggested | absent
  if (body.classification && body.classification !== "all") {
    and.push({ classification: body.classification });
  }
  // precision lane: only single-candidate (near-certain) authorships
  if (body.precision === "single") {
    and.push({ single_candidate: true });
  }
  // person-type filter (multiselect): the proposed identity's person type(s)
  if (Array.isArray(body.personTypes) && body.personTypes.length > 0) {
    and.push({ top_person_type: { [Op.in]: body.personTypes } });
  }
  // free-text search across author name, proposed identity, and pmid
  const search = (body.searchTextInput || "").trim();
  if (search) {
    const like = `%${search}%`;
    const or: any[] = [
      { wcm_author: { [Op.like]: like } },
      { top_name: { [Op.like]: like } },
      { top_cwid: { [Op.like]: like } },
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

    // Per-paper sibling count (B2): one grouped COUNT over the page's distinct pmids,
    // scoped to the active status-view predicate so we don't count e.g. dismissed
    // siblings while in the Open view. Accurate even when siblings are off-page.
    const pmids = [...new Set(rows.map((r: any) => r.pmid))];
    let sibMap: Record<string, number> = {};
    if (pmids.length) {
      const sibWhere: any = { pmid: { [Op.in]: pmids } };
      const status = openStatusWhere(body);
      const sibCountWhere = status ? { [Op.and]: [sibWhere, status] } : sibWhere;
      const sib: any[] = await models.AuthorshipReview.findAll({
        attributes: ["pmid", [fn("COUNT", col("id")), "n"]],
        where: sibCountWhere,
        group: ["pmid"],
        raw: true,
      });
      sibMap = Object.fromEntries(sib.map((s) => [String(s.pmid), Number(s.n)]));
    }
    const out = rows.map((r: any) => ({
      ...r.toJSON(),
      pmid_sibling_count: sibMap[String(r.pmid)] || 1,
    }));

    res.send({ rows: out, count, limit, offset });
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

// POST /api/db/authorships/summary — counts per classification + precision lane, for the
// tab headers. Honours the same feed/search filters but ignores classification/precision so
// each lane shows its own total.
export const authorshipSummary = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const body = { ...(req.body || {}), classification: "all", precision: "all", personTypes: [] };
    const where = buildWhere(body);
    const [total, single, byClass, byType] = await Promise.all([
      models.AuthorshipReview.count({ where }),
      models.AuthorshipReview.count({ where: { [Op.and]: [where, { single_candidate: true }] } }),
      models.AuthorshipReview.findAll({
        attributes: [
          "classification",
          [fn("COUNT", col("id")), "n"],
        ],
        where,
        group: ["classification"],
        raw: true,
      }),
      models.AuthorshipReview.findAll({
        attributes: [
          "top_person_type",
          [fn("COUNT", col("id")), "n"],
        ],
        where,
        group: ["top_person_type"],
        raw: true,
      }),
    ]);
    const classes: Record<string, number> = {};
    (byClass as any[]).forEach((r) => { classes[r.classification] = Number(r.n); });
    const personTypes = (byType as any[])
      .filter((r) => r.top_person_type)
      .map((r) => ({ type: r.top_person_type as string, n: Number(r.n) }))
      .sort((a, b) => b.n - a.n);
    res.send({ total, single_candidate: single, classes, personTypes });
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

// ---- Phase C: curator actions -------------------------------------------------
// Resolve the curator's identity + authorization server-side from the next-auth JWT.
// The /api routes are NOT covered by middleware (matcher is page-only) and the
// backendApiKey is a shared app secret, so identity/role must be enforced here.
async function resolveCurator(req: NextApiRequest): Promise<{ userID?: number; cwid?: string; authorized: boolean }> {
  const token: any = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return { authorized: false };
  let userID: number | undefined = token.databaseUser?.userID;
  const cwid: string | undefined = token.username;
  // fallback: resolve the AdminUser id from the curator CWID if the JWT lacks databaseUser
  if (!userID && cwid) {
    const au: any = await models.AdminUser.findOne({ where: { personIdentifier: cwid }, attributes: ["userID"] });
    userID = au?.userID;
  }
  let roles: any[] = [];
  try { roles = token.userRoles ? JSON.parse(token.userRoles) : []; } catch { roles = []; }
  const authorized = roles.some((r: any) => r.roleLabel === "Superuser" || r.roleLabel === "Curator_All");
  return { userID, cwid, authorized };
}

// Gold-standard MERGE/DELETE via the ReCiter Java endpoint, tagged with the AAR source
// and the curator's numeric userID. Returns the upstream HTTP status.
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

// Append an AdminFeedbackLog row (accept/reject only). Mirrors createFeedbackLog:
// validates the curator is an ACTIVE AdminUser, then writes + bumps the pending count.
async function appendFeedbackLog(userID: number, personIdentifier: string, pmid: number, feedback: "ACCEPTED" | "REJECTED") {
  const active: any = await models.AdminUser.findOne({ where: { userID, status: 1 }, attributes: ["userID"] });
  if (!active) throw new Error(`userID ${userID} is not an active AdminUser`);
  await models.AdminFeedbackLog.create({
    userID, personIdentifier, articleIdentifier: pmid, feedback, createTimestamp: new Date(),
  });
  // same side-effect the normal curate flow has; never throws (own try/catch)
  await updatePendingArticleCount(personIdentifier, feedback);
}

// POST /api/db/authorships/action — single-row curator action.
// body: { id: number, action: "accept"|"reject"|"snooze"|"dismiss"|"assign"|"reopen", cwid?: string }
// cwid is required only for "assign" (the chosen multi-candidate WCM homonym).
export const authorshipAction = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const curator = await resolveCurator(req);
    if (!curator.authorized) return res.status(403).send("Not authorized for authorships review");
    if (!curator.userID) return res.status(401).send("Could not resolve curator identity");

    const body = req.body || {};
    const id = Number(body.id);
    const action = String(body.action || "");
    if (!id || !action) return res.status(400).send("id and action are required");

    const row: any = await models.AuthorshipReview.findByPk(id);
    if (!row) return res.status(404).send("Authorship not found");

    const pmid = Number(row.pmid);
    const cwid = row.top_cwid as string | undefined;
    const reviewer = curator.cwid || String(curator.userID);

    switch (action) {
      case "accept": {
        if (!cwid) return res.status(409).send("No proposed identity to accept");
        if (!row.single_candidate) return res.status(409).send("Multiple candidates — use \"Pick one\" to assign");
        const gs = await writeGoldStandard(cwid, pmid, "known", "UPDATE", curator.userID);
        if (gs !== 200) return res.status(502).send(`Gold-standard write failed (${gs})`);
        await models.AuthorshipReview.update(
          { status: "accepted", resolution_cwid: cwid, reviewer, resolved_at: new Date() },
          { where: { id } },
        );
        // audit log is best-effort: a hiccup here must not undo the authoritative GS+status write
        try { await appendFeedbackLog(curator.userID, cwid, pmid, "ACCEPTED"); }
        catch (e) { console.log("[authorships] feedbacklog (accept) non-fatal:", e); }
        break;
      }
      case "reject": {
        if (!cwid) return res.status(409).send("No proposed identity to reject");
        if (!row.single_candidate) return res.status(409).send("Multiple candidates — use \"Pick one\" to assign");
        const gs = await writeGoldStandard(cwid, pmid, "rejected", "UPDATE", curator.userID);
        if (gs !== 200) return res.status(502).send(`Gold-standard write failed (${gs})`);
        await models.AuthorshipReview.update(
          { status: "rejected", reviewer, resolved_at: new Date() },
          { where: { id } },
        );
        // audit log is best-effort (see accept)
        try { await appendFeedbackLog(curator.userID, cwid, pmid, "REJECTED"); }
        catch (e) { console.log("[authorships] feedbacklog (reject) non-fatal:", e); }
        break;
      }
      case "snooze": {
        const wake = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
        await models.AuthorshipReview.update(
          { status: "snoozed", snooze_until: wake, reviewer },
          { where: { id } },
        );
        break;
      }
      case "dismiss": {
        await models.AuthorshipReview.update(
          { status: "dismissed", reviewer, resolved_at: new Date() },
          { where: { id } },
        );
        break;
      }
      case "assign": {
        // multi-candidate disambiguation: curator picks the chosen WCM homonym.
        // No single_candidate guard — assign is precisely the multi-candidate path.
        const chosen = String(body.cwid || "");
        if (!chosen) return res.status(400).send("cwid is required for assign");
        // Integrity boundary: assign writes the authoritative gold standard, so the server —
        // not the client — must verify the chosen cwid is actually a candidate for this
        // authorship. accept/reject derive cwid server-side from top_cwid and can't be
        // spoofed; assign trusts a client-supplied cwid, so validate it against the
        // candidate set (plus top_cwid) before any GS write.
        let candidateCwids: string[] = [];
        try {
          const parsed = JSON.parse(row.candidate_cwids_json || "[]");
          if (Array.isArray(parsed)) {
            candidateCwids = parsed
              .map((c: any) => (typeof c === "string" ? c : c?.cwid))
              .filter(Boolean)
              .map(String);
          }
        } catch { candidateCwids = []; }
        const allowed = new Set([row.top_cwid, ...candidateCwids].filter(Boolean).map(String));
        if (!allowed.has(chosen)) {
          return res.status(400).send("cwid is not a candidate for this authorship");
        }
        const gs = await writeGoldStandard(chosen, pmid, "known", "UPDATE", curator.userID);
        if (gs !== 200) return res.status(502).send(`Gold-standard write failed (${gs})`);
        await models.AuthorshipReview.update(
          { status: "assigned", resolution_cwid: chosen, reviewer, resolved_at: new Date() },
          { where: { id } },
        );
        // audit log is best-effort (see accept)
        try { await appendFeedbackLog(curator.userID, chosen, pmid, "ACCEPTED"); }
        catch (e) { console.log("[authorships] feedbacklog (assign) non-fatal:", e); }
        break;
      }
      case "reopen": {
        // reverse any prior gold-standard write before re-opening.
        // accept/assign both wrote a "known" GS entry; the assigned chosen cwid lives
        // in resolution_cwid (top_cwid is the matcher's default, not the curator's pick).
        const reverseCwid = row.resolution_cwid || cwid;
        if (row.status === "accepted" && reverseCwid) {
          const gs = await writeGoldStandard(reverseCwid, pmid, "known", "DELETE", curator.userID);
          if (gs !== 200) return res.status(502).send(`Gold-standard undo failed (${gs})`);
        } else if (row.status === "assigned" && reverseCwid) {
          const gs = await writeGoldStandard(reverseCwid, pmid, "known", "DELETE", curator.userID);
          if (gs !== 200) return res.status(502).send(`Gold-standard undo failed (${gs})`);
        } else if (row.status === "rejected" && reverseCwid) {
          const gs = await writeGoldStandard(reverseCwid, pmid, "rejected", "DELETE", curator.userID);
          if (gs !== 200) return res.status(502).send(`Gold-standard undo failed (${gs})`);
        }
        await models.AuthorshipReview.update(
          { status: "open", snooze_until: null, resolved_at: null, resolution_cwid: null, reviewer },
          { where: { id } },
        );
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
