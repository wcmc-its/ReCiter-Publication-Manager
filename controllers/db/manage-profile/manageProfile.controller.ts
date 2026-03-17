import type { NextApiRequest, NextApiResponse } from "next";
import models from "../../../src/db/sequelize";

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
                where: { "personIdentifier": personIdentifier }
            })

            if (profileInfo) {
                let result = {
                    "email": adminUserData.email
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
