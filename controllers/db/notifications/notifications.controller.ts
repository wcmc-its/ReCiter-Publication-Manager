import { response } from "express";
import type { NextApiRequest, NextApiResponse } from "next";
//import { Op, Sequelize, where,Transaction } from "sequelize";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";
import { sendEmailNotification } from "./../../../src/utils/emailUtilityHelper";


export const saveNotifications = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { frequency, accepted, status, minimumThreshold, userId, suggested, recipient, isReqFrom,recipientName } = req.body;
    try {
        let createUserPayload = {
            'frequency': frequency,
            'accepted': accepted,
            'minimumThreshold': minimumThreshold,
            'status': 1, // Hardcoded 1 to make user active bydefault
            'personIdentifier': userId,
            'suggested': suggested,
            'createTimestamp': new Date(),
            // 'userID': userId
        }

        let AdminUserData = await models.AdminUser.findOne({
            where: { "personIdentifier": userId }
        })

        if (AdminUserData) {
            let userNotifiedUser = await models.AdminNotificationPreference.findOne({
                where: { "personIdentifier": userId }
            })

            if (userNotifiedUser) {
                const result = await sequelize.transaction(async (t) => {
                    const updateNotificationResp = await models.AdminNotificationPreference.update(createUserPayload,
                        {
                          where: { personIdentifier: userId },
                          transaction: t
                        });
                        if(updateNotificationResp) {
                            let result = {"personIdentifier":userId}
                            res.send(result);
                            snedNotifiationPrefEmail(req.body, req,res)
                        }
                        else res.send(updateNotificationResp)
                });
            }else{
                const result = await sequelize.transaction(async (t) => {
                    const saveNotificationResp = await models.AdminNotificationPreference.create(createUserPayload, { transaction: t })
                    res.send(saveNotificationResp);
                    snedNotifiationPrefEmail(req.body,req,res)
                });
            }
        }else{
            let noData = {
                "message" : "User does not exist"
            }
            res.send(noData)
        }
    } catch (e) {
        console.log(e);
        res.status(500).send(e);
    }
}

export const snedNotifiationPrefEmail = (paylaod,req,res) => {
    const { frequency, accepted, status, minimumThreshold, userId, suggested, recipient, isReqFrom, recipientName } = req.body;

    const fromAddress =
        process.env.NODE_ENV === "production"
            ? '"Reciter Pub Manager" <publications@med.cornell.edu>'
            : '"Reciter Pub Manager Test" <doNotReply@med.cornell.edu>';
    let subject = "Notification preference has been configured for " + userId;
    let emailBody = `<div style="font-family: Arial; font-size : 11pt">
                            <p>Hello ${recipientName},</p>
                            <p>new publication has been accepted on your behalf: ${accepted == 0 ? false : true}</p>
                            <p>A new publication has been suggested: ${suggested == 0 ? false : true}</p>
                            <p>Minimum evidence score for triggering a notification: ${minimumThreshold}</p>
                            <p>Frequency of notifications: ${frequency == 1 ? "daily" : frequency + "days"}</p>
                            </div>`
    let mailOptions = {
        from: fromAddress,
        to: process.env.SMTP_ADMIN_EMAIL, // admin_users.email || recipient  to: 
        subject: subject,
        html: emailBody
    }
    sendEmailNotification(paylaod, mailOptions, req, res);
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

export const getNotificationByPersonIdentifier = async(
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const {personIdentifier} = req.query;
    try {

        let AdminUserData = await models.AdminUser.findOne({
            where: { "personIdentifier": personIdentifier }
        })

        if(AdminUserData){
            let notification = await models.AdminNotificationPreference.findOne({
                where:{"personIdentifier" : personIdentifier}
            }) 
            
            if(notification) { res.send(notification) }
            else {
                let result = {
                    "message": "No data found"
                }
                res.send(result)
            }
        }else{
            let noData = {
                "message" : "User does not exist"
            }
            res.send(noData)
        }
    } catch (e) {
        console.log(e);
        res.status(500).send(e);
    }
}

export const saveNotificationsLog = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { frequency, accepted, status, minimumThreshold, userId,notificatonType } = req.body;
    try {
        let createUserPayload = {
            'messageID': frequency,
            'articleIdentifier': accepted,
            'articleScore': minimumThreshold,
            'email': status, // Hardcoded 1 to make user active bydefault
            'userId': userId,
            'dateSent': new Date(),
            'createTimestamp': new Date(),
            'notificationType': notificatonType
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