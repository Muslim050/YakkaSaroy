/**
 * Demo data for the Neon database.
 *
 *   pnpm db:seed         replace demo bookings, add demo admins and the catalog if missing
 *   pnpm db:clear-demo   remove demo bookings only (do this before launch)
 *
 * Real requests (from the site or managers) are never touched: only rows flagged
 * seeded/demo are deleted, and demo rows avoid the slots real banquets already hold.
 */
import { and, eq, ne, or } from "drizzle-orm";
import { getDb } from "../src/db";
import { adminUsers, bookings, programOptions } from "../src/db/schema";
import { toRow } from "../src/db/rows";
import { DEMO_ADMINS, demoBookings } from "../src/db/demo";
import { seedCatalog } from "../src/lib/programSeed";
import { hashPassword } from "../src/lib/password";
import { todayISO } from "../src/lib/time";

async function main() {
  const db = getDb();
  const clear = process.argv.includes("--clear");

  const removed = await db.delete(bookings).where(or(eq(bookings.seeded, true), eq(bookings.demo, true))).returning({ id: bookings.id });
  console.log(`Удалено демо-броней: ${removed.length}`);
  if (clear) return;

  const catalogRows = seedCatalog().flatMap((c) => c.options.map(({ id, ...data }) => ({ id, category: c.id, data })));
  const addedOptions = await db.insert(programOptions).values(catalogRows).onConflictDoNothing().returning({ id: programOptions.id });
  console.log(`Вариантов каталога добавлено: ${addedOptions.length} (существующие не трогаем)`);

  for (const a of DEMO_ADMINS) {
    await db.insert(adminUsers).values({ id: a.id, login: a.login, name: a.name, ...hashPassword(a.password) }).onConflictDoNothing();
  }
  console.log(`Демо-администраторы: ${DEMO_ADMINS.map((a) => a.login).join(", ")} (если их ещё не было)`);

  const real = await db
    .select({ hall: bookings.hall, date: bookings.date, slot: bookings.slot })
    .from(bookings)
    .where(and(ne(bookings.hall, "restaurant"), ne(bookings.status, "cancelled")));
  const taken = new Set(real.map((r) => `${r.hall}|${r.date}|${r.slot}`));

  const rows = demoBookings(todayISO(), seedCatalog(), taken).map(toRow);
  for (let i = 0; i < rows.length; i += 500) await db.insert(bookings).values(rows.slice(i, i + 500));
  console.log(`Добавлено демо-броней: ${rows.length}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
