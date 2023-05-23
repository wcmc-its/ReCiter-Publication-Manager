import type { Request, Response } from 'express'
import { authenticate } from '../../../../controllers/authentication.controller'
import { reciterConfig } from '../../../../config/local'
import { Credential } from '../../../../controllers/authentication.controller'
import { sendNotification } from '../../../../controllers/sendNotifications.controller'

type Data = {
  statusCode: number,
  message: any
}

export default async function handler(
  req: Request,
  res: Response<Data>,
  credential: Credential
) {
  sendNotification(req);
  // const apiResponse = await sendNotification(req);

  //     if(req.method === "POST") {
  //       if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
  //         const apiResponse = await sendNotification(req);
  //       //   res.status(apiResponse.statusCode).send({
  //       //       statusCode: apiResponse.statusCode,
  //       //       message: apiResponse.statusMessage
  //       //   })

  //       } else if(req.headers.authorization === undefined) {
  //         res.status(400).send({
  //           statusCode: 400,
  //           message: "Authorization header is needed"
  //         })
  //       } else {
  //         res.status(401).send({
  //           statusCode: 401,
  //           message: "Authorization header is incorrect"
  //         })
  //       }
  //   } else {
  //       res.status(400).send({
  //           statusCode: 400,
  //           message: "HTTP Method supported is POST"
  //   })
  // }
}
