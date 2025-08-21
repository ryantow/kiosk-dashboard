import { useEffect, useMemo, useState } from "react";

type MetricsRow = { kiosk_id: string; started: number; completed: number; abandoned: number; avg_ms: number | null; };
type Kiosk = { kiosk_id: string; kiosk_name: string };

export default function Dashboard() {
  const [rows, setRows] = useState<MetricsRow[]>([]);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  useEffect(() => {
    fetch(`/api/kiosks?only_active=true`).then(r => r.json()).then(setKiosks).catch(()=>setKiosks([]));
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams({ ...(from && {date_from: from}), ...(to && {date_to: to}) }).toString();
    fetch(`/api/metrics?${qs}`).then(r => r.json()).then(setRows).catch(()=>setRows([]));
  }, [from, to]);

  const nameFor = (id: string) => kiosks.find(k => k.kiosk_id === id)?.kiosk_name || id;

  const totals = useMemo(() => {
    const started = rows.reduce((s, r) => s + (r.started || 0), 0);
    const completed = rows.reduce((s, r) => s + (r.completed || 0), 0);
    const abandoned = rows.reduce((s, r) => s + (r.abandoned || 0), 0);
    const weightedSum = rows.reduce((s, r) => s + ((r.avg_ms || 0) * (r.started || 0)), 0);
    const avgMs = started ? (weightedSum / started) : 0;
    return { started, completed, abandoned, avgMs };
  }, [rows]);

  const fmtMs = (ms?: number | null) => {
    if (!ms || ms <= 0) return "—";
    const sec = Math.round(ms / 1000);
    const m = Math.floor(sec / 60).toString();
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const csvHref = `/api/csv?${new URLSearchParams({ ...(from && {date_from: from}), ...(to && {date_to: to}) })}`;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Kiosk Sessions</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label>From: <input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
        <label>To: <input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
        <a href={csvHref}><button>Export CSV</button></a>
      </div>

      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%", border: "1px solid #e5e7eb" }}>
        <thead style={{ background: "#f9fafb" }}>
          <tr>
            <th align="left">Kiosk</th>
            <th align="right">Started</th>
            <th align="right">Completed</th>
            <th align="right">Abandoned</th>
            <th align="right">Completion %</th>
            <th align="right">Avg Session</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const pct = r.started ? (r.completed / r.started) : 0;
            return (
              <tr key={r.kiosk_id} style={{ borderTop: "1px solid #eee" }}>
                <td>{nameFor(r.kiosk_id)}</td>
                <td align="right">{r.started}</td>
                <td align="right">{r.completed}</td>
                <td align="right">{r.abandoned}</td>
                <td align="right">{(pct*100).toFixed(1)}%</td>
                <td align="right">{fmtMs(r.avg_ms)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #ddd", fontWeight: 600, background: "#fbfbfb" }}>
            <td>All kiosks</td>
            <td align="right">{totals.started}</td>
            <td align="right">{totals.completed}</td>
            <td align="right">{totals.abandoned}</td>
            <td align="right">{((totals.completed / (totals.started || 1)) * 100).toFixed(1)}%</td>
            <td align="right">{fmtMs(totals.avgMs)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}