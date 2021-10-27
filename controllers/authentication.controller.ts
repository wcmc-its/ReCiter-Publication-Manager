
import httpBuildQuery from 'http-build-query'
import jwt from 'jsonwebtoken'
import { reciterConfig } from '../config/local'
import { Request, Response } from 'express'

export async function authenticate(req: Request){
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
        .then( async (res) => {
            if (res === true) {
                const payload: {
                    username: string
                } = {
                        username: req.body.username
                    }
                const token = jwt.sign(payload, reciterConfig.tokenSecret, { algorithm: 'HS256', expiresIn: '1 day' });
                return {
                    ...cookie,
                    accessToken: token
                }
            } else if(res === false){
                console.log("Credentials for user: " + req.body.username + " is incorrect")
                return "Credentials for user: " + req.body.username + " is incorrect"
            } else {
                return res
            }
        })
        .catch((error) => {
            console.log('ReCiter Authenticate api is not reachable: ' + error)
            return error
        });
}

export async function withAuth(req: Request, res: Response) {
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