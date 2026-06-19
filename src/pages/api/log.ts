import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { code, message, context } = req.body || {};
  if (!code) return res.status(400).json({ error: "Missing error code" });
  console.error(`[CLIENT:${code}]`, message || "", context || "");
  res.status(204).end();
}
