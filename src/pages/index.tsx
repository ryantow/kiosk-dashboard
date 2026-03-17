import Head from "next/head";
import { useMemo } from "react";
import { useRouter } from "next/router";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";

/* -------------------- Types -------------------- */
type Kiosk = { kiosk_id: string; kiosk_name: string };

type Row = {
  kiosk_id: string;
  started: number;
  completed: number;
  abandoned: number;
  restart_clicks: number;
  avg_ms: number | null;
  avg_map_time_sec?: number | null;
  avg_poi_popups_completed?: number | null;
  avg_poi_popups_abandoned?: number | null;
  avg_easter_eggs?: number | null;
  back_to_map_sessions?: number | null;
  avg_abandoned_screen_depth?: number | null;
  poi_clicks?: Record<string, number>;
};

type OkProps = {
  kiosks: Kiosk[];
  rows: Row[];
  activeTab: string;
  date_from?: string | null;
  date_to?: string | null;
  error?: undefined;
};

type ErrProps = {
  kiosks: [];
  rows: [];
  activeTab: string;
  date_from?: string | null;
  date_to?: string | null;
  error: { msg: string; detail?: string };
};

type Props = OkProps | ErrProps;

const TABS = [
  { id: "wallet", label: "Wallet App" },
  { id: "hubwall", label: "Interactive Hubwall" },
  { id: "mobile", label: "Mobile Web" },
];

const EMPTY_ROWS: Row[] = [];

/* -------------------- Helpers -------------------- */
function fmtPct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function computeTotals(rows: Row[]) {
  return rows.reduce(
    (acc, r) => {
      acc.started += r.started || 0;
      acc.completed += r.completed || 0;
      acc.abandoned += r.abandoned || 0;
      acc.restart_clicks += r.restart_clicks || 0;
      return acc;
    },
    { started: 0, completed: 0, abandoned: 0, restart_clicks: 0 }
  );
}

/* -------------------- Server Side -------------------- */
export const getServerSideProps = withPageAuthRequired({
  getServerSideProps: async ({ query }) => {
    const BASE = (process.env.API_BASE_URL || "").trim();
    const KEY = (process.env.API_KEY || "").trim();

    const date_from = typeof query.date_from === "string" ? query.date_from : undefined;
    const date_to = typeof query.date_to === "string" ? query.date_to : undefined;
    const activeTab = typeof query.tab === "string" ? query.tab : "wallet";

    const qs = new URLSearchParams();
    if (date_from) qs.set("date_from", date_from);
    if (date_to) qs.set("date_to", date_to);
    qs.set("experience", activeTab);

    const q = qs.toString() ? `?${qs.toString()}` : "";

    if (!BASE || !KEY) {
      return {
        props: { kiosks: [], rows: [], activeTab, error: { msg: "Missing API envs" } } as Props,
      };
    }

    try {
      const [kiosksRes, metricsRes] = await Promise.all([
        fetch(`${BASE}/kiosks`, { headers: { Authorization: `Bearer ${KEY}` } }),
        fetch(`${BASE}/metrics/by-kiosk${q}`, { headers: { Authorization: `Bearer ${KEY}` } }),
      ]);

      if (!metricsRes.ok) throw new Error("API Fetch Failed");

      const kiosks: Kiosk[] = await kiosksRes.json();
      const rows: Row[] = await metricsRes.json();
      
      return { 
        props: { kiosks, rows, activeTab, date_from: date_from ?? null, date_to: date_to ?? null } as Props,
      };
    } catch (e) {
      return {
        props: { kiosks: [], rows: [], activeTab, error: { msg: String(e) } } as Props,
      };
    }
  }
});

/* -------------------- Page -------------------- */
export default function DashboardPage(props: Props) {
  const router = useRouter();
  
  const rows = "rows" in props && props.rows ? props.rows : EMPTY_ROWS;
  const totals = useMemo(() => computeTotals(rows), [rows]);

  const handleFilterChange = (updates: Record<string, string | undefined>) => {
    const currentQuery: Record<string, string | string[] | undefined> = { ...router.query, ...updates };
    
    // Safely clean up undefined values before pushing to the router
    Object.keys(currentQuery).forEach((key) => {
      if (currentQuery[key] === undefined) {
        delete currentQuery[key];
      }
    });
    
    router.push({ pathname: "/", query: currentQuery });
  };

  if ("error" in props && props.error) {
    return (
      <main className="p-8 text-red-600 bg-red-50 min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Dashboard Error</h1>
        <pre>{JSON.stringify(props.error, null, 2)}</pre>
      </main>
    );
  }

  const { activeTab, date_from, date_to } = props as OkProps;

  return (
    <>
      <Head>
        <title>Experience Dashboard</title>
      </Head>
      <main className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Experience Dashboard</h1>
            <div className="flex gap-3 items-end">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">From</label>
                <input 
                  type="date" 
                  value={date_from || ""} 
                  onChange={(e) => handleFilterChange({ date_from: e.target.value })}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm" 
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">To</label>
                <input 
                  type="date" 
                  value={date_to || ""} 
                  onChange={(e) => handleFilterChange({ date_to: e.target.value })}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm" 
                />
              </div>
            </div>
          </header>

          <div className="mb-8 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleFilterChange({ tab: tab.id })}
                  className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Total Starts" value={totals.started} />
            <Card title="Completed" value={totals.completed} rate={totals.started ? totals.completed / totals.started : 0} />
            <Card title="Abandoned" value={totals.abandoned} rate={totals.started ? totals.abandoned / totals.started : 0} />
            <Card title="Restart Clicks" value={totals.restart_clicks} rate={totals.completed ? totals.restart_clicks / totals.completed : 0} />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-md">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                <tr>
                  <th className="p-4">Source ID</th>
                  <th className="p-4 text-right">Started</th>
                  <th className="p-4 text-right">Completed</th>
                  <th className="p-4 text-right">Abandoned</th>
                  
                  {activeTab === "wallet" && (
                    <>
                      <th className="p-4 text-right border-l border-gray-300">Avg Map Time (s)</th>
                      <th className="p-4 text-right">Avg Popups (Done)</th>
                      <th className="p-4 text-right">Avg Popups (Drop)</th>
                      <th className="p-4 text-right">Avg Easter Eggs</th>
                      <th className="p-4 text-right">Back to Map #</th>
                      <th className="p-4">POI Breakdown</th>
                    </>
                  )}

                  {activeTab === "hubwall" && (
                    <>
                      <th className="p-4 text-right border-l border-gray-300">Avg Drop-off Screen Depth</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r) => (
                  <tr key={r.kiosk_id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900">{r.kiosk_id}</td>
                    <td className="p-4 text-right tabular-nums">{r.started}</td>
                    <td className="p-4 text-right tabular-nums">{r.completed}</td>
                    <td className="p-4 text-right tabular-nums">{r.abandoned}</td>

                    {activeTab === "wallet" && (
                      <>
                        <td className="p-4 text-right border-l border-gray-100 tabular-nums">
                          {r.avg_map_time_sec?.toFixed(1) || "-"}
                        </td>
                        <td className="p-4 text-right tabular-nums">
                          {r.avg_poi_popups_completed?.toFixed(1) || "-"}
                        </td>
                        <td className="p-4 text-right tabular-nums text-gray-500">
                          {r.avg_poi_popups_abandoned?.toFixed(1) || "-"}
                        </td>
                        <td className="p-4 text-right tabular-nums">
                          {r.avg_easter_eggs?.toFixed(1) || "-"}
                        </td>
                        <td className="p-4 text-right tabular-nums">
                          {r.back_to_map_sessions || 0}
                        </td>
                        <td className="p-4 text-xs">
                          {r.poi_clicks ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(r.poi_clicks).map(([poi, count]) => (
                                <span key={poi} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                  {poi}: {count}
                                </span>
                              ))}
                            </div>
                          ) : "None"}
                        </td>
                      </>
                    )}

                    {activeTab === "hubwall" && (
                      <>
                        <td className="p-4 text-right border-l border-gray-100 tabular-nums text-red-600 font-medium">
                          {r.avg_abandoned_screen_depth?.toFixed(1) || "-"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500">No data found for this tab and date range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}

/* -------------------- UI Components -------------------- */
function Card({ title, value, rate }: { title: string; value: number; rate?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium text-gray-500">{title}</div>
        {rate !== undefined && <div className="text-xs text-gray-400">Rate</div>}
      </div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold tabular-nums text-gray-900">{value}</div>
        {rate !== undefined && <div className="text-lg font-medium text-blue-600">{fmtPct(rate)}</div>}
      </div>
    </div>
  );
}