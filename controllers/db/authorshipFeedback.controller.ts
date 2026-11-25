import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { readFile } from "fs/promises";
import path from "path";
import models from "../../src/db/sequelize";
import { viewAsActive, scopeFieldsFromDbUser, viewAsSummary } from "../../src/utils/viewAs";
import { externalStoreMode } from "../../src/lib/externalStore";
import { absentCwidCacheInfo } from "./authorships.controller";
import {
  errorInfo, feedbackAllowed, isDuplicateKey, isMissingTable, parseFeedbackBody, realCwid, resolutionUrl, writeSnapshot,
} from "../../src/lib/authorshipFeedback";
import { enrichFeedback } from "../../src/lib/authorshipFeedbackEnrich";

// "Report a problem" on /authorships. Never log or return an error object or a payload value from
// here: see the header of src/lib/authorshipFeedback.ts.
function logFailure(where: string, e: any, id?: number) {
  const { name, code } = errorInfo(e);
  console.log(`[authorshipFeedback] ${where} failed${id ? ` id=${id}` : ""} name=${name} code=${code}`);
}

// The real person's token, never effectiveToken(): under "View as" the report is still theirs, and
// the target is only recorded.
const sessionToken = (req: NextApiRequest): Promise<any> =>
  getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });

const allowed = (token: any) => feedbackAllowed(token, process.env.AUTHORSHIP_FEEDBACK_CWIDS);

// .next/BUILD_ID, what the browser's __NEXT_DATA__.buildId is compared with. Fixed for the process.
let serverBuild: Promise<string | null> | null = null;
const getServerBuild = () => (serverBuild ??= readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8")
  .then((s) => s.trim().slice(0, 64) || null, () => null));

// A query against an exhausted pool waits 30 s, and the page draws no control until this answers.
const REPORTS_WAIT_MS = 2000;

// GET -> { enabled, reports, reportsError? }. `enabled` reads no table, so the page's control still
// opens during a database outage; the list of the caller's own reports is best effort.
export const feedbackStatus = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const token = await sessionToken(req);
    if (!token) return res.status(401).json({ message: "Not signed in" });
    if (!allowed(token)) return res.send({ enabled: false, reports: [] });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const query = models.AuthorshipFeedback.findAll({
        attributes: ["id", "created_at", "category", "comment", "review_id", "trigger_place", "status", "resolution_ref"],
        where: { reported_by: realCwid(token)! },
        order: [["id", "DESC"]], limit: 50, raw: true, logging: false,
      });
      const rows: any[] = await Promise.race([query, new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(Object.assign(new Error(), { name: "ReportsTimeout" })), REPORTS_WAIT_MS);
      })]);
      return res.send({
        enabled: true,
        reports: rows.map(({ resolution_ref, ...r }) => ({ ...r, resolution_url: resolutionUrl(resolution_ref) })),
      });
    } catch (e) {
      logFailure("list", e);
      return res.send({ enabled: true, reports: [], reportsError: true });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    logFailure("session", e);
    return res.status(503).json({ code: "DB", message: "Could not read the session" });
  }
};

// Block E: what was running, and who was looking at what.
async function runEnv(req: NextApiRequest, token: any) {
  const roleLabels = (raw: any) => {
    try {
      const roles = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(roles) ? roles.map((r: any) => r?.roleLabel ?? null) : [];
    } catch { return null; }
  };
  const json = (raw: any) => {
    try { return typeof raw === "string" ? JSON.parse(raw) : raw ?? null; } catch { return null; }
  };
  const who = (cwid: any, userRoles: any, scopeData: any, proxyPersonIds: any) =>
    ({ cwid, roles: roleLabels(userRoles), scope: json(scopeData), proxy_person_ids: json(proxyPersonIds) });
  let viewingAs = null;
  if (viewAsActive(token)) {
    const { scopeData, proxyPersonIds } = scopeFieldsFromDbUser(token.viewAs.databaseUser);
    viewingAs = {
      ...who(token.viewAs.targetCwid, token.viewAs.userRoles, scopeData, proxyPersonIds), started_at: token.viewAs.startedAt,
    };
  }
  return {
    external_store: externalStoreMode(),
    host: req.headers.host ?? null,
    pod: process.env.HOSTNAME ?? null,
    server_build: await getServerBuild(),
    real: who(realCwid(token), token.userRoles, token.scopeData, token.proxyPersonIds),
    viewing_as: viewingAs,
    absent_cwid_cache: absentCwidCacheInfo(),
  };
}

// POST: save the comment and the browser's snapshot, answer, then collect the server's blocks and
// write them once. Nothing after the insert can lose the report.
export const feedbackCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  let token: any;
  try { token = await sessionToken(req); } catch (e) {
    logFailure("session", e);
    return res.status(503).json({ code: "DB", message: "Could not read the session" });
  }
  if (!token) return res.status(401).json({ message: "Not signed in" });
  if (!allowed(token)) return res.status(403).json({ message: "Reporting is not enabled for this account" });
  const reportedBy = realCwid(token)!;

  const parsed = parseFeedbackBody(req.body);
  if ("message" in parsed) return res.status(400).json({ message: parsed.message });
  const input = parsed.input;

  let id: number;
  try {
    const saved: any = await models.AuthorshipFeedback.create({
      client_uuid: input.client_uuid,
      created_at: new Date(),
      reported_by: reportedBy,
      viewing_as: viewAsSummary(token)?.targetCwid ?? null,
      host: String(req.headers.host || "").slice(0, 128),
      review_id: input.review_id,
      trigger_place: input.trigger_place,
      category: input.category,
      about_cwids: JSON.stringify(input.about_cwids),
      expected: input.expected,
      typed_ref: input.typed_ref,
      comment: input.comment,
      snapshot_version: input.snapshot_version,
      client_build: input.client_build,
      server_build: await getServerBuild(),
      client_snapshot: input.client_snapshot,
    }, { logging: false });
    id = Number(saved.id);
  } catch (e) {
    if (isDuplicateKey(e)) {
      try {
        const first: any = await models.AuthorshipFeedback.findOne({
          attributes: ["id"], where: { client_uuid: input.client_uuid, reported_by: reportedBy }, raw: true, logging: false,
        });
        return first
          ? res.status(200).json({ id: Number(first.id), duplicate: true })
          : res.status(400).json({ message: "client_uuid is already in use" });
      } catch (e2) {
        logFailure("duplicate lookup", e2);
        return res.status(503).json({ code: "DB", message: "The report could not be saved" });
      }
    }
    logFailure("insert", e);
    return isMissingTable(e)
      ? res.status(503).json({ code: "NO_TABLE", message: "The report table does not exist in this database" })
      : res.status(503).json({ code: "DB", message: "The report could not be saved" });
  }
  res.status(201).json({ id });
  console.log(`[authorshipFeedback] saved id=${id} review=${input.review_id ?? "none"}`);

  try {
    const found = await enrichFeedback({
      reviewId: input.review_id, typedRef: input.typed_ref, expected: input.expected, aboutCwids: input.about_cwids,
      env: await runEnv(req, token),
    });
    await writeSnapshot((values) => models.AuthorshipFeedback.update(values, { where: { id }, logging: false }), found,
      (e) => logFailure("snapshot update", e, id));
  } catch (e) {
    logFailure("enrichment", e, id);
  }
};
