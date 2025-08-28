import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool__: Pool | undefined;
}

export function getPool(): Pool {
  if (global.__pgPool__) return global.__pgPool__;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");

  const pool = new Pool({
    connectionString,
    // ssl: { rejectUnauthorized: false }, // enable if your URL lacks sslmode=require
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  global.__pgPool__ = pool;
  return pool;
}