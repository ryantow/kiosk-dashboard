import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const base = process.env.API_BASE_URL!;
  const key  = process.env.API_KEY!;
  const qs   = new URLSearchParams(req.query as any).toString();
  const r = await fetch(`${base}/metrics/by-kiosk?${qs}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  res.status(r.status).json(await r.json());
}