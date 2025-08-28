import type { NextApiRequest, NextApiResponse } from "next";
import { getPool } from "../../../lib/db/client";
import type { QueryResult } from "pg";

type EventRow = {
  id: number;
  session_id: string;
  kiosk_id: string;
  event_type: string;
  timestamp_utc: string | null;
  duration_ms: number | null;
  created_at: string; // ISO from PG
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const pool = getPool();

    const kioskIdParam =
      typeof req.query.kiosk_id === "string"
        ? req.query.kiosk_id
        : Array.isArray(req.query.kiosk_id)
        ? req.query.kiosk_id[0]
        : undefined;

    const params: string[] = [];
    let where = "";
    if (kioskIdParam) {
      where = "WHERE kiosk_id = $1";
      params.push(kioskIdParam);
    }

    const result: QueryResult<EventRow> = await pool.query(
      `
      SELECT id, session_id, kiosk_id, event_type, timestamp_utc, duration_ms, created_at
      FROM session_events
      ${where}
      ORDER BY id DESC
      LIMIT 20
      `,
      params
    );

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ count: result.rowCount, rows: result.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "debug_error";
    res.status(500).json({ error: message });
  }
}