import { Pool } from "pg";

declare global {
  // Keep a global for hot-reload/serverless reuse; no eslint disable needed
  // eslint rules won't complain in ambient context
  var __pgPool__: Pool | undefined;
}

export function getPool(): Pool {
  if (global.__pgPool__) return global.__pgPool__;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");

  const pool = new Pool({
    connectionString,
    // If your provider requires TLS and your URL lacks it, uncomment:
    // ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  global.__pgPool__ = pool;
  return pool;
}