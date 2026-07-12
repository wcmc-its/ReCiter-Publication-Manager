import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'
import url from 'url'
import { saveUserFeedback } from './userfeedback.controller'

// curatedBy is the curating user's admin_users.userID. ReCiter accepts it as a query
// param on /reciter/goldstandard and defaults it to 0 ("unknown") when absent — which is
// why every FeedbackLog row was being written with curatedBy=0 and rendering as "Unknown"
// in the curation History. It is stamped server-side from the JWT by the route and is
// never taken from the client.
export async function updateGoldStandard(req: NextApiRequest, curatedBy: number = 0)  {

    const {
        query: { goldStandardUpdateFlag }
      } = req;

    const curatedByParam = Number.isInteger(curatedBy) && curatedBy > 0 ? `&curatedBy=${curatedBy}` : ''

   return fetch(`${reciterConfig.reciter.reciterUpdateGoldStandardEndpoint}?goldStandardUpdateFlag=${goldStandardUpdateFlag}${curatedByParam}`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'api-key': reciterConfig.reciter.adminApiKey,
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
                statusCode: error.status || 500,
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
    req.body = userFeedback
}