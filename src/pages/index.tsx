import Head from "next/head";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useMemo } from "react";

type Kiosk = { kiosk_id: string; kiosk_name: string };
type Row = {
  kiosk_id: string;
  started: number;
  completed: number;
  abandoned: number;
  restart_clicks: number;
  avg_ms: number | null;
};

type Props =
  | { kiosks: Kiosk[]; rows: Row[]; error?: undefined }
  | { kiosks: []; rows: []; error: { msg: string; kiosksStatus?: number; metricsStatus?: number; detail?: string } };

// ---- Server-side: fetch DIRECTLY from Railway (bypass /api proxies) ----
export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const BASE = (process.env.API_BASE_URL || "").trim(); // e.g. https://kiosk-api-xxxxx.up.railway.app
  const KEY = (process.env.API_KEY || "").trim();

  if (!BASE || !KEY) {
    return {
      props: {
        kiosks: [],
        rows: [],
        error: { msg: "Missing API envs on the server", detail: `API_BASE_URL:${!!BASE} API_KEY:${!!KEY}` },
      },
    };
  }

  try {
    const [kiosksRes, metricsRes] = await Promise.all([
      fetch(`${BASE}/kiosks`, { headers: { Authorization: `Bearer ${KEY}` } }),
      fetch(`${BASE}/metrics/by-kiosk`, { headers: { Authorization: `Bearer ${KEY}` } }),
    ]);

    if (!kiosksRes.ok || !metricsRes.ok) {
      return {
        props: {
          kiosks: [],
          rows: [],
          error: { msg: "Railway API failed", kiosksStatus: kiosksRes.status, metricsStatus: metricsRes.status },
        },
      };
    }

    const kiosks: Kiosk[] = await kiosksRes.json();
    const rows: Row[] = await metricsRes.json();
    return { props: { kiosks, rows } };
  } catch (e) {
    return {
      props: {
        kiosks: [],
        rows: [],
        error: { msg: e instanceof Error ? e.message : String(e) },
      },
    };
  }
};

export default function Dashboard(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  // Error panel (prevents 500 white-screen)
  if ("error" in props && props.error) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-3xl p-6">
          <h1 className="text-xl font-semibold mb-3">Dashboard Error</h1>
          <pre className="whitespace-pre-wrap rounded border bg-white p-3 text-sm">
            {JSON.stringify(props.error, null, 2)}
          </pre>
          <p className="mt-4 text-sm">
            Check your Railway API and Vercel env vars (<code>API_BASE_URL</code>, <code>API_KEY</code>). This page now
            fetches Railway directly on the server.
          </p>
        </div>
      </main>
    );
  }

  const { kiosks, rows } = props;

  // Map kiosk_id -> friendly name
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of kiosks) m.set(k.kiosk_id, k.kiosk_name);
    return m;
  }, [kiosks]);

  // Totals
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.started += r.started || 0;
          acc.completed += r.completed || 0;
          acc.abandoned += r.abandoned || 0;
          acc.restart_clicks += r.restart_clicks || 0;
          return acc;
        },
        { started: 0, completed: 0, abandoned: 0, restart_clicks: 0 }
      ),
    [rows]
  );

  const overallRestartRate = totals.completed ? totals.restart_clicks / totals.completed : 0;

  return (
    <>
      <Head>
        <title>Kiosk Metrics Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <header className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Kiosk Metrics</h1>
            <div className="flex items-center gap-2">
              {/* CSV still goes through your Next proxy (works great for download) */}
              <button
                onClick={() => (window.location.href = "/api/csv")}
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100"
                aria-label="Export CSV"
              >
                Export CSV
              </button>
            </div>
          </header>

          <section className="overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-2">Kiosk</th>
                  <th className="p-2 text-right">Started</th>
                  <th className="p-2 text-right">Completed</th>
                  <th className="p-2 text-right">Abandoned</th>
                  <th className="p-2 text-right">Restart Clicks</th>
                  <th className="p-2 text-right">Restart Rate</th>
                  <th className="p-2 text-right">Avg Sec</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const avgSec = r.avg_ms !== null ? r.avg_ms / 1000 : null;
                  const restartRate = r.completed ? r.restart_clicks / r.completed : 0;
                  const label = nameById.get(r.kiosk_id) ?? r.kiosk_id;
                  return (
                    <tr key={r.kiosk_id} className="border-t">
                      <td className="p-2">{label}</td>
                      <td className="p-2 text-right tabular-nums">{r.started}</td>
                      <td className="p-2 text-right tabular-nums">{r.completed}</td>
                      <td className="p-2 text-right tabular-nums">{r.abandoned}</td>
                      <td className="p-2 text-right tabular-nums">{r.restart_clicks}</td>
                      <td className="p-2 text-right tabular-nums">{(restartRate * 100).toFixed(1)}%</td>
                      <td className="p-2 text-right tabular-nums">{avgSec !== null ? avgSec.toFixed(1) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50 font-semibold">
                  <td className="p-2">Totals</td>
                  <td className="p-2 text-right tabular-nums">{totals.started}</td>
                  <td className="p-2 text-right tabular-nums">{totals.completed}</td>
                  <td className="p-2 text-right tabular-nums">{totals.abandoned}</td>
                  <td className="p-2 text-right tabular-nums">{totals.restart_clicks}</td>
                  <td className="p-2 text-right tabular-nums">{(overallRestartRate * 100).toFixed(1)}%</td>
                  <td className="p-2 text-right">—</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <p className="mt-3 text-xs text-gray-500">
            Showing {rows.length} kiosks. Restart Rate = Restart Clicks ÷ Completed.
          </p>
        </div>
      </main>
    </>
  );
}