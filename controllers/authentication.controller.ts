
import httpBuildQuery from 'http-build-query'
import jwt from 'jsonwebtoken'
import { reciterConfig } from '../config/local'
import { Request, Response } from 'express'

export type Credential = {
    username: string,
    password: string
}

export async function authenticate(credential: Credential){
    const hour: number = 3600000 * 8; // 8 hours
    const expires: Date = new Date(Date.now() + hour);
    let cookie = {
        name: 'reciter-pub-manager-session',
        accessToken: '',
        username: '',
        path: '/',
        expires: expires,
        maxAge: hour,
        secure: true, 
    }
    if(credential === undefined) {
        return {
            statusCode: 401,
            statusMessage: "Credentials is incorrect"
        }
    } else {
        return fetch(`${reciterConfig.reciter.reciterPubManagerAuthenticationEndpoint}?${httpBuildQuery(credential)}`,
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
                            username: credential.username
                        }
                    const token = jwt.sign(payload, reciterConfig.tokenSecret, { algorithm: 'HS256', expiresIn: '1 day' });
                    return {
                        statusMessage: {
                            ...cookie,
                            accessToken: token,
                            username: credential.username
                        },
                        statusCode: 200
                    }
                } else {
                    return {
                        statusCode: 401,
                        statusMessage: "Credentials for user: " + credential.username + " is incorrect"
                    }
                }
            })
            .catch((error) => {
                console.log('ReCiter Authenticate api is not reachable: ' + error)
                return error
            });
    }
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