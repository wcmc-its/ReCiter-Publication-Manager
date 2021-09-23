
import httpBuildQuery from 'http-build-query'
import jwt from 'jsonwebtoken'
import { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../config/local'



export async function authenticate(req: any){
    const hour: number = 3600000 * 8; // 8 hours
    const expires: Date = new Date(Date.now() + hour);
    let cookie = {
        name: 'reciter-pub-manager-session',
        accessToken: '',
        sid: req.body.username,
        path: '/',
        expires: expires,
        maxAge: hour,
        secure: true, 
    }

    req.cookies = cookie
    const credentials = {
        username: req.body.username,
        password: req.body.password
    }
    return fetch(`${reciterConfig.reciter.reciterPubManagerAuthenticationEndpoint}?${httpBuildQuery(credentials)}`,
        {
            method: "POST",
            headers: {
                'api-key': reciterConfig.reciter.adminApiKey,
                'Content-type': 'application/json',
                'User-Agent': 'reciter-pub-manager-server'
            },
        })
        .then(res=>res.json())
        .then((res) => {
            console.log(res)
            if (res === true) {
                const payload = {
                    username: req.body.username
                }
                jwt.sign(payload, reciterConfig.tokenSecret, { algorithm: 'HS256', expiresIn: '1 day' }, function (err, token: any) {
                    if (err) {
                        return "Failed to generate jwt token for user using tokenSecret"
                    }
                    cookie['accessToken'] = token
                    return cookie
                }) 
                return cookie 
            } else if(res === false){
                console.log("Credentials for user: " + req.body.username + " is incorrect")
                return "Credentials for user: " + req.body.username + " is incorrect"
            } else {
                return res
            }
        })
        .catch((error) => {
            console.log('ReCiter Delete User Feedback api is not reachable: ' + error)
            return error
        });
}

export async function withAuth(req: any, res: any) {
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
        return jwt.verify(token, reciterConfig.tokenSecret, function (err: any, decoded: any) {
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