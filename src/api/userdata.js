const request = require('request')
const adminApiKey = require('../../config/local').config.reciter.adminApiKey
const identityEndpoint = require('../../config/local').config.reciter.reciterIdentityEndpoints.identityByUid
const identityAllEndpoint =  require('../../config/local').config.reciter.reciterIdentityEndpoints.getAllIdentity
const identityImageEndpoint = require('../../config/local').config.reciter.reciterIdentityEndpoints.identityImageEndpoint

const getIdentity = (uid, cb) => {
    let identityImage = ''
    if(identityImageEndpoint !== undefined && identityImageEndpoint.length > 0) {
        if(identityImageEndpoint.includes('${uid}')) {
            identityImage = identityImageEndpoint.replace('${uid}', uid)
        }  else {
            identityImage = identityImageEndpoint
        }
    }
    return request({
        headers: {
            'api-key': adminApiKey
        },
        uri: `${identityEndpoint}?uid=${uid}`,
        method: 'GET'
    }, function (error, response, body) {
        if (error) {
            return cb(error, null)
        }
        let data = JSON.parse(body)
        data['identityImageEndpoint'] = identityImage
        //const knownRelationships = data.knownRelationships.filter(relationship => relationship.type === 'CO_INVESTIGATOR')
        return cb(null, data)
        

    }); 

}

const getAllIdentity = (cb) => {
    return request({
        headers: {
            'api-key': adminApiKey
        },
        uri: `${identityAllEndpoint}`,
        method: 'GET'
    }, function (error, response, body) {
        if (error) {
            return cb(error, null)
        }
        if(response.statusCode != 200) {
            console.log('ReCiter IdentityAll api is not reachable')
            const apiError = 'ReCiter IdentityAll api is not reachable'
            return (apiError, null)
        }
        if(response.statusCode == 200) {
            let data = JSON.parse(body)
            data.forEach(identity => {
                let identityImage = ''
                if(identityImageEndpoint !== undefined && identityImageEndpoint.length > 0) {
                    if(identityImageEndpoint.includes('${uid}')) {
                        identityImage = identityImageEndpoint.replace('${uid}', identity.uid)
                    }  else {
                        identityImage = identityImageEndpoint
                    }
                }
                identity['identityImageEndpoint'] = identityImage
            })
            //const knownRelationships = data.knownRelationships.filter(relationship => relationship.type === 'CO_INVESTIGATOR')
            return cb(null, data)
        }
        

    }); 

}


function formatIdentity(data) {
    console.log(data)
    var reciterIdentity = {}
    if (data.hasOwnProperty('primaryName')) {
        const primaryName = data.primaryName

        reciterIdentity.primaryName = ((primaryName.firstName !== null) ? primaryName.firstName + ' ' : '') +
            ((primaryName.middleName !== null) ? primaryName.middleName + ' ' : '') +
            ((primaryName.lastName !== null) ? primaryName.lastName : '')
    }
    reciterIdentity.title = ((data.title !==null)? '<span>' + data.title + '</span>':'')

    if(data.hasOwnProperty('institutions')) {
        reciterIdentity.institutions = []
        data.institutions.forEach(institution => {
            reciterIdentity.institutions.push('<b>' + institution + '</b>')
        })
    }
    return reciterIdentity
}

  
function requestWithRetry (uid, cb) {
    const MAX_RETRIES = 5
    let dataRetrieved = false
    let retryCount = 0
    const retryInterval = setInterval(() => {
        if(retryCount < MAX_RETRIES && !dataRetrieved) {
            return getIdentity(uid, (err, results) => {
                if(err) return dataRetrieved = false
                dataRetrieved = true
                cb(null, results)
                return clearInterval(retryInterval)
            })
        }
        if(retryCount >= MAX_RETRIES && !dataRetrieved) {
            cb({
                message: 'failure'
            }, null)
            return clearInterval(retryInterval)
        }
        if(dataRetrieved)
        {
            clearInterval(retryInterval)
        }
    },500)
}

module.exports.getIdentity = getIdentity
module.exports.getAllIdentity = getAllIdentity
module.exports.requestWithRetry = requestWithRetry