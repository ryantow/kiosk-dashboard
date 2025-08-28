import Head from "next/head";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/router";

type Kiosk = { kiosk_id: string; kiosk_name: string };
type Row = {
  kiosk_id: string;
  started: number;
  completed: number;
  abandoned: number;
  restart_clicks: number;
  avg_ms: number | null;
};

type OkProps = {
  kiosks: Kiosk[];
  rows: Row[];
  date_from?: string | null;
  date_to?: string | null;
  error?: undefined;
};
type ErrProps = {
  kiosks: [];
  rows: [];
  date_from?: string | null;
  date_to?: string | null;
  error: { msg: string; kiosksStatus?: number; metricsStatus?: number; detail?: string };
};
type Props = OkProps | ErrProps;

//adds summary table function
function computeTotals(rows: Row[]) {
  return rows.reduce(
    (acc, r) => {
      acc.started += r.started || 0;
      acc.completed += r.completed || 0;
      acc.abandoned += r.abandoned || 0;
      acc.restart_clicks += r.restart_clicks || 0;
      // for weighted avg, weight each kiosk’s avg_ms by its session count (started)
      if (r.avg_ms !== null && r.started > 0) {
        acc.weightedMsSum += r.avg_ms * r.started;
        acc.weightedCount += r.started;
      }
      return acc;
    },
    { started: 0, completed: 0, abandoned: 0, restart_clicks: 0, weightedMsSum: 0, weightedCount: 0 }
  );
}

function fmtPct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

// ---------- SSR: fetch DIRECTLY from Railway ----------
export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
  const BASE = (process.env.API_BASE_URL || "").trim(); // e.g. https://kiosk-api-xxxxx.up.railway.app
  const KEY = (process.env.API_KEY || "").trim();

  const date_from = typeof query.date_from === "string" ? query.date_from : undefined;
  const date_to = typeof query.date_to === "string" ? query.date_to : undefined;

  const qs = new URLSearchParams();
  if (date_from) qs.set("date_from", date_from);
  if (date_to) qs.set("date_to", date_to);
  const q = qs.toString() ? `?${qs.toString()}` : "";

  if (!BASE || !KEY) {
    return {
      props: {
        kiosks: [],
        rows: [],
        date_from: date_from ?? null,
        date_to: date_to ?? null,
        error: { msg: "Missing API envs on the server", detail: `API_BASE_URL:${!!BASE} API_KEY:${!!KEY}` },
      },
    };
  }

  try {
    const [kiosksRes, metricsRes] = await Promise.all([
      fetch(`${BASE}/kiosks`, { headers: { Authorization: `Bearer ${KEY}` } }),
      fetch(`${BASE}/metrics/by-kiosk${q}`, { headers: { Authorization: `Bearer ${KEY}` } }),
    ]);

    if (!kiosksRes.ok || !metricsRes.ok) {
      return {
        props: {
          kiosks: [],
          rows: [],
          date_from: date_from ?? null,
          date_to: date_to ?? null,
          error: { msg: "Railway API failed", kiosksStatus: kiosksRes.status, metricsStatus: metricsRes.status },
        },
      };
    }

    const kiosks: Kiosk[] = await kiosksRes.json();
    const rows: Row[] = await metricsRes.json();
    return { props: { kiosks, rows, date_from: date_from ?? null, date_to: date_to ?? null } };
  } catch (e) {
    return {
      props: {
        kiosks: [],
        rows: [],
        date_from: date_from ?? null,
        date_to: date_to ?? null,
        error: { msg: e instanceof Error ? e.message : String(e) },
      },
    };
  }
};

export default function DashboardPage(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <>
      <Head>
        <title>Kiosk Metrics Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {"error" in props && props.error ? (
        <ErrorPanel error={props.error} date_from={props.date_from} date_to={props.date_to} />
      ) : (
        <MetricsView
          kiosks={(props as OkProps).kiosks}
          rows={(props as OkProps).rows}
          date_from={props.date_from ?? undefined}
          date_to={props.date_to ?? undefined}
        />
      )}
    </>
  );
}

// ---------- Error Panel ----------
function ErrorPanel({
  error,
  date_from,
  date_to,
}: {
  error: ErrProps["error"];
  date_from?: string | null;
  date_to?: string | null;
}) {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Header
          date_from={date_from ?? undefined}
          date_to={date_to ?? undefined}
          onApply={(f, t) => {
            const qs = new URLSearchParams();
            if (f) qs.set("date_from", f);
            if (t) qs.set("date_to", t);
            router.push({ pathname: "/", query: Object.fromEntries(qs.entries()) });
          }}
        />
        <div className="mt-4 rounded-xl border border-red-200 bg-white p-4 shadow-md">
          <h2 className="mb-2 text-lg font-semibold text-red-700">Dashboard Error</h2>
          <pre className="whitespace-pre-wrap rounded border bg-red-50 p-3 text-sm text-red-900">
            {JSON.stringify(error, null, 2)}
          </pre>
          <p className="mt-4 text-sm text-gray-600">
            Check API env vars (<code>API_BASE_URL</code>, <code>API_KEY</code>) or Railway API status.
          </p>
        </div>
      </div>
    </main>
  );
}

// ---------- Metrics View ----------
function MetricsView({
  kiosks,
  rows,
  date_from,
  date_to,
}: {
  kiosks: Kiosk[];
  rows: Row[];
  date_from?: string;
  date_to?: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(date_from ?? "");
  const [to, setTo] = useState(date_to ?? "");

  useEffect(() => setFrom(date_from ?? ""), [date_from]);
  useEffect(() => setTo(date_to ?? ""), [date_to]);

  // map ids to names
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of kiosks) m.set(k.kiosk_id, k.kiosk_name);
    return m;
  }, [kiosks]);

  // totals
  const totals = useMemo(() => computeTotals(rows), [rows]);

const completionRate = totals.started ? totals.completed / totals.started : 0;
const abandonmentRate = totals.started ? totals.abandoned / totals.started : 0;
const restartRate = totals.completed ? totals.restart_clicks / totals.completed : 0;
const weightedAvgSec =
  totals.weightedCount > 0 ? (totals.weightedMsSum / totals.weightedCount) / 1000 : null;
  // csv link with filters
  const csvHref = (() => {
    const qs = new URLSearchParams();
    if (from) qs.set("date_from", from);
    if (to) qs.set("date_to", to);
    return `/api/csv${qs.toString() ? `?${qs.toString()}` : ""}`;
  })();

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        <Header
          date_from={from || undefined}
          date_to={to || undefined}
          onApply={(f, t) => {
            const qs = new URLSearchParams();
            if (f) qs.set("date_from", f);
            if (t) qs.set("date_to", t);
            router.push({ pathname: "/", query: Object.fromEntries(qs.entries()) });
          }}
        >
          <a
            href={csvHref}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Export CSV
          </a>
        </Header>

        {/* Summary Bar */}
<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-xs font-medium text-gray-500">Total Sessions Started</div>
    <div className="mt-1 text-2xl font-semibold tabular-nums">{totals.started}</div>
  </div>

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div className="text-xs font-medium text-gray-500">Completed</div>
      <div className="text-xs text-gray-400">Completion Rate</div>
    </div>
    <div className="mt-1 flex items-end justify-between">
      <div className="text-2xl font-semibold tabular-nums">{totals.completed}</div>
      <div className="text-base font-medium text-gray-700">{fmtPct(completionRate)}</div>
    </div>
  </div>

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div className="text-xs font-medium text-gray-500">Abandoned</div>
      <div className="text-xs text-gray-400">Abandonment Rate</div>
    </div>
    <div className="mt-1 flex items-end justify-between">
      <div className="text-2xl font-semibold tabular-nums">{totals.abandoned}</div>
      <div className="text-base font-medium text-gray-700">{fmtPct(abandonmentRate)}</div>
    </div>
  </div>

  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div className="text-xs font-medium text-gray-500">Restart Clicks</div>
      <div className="text-xs text-gray-400">Restart Rate</div>
    </div>
    <div className="mt-1 flex items-end justify-between">
      <div className="text-2xl font-semibold tabular-nums">{totals.restart_clicks}</div>
      <div className="text-base font-medium text-gray-700">{fmtPct(restartRate)}</div>
    </div>
    <div className="mt-2 text-xs text-gray-500">
      {weightedAvgSec !== null ? `Weighted Avg Sec: ${weightedAvgSec.toFixed(1)}` : "Weighted Avg Sec: —"}
    </div>
  </div>
</div>
        <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-md">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-gray-100 text-gray-700">
              <tr className="uppercase tracking-wide">
                <th className="p-3 text-left">Kiosk</th>
                <th className="p-3 text-right">Started</th>
                <th className="p-3 text-right">Completed</th>
                <th className="p-3 text-right">Abandoned</th>
                <th className="p-3 text-right">Restart Clicks</th>
                <th className="p-3 text-right">Restart Rate</th>
                <th className="p-3 text-right">Avg Sec</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-gray-50">
              {rows.map((r) => {
                const avgSec = r.avg_ms !== null ? r.avg_ms / 1000 : null;
                const restartRate = r.completed ? r.restart_clicks / r.completed : 0;
                const label = nameById.get(r.kiosk_id) ?? r.kiosk_id;
                return (
                  <tr key={r.kiosk_id} className="border-t border-gray-200">
                    <td className="p-3">{label}</td>
                    <td className="p-3 text-right tabular-nums">{r.started}</td>
                    <td className="p-3 text-right tabular-nums">{r.completed}</td>
                    <td className="p-3 text-right tabular-nums">{r.abandoned}</td>
                    <td className="p-3 text-right tabular-nums">{r.restart_clicks}</td>
                    <td className="p-3 text-right tabular-nums">{(restartRate * 100).toFixed(1)}%</td>
                    <td className="p-3 text-right tabular-nums">{avgSec !== null ? avgSec.toFixed(1) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-300 bg-gray-100 font-semibold text-gray-900">
                <td className="p-3">Totals</td>
                <td className="p-3 text-right tabular-nums">{totals.started}</td>
                <td className="p-3 text-right tabular-nums">{totals.completed}</td>
                <td className="p-3 text-right tabular-nums">{totals.abandoned}</td>
                <td className="p-3 text-right tabular-nums">{totals.restart_clicks}</td>
                <td className="p-3 text-right tabular-nums">{(overallRestartRate * 100).toFixed(1)}%</td>
                <td className="p-3 text-right">—</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <p className="mt-4 text-xs text-gray-500">
          Showing {rows.length} kiosks. Restart Rate = Restart Clicks ÷ Completed.
        </p>
      </div>
    </main>
  );
}

// ---------- Header (styled date inputs + buttons) ----------
function Header({
  date_from,
  date_to,
  onApply,
  children,
}: {
  date_from?: string;
  date_to?: string;
  onApply: (from?: string, to?: string) => void;
  children?: React.ReactNode;
}) {
  const [from, setFrom] = useState(date_from ?? "");
  const [to, setTo] = useState(date_to ?? "");

  useEffect(() => setFrom(date_from ?? ""), [date_from]);
  useEffect(() => setTo(date_to ?? ""), [date_to]);

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <h1 className="text-4xl font-bold tracking-tight text-gray-900">Kiosk Metrics</h1>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">To (exclusive)</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>
        <button
          onClick={() => onApply(from || undefined, to || undefined)}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Apply
        </button>
        {children}
      </div>
    </header>
  );
}