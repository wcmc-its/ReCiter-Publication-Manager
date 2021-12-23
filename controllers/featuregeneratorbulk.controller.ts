import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'
import httpBuildQuery from 'http-build-query'
import { findUserFeedback } from './userfeedback.controller'

export async function getPublicationsBulk(req: NextApiRequest)  {

    let uri = `${reciterConfig.reciter.featureGeneratorByGroup.featureGeneratorByGroupEndpoint}` +'?' + `${httpBuildQuery(reciterConfig.reciter.featureGeneratorByGroup.featureGeneratorByGroupApiParams)}`
    return fetch(uri, {
            method: "POST",
            headers: {
                'api-key': reciterConfig.reciter.adminApiKey,
                'User-Agent': 'reciter-pub-manager-server',
                'Content-Length': req.body.length,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body)
        })
            .then(async(res)=> {
                if(res.status !== 200) {
                    let responseText = await res.text()
                    return {
                        statusCode: res.status,
                        statusText: responseText
                    }
                } else {
                    let data: any = await res.json()
                    let finalData = await getPendingFeedback(req.body, data)
                    return {
                        statusCode: res.status,
                        statusText: finalData
                    }
                }
            })
            .catch((error) => {
                console.log('ReCiter feature generator by group api is not reachable: ' + error)
                return {
                    statusCode: error.status,
                    statusText: error
                }
            });
}


async function getPendingFeedback(uids: string[], data: any) {
    for await(const uid of uids) {
        let userFeedbackResponse: any =  await findUserFeedback(uid)
        let personIdentifierIndex = data.findIndex((item: any) => item.personIdentifier == uid)
        if(userFeedbackResponse.statusCode != 200) {
            let updatedPersonIdentifier = {...data[personIdentifierIndex], reciterPendingData: []};
            data[personIdentifierIndex] = updatedPersonIdentifier;
        } else if(userFeedbackResponse.statusCode == 200 && userFeedbackResponse.userFeedback !== undefined) {
            let pendingPublications: any = []
                if(userFeedbackResponse.userFeedback.acceptedPmids !== undefined) {
                    userFeedbackResponse.userFeedback.acceptedPmids.forEach((acceptedPmid: any) => {
                        let foundIndex = data[personIdentifierIndex].reCiterArticleFeatures.findIndex((item: any) => item.pmid == acceptedPmid)
                        data[personIdentifierIndex].reCiterArticleFeatures[foundIndex].userAssertion = 'ACCEPTED'
                        pendingPublications.push(
                            data[personIdentifierIndex].reCiterArticleFeatures[foundIndex]
                        )
                    })
                }
                if(userFeedbackResponse.userFeedback.rejectedPmids !== undefined) {
                    userFeedbackResponse.userFeedback.rejectedPmids.forEach((rejectedPmid: any) => {
                        let foundIndex = data[personIdentifierIndex].reCiterArticleFeatures.findIndex((item: any) => item.pmid == rejectedPmid)
                        data[personIdentifierIndex].reCiterArticleFeatures[foundIndex].userAssertion = 'REJECTED'
                        pendingPublications.push(
                            data[personIdentifierIndex].reCiterArticleFeatures[foundIndex]
                        )
                    })
                }
                let updatedPersonIdentifier = {...data[personIdentifierIndex], reciterPendingData: pendingPublications}
                data[personIdentifierIndex] = updatedPersonIdentifier
        }
    }
    return data
}