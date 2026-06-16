import { raw, response } from "express";
import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize,QueryTypes } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";
import { QueryConstants } from "../../../src/utils/namedQueryConstants";

export const getManageProfileByID = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { personIdentifier } = req.query;
    try {
        const adminUserData = await models.AdminUser.findOne({
            where: { "personIdentifier": personIdentifier }
        })

        const profileInfo = await sequelize.query(
            QueryConstants.getManageProfileForOCIDData,
            {
                type: QueryTypes.SELECT,
                replacements: { personIdentifier: personIdentifier },
                raw: true,
            },
        );

        if (profileInfo && profileInfo.length > 0) {
            res.send({
                "email": adminUserData?.email || '',
                "data": profileInfo
            });
        } else {
            res.send({
                "message": "No data found",
                "email": adminUserData?.email || '',
            });
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
