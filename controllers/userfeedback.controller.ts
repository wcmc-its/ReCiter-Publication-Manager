import { reciterConfig } from '../config/local'

export async function deleteUserFeedback(uid: string | string[])  {
   return fetch(`${reciterConfig.reciter.reciterUserFeedbackEndpoints.deleteUserFeedback}` +'?uid=' + uid, {
        method: "GET",
        headers: {
            'api-key': reciterConfig.reciter.adminApiKey,
            'User-Agent': 'reciter-pub-manager-server'
        },
    })
        //.then((res) => res.json())
        .then((res) => {
            return res.statusText
        })
        .catch((error) => {
            console.log('ReCiter Delete User Feedback api is not reachable: ' + error)
            return {
                status: error.statusCode,
                error: error.body
            }

        });
}