import type { NextApiRequest, NextApiResponse } from "next";
import { insertSessionEvent } from "../../../lib/db/analytics";

type UpdateEventType = "session_complete" | "session_abandon" | "session_restart_click";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { session_id, kiosk_id, timestamp, duration_ms, event_type } = req.body || {};
    if (!session_id || !kiosk_id || !event_type) {
      return res.status(400).json({ error: "missing fields: session_id, kiosk_id, event_type" });
    }

    if (!["session_complete", "session_abandon", "session_restart_click"].includes(event_type)) {
      return res.status(400).json({ error: "invalid event_type" });
    }

    await insertSessionEvent({
      session_id,
      kiosk_id,
      timestamp,
      duration_ms: Number(duration_ms) ?? 0,
      event_type: event_type as UpdateEventType,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("session update error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
}