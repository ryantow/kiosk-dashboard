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
  avg_completed_ms?: number | null;
  avg_abandoned_ms?: number | null;
  avg_map_time_sec?: number | null;
  avg_poi_popups_completed?: number | null;
  avg_poi_popups_abandoned?: number | null;
  avg_easter_eggs?: number | null;
  back_to_map_sessions?: number | null;
  avg_abandoned_screen_depth?: number | null;
  poi_clicks?: Record<string, number>;
  download_app_clicks?: number | null;
  click_location_clicks?: number | null;
};

type OkProps = {
  kiosks: Kiosk[];
  rows: Row[];
  activeTab: string;
  date_from?: string | null;
  date_to?: string | null;
  apiUrl: string;   // <-- NEW
  apiKey: string;   // <-- NEW
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
        props: { 
          kiosks, 
          rows, 
          activeTab, 
          date_from: date_from ?? null, 
          date_to: date_to ?? null,
          apiUrl: BASE, // <-- Pass down for client-side CSV fetch
          apiKey: KEY   // <-- Pass down for client-side CSV fetch
        } as Props,
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
  
  // Extract activeTab up here so the filter can safely use it!
  const activeTab = props.activeTab; 
  
  const rawRows = "rows" in props && props.rows ? props.rows : EMPTY_ROWS;
  
  // Filter the rows based on the active tab's designated prefix
  const rows = useMemo(() => {
    return rawRows.filter((r) => {
      const id = r.kiosk_id.toLowerCase();
      
      if (activeTab === "mobile") {
        return id.startsWith("mobile_") || id.startsWith("mobile-");
      }
      if (activeTab === "wallet") {
        // Change "wallet" to whatever prefix your wallet kiosks use!
        return id.startsWith("wallet_") || id.startsWith("wallet-");
      }
      if (activeTab === "hubwall") {
        // Assuming Hubwalls are whatever is left over (or change this to id.startsWith("hubwall"))
        return id.startsWith("hubwall_") && !id.startsWith("hubwall-");
      }
      
      return true;
    });
  }, [rawRows, activeTab]);

  const totals = useMemo(() => computeTotals(rows), [rows]);

  const handleFilterChange = (updates: Record<string, string | undefined>) => {
    const currentQuery: Record<string, string | string[] | undefined> = { ...router.query, ...updates };
    
    Object.keys(currentQuery).forEach((key) => {
      if (currentQuery[key] === undefined) {
        delete currentQuery[key];
      }
    });
    
    router.push({ pathname: "/", query: currentQuery });
  };

  // --- CSV Download Handler ---
  const handleDownloadCSV = async () => {
    if (!("apiUrl" in props) || !props.apiUrl) return;

    try {
      const qs = new URLSearchParams();
      if (props.date_from) qs.set("date_from", props.date_from);
      if (props.date_to) qs.set("date_to", props.date_to);
      qs.set("experience", props.activeTab);

      const response = await fetch(`${props.apiUrl}/metrics/by-kiosk.csv?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${props.apiKey}` }
      });

      if (!response.ok) throw new Error("Failed to generate CSV");

      // Convert response to a blob and trigger browser download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `kiosk_metrics_${props.activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("There was an error downloading the CSV.");
    }
  };

  if ("error" in props && props.error) {
    return (
      <main className="p-8 text-red-600 bg-red-50 min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Dashboard Error</h1>
        <pre>{JSON.stringify(props.error, null, 2)}</pre>
      </main>
    );
  }

// We removed activeTab from here since we already grabbed it at the top
  const { date_from, date_to, kiosks } = props as OkProps;

  return (
    <>
      <Head>
        <title>Capital One Summer 2026 Data Tracking</title>
      </Head>
      <main className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Experience Dashboard</h1>
            <div className="flex gap-4 items-end">
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
              
              <button
                onClick={handleDownloadCSV}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Download CSV
              </button>
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
                  <th className="p-4">Location / Source ID</th>
                  <th className="p-4 text-right">Started</th>
                  <th className="p-4 text-right">Completed</th>
                  <th className="p-4 text-right">Abandoned</th>
                  
                  {activeTab === "wallet" && (
                    <>
                      <th className="p-4 text-right border-l border-gray-300">Avg Time (Completed)</th>
                      <th className="p-4 text-right">Avg Time (Abndn)</th>
                      <th className="p-4 text-right">Back to Map #</th>
                      <th className="p-4 text-right">Restarts</th>
                      <th className="p-4 text-right">POI 1 (PP)</th>
                      <th className="p-4 text-right">POI 2 (BB)</th>
                      <th className="p-4 text-right">POI 3 (SS)</th>
                      <th className="p-4 text-right">POI 4 (SSS)</th>
                      <th className="p-4 text-right">POI 5 (CCC)</th>
                      <th className="p-4 text-right">Avg. Eggs</th>
                    </>
                  )}

                  {activeTab === "mobile" && (
                    <>
                      <th className="p-4 text-right border-l border-gray-300">Avg Time (Completed)</th>
                      <th className="p-4 text-right">Avg Time (Abndn)</th>
                      <th className="p-4 text-right">Restarts</th>
                      <th className="p-4 text-right">Download App</th>
                      <th className="p-4 text-right">Find Location</th>
                      <th className="p-4 text-right">POI 1 (PP)</th>
                      <th className="p-4 text-right">POI 2 (BB)</th>
                      <th className="p-4 text-right">POI 3 (SS)</th>
                      <th className="p-4 text-right">POI 4 (SSS)</th>
                      <th className="p-4 text-right">POI 5 (CCC)</th>
                      <th className="p-4 text-right">Avg. Eggs</th>
                    </>
                  )}

                  {activeTab === "hubwall" && (
                    <>
                      <th className="p-4 text-right border-l border-gray-300">Avg Time (Completed)</th>
                      <th className="p-4 text-right">Avg Time (Abandoned)</th>
                      <th className="p-4 text-right">Restarts</th>
                      <th className="p-4 text-right">Avg Drop-off Screen Depth</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r) => {
                  const matchedKiosk = kiosks?.find((k) => k.kiosk_id === r.kiosk_id);
                  const displayName = matchedKiosk ? matchedKiosk.kiosk_name : "Unknown Location";

                  return (
                    <tr key={r.kiosk_id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{displayName}</div>
                        <div className="text-xs text-gray-400">{r.kiosk_id}</div>
                      </td>
                      <td className="p-4 text-right tabular-nums">{r.started}</td>
                      <td className="p-4 text-right tabular-nums">{r.completed}</td>
                      <td className="p-4 text-right tabular-nums">{r.abandoned}</td>

                      {activeTab === "wallet" && (
                        <>
                          <td className="p-4 text-right border-l border-gray-100 tabular-nums">
                            {r.avg_completed_ms ? `${(r.avg_completed_ms / 1000).toFixed(1)}s` : "-"}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.avg_abandoned_ms ? `${(r.avg_abandoned_ms / 1000).toFixed(1)}s` : "-"}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.back_to_map_sessions || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.restart_clicks || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.poi_clicks?.["Priority Pass"] || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.poi_clicks?.["Barcode Booth"] || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.poi_clicks?.["Support Spotlight"] || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.poi_clicks?.["Self Service Station"] || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.poi_clicks?.["Cash Concession"] || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.avg_easter_eggs?.toFixed(1) || "-"}
                          </td>
                        </>
                      )}

                      {activeTab === "mobile" && (
                        <>
                          <td className="p-4 text-right border-l border-gray-100 tabular-nums">
                            {r.avg_completed_ms ? `${(r.avg_completed_ms / 1000).toFixed(1)}s` : "-"}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.avg_abandoned_ms ? `${(r.avg_abandoned_ms / 1000).toFixed(1)}s` : "-"}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.restart_clicks || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums font-medium text-blue-600">
                            {r.download_app_clicks || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums font-medium text-blue-600">
                            {r.click_location_clicks || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.poi_clicks?.["Priority Pass"] || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.poi_clicks?.["Barcode Booth"] || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.poi_clicks?.["Support Spotlight"] || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.poi_clicks?.["Self Service Station"] || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.poi_clicks?.["Cash Concession"] || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.avg_easter_eggs?.toFixed(1) || "-"}
                          </td>
                        </>
                      )}

                      {activeTab === "hubwall" && (
                        <>
                          <td className="p-4 text-right border-l border-gray-100 tabular-nums">
                            {r.avg_completed_ms ? `${(r.avg_completed_ms / 1000).toFixed(1)}s` : "-"}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.avg_abandoned_ms ? `${(r.avg_abandoned_ms / 1000).toFixed(1)}s` : "-"}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {r.restart_clicks || 0}
                          </td>
                          <td className="p-4 text-right tabular-nums text-red-600 font-medium">
                            {r.avg_abandoned_screen_depth?.toFixed(1) || "-"}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
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