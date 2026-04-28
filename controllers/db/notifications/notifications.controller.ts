import { response } from "express";
import type { NextApiRequest, NextApiResponse } from "next";
//import { Op, Sequelize, where,Transaction } from "sequelize";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";

export const saveNotifications = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { frequency, accepted, status, minimumThreshold, userId } = req.body;
    try {
        let createUserPayload = {
            'frequency': frequency,
            'accepted': accepted,
            'minimumThreshold1': minimumThreshold,
            'status': status, // Hardcoded 1 to make user active bydefault
            'userId': userId,
            'createTimestamp': new Date()
        }
        const result = await sequelize.transaction(async (t) => {
            const saveNotificationResp = await models.AdminNotificationPreference.create(createUserPayload, { transaction: t })
            res.send(saveNotificationResp)
        });
    } catch (e) {
        console.log(e);
        res.status(500).send(e);
    }
}