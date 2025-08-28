import type { NextApiRequest, NextApiResponse } from "next";
import { insertSessionEvent } from "@/lib/db/analytics"; // same helper as others

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { session_id, kiosk_id, timestamp } = req.body || {};
    if (!session_id || !kiosk_id) {
      return res.status(400).json({ error: "missing fields: session_id, kiosk_id" });
    }

    await insertSessionEvent({
      session_id,
      kiosk_id,
      timestamp,
      duration_ms: 0,                // always 0 on start
      event_type: "session_start",
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("session start error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
}