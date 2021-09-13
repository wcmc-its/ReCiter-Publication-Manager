const request = require('request')
var httpBuildQuery = require('http-build-query') 
const userFeedbackEndpoint = require('../../config/local').config.reciter.reciterUserFeedbackEndpoints
const adminApiKey = require('../../config/local').config.reciter.adminApiKey

const addUserFeedback = (req, cb) => {
    return request({
        uri: `${userFeedbackEndpoint.saveUserFeedback}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': adminApiKey,
            'Content-Length' : req.body.length,
            'User-Agent': 'reciter-pub-manager-server'

        },
        body: JSON.stringify(req.body)
    }, (error, res, body) => {
        if(error) {
            return cb(error, null)
        }
        if(res.statusCode != 200) {
            console.log('ReCiter Add User Feedback api is not reachable: ' + body)
            const apiError = {
                status: res.statusCode,
                error: body
            }
            return cb(apiError, null)
        }
        if(res.statusCode == 200 && body !== undefined) {
            return cb(null, JSON.parse(body))
        }
    })
}

const deleteUserFeedback = (uid, cb) => {
    return request({
        uri: `${userFeedbackEndpoint.deleteUserFeedback}` +'?uid=' + uid,
        method: 'GET',
        headers: {
            'api-key': adminApiKey,
            'User-Agent': 'reciter-pub-manager-server'
        }
    }, (error, res, body) => {
        if(error) {
            return cb(error, null)
        }
        if(res.statusCode != 200) {
            console.log('ReCiter Delete User Feedback api is not reachable: ' + body)
            const apiError = {
                status: res.statusCode,
                error: body
            }
            return cb(apiError, null)
        }
        if(res.statusCode == 200 && body !== undefined) {
            return cb(null, body)
        }
    })
}

const getUserFeedback = (uid, cb) => {
    return request({
        uri: `${userFeedbackEndpoint.findUserFeedback}` +'?uid=' + uid,
        method: 'GET',
        headers: {
            'api-key': adminApiKey,
            'User-Agent': 'reciter-pub-manager-server'
        }
    }, (error, res, body) => {
        if(error) {
            return cb(error, null)
        }
        if(res.statusCode != 200) {
            console.log('ReCiter Get User Feedback api is not reachable: ' + body)
            const apiError = {
                status: res.statusCode,
                error: body
            }
            return cb(apiError, null)
        }
        if(res.statusCode == 200 && body !== undefined) {
            try{
                const response = JSON.parse(body)
                return cb(null, response)
            }
            catch(e) {
                return cb(null, body) 
            }  
        }
    })
}

module.exports.addUserFeedback = addUserFeedback
module.exports.deleteUserFeedback = deleteUserFeedback
module.exports.getUserFeedback = getUserFeedback