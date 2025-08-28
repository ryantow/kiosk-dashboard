import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const base = (process.env.API_BASE_URL || "").trim();
  const key  = (process.env.API_KEY || "").trim();

  let kiosksStatus: number | null = null;
  let kiosksBody = "";
  let err: string | null = null;

  try {
    const r = await fetch(`${base}/kiosks`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    kiosksStatus = r.status;
    kiosksBody = await r.text();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  res.status(200).json({
    base,
    apiKeyPresent: Boolean(key),
    apiKeyLength: key.length,
    kiosksStatus,
    kiosksBody,
    err,
  });
}