import type { Request, Response } from 'express'
import { authenticate } from '../../../../controllers/authentication.controller'
import { reciterConfig } from '../../../../config/local'

type Data = {
  statusCode: number,
  message: any
}

export default async function handler(
  req: Request,
  res: Response<Data>
) {
      if(req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
          const apiResponse = await authenticate(req);
          res.status(200).send({
              statusCode: 200,
              message: apiResponse
          })
        } else if(req.headers.authorization === undefined) {
          res.status(400).send({
            statusCode: 400,
            message: "Authorization header is needed"
          })
        } else {
          res.status(401).send({
            statusCode: 401,
            message: "Authorization header is incorrect"
          })
        }
    } else {
        res.status(400).send({
            statusCode: 400,
            message: "HTTP Method supported is POST"
    })
  }
}
