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
    const { frequency, accepted, status, minimumThreshold, userId,suggested } = req.body;

    try {
        let createUserPayload = {
            'frequency': frequency,
            'accepted': accepted,
            'minimumThreshold': minimumThreshold,
            'status': 1, // Hardcoded 1 to make user active bydefault
            'personIdentifier': userId,
            'suggested':suggested,
            'createTimestamp': new Date(),
            // 'userID': userId
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

export const disableNotificationByID = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { frequency, accepted, status, minimumThreshold, userId ,suggested} = req.body;

    try {

        var updateNotificationPayload = {
            'status': status, 
            'frequency': frequency,
            'accepted': accepted,
            'minimumThreshold': minimumThreshold,
            'suggested':suggested,
            'modifyTimestamp': new Date(),
        }
         const disableNotification = await models.AdminNotificationPreference.update(updateNotificationPayload,
            {
              where: { personIdentifier: userId },
            });
    } catch (e) {
        console.log(e);
        res.status(500).send(e);
    }
}

export const saveNotificationsLog = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { frequency, accepted, status, minimumThreshold, userId } = req.body;
    try {
        let createUserPayload = {
            'messageID': frequency,
            'articleIdentifier': accepted,
            'articleScore': minimumThreshold,
            'email': status, // Hardcoded 1 to make user active bydefault
            'userId': userId,
            'dateSent': new Date(),
            'createTimestamp': new Date()
        }
        const result = await sequelize.transaction(async (t) => {
            const saveNotificationResp = await models.AdminNotificationLog.create(createUserPayload, { transaction: t })
            res.send(saveNotificationResp)
        });
    } catch (e) {
        console.log(e);
        res.status(500).send(e);
    }
}