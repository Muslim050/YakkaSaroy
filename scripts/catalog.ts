/**
 * Brings the live catalog up to the seed without touching what managers edited:
 *
 *   pnpm db:catalog
 *
 * Options the seed has and the database lacks are added. Options that exist but
 * were saved before "occasions" appeared get the seed's occasions; an option whose
 * occasions a manager already set (even to none) keeps them.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { programOptions } from "../src/db/schema";
import { seedCatalog } from "../src/lib/programSeed";

async function main() {
  const db = getDb();
  const seed = seedCatalog().flatMap((c) => c.options.map(({ id, ...data }) => ({ id, category: c.id, data })));

  const added = await db.insert(programOptions).values(seed).onConflictDoNothing().returning({ id: programOptions.id });
  console.log(`Вариантов добавлено: ${added.length}${added.length ? ` (${added.map((a) => a.id).join(", ")})` : ""}`);

  const rows = await db.select().from(programOptions);
  let filled = 0;
  for (const r of rows) {
    const s = seed.find((x) => x.id === r.id);
    if (!s?.data.eventTypes?.length || "eventTypes" in r.data) continue;
    await db
      .update(programOptions)
      .set({ data: { ...r.data, eventTypes: s.data.eventTypes }, updatedAt: new Date() })
      .where(eq(programOptions.id, r.id));
    filled++;
    console.log(`  ${r.data.title}: ${s.data.eventTypes.join(", ")}`);
  }
  console.log(`Поводы проставлены: ${filled}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
