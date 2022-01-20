import models from '../../src/db/sequelize'
import type { NextApiRequest, NextApiResponse } from 'next'
import { updatePendingArticleCount } from './person.controller'

export const findFeedbackLogByUid = async (req: NextApiRequest, res: NextApiResponse) => {
    const { uid } = req.query;
    try {
        const feedbackLog = await models.AdminFeedbackLog.findAll({
            order: [["modifyTimestamp", "DESC"]],
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
    const { userID, personIdentifier, articleIdentifier, feedback } = req.body;
    try {
        console.log('Checking request body for createFeedbackLog')
        if(userID && personIdentifier && articleIdentifier && feedback) {
            console.log('Valid request body for createFeedbackLog')
            const isUserExistAndActive = await models.AdminUser.findOne({
                where: {
                    userID: userID,
                    status: 1
                },
                attributes: ["userID"]
            })
            if(isUserExistAndActive) {
                console.log('UserID ' + userID + ' for request createFeedbackLog exist and active')
                const feedbackModel = models.AdminFeedbackLog.build({
                    userID: isUserExistAndActive.userID,
                    personIdentifier: personIdentifier,
                    articleIdentifier: articleIdentifier,
                    feedback: feedback,
                    createTimestamp: new Date()
                })
                await feedbackModel.save()
                res.status(201).send(feedbackModel)
                console.log('Successful creation of feedbacklog ' + JSON.stringify(feedbackModel.toJSON()))

                //Update pending count for articles in person table
                await updatePendingArticleCount(personIdentifier, feedback)
            } else {
                res.status(401).send('userID ' + userID + ' is unauthorized to provide feedback')
                console.log('userID ' + userID + ' is unauthorized to provide feedback')
            }
        } else {
            res.status(400).send('Include userID, personIdentifier, articleIdentifier & feedback in request body')
            console.log('Include userID, personIdentifier, articleIdentifier & feedback in request body for createFeedbackLog')
        }
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
};