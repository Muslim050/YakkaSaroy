import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Lazily created so `next build` does not need DATABASE_URL. The Neon HTTP driver is
 * stateless, so one client per process is enough on serverless.
 */
function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run `vercel env pull .env.local` or connect the Neon database.");
  const sql = neon(url);
  return { db: drizzle(sql, { schema }), sql };
}

let client: ReturnType<typeof createDb> | null = null;

export function getDb() {
  client ??= createDb();
  return client.db;
}

/** Raw tagged-template SQL, for the few statements that need a transaction batch. */
export function getSql() {
  client ??= createDb();
  return client.sql;
}

export { schema };
