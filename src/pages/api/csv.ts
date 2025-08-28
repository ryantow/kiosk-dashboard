import type { NextApiRequest, NextApiResponse } from "next";

function toQueryString(q: NextApiRequest["query"]): string {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (Array.isArray(v)) flat[k] = v[0] ?? "";
    else if (v !== undefined) flat[k] = String(v);
  }
  return new URLSearchParams(flat).toString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const base = (process.env.API_BASE_URL || "").trim();
  const key  = (process.env.API_KEY || "").trim();
  if (!base || !key) {
    res.status(500).json({ error: "Proxy misconfigured", base: !!base, key: !!key });
    return;
  }

  const qs = toQueryString(req.query);
  const url = `${base}/metrics/by-kiosk.csv${qs ? `?${qs}` : ""}`;

  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const body = await r.text();

    if (!r.ok) {
      res.status(r.status).setHeader("Content-Type", "text/plain; charset=utf-8").send(body);
      return;
    }

    const disp = r.headers.get("content-disposition") ?? 'attachment; filename="metrics_by_kiosk.csv"';
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", disp);
    res.status(200).send(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: "CSV proxy failed", message, url });
  }
}