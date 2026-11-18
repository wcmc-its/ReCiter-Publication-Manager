import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'
import httpBuildQuery from 'http-build-query'
import { findUserFeedback } from './userfeedback.controller'
import { parseCwidList, sameCwid } from '../src/utils/canonicalCwid'

export async function getPublicationsBulk(req: NextApiRequest)  {
    // Convert every uid on the way in (trim, lowercase) so ReCiter is never asked to analyze
    // `Abl9002` as a person separate from `abl9002`. Invalid entries are skipped and logged;
    // a request with no valid uid at all is a 400.
    let rawBody: unknown = req.body
    if (typeof rawBody === 'string') {
        try { rawBody = JSON.parse(rawBody) } catch { rawBody = undefined }
    }
    if (!Array.isArray(rawBody)) {
        return { statusCode: 400, statusText: 'Request body must be a JSON array of uids' }
    }
    const { valid: uids, invalid } = parseCwidList(rawBody)
    if (invalid.length) {
        console.warn(`[feature-generator/group] skipping ${invalid.length} invalid uid(s): ${JSON.stringify(invalid)}`)
    }
    if (!uids.length) {
        return { statusCode: 400, statusText: 'No valid uids in request body' }
    }

    let uri = `${reciterConfig.reciter.featureGeneratorByGroup.featureGeneratorByGroupEndpoint}` +'?' + `${httpBuildQuery(reciterConfig.reciter.featureGeneratorByGroup.featureGeneratorByGroupApiParams)}`
    return fetch(uri, {
            method: "POST",
            headers: {
                'api-key': reciterConfig.reciter.adminApiKey,
                'User-Agent': 'reciter-pub-manager-server',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(uids)
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
                    let finalData = await getPendingFeedback(uids, data)
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
        let personIdentifierIndex = data.findIndex((item: any) => sameCwid(item?.personIdentifier, uid))
        if(userFeedbackResponse.statusCode != 200) {
            let updatedPersonIdentifier = {...data[personIdentifierIndex], reciterPendingData: []};
            data[personIdentifierIndex] = updatedPersonIdentifier;
        } else if(userFeedbackResponse.statusCode == 200 && userFeedbackResponse.statusText !== undefined && personIdentifierIndex >=0 && data[personIdentifierIndex] && data[personIdentifierIndex].reCiterArticleFeatures) {
            let pendingPublications: any = []
            if(userFeedbackResponse.statusText && userFeedbackResponse.statusText.acceptedPmids) {
                pendingPublications = [...userFeedbackResponse.statusText.acceptedPmids]
            }
            if(userFeedbackResponse.statusText && userFeedbackResponse.statusText.rejectedPmids) {
                pendingPublications = [...userFeedbackResponse.statusText.rejectedPmids]
            }
                /* if(userFeedbackResponse.statusText.acceptedPmids !== undefined) {
                    userFeedbackResponse.statusText.acceptedPmids.forEach((acceptedPmid: any) => {
                        let foundIndex = data[personIdentifierIndex].reCiterArticleFeatures.findIndex((item: any) => item.pmid == acceptedPmid)
                        if(foundIndex >= 0) {
                            data[personIdentifierIndex].reCiterArticleFeatures[foundIndex].userAssertion = 'ACCEPTED'
                            pendingPublications.push(
                                data[personIdentifierIndex].reCiterArticleFeatures[foundIndex].pmid
                            )
                        }
                    })
                }
                if(userFeedbackResponse.statusText.rejectedPmids !== undefined) {
                    userFeedbackResponse.statusText.rejectedPmids.forEach((rejectedPmid: any) => {
                        let foundIndex = data[personIdentifierIndex].reCiterArticleFeatures.findIndex((item: any) => item.pmid == rejectedPmid)
                        if(foundIndex >= 0) {
                            data[personIdentifierIndex].reCiterArticleFeatures[foundIndex].userAssertion = 'REJECTED'
                            pendingPublications.push(
                                data[personIdentifierIndex].reCiterArticleFeatures[foundIndex].pmid
                            )
                        }
                    })
                } */
                let updatedPersonIdentifier = {...data[personIdentifierIndex], reciterPendingData: pendingPublications}
                data[personIdentifierIndex] = updatedPersonIdentifier
        }
    }
    return data
}