import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
});

function normalizeId(id: string) {
  return (id || "").replace(/-/g, "").toUpperCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const { session_id } = req.body || {};
    const sid = normalizeId(session_id);
    if (!sid) return res.status(400).json({ error: "session_id required" });

    const sql = `
      UPDATE sessions
         SET restart_clicks = COALESCE(restart_clicks, 0) + 1,
             updated_at = NOW()
       WHERE REPLACE(UPPER(session_id::text), '-', '') = $1
       RETURNING session_id, restart_clicks;
    `;
    const { rows, rowCount } = await pool.query(sql, [sid]);
    if (rowCount === 0) return res.status(404).json({ error: "session not found" });

    res.status(200).json({ ok: true, session_id: rows[0].session_id, restart_clicks: rows[0].restart_clicks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
}