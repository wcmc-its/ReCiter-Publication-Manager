import { Op } from "sequelize";
import models from "../../../src/db/sequelize";
import { DynamoDBClient, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";

/**
 * Resolves FeedbackLog.actorPersonIdentifier (a cwid) to a display name for the curation
 * History panel, for rows where curatedBy didn't resolve against admin_users -- the
 * external/Scopus/manual-article lane always sets actorPersonIdentifier but hardcodes
 * curatedBy=0.
 *
 * Same resolution order as authorships.controller.ts's identityLabel()/personNames(): person
 * mirror first, SQL Identity roster next, DynamoDB Identity primaryName last. Reused as logic
 * rather than as an import because neither helper there is exported and this ticket's write
 * set doesn't include authorships.controller.ts -- see that file's identityLabel() for the
 * fuller rationale on source ordering.
 *
 * Checked here first, ahead of the name cascade: admin_users.personIdentifier, since a
 * curator acting through this lane is usually an admin and admin_users already carries the
 * byline-shaped name the feedback-log route uses for resolved curatedBy ids.
 */
const identityDdb = new DynamoDBClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1" });

export const resolveActorNames = async (cwids: string[]): Promise<Record<string, string>> => {
  const wanted = [...new Set((cwids || []).filter(Boolean).map(String))];
  const out: Record<string, string> = {};
  if (wanted.length === 0) return out;
  let remaining = wanted;

  try {
    const admins: any[] = await models.AdminUser.findAll({
      where: { personIdentifier: { [Op.in]: remaining } },
      attributes: ["personIdentifier", "nameFirst", "nameLast"],
      raw: true,
    });
    admins.forEach((u) => {
      const name = [u.nameFirst, u.nameLast].filter(Boolean).join(" ").trim();
      if (name) out[String(u.personIdentifier)] = name;
    });
  } catch (e) {
    console.log("resolveActorNames admin_users lookup error", e);
  }
  remaining = remaining.filter((c) => !out[c]);
  if (remaining.length === 0) return out;

  try {
    const people: any[] = await models.Person.findAll({
      where: { personIdentifier: { [Op.in]: remaining } },
      attributes: ["personIdentifier", "firstName", "middleName", "lastName"],
      raw: true,
    });
    people.forEach((p) => {
      const name = [p.firstName, p.middleName, p.lastName].map((v) => String(v || "").trim()).filter(Boolean).join(" ");
      if (name) out[String(p.personIdentifier)] = name;
    });
  } catch (e) {
    console.log("resolveActorNames person mirror lookup error", e);
  }
  remaining = remaining.filter((c) => !out[c]);
  if (remaining.length === 0) return out;

  try {
    const rows: any[] = await models.Identity.findAll({
      where: { cwid: { [Op.in]: remaining } },
      attributes: ["cwid", "givenName", "middleName", "surname"],
      raw: true,
    });
    rows.forEach((r) => {
      const name = [r.givenName, r.middleName, r.surname].map((v) => String(v || "").trim()).filter(Boolean).join(" ");
      if (name) out[String(r.cwid)] = name;
    });
  } catch (e) {
    console.log("resolveActorNames SQL Identity lookup error", e);
  }
  remaining = remaining.filter((c) => !out[c]);
  if (remaining.length === 0) return out;

  try {
    for (let i = 0; i < remaining.length; i += 100) { // 100 = BatchGetItem hard limit
      const batch = remaining.slice(i, i + 100);
      const resp = await identityDdb.send(new BatchGetItemCommand({
        RequestItems: {
          Identity: {
            Keys: batch.map((uid) => ({ uid: { S: uid } })),
            ProjectionExpression: "uid, #i.#p",
            ExpressionAttributeNames: { "#i": "identity", "#p": "primaryName" },
          },
        },
      }));
      for (const it of resp.Responses?.Identity ?? []) {
        const uid = it.uid?.S;
        const pn = it.identity?.M?.primaryName?.M;
        const name = [pn?.firstName?.S, pn?.middleName?.S, pn?.lastName?.S]
          .map((v) => String(v || "").trim()).filter(Boolean).join(" ");
        if (uid && name) out[uid] = name;
      }
    }
  } catch (e) {
    console.log("resolveActorNames DynamoDB Identity lookup error", e);
  }

  return out;
};
