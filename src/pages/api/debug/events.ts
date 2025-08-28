import type { NextApiRequest, NextApiResponse } from "next";
import { getPool } from "../../../lib/db/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const pool = getPool();
    const { kiosk_id } = req.query;
    const params: any[] = [];
    let where = "";
    if (kiosk_id) { where = "WHERE kiosk_id = $1"; params.push(String(kiosk_id)); }

    const r = await pool.query(
      `
      SELECT id, session_id, kiosk_id, event_type, timestamp_utc, duration_ms, created_at
      FROM session_events
      ${where}
      ORDER BY id DESC
      LIMIT 20
      `,
      params
    );
    res.setHeader("Cache-Control", "no-store"); // don't cache in Vercel/CDN
    res.status(200).json({ count: r.rowCount, rows: r.rows });
  } catch (e:any) {
    res.status(500).json({ error: e?.message || "debug_error" });
  }
}