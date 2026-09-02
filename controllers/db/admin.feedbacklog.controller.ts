import models from '../../src/db/sequelize'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { updatePendingArticleCount } from './person.controller'


models.AdminUser.hasMany(models.AdminFeedbackLog, { foreignKey: 'userID'})
models.AdminFeedbackLog.belongsTo(models.AdminUser, {foreignKey: 'userID'})
export const findFeedbackLogByUid = async (req: NextApiRequest, res: NextApiResponse) => {
    const { uid } = req.query;
    try {
        const feedbackLog = await models.AdminFeedbackLog.findAll({
            order: [["modifyTimestamp", "DESC"]],
            include: [
                models.AdminUser
            ],
            where: {
                personIdentifier: uid
            }
        });

        res.send(feedbackLog);
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
};


export const createFeedbackLog = async (req: NextApiRequest, res: NextApiResponse) => {
    const { personIdentifier, articleIdentifier, feedback } = req.body;
    try {
        // userID was previously client-supplied (req.body.userID); the route is under /api/db
        // so middleware guarantees a session -- resolve the real signed-in user from the JWT
        // instead of trusting whatever the client sent.
        const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
        const userID = Number(token?.databaseUser?.userID)
        if (!Number.isInteger(userID) || userID <= 0) {
            res.status(401).send('Not signed in')
            return
        }
        if(userID && personIdentifier && articleIdentifier && feedback) {
            const isUserExistAndActive = await models.AdminUser.findOne({
                where: {
                    userID: userID,
                    status: 1
                },
                attributes: ["userID"]
            })
            if(isUserExistAndActive) {
                let data = []
                articleIdentifier.forEach((element: number) => {
                    data.push({
                        userID: isUserExistAndActive.userID,
                        personIdentifier: personIdentifier,
                        articleIdentifier: element,
                        feedback: feedback,
                        createTimestamp: new Date()
                    })
                });
                const feedbackLog = await models.AdminFeedbackLog.bulkCreate(data)
                res.status(201).send(feedbackLog)

                //Update pending count for articles in person table -- this call recorded
                //articleIdentifier.length rows, not the person's lifetime feedback total
                await updatePendingArticleCount(personIdentifier, feedback, articleIdentifier.length)
            } else {
                res.status(401).send('userID ' + userID + ' is unauthorized to provide feedback')
            }
        } else {
            res.status(400).send('Include userID, personIdentifier, articleIdentifier & feedback in request body')
        }
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
};