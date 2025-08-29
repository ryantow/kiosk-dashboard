import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
});

function normalizeId(id: string) {
  return id?.replace(/-/g, "").toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json();
    const sid = normalizeId(session_id || "");
    if (!sid) return NextResponse.json({ error: "session_id required" }, { status: 400 });

    const sql = `
      UPDATE sessions
         SET restart_clicks = COALESCE(restart_clicks, 0) + 1,
             updated_at = NOW()
       WHERE REPLACE(UPPER(session_id), '-', '') = $1
       RETURNING session_id, restart_clicks;
    `;
    const client = await pool.connect();
    try {
      const { rows, rowCount } = await client.query(sql, [sid]);
      if (rowCount === 0) return NextResponse.json({ error: "session not found" }, { status: 404 });
      return NextResponse.json({ ok: true, session_id: rows[0].session_id, restart_clicks: rows[0].restart_clicks });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}