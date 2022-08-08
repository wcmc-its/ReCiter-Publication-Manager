// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  success: string,
  DB: string,
  test: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  res.status(200).send({ success: '1', DB: '1', test: `${process.env.RECITER_IDENITY_BY_UID} ${process.env.NEXT_PUBLIC_RECITER_TOKEN_SECRET}`})
}
