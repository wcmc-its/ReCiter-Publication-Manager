// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { deleteUserFeedback } from "../../../../../controllers/userfeedback.controller";

type Data = {
    statusCode: number,
    message: any
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
    if(req.method === "GET") {
        const { uid } = req.query;

        const apiResponse = await deleteUserFeedback(uid);
        res.status(200).send({
            statusCode: 200,
            message: apiResponse
        })
    } else {
        res.status(400).send({
            statusCode: 400,
            message: "HTTP Method supported is GET"
        })
    }
}
