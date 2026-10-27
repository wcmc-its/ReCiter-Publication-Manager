import { raw, response } from "express";
import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize,QueryTypes } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";
import { QueryConstants } from "../../../src/utils/namedQueryConstants";
import { getIdentity } from "../../identity.controller";
import { scholarsManagesOrcid, scholarsChangeUrl, SCHOLARS_ACTIVE_MAX_AGE_HOURS } from "../../../src/utils/scholarsOrcid";

// Does Scholars own this person's ORCID? Reads reciterdb.scholar_active (written by SPS, prod
// only). Any failure, including the table not existing (PM dev's reciterdb), keeps the
// editable field. ponytail: hour-level age vs UTC_TIMESTAMP; a few hours of timezone skew
// doesn't matter against a 48h window.
const scholarsActiveRow = async (personIdentifier: string) => {
    try {
        const [row]: any = await sequelize.query(
            "SELECT s.has_confirmed_orcid AS hasConfirmedOrcid, " +
            "(SELECT TIMESTAMPDIFF(HOUR, MAX(refreshed_at), UTC_TIMESTAMP()) FROM scholar_active) AS ageHours " +
            "FROM scholar_active s WHERE s.cwid = LOWER(:personIdentifier)",
            { type: QueryTypes.SELECT, replacements: { personIdentifier } }
        )
        if (row && !scholarsManagesOrcid(row))
            console.warn(`scholar_active is stale (${row.ageHours}h, limit ${SCHOLARS_ACTIVE_MAX_AGE_HOURS}h); ORCID field left editable`)
        return scholarsManagesOrcid(row) ? row : null
    } catch (e) {
        console.warn("scholar_active unavailable; ORCID field left editable: " + e?.message)
        return null
    }
}

// The read-only ORCID block for an active scholar, or null for everyone else. The iD is
// Identity's, which the SPS push keeps equal to Scholars.
const scholarsOrcid = async (personIdentifier: string) => {
    const row = await scholarsActiveRow(personIdentifier)
    if (!row) return null
    const identity: any = await getIdentity(personIdentifier)
    return {
        loaded: identity?.statusCode === 200,
        orcid: identity?.statusCode === 200 ? (identity.statusText?.orcid || null) : null,
        confirmed: !!Number(row.hasConfirmedOrcid),
        changeUrl: scholarsChangeUrl(personIdentifier, process.env.SCHOLARS_BASE_URL),
    }
}

const refuseIfScholars = async (personIdentifier: string, res: NextApiResponse) => {
    if (!(await scholarsActiveRow(personIdentifier))) return false
    res.status(409).send(`ORCID for ${personIdentifier} is managed in Scholars`)
    return true
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
        if (await refuseIfScholars(String(personIdentifier), res)) return
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
        if (await refuseIfScholars(String(personIdentifier), res)) return
        let createUserPayload = {
            'personIdentifier': personIdentifier,
            'orcid': orcid,
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
