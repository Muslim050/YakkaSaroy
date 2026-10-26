import "server-only";
import { and, eq, gt, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";

/**
 * Login attempt limiter: `limit` failures per key within a 15 minute window. Kept in
 * Postgres so every serverless instance sees the same count.
 */
const WINDOW = "15 minutes";

export async function tooManyAttempts(key: string, limit = 5) {
  const [row] = await getDb()
    .select({ n: loginAttempts.count })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.until, sql`now()`), gte(loginAttempts.count, limit)))
    .limit(1);
  return !!row;
}

export async function recordFailure(key: string) {
  await getDb()
    .insert(loginAttempts)
    .values({ key, count: 1, until: sql`now() + ${WINDOW}::interval` })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        count: sql`case when ${loginAttempts.until} < now() then 1 else ${loginAttempts.count} + 1 end`,
        until: sql`case when ${loginAttempts.until} < now() then now() + ${WINDOW}::interval else ${loginAttempts.until} end`,
      },
    });
}

export async function clearFailures(key: string) {
  await getDb().delete(loginAttempts).where(eq(loginAttempts.key, key));
}
