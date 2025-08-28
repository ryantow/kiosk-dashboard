import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Missing env: DATABASE_URL");

export const pool = new Pool({
  connectionString,
  // optional hardening for serverless:
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});