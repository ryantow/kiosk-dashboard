import { getPool } from "./client";

export type EventType =
  | "session_start"
  | "session_complete"
  | "session_abandon"
  | "session_restart_click"
  | "download_app_click"
  | "find_location_click";

type InsertArgs = {
  session_id: string;
  kiosk_id: string;
  timestamp?: string | null;   // ISO string (UTC)
  duration_ms?: number | null; // 0 for start; >0 for updates
  event_type: EventType;
};

export async function insertSessionEvent(args: InsertArgs) {
  const pool = getPool(); // <-- use lazy getter

  const {
    session_id,
    kiosk_id,
    timestamp = null,
    duration_ms = null,
    event_type,
  } = args;

  // Ensure table (ok to keep in early iterations)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_events (
      id             bigserial PRIMARY KEY,
      session_id     text NOT NULL,
      kiosk_id       text NOT NULL,
      event_type     text NOT NULL,
      timestamp_utc  timestamptz NULL,
      duration_ms    integer NULL,
      created_at     timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS session_events_session_id_idx ON session_events (session_id);
    CREATE INDEX IF NOT EXISTS session_events_event_type_idx ON session_events (event_type);
  `);

  await pool.query(
    `INSERT INTO session_events
       (session_id, kiosk_id, event_type, timestamp_utc, duration_ms)
     VALUES ($1, $2, $3, CAST($4 AS timestamptz), $5)`,
    [session_id, kiosk_id, event_type, timestamp, duration_ms]
  );
}