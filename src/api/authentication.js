const request = require('request')
var httpBuildQuery = require('http-build-query')
var jwt = require('jsonwebtoken')
const tokenSecret = require('../../config/local').config.tokenSecret
const adminApiKey = require('../../config/local').config.reciter.adminApiKey
const authenticationEndpoint = require('../../config/local').config.reciter.reciterPubManagerAuthenticationEndpoint



const authenticate = (req, cb) => {
    var hour = 3600000 * 8; // 8 hours
    var expires = new Date(Date.now() + hour);
    let cookie = {
        name: 'reciter-pub-manager-session',
        sid: req.session.id,
        path: '/',
        expires: expires,
        maxAge: hour,
        secure: true, /** TODO: REMEMBER TO ENABLE BEFORE DEPLOYMENT */
    }

    req.session.cookie = cookie
    const credentials = {
        username: req.body.username,
        password: req.body.password
    }
    return request({
        uri: `${authenticationEndpoint}?${httpBuildQuery(credentials)}`,
        headers: {
            'api-key': adminApiKey,
            'Content-type': 'application/json',
            'User-Agent': 'reciter-pub-manager-server'
        },
        method: 'POST'
    }, (error, res, body) => {
        if (error) {
            const apiError = 'ReCiter Publication Manager authenticate api is not reachable'
            return cb(apiError, null)
        }
        console.log(body)
        if (body !== undefined) {
            const payload = {
                username: req.body.username
            }
            return jwt.sign(payload, tokenSecret, { algorithm: 'HS256', expiresIn: '1 day' }, function (err, token) {
                if (err) return cb('Failed to generate jwt token for user using tokenSecret', null)
                cookie['accessToken'] = token
                return cb(null, cookie)
            })     
        } else {
            return cb('User credentials is wrong', null)
        }
    })
}
const withAuth = function (req, res) {
    if(!req.cookies || !req.cookies['reciter-session'])
    {
        return res.send({
            success: false,
            message: 'There is no access token'
        })
    }
    const token = req.cookies['reciter-session']['accessToken']
    if (!token) {
        return res.send({
            success: false,
            message: 'There is no access token'
        })
    } else {
        return jwt.verify(token, tokenSecret, function (err, decoded) {
            if (err) {
                return res.send({
                    success: false,
                    message: 'The token is not valid'
                })
            } else {
                return res.send({
                    success: true,
                    username: decoded.username
                })
            }
        });
    }
}

module.exports.authenticate = authenticate
module.exports.withAuth = withAuth