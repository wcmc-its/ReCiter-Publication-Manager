import { NextApiRequest } from 'next';
import { reciterConfig } from '../config/local'

export async function deleteUserFeedback(uid: string | string[])  {
    
   return fetch(`${reciterConfig.reciter.reciterUserFeedbackEndpoints.deleteUserFeedback}` +'?uid=' + uid, {
        method: "GET",
        headers: {
            'api-key': reciterConfig.reciter.adminApiKey,
            'User-Agent': 'reciter-pub-manager-server'
        },
    })
        .then(async (res) => {
            let responseText = await res.text()
            return {
                statusCode: res.status,
                statusText: responseText
            }
        })
        .catch((error) => {
            console.log('ReCiter Delete User Feedback api is not reachable: ' + error)
            return {
                statusCode: error.status,
                statusText: error
            }
        });
}

export async function findUserFeedback(uid: string | string[])  {
    
    return fetch(`${reciterConfig.reciter.reciterUserFeedbackEndpoints.findUserFeedback}` +'?uid=' + uid, {
         method: "GET",
         headers: {
             'api-key': reciterConfig.reciter.adminApiKey,
             'User-Agent': 'reciter-pub-manager-server'
         },
     })
         .then(async (res) => {
            let responseText = await res.text()
             if(res.status !== 200) {
                 return {
                    statusCode: res.status,
                    statusText: responseText
                }
             } else  {
                let data: any = JSON.parse(responseText)
                return {
                    statusCode: res.status,
                    statusText: data
                }
             }
         })
         .catch((error) => {
             console.log('ReCiter Find User Feedback api is not reachable: ' + error)
             return {
                statusCode: error.status,
                statusText: error
            }
         });
 }

 export async function saveUserFeedback(req: NextApiRequest, uid: string | string[])  {
    
    return fetch(`${reciterConfig.reciter.reciterUserFeedbackEndpoints.saveUserFeedback}` +'?uid=' + uid, {
         method: "POST",
         headers: {
             'api-key': reciterConfig.reciter.adminApiKey,
             'User-Agent': 'reciter-pub-manager-server',
             'Content-Type': 'application/json',
             'Content-Length' : req.body.length
         },
         body: JSON.stringify(req.body)
     })
         .then(async (res) => {
            let data: any = await res.json()
            console.log('Save user feedback is successful for ' + uid + ' with data' + JSON.stringify(data))
            return {
                statusCode: res.status,
                statusText: data
            }
         })
         .catch((error) => {
             console.log('ReCiter Save User Feedback api is not reachable: ' + error)
             return {
                statusCode: error.status,
                statusText: error
            }
         });
 }