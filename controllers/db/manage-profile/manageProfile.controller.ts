import { response } from "express";
import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";

export const getManageProfileByID = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { personIdentifier } = req.query;
    try {
        let profileInfo: any = '';
        let adminUserData = await models.AdminUser.findOne({
            where: { "personIdentifier": personIdentifier }
        })
        if (adminUserData) {
            profileInfo = await models.PersonArticleAuthor.findOne({
                // attributes:['personIdentifier', [Sequelize.fn("GROUP_CONCAT", Sequelize.col('AdminDepartment.departmentLabel')),"departmentLabel",],'userID'],
                where: { "personIdentifier": personIdentifier }
            })
            console.log("profileInfo", profileInfo)

            if (profileInfo) {
                let result = {
                    // "accepted":notification.accepted,
                    // "createTimestamp":notification.createTimestamp,
                    // "frequency": notification.frequency,
                    // "minimumThreshold":notification.minimumThreshold,
                    // "id":notification.id,
                    // "modifyTimestamp":notification.modifyTimestamp,
                    // "personIdentifier":notification.personIdentifier,
                    // "status":notification.status,
                    // "userID":notification.userID,
                    // "suggested":notification.suggested,
                    "email": adminUserData.email
                    // 'id',
                    // 'personIdentifier',
                    // 'pmid',
                    // 'authorFirstName',
                    // 'authorLastName',
                    // 'targetAuthor',
                    // 'rank',
                    // 'orcid'
                }
                res.send(result);
            }
            else {
                let result = {
                    "message": "No data found",
                    "email": adminUserData.email,
                    "userID": adminUserData.userID
                }
                res.send(result)
            }
        } else {
            let noData = {
                "message": "User does not exist",
                "email": ''

            }
            res.send(noData)
        }
    } catch (e) {
        console.log(e);
        res.status(500).send(e);
    }
}
