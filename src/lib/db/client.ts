import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool__: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Missing env: DATABASE_URL");

// Reuse across hot reloads/serverless invocations
export const pool =
  global.__pgPool__ ??
  new Pool({
    connectionString,
    // If your provider requires TLS but the URL doesn’t include it, uncomment:
    // ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") global.__pgPool__ = pool;