import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const sloUrl = process.env.SSO_LOGOUT_URL;
  if (sloUrl) {
    res.redirect(302, sloUrl);
  } else {
    res.redirect(302, '/login');
  }
}
