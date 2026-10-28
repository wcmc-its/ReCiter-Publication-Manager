import { raw, response } from "express";
import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize,QueryTypes } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";
import { QueryConstants } from "../../../src/utils/namedQueryConstants";
import { getIdentity } from "../../identity.controller";
import { scholarsStatus, scholarsChangeUrl, identityOrcidUpdate, SCHOLARS_ACTIVE_MAX_AGE_HOURS } from "../../../src/utils/scholarsOrcid";
import { reciterConfig } from "../../../config/local";

// Who owns this person's ORCID, from reciterdb.scholar_active (written by SPS, prod only).
// Any failure, including the table not existing (PM dev's reciterdb), is 'unknown'.
// ponytail: hour-level age vs UTC_TIMESTAMP; a few hours of timezone skew doesn't matter
// against a 48h window.
const scholarsActive = async (personIdentifier: string) => {
    try {
        const [row]: any = await sequelize.query(
            "SELECT (SELECT has_confirmed_orcid FROM scholar_active WHERE cwid = LOWER(:personIdentifier)) AS hasConfirmedOrcid, " +
            "(SELECT TIMESTAMPDIFF(HOUR, MAX(refreshed_at), UTC_TIMESTAMP()) FROM scholar_active) AS ageHours",
            { type: QueryTypes.SELECT, replacements: { personIdentifier } }
        )
        const status = scholarsStatus(row)
        if (status === 'unknown')
            console.warn(`scholar_active is stale or empty (${row?.ageHours}h, limit ${SCHOLARS_ACTIVE_MAX_AGE_HOURS}h); ORCID field left editable, Identity not written`)
        return { status, row }
    } catch (e) {
        console.warn("scholar_active unavailable; ORCID field left editable, Identity not written: " + e?.message)
        return { status: 'unknown' as const, row: null }
    }
}

// The read-only ORCID block for an active scholar, or null for everyone else. The iD is
// Identity's, which the SPS push keeps equal to Scholars.
const scholarsOrcid = async (personIdentifier: string) => {
    const { status, row } = await scholarsActive(personIdentifier)
    if (status !== 'scholar') return null
    const identity: any = await getIdentity(personIdentifier)
    return {
        loaded: identity?.statusCode === 200,
        orcid: identity?.statusCode === 200 ? (identity.statusText?.orcid || null) : null,
        confirmed: !!Number(row.hasConfirmedOrcid),
        changeUrl: scholarsChangeUrl(personIdentifier, process.env.SCHOLARS_BASE_URL),
    }
}

// Copy a PM save/remove into the person's ReCiter Identity record (GET, change only
// orcid, POST back; the same API SPS's orcid-push uses). No Identity record (404) is
// nothing to write. Throws on any other failure so the caller writes nothing.
const writeIdentityOrcid = async (personIdentifier: string, op: { save: string } | { remove: string | null }) => {
    const { reciterApiBaseUrl, adminApiKey, reciterIdentityEndpoints } = reciterConfig.reciter
    const headers = { 'api-key': adminApiKey, 'User-Agent': 'reciter-pub-manager-server' }
    const got = await fetch(`${reciterIdentityEndpoints.identityByUid}?uid=${encodeURIComponent(personIdentifier)}`, { headers })
    if (got.status === 404) return
    if (!got.ok) throw new Error(`ReCiter identity GET ${got.status}`)
    const save = identityOrcidUpdate(await got.json(), op)
    if (!save) return
    const put = await fetch(`${reciterApiBaseUrl}/reciter/identity/`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(save),
    })
    if (!put.ok) throw new Error(`ReCiter identity POST ${put.status}`)
}

// 409 for an active scholar (returns null); otherwise the status, so the caller knows
// whether PM may also write Identity ('not_scholar' only).
const refuseIfScholars = async (personIdentifier: string, res: NextApiResponse) => {
    const { status } = await scholarsActive(personIdentifier)
    if (status !== 'scholar') return status
    res.status(409).send(`ORCID for ${personIdentifier} is managed in Scholars`)
    return null
}

export const getManageProfileByID = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { personIdentifier } = req.query;
    try {
        let profileInfo: any = [];
        let adminUserData = await models.AdminUser.findOne({
            where: { "personIdentifier": personIdentifier }
        })
        // The saved ORCID read on its own: getManageProfileForOCIDData only returns rows for
        // suggested ORCIDs, so a manually saved ORCID was invisible for anyone without one.
        const savedOrcidRow: any = await models.AdminOrcid.findOne({
            where: { "personIdentifier": personIdentifier },
            raw: true
        })
        const savedOrcid = savedOrcidRow?.orcid || ''
        const scholars = await scholarsOrcid(String(personIdentifier))

        if (adminUserData) {
            profileInfo = await sequelize.query(
                QueryConstants.getManageProfileForOCIDData,
                {
                type: QueryTypes.SELECT,    
                replacements: {personIdentifier: personIdentifier} ,
                   raw : true,
                //    benchmark:true
                },
                
            );
            if (profileInfo) {
                let result = {
                    "email": adminUserData.email,
                    "data": profileInfo,
                    savedOrcid,
                    scholars
                }
                res.send(result);
            }
            else {
                let result = {
                    "message": "No data found",
                    "email": adminUserData.email,
                    "userID": adminUserData.userID,
                    savedOrcid,
                    scholars
                }
                res.send(result);
            }
        } else {
            let noData = {
                "message": "User does not exist",
                "email": '',
                savedOrcid,
                scholars
            }
            res.send(noData)
        }
    } catch (e) {
        console.log(e);
        res.status(500).send(e);
    }
}

export const saveORCIDProfile = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { orcid, personIdentifier } = req.body;

    try {
        if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(String(orcid))) {
            res.status(400).send("ORCID must be in the format ####-####-####-####")
            return
        }
        const status = await refuseIfScholars(String(personIdentifier), res)
        if (!status) return
        try {
            if (status === 'not_scholar') await writeIdentityOrcid(String(personIdentifier), { save: String(orcid) })
        } catch (e) {
            console.log(e)
            res.status(502).send("Unable to update the ORCID in ReCiter Identity; nothing was saved")
            return
        }
        let createUserPayload = {
            'personIdentifier': personIdentifier,
            'orcid': orcid,
        }
        const result = await sequelize.transaction(async (t) => {
            const response = await models.AdminOrcid.upsert(createUserPayload)
            res.send(response)
        });
    } catch (e) {
        console.log(e);
        res.status(500).send(e);
    }
}

export const resetProfileORCID = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { orcid, personIdentifier } = req.query;
    try {
        const status = await refuseIfScholars(String(personIdentifier), res)
        if (!status) return
        const saved: any = await models.AdminOrcid.findOne({ where: { personIdentifier }, raw: true })
        try {
            if (status === 'not_scholar') await writeIdentityOrcid(String(personIdentifier), { remove: saved?.orcid || null })
        } catch (e) {
            console.log(e)
            res.status(502).send("Unable to update the ORCID in ReCiter Identity; nothing was removed")
            return
        }

            const response = await models.AdminOrcid.destroy({
                where:{
                    personIdentifier : personIdentifier
                }
            })
            res.send(response)
    } catch (e) {
        console.log(e);
        res.status(500).send(e);
    }
}
