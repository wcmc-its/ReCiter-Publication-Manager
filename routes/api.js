var express = require('express')
var router = express.Router()
const userData = require('../src/api/userdata')
const reciterPublication = require('../src/api/reciterPublication')
const reciterPubmed = require('../src/api/searchPubmed')
const reciterUpdateGoldStandard = require('../src/api/reciterUpdateGoldStandard')
const userFeedback = require('../src/api/userFeedback')
const identityImageEndpoint = require('../config/local').config.reciter.reciterIdentityEndpoints.identityImageEndpoint

router.get('/reciter/getidentity/:uid', function (req, res) {
    return userData.getIdentity(req.params.uid, (err, data) => {
        if (err) {
            res.status(err.status)
            return res.send({
                error: err,
                message: 'failure'
            })
        }
        return res.send({
            identity: data,
            message: 'success'
        })
    })
})

router.get('/reciter/getAllIdentity', function (req, res) {
    return userData.getAllIdentity((err, data) => {
        if (err) {
            err = JSON.parse(err)
            res.status(err.status)
            return res.send({
                error: err,
                message: 'failure'
            })
        }
        return res.send({
            identity: data,
            message: 'success'
        })
    })
})

router.get('/reciter/feature-generator/:uid', function (req, res) {
    return reciterPublication.getPublications(req, (err, data) => {
        if (err) {
            res.status(err.status)
            return res.send({
                error: err,
                message: 'failure'
            })
        }
        return res.send({
            reciter: data.reciterData,
            reciterPending: data.reciterPendingData,
            message: 'success'
        })
    })
})

// router.get('/reciter/authentication', function (req, res) {
//     return authenticate.authenticate(req, (err, data) => {
//         if (err) {
//             return res.send({
//                 error: err,
//                 message: 'failure'
//             })
//         }
//         return res.send({
//             message: data
//         })
        
//     })
// })

router.post('/reciter/search/pubmed', function (req, res) {
    return reciterPubmed.searchPubmed(req, (err, data) => {
        if (err) {
            res.status(err.status)
            return res.send({
                error: err,
                message: 'failure'
            })
        }
        let resultMode = ''
        if (data !== undefined && Array.isArray(data)) {
            if (data.length >= 200) {
                resultMode = 'LARGE_RESULTS'
            } else {
                resultMode = 'VALID_RESULTS'
            }
            if (data.length == 0) {
                resultMode = 'EMPTY'
            }
        }
        return res.send({
            reciter: data,
            resultMode: resultMode
        })
    })
})

router.post('/reciter/update/goldstandard', function (req, res) {
    return reciterUpdateGoldStandard.updateGoldStandard(req, (err, data) => {
        if (err) {
            res.status(err.status)
            return res.send({
                error: err,
                message: 'failure'
            })
        }
        if (data !== undefined ) {
            return res.send({
                goldStandard: data,
                message: 'success'
            }) 
        }
    })
})

router.post('/reciter/save/userfeedback', function (req, res) {
    return userFeedback.addUserFeedback(req, (err, data) => {
        if (err) {
            res.status(err.status)
            return res.send({
                error: err,
                message: 'failure'
            })
        }
        if (data !== undefined ) {
            return res.send({
                userFeedback: data,
                message: 'success'
            }) 
        }
    })
})

router.get('/reciter/find/userfeedback/:uid', function (req, res) {
    return userFeedback.getUserFeedback(req.params.uid, (err, data) => {
        if (err) {
            res.status(err.status)
            return res.send({
                error: err,
                message: 'failure'
            })
        }
        if (data !== undefined ) {
            return res.send({
                userFeedback: data,
                message: 'success'
            }) 
        }
    })
})

router.get('/reciter/delete/userfeedback/:uid', function (req, res) {
    return userFeedback.deleteUserFeedback(req.params.uid, (err, data) => {
        if (err) {
            res.status(err.status)
            return res.send({
                error: err,
                message: 'failure'
            })
        }
        if (data !== undefined ) {
            return res.send({
                userFeedback: data,
                message: 'success'
            }) 
        }
    })
})


module.exports = router