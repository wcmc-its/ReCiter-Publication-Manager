var express = require('express');
const app = express()
const session = require('cookie-session')//require('express-session')
const authenticate = require('../src/api/authentication')
const cookieParser = require('cookie-parser')

app.use(cookieParser())
app.use(session({
    secret: 'keyboard cat', 
    key: 'reciter-pub-manager-session',
    resave: false, 
    saveUninitialized: false
}))

app.post('/reciter/authentication', (req, res) => {
  return authenticate.authenticate(req, (err, data) => {
        if(err)
        {
            return res.send({
                success: false,
                errCode: "FAILED_TO_AUTHENTICATE",
                message: "The system failed to authenticate user."
            })
        }
        return res.cookie('reciter-session', req.session.cookie, { maxAge : req.session.cookie.maxAge } ).send({
            success: true,
            data: {
                "username": req.body.username,
                "accessToken": data.accessToken
            }
        })
  })
})

app.post('/reciter/validate', (req, res) => authenticate.withAuth(req, res))


module.exports = app

