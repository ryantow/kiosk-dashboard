// src/pages/api/session/restart_click.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: "session_id required" });

    const client = await pool.connect();
    try {
      const sql = `
        UPDATE sessions
           SET restart_clicks = COALESCE(restart_clicks, 0) + 1,
               updated_at = NOW()
         WHERE session_id = $1
       RETURNING session_id, restart_clicks;
      `;
      const { rows, rowCount } = await client.query(sql, [session_id]);
      if (rowCount === 0) return res.status(404).json({ error: "session not found" });

      return res.status(200).json({ ok: true, session_id: rows[0].session_id, restart_clicks: rows[0].restart_clicks });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server_error" });
  }
}