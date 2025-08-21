import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const base = process.env.API_BASE_URL;
    const key  = process.env.API_KEY;
    if (!base || !key) {
      res.status(500).json({ error: "Proxy misconfigured", base: !!base, key: !!key });
      return;
    }

    const qs  = new URLSearchParams(req.query as any).toString();
    const url = `${base}/metrics/by-kiosk.csv${qs ? `?${qs}` : ""}`;

    const r   = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const txt = await r.text();

    if (!r.ok) {
      // Do NOT set CSV headers on errors; just pass through as text.
      res.status(r.status).setHeader("Content-Type", "text/plain; charset=utf-8").send(txt);
      return;
    }

    // Success: set all headers AFTER we know it's OK, then send once.
    const disp = r.headers.get("content-disposition") ?? 'attachment; filename="metrics_by_kiosk.csv"';
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", disp);
    res.status(200).send(txt);
  } catch (e: any) {
    res.status(500).json({ error: "CSV proxy failed", message: String(e?.message || e) });
  }
}