// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiResponse } from 'next'

type Data = {
  success: string,
  DB: string
}

export default function handler(
  res: NextApiResponse<Data>
) {
  res.status(200).json({ success: '1', DB: '1'})
}
