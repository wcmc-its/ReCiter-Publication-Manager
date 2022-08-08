// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
    success: string;
    DB: string;
};

export default function handler(
    __req: NextApiRequest,
    res: NextApiResponse<Data>
) {
    res.status(200).send({ success: "1", DB: "1" });
}
