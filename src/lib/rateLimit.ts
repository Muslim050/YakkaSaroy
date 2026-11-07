import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";

/**
 * Login attempt limiter, kept in Postgres so every serverless instance sees the same count.
 * An attempt is counted before the password is checked, in one statement, so requests sent
 * in parallel cannot all pass before the first failure is written.
 */
const WINDOW = "15 minutes";
/** One address guessing one login: enough for a person mistyping a password. */
const PER_ADDRESS = 5;
/** One login from every address together: what stops guessing from many addresses. */
const PER_LOGIN = 20;

const addressKey = (ip: string, login: string) => `admin:${ip}:${login}`;
const loginKey = (login: string) => `admin-login:${login}`;

/** Adds one to the count, starting a new window if the last one ended; true while within the limit. */
async function consume(key: string, limit: number) {
  const [row] = await getDb()
    .insert(loginAttempts)
    .values({ key, count: 1, until: sql`now() + ${WINDOW}::interval` })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        count: sql`case when ${loginAttempts.until} < now() then 1 else ${loginAttempts.count} + 1 end`,
        until: sql`case when ${loginAttempts.until} < now() then now() + ${WINDOW}::interval else ${loginAttempts.until} end`,
      },
    })
    .returning({ count: loginAttempts.count });
  return row.count <= limit;
}

/** Takes one attempt; false means refuse without checking the password. A blocked address uses up nothing of the login's limit. */
export async function takeLoginAttempt(ip: string, login: string) {
  return (await consume(addressKey(ip, login), PER_ADDRESS)) && (await consume(loginKey(login), PER_LOGIN));
}

/** A correct password is not a guess: forgets this address's failures and gives the attempt back to the login. */
export async function settleLoginAttempt(ip: string, login: string) {
  const db = getDb();
  await db.delete(loginAttempts).where(eq(loginAttempts.key, addressKey(ip, login)));
  await db
    .update(loginAttempts)
    .set({ count: sql`greatest(${loginAttempts.count} - 1, 0)` })
    .where(eq(loginAttempts.key, loginKey(login)));
}
