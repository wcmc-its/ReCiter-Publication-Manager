import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'
import url from 'url'
import { saveUserFeedback } from './userfeedback.controller'

export async function updateGoldStandard(req: NextApiRequest)  {
    
   return fetch(`${reciterConfig.reciter.reciterUpdateGoldStandardEndpoint}`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'api-key': reciterConfig.reciter.adminApiKey,
            'Content-Length': req.body.length,
            'User-Agent': 'reciter-pub-manager-server'
        },
        body: JSON.stringify(req.body)
    })
        .then(async(res)=> {
            if(res.status !== 200) {
                let responseText = await res.json()
                return {
                    statusCode: res.status,
                    statusText: responseText
                }
            } else {
                let data: any = await res.json()
                callUserFeedbackApi(req.body, req)
                return {
                    statusCode: res.status,
                    statusText: data
                }
            }
        })
        .catch((error) => {
            console.log('ReCiter Update Goldstandard api is not reachable: ' + error)
            return {
                statusCode: error.status,
                statusText: error
            }
        });
}


async function callUserFeedbackApi(goldStandard: any, req: NextApiRequest) {
    let acceptedPmids = []
    let rejectedPmids = []
    if (goldStandard.knownPmids !== undefined) {
        acceptedPmids = goldStandard.knownPmids
    }
    if (goldStandard.rejectedPmids !== undefined) {
        rejectedPmids = goldStandard.rejectedPmids
    }
    const userFeedback = {
        'uid': goldStandard.uid,
        'acceptedPmids': acceptedPmids,
        'rejectedPmids': rejectedPmids,
        'feedbackDate': new Date()
    }
    console.log(await saveUserFeedback(req, goldStandard.uid))
}