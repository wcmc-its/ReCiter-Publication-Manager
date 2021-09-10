const request = require('request')
var httpBuildQuery = require('http-build-query')
const updateGoldStandardEndpoint = require('../../config/local').config.reciter.reciterUpdateGoldStandardEndpoint
const adminApiKey = require('../../config/local').config.reciter.adminApiKey
const userFeedbackApi = require('../api/userFeedback')
var url = require('url')

const updateGoldStandard = (req, cb) => {
    const goldStandard = req.body
    return request({
        uri: `${updateGoldStandardEndpoint}` + '?' + httpBuildQuery(req.query),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': adminApiKey,
            'Content-Length': req.body.length,
            'User-Agent': 'reciter-pub-manager-server'

        },
        body: JSON.stringify(req.body)
    }, (error, res, body) => {
        if (error) {
            return cb(error, null)
        }
        if (body !== undefined) {
            callUserFeedbackApi(goldStandard, req)
            return cb(null, JSON.parse(body))
        }
    })
}

function callUserFeedbackApi(goldStandard, req) {
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
    console.log(fullUrl(req))
    request({
        uri: fullUrl(req),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': userFeedback.length,
            'User-Agent': 'reciter-pub-manager-server'

        },
        body: JSON.stringify(userFeedback)
    }, (error, res, body) => {
        if (error) {
            console.log(error)
        }
        if (body !== undefined) {
            console.log(body)
        }
    })
}

function fullUrl(req) {
    return url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: '/api/reciter/save/userfeedback'
    });
}

module.exports.updateGoldStandard = updateGoldStandard
module.exports.fullUrl = fullUrl