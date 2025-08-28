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
  const url = `${base}/metrics/by-kiosk${qs ? `?${qs}` : ""}`;

  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const text = await r.text();
    if (!r.ok) {
      res.status(r.status).json({ error: "Upstream error", status: r.status, body: text });
      return;
    }
    res.status(200).send(text); // JSON passthrough
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: "fetch failed", message, url });
  }
}