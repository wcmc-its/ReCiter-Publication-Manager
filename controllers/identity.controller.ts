import { reciterConfig } from '../config/local'

export async function getIdentity(uid: string | string[])  {
    
   return fetch(`${reciterConfig.reciter.reciterIdentityEndpoints.identityByUid}` +'?uid=' + uid, {
        method: "GET",
        headers: {
            'api-key': reciterConfig.reciter.adminApiKey,
            'User-Agent': 'reciter-pub-manager-server'
        },
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
                let identityImage = ''
                if(reciterConfig.reciter.reciterIdentityEndpoints.identityImageEndpoint !== undefined && reciterConfig.reciter.reciterIdentityEndpoints.identityImageEndpoint.length > 0) {
                    if(reciterConfig.reciter.reciterIdentityEndpoints.identityImageEndpoint.includes('${uid}')) {
                        identityImage = reciterConfig.reciter.reciterIdentityEndpoints.identityImageEndpoint.replace('${uid}', String(uid))
                    } else {
                        identityImage = reciterConfig.reciter.reciterIdentityEndpoints.identityImageEndpoint
                    }
                }
                data['identityImageEndpoint'] = identityImage
                return {
                    statusCode: res.status,
                    statusText: data
                }
            }
        })
        .catch((error) => {
            console.log('ReCiter Identity api is not reachable: ' + error)
            return {
                statusCode: error.status,
                statusText: error
            }
        });
}