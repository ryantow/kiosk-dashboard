import Head from "next/head";
import { useMemo } from "react";
import { useRouter } from "next/router";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import type { InferGetServerSidePropsType } from "next";

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
  async getServerSideProps({ query }) {
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
        props: { kiosks: [], rows: [], activeTab, error: { msg: "Missing API envs" } },
      } as Props;
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
        props: { kiosks, rows, activeTab, date_from: date_from ?? null, date_to: date_to ?? null } as Props 
      };
    } catch (e) {
      return {
        props: { kiosks: [], rows: [], activeTab, error: { msg: String(e) } },
      } as Props;
    }
  },
});

/* -------------------- Page -------------------- */
export default function DashboardPage(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  
  const rows = "rows" in props ? props.rows : [];
  const totals = useMemo(() => computeTotals(rows), [rows]);

  const handleFilterChange = (updates: Record<string, string | undefined>) => {
    const currentQuery = { ...router.query, ...updates };
    Object.keys(currentQuery).forEach(key => currentQuery