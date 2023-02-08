import { reciterConfig } from '../config/local'
import models from '../src/db/sequelize';

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
                data['identityImageEndpoint'] = identityImage;
                let personInfo = await models.AnalysisSummaryPerson.findOne({ where: { personIdentifier: data.uid} });
                data['h5indexNIH'] = personInfo?.h5indexNIH || "";
                data['hindexNIH'] = personInfo?.hindexNIH || "";
                data['hindexScopus'] = personInfo?.hindexScopus || "";
                data['h5indexScopus'] = personInfo?.h5indexScopus || "";
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

export async function getAllIdentity()  {
    
    return fetch(`${reciterConfig.reciter.reciterIdentityEndpoints.getAllIdentity}`, {
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
                 data.forEach((identity: any) => {
                    if(reciterConfig.reciter.reciterIdentityEndpoints.identityImageEndpoint !== undefined && reciterConfig.reciter.reciterIdentityEndpoints.identityImageEndpoint.length > 0) {
                        if(reciterConfig.reciter.reciterIdentityEndpoints.identityImageEndpoint.includes('${uid}')) {
                            identityImage = reciterConfig.reciter.reciterIdentityEndpoints.identityImageEndpoint.replace('${uid}', String(identity.uid))
                        } else {
                            identityImage = reciterConfig.reciter.reciterIdentityEndpoints.identityImageEndpoint
                        }
                    }
                    identity['identityImageEndpoint'] = identityImage
                 })
                 
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