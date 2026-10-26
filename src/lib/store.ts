import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, count, desc, eq, gte, ilike, isNotNull, like, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import { adminUsers, bookings, programOptions } from "@/db/schema";
import { toRow } from "@/db/rows";
import { HALLS, RESTAURANT_HOURS, RESTAURANT_TABLES, SLOTS, type HallId, type SlotId } from "./data";
import type { DayAvailability } from "./availability";
import { describeChange, offered, type Catalog, type CategoryId, type ProgramOption, type ProgramSelection } from "./program";
import { programCategories, seedCatalog } from "./programSeed";
import { STATUS, estimateTotal, formatSum, phoneDigits, type Booking, type BookingStatus, type HistoryEntry } from "./bookings";
import { checkPassword, hashPassword } from "./password";
import { addDaysISO, todayISO } from "./time";

/**
 * Data access for the whole app, backed by Neon Postgres (see src/db). Pages and route
 * handlers only use the functions below, never the tables directly.
 */

export type { Booking };
export { todayISO };

export type AdminUser = { id: string; login: string; name: string; role: "admin" };

/** Thrown when the database refuses a booking because the hall and time are taken. */
export class SlotTakenError extends Error {
  constructor() {
    super("Это время уже занято");
    this.name = "SlotTakenError";
  }
}

/** Kept for callers that format a Date; for "today" use todayISO (Tashkent). */
export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function newId() {
  return `b-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}
function newCode() {
  return `YS-${1000 + (randomBytes(2).readUInt16BE(0) % 9000)}`;
}

/** Postgres unique_violation, possibly wrapped by Drizzle. */
function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

type Row = typeof bookings.$inferSelect;

function toBooking(r: Row): Booking {
  return {
    id: r.id,
    code: r.code,
    hall: r.hall as HallId,
    date: r.date,
    slot: r.slot,
    guests: r.guests,
    name: r.name,
    phone: r.phone,
    eventType: r.eventType ?? undefined,
    comment: r.comment ?? undefined,
    status: r.status,
    prepayment: r.prepayment ?? undefined,
    tastingAt: r.tastingAt ?? undefined,
    managerNote: r.managerNote ?? undefined,
    extras: r.extras ?? undefined,
    source: r.source,
    history: r.history ?? [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    seeded: r.seeded || undefined,
    demo: r.demo || undefined,
  };
}

const active = ne(bookings.status, "cancelled");
const isBanquet = ne(bookings.hall, "restaurant");
const isTable = eq(bookings.hall, "restaurant");

/* ----------------------------------------------------------- availability */

export async function availabilityForMonth(month: string): Promise<Record<string, DayAvailability>> {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const result: Record<string, DayAvailability> = {};
  for (let day = 1; day <= daysInMonth; day++) {
    result[`${month}-${String(day).padStart(2, "0")}`] = {
      grand: { day: "free", evening: "free" },
      small: { day: "free", evening: "free" },
      terrace: { day: "free", evening: "free" },
      restaurant: Object.fromEntries(RESTAURANT_HOURS.map((h) => [h, RESTAURANT_TABLES])),
    };
  }
  const rows = await getDb()
    .select({ hall: bookings.hall, date: bookings.date, slot: bookings.slot, n: count() })
    .from(bookings)
    .where(and(gte(bookings.date, first), sql`${bookings.date} <= ${last}`, active))
    .groupBy(bookings.hall, bookings.date, bookings.slot);
  for (const r of rows) {
    const entry = result[r.date];
    if (!entry) continue;
    if (r.hall === "restaurant") {
      if (entry.restaurant[r.slot] !== undefined) entry.restaurant[r.slot] = Math.max(0, RESTAURANT_TABLES - r.n);
    } else if (r.hall in entry) {
      entry[r.hall as Exclude<HallId, "restaurant">][r.slot as SlotId] = "booked";
    }
  }
  return result;
}

export async function isFree(hall: HallId, date: string, slot: string, exceptId?: string) {
  const conds = [eq(bookings.hall, hall), eq(bookings.date, date), eq(bookings.slot, slot), active];
  if (exceptId) conds.push(ne(bookings.id, exceptId));
  const [{ n }] = await getDb().select({ n: count() }).from(bookings).where(and(...conds));
  return hall === "restaurant" ? n < RESTAURANT_TABLES : n === 0;
}

/* --------------------------------------------------------------- bookings */

export type NewBooking = Pick<Booking, "hall" | "date" | "slot" | "guests" | "name" | "phone" | "eventType" | "comment"> &
  Partial<Pick<Booking, "status" | "managerNote">>;

/**
 * Creates a booking, or returns null when the time is already taken. Banquet slots are
 * guarded by a unique index; restaurant hours by a count under an advisory lock, so two
 * guests booking the last table at once cannot both get it.
 */
export async function createBooking(input: NewBooking, by: "client" | "admin" = "client"): Promise<Booking | null> {
  const now = new Date().toISOString();
  const status = input.status ?? (by === "admin" ? "confirmed" : "new");
  const history: HistoryEntry[] = [{ at: now, by, text: by === "admin" ? "Бронь создана менеджером" : "Заявка отправлена с сайта" }];
  if (status !== "new") history.push({ at: now, by, text: `Статус: ${STATUS[status].label.toLowerCase()}` });
  const booking: Booking = { ...input, id: newId(), code: newCode(), status, source: by === "admin" ? "admin" : "site", history, createdAt: now, updatedAt: now };
  const row = toRow(booking);

  if (input.hall !== "restaurant") {
    try {
      await getDb().insert(bookings).values(row);
      return booking;
    } catch (e) {
      if (isUniqueViolation(e)) return null;
      throw e;
    }
  }

  const q = getSql();
  const lockKey = `restaurant|${row.date}|${row.slot}`;
  const [, inserted] = await q.transaction([
    q`select pg_advisory_xact_lock(hashtext(${lockKey}))`,
    q`insert into bookings (id, code, hall, date, slot, guests, name, phone, phone_digits, event_type, comment, status, manager_note, source, history, created_at, updated_at)
      select ${row.id}, ${row.code}, ${row.hall}, ${row.date}, ${row.slot}, ${row.guests}, ${row.name}, ${row.phone}, ${row.phoneDigits}, ${row.eventType}, ${row.comment}, ${row.status}, ${row.managerNote}, ${row.source}, ${JSON.stringify(history)}::jsonb, ${now}, ${now}
      where (select count(*) from bookings where hall = 'restaurant' and date = ${row.date} and slot = ${row.slot} and status <> 'cancelled') < ${RESTAURANT_TABLES}
      returning id`,
  ]);
  return (inserted as unknown[]).length ? booking : null;
}

export async function getBooking(id: string) {
  const [r] = await getDb().select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return r ? toBooking(r) : null;
}

export type BookingPatch = Partial<Pick<Booking, "status" | "guests" | "eventType" | "comment" | "prepayment" | "tastingAt" | "managerNote" | "name" | "phone">> & {
  extras?: ProgramSelection;
};

/**
 * Apply a change and append a readable line to the booking's history. Throws
 * SlotTakenError if re-opening a cancelled banquet would double-book its slot.
 */
export async function updateBooking(id: string, patch: BookingPatch, by: "client" | "admin") {
  const b = await getBooking(id);
  if (!b) return null;
  const now = new Date().toISOString();
  const lines: HistoryEntry[] = [];
  const log = (text: string) => lines.push({ at: now, by, text });
  const set: Partial<typeof bookings.$inferInsert> = {};

  if (patch.status && patch.status !== b.status) {
    log(patch.status === "cancelled" && by === "client" ? "Клиент отменил заявку" : `Статус: ${STATUS[patch.status].label.toLowerCase()}`);
    set.status = patch.status;
  }
  if (patch.guests !== undefined && patch.guests !== b.guests) {
    log(`Гостей: ${b.guests} → ${patch.guests}`);
    set.guests = patch.guests;
  }
  if (patch.prepayment !== undefined && patch.prepayment !== (b.prepayment ?? 0)) {
    log(patch.prepayment ? `Предоплата: ${formatSum(patch.prepayment)}` : "Предоплата обнулена");
    set.prepayment = patch.prepayment || null;
  }
  if (patch.tastingAt !== undefined && patch.tastingAt !== (b.tastingAt ?? "")) {
    log(patch.tastingAt ? "Назначена дегустация" : "Дегустация отменена");
    set.tastingAt = patch.tastingAt || null;
  }
  if (patch.eventType !== undefined && patch.eventType !== b.eventType) {
    log(`Повод: ${patch.eventType}`);
    set.eventType = patch.eventType;
  }
  if (patch.comment !== undefined && patch.comment !== (b.comment ?? "")) {
    log(by === "client" ? "Клиент изменил пожелания" : "Изменены пожелания");
    set.comment = patch.comment || null;
  }
  if (patch.name !== undefined && patch.name !== b.name) {
    log("Изменено имя клиента");
    set.name = patch.name;
  }
  if (patch.phone !== undefined && patch.phone !== b.phone) {
    log("Изменён телефон клиента");
    set.phone = patch.phone;
    set.phoneDigits = phoneDigits(patch.phone);
  }
  if (patch.extras !== undefined) {
    const line = describeChange(await getCatalog(), b.extras, patch.extras);
    if (line) log(line);
    set.extras = patch.extras;
  }
  if (patch.managerNote !== undefined) set.managerNote = patch.managerNote || null;

  try {
    const [r] = await getDb()
      .update(bookings)
      .set({ ...set, updatedAt: new Date(now), history: sql`${bookings.history} || ${JSON.stringify(lines)}::jsonb` })
      .where(eq(bookings.id, id))
      .returning();
    return r ? toBooking(r) : null;
  } catch (e) {
    if (isUniqueViolation(e)) throw new SlotTakenError();
    throw e;
  }
}

export type BookingQuery = {
  kind?: "halls" | "restaurant";
  status?: BookingStatus | "upcoming" | "all";
  hall?: HallId;
  q?: string;
  page?: number;
  pageSize?: number;
};

export async function listBookings(query: BookingQuery) {
  const db = getDb();
  const today = todayISO();
  const conds: SQL[] = [query.kind === "restaurant" ? isTable : isBanquet];
  if (query.hall) conds.push(eq(bookings.hall, query.hall));
  const status = query.status ?? "upcoming";
  if (status === "upcoming") conds.push(gte(bookings.date, today), active);
  else if (status !== "all") conds.push(eq(bookings.status, status));
  const q = query.q?.trim() ?? "";
  if (q) {
    const digits = q.replace(/\D/g, "");
    const match = [ilike(bookings.name, `%${q}%`), ilike(bookings.code, `%${q}%`)];
    if (digits.length >= 3) match.push(like(bookings.phoneDigits, `%${digits}%`));
    conds.push(or(...match)!);
  }
  const where = and(...conds);
  // Upcoming first by date; finished and cancelled ones newest first.
  const newest = status === "done" || status === "cancelled" || status === "all";
  const pageSize = query.pageSize ?? 25;
  const [{ n: total }] = await db.select({ n: count() }).from(bookings).where(where);
  const page = Math.min(Math.max(1, query.page ?? 1), Math.max(1, Math.ceil(total / pageSize)));
  const rows = await db
    .select()
    .from(bookings)
    .where(where)
    .orderBy(newest ? desc(bookings.date) : asc(bookings.date), asc(bookings.slot), asc(bookings.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { rows: rows.map(toBooking), total, page, pageSize };
}

export async function countByStatus(kind: "halls" | "restaurant") {
  const db = getDb();
  const kindCond = kind === "restaurant" ? isTable : isBanquet;
  const counts: Record<BookingStatus | "upcoming" | "all", number> = { upcoming: 0, all: 0, new: 0, confirmed: 0, prepaid: 0, done: 0, cancelled: 0 };
  const [byStatus, [{ n: upcoming }]] = await Promise.all([
    db.select({ status: bookings.status, n: count() }).from(bookings).where(kindCond).groupBy(bookings.status),
    db.select({ n: count() }).from(bookings).where(and(kindCond, gte(bookings.date, todayISO()), active)),
  ]);
  for (const r of byStatus) {
    counts[r.status] = r.n;
    counts.all += r.n;
  }
  counts.upcoming = upcoming;
  return counts;
}

/** Banquet bookings of one month for the admin calendar. */
export async function hallBookingsForMonth(month: string) {
  const rows = await getDb()
    .select()
    .from(bookings)
    .where(and(isBanquet, active, like(sql`${bookings.date}::text`, `${month}-%`)));
  return rows.map(toBooking);
}

/* ---------------------------------------------------------------- clients */

/** A client's own bookings, newest event first. */
export async function bookingsByPhone(phone: string) {
  const rows = await getDb().select().from(bookings).where(eq(bookings.phoneDigits, phoneDigits(phone))).orderBy(desc(bookings.date));
  return rows.map(toBooking);
}

/** Client login: the phone must own a booking with that code. */
export async function findClient(phone: string, code: string) {
  const d = phoneDigits(phone);
  const c = code.trim().toUpperCase().replace(/^YS-?/, "YS-");
  if (d.length !== 12 || !/^YS-\d{4}$/.test(c)) return null;
  const [r] = await getDb()
    .select({ name: bookings.name })
    .from(bookings)
    .where(and(eq(bookings.phoneDigits, d), sql`upper(${bookings.code}) = ${c}`))
    .limit(1);
  return r ? { phone: d, name: r.name } : null;
}

export type ClientSummary = {
  phone: string;
  name: string;
  bookings: number;
  upcoming: number;
  nextDate?: string;
  lastDate: string;
  spent: number;
};

/** Banquet clients grouped by phone (restaurant walk-ins are left out). */
export async function listClients(q?: string) {
  const [rows, catalog] = await Promise.all([
    getDb()
      .select({ phone: bookings.phone, phoneDigits: bookings.phoneDigits, name: bookings.name, date: bookings.date, status: bookings.status, prepayment: bookings.prepayment, hall: bookings.hall, guests: bookings.guests, extras: bookings.extras })
      .from(bookings)
      .where(isBanquet)
      .orderBy(asc(bookings.createdAt)),
    getCatalog(),
  ]);
  const today = todayISO();
  const map = new Map<string, ClientSummary>();
  for (const b of rows) {
    const c = map.get(b.phoneDigits) ?? { phone: b.phone, name: b.name, bookings: 0, upcoming: 0, lastDate: b.date, spent: 0 };
    c.bookings++;
    if (b.date >= today && b.status !== "cancelled") {
      c.upcoming++;
      if (!c.nextDate || b.date < c.nextDate) c.nextDate = b.date;
    }
    if (b.date > c.lastDate) c.lastDate = b.date;
    if (b.status === "done") c.spent += estimateTotal({ hall: b.hall as HallId, guests: b.guests, extras: b.extras ?? undefined }, catalog) ?? 0;
    else c.spent += b.prepayment ?? 0;
    map.set(b.phoneDigits, c);
  }
  let list = [...map.values()];
  const s = q?.trim().toLowerCase();
  if (s) {
    const digits = s.replace(/\D/g, "");
    list = list.filter((c) => c.name.toLowerCase().includes(s) || (digits.length >= 3 && phoneDigits(c.phone).includes(digits)));
  }
  return list.sort((a, b) => (a.nextDate ?? "9999").localeCompare(b.nextDate ?? "9999") || b.lastDate.localeCompare(a.lastDate));
}

/* --------------------------------------------------------------- overview */

export async function overview() {
  const db = getDb();
  const today = todayISO();
  const in7 = addDaysISO(today, 7);
  const in30 = addDaysISO(today, 30);

  const [newRows, windowRows, tastingRows, [{ n: tablesToday }], catalog] = await Promise.all([
    db.select().from(bookings).where(and(isBanquet, eq(bookings.status, "new"))).orderBy(desc(bookings.createdAt)),
    db.select().from(bookings).where(and(isBanquet, active, gte(bookings.date, today), lt(bookings.date, in30))).orderBy(asc(bookings.date), asc(bookings.slot)),
    db
      .select()
      .from(bookings)
      .where(and(isBanquet, active, isNotNull(bookings.tastingAt), gte(bookings.tastingAt, today), lt(bookings.tastingAt, in7)))
      .orderBy(asc(bookings.tastingAt)),
    db.select({ n: count() }).from(bookings).where(and(isTable, active, eq(bookings.date, today))),
    getCatalog(),
  ]);
  const next30 = windowRows.map(toBooking);
  const week = next30.filter((b) => b.date < in7);
  const prepaid30 = next30.reduce((s, b) => s + (b.prepayment ?? 0), 0);
  const expected30 = next30.reduce((s, b) => s + (estimateTotal(b, catalog) ?? 0), 0);

  // Share of the 60 day/evening slots of each hall taken in the next 30 days.
  const occupancy = HALLS.filter((h) => h.id !== "restaurant").map((h) => ({
    hall: h.id,
    name: h.name,
    taken: next30.filter((b) => b.hall === h.id).length,
    slots: 30 * SLOTS.length,
  }));

  return {
    newRequests: newRows.map(toBooking),
    week,
    next30: next30.length,
    prepaid30,
    expected30,
    tastings: tastingRows.map(toBooking),
    occupancy,
    tablesToday,
  };
}

/* ---------------------------------------------------------------- catalog */

/** The catalog: category rules from code, options from the database (seeded on first use). */
export async function getCatalog(): Promise<Catalog> {
  const db = getDb();
  let rows = await db.select().from(programOptions);
  if (!rows.length) {
    const seed = seedCatalog().flatMap((c) => c.options.map(({ id, ...data }) => ({ id, category: c.id, data })));
    await db.insert(programOptions).values(seed).onConflictDoNothing();
    rows = await db.select().from(programOptions);
  }
  return programCategories().map((c) => ({
    ...c,
    options: rows.filter((r) => r.category === c.id).map((r) => ({ ...r.data, id: r.id }) as ProgramOption),
  }));
}

export type OptionInput = Pick<ProgramOption, "title" | "description" | "includes" | "price" | "media" | "order" | "hidden">;

function locate(catalog: Catalog, id: string) {
  for (const category of catalog) {
    const option = category.options.find((o) => o.id === id && !o.archived);
    if (option) return { category, option };
  }
  return null;
}

/** A required category (menu, decor) must keep at least one option guests can pick. */
function lastOffered(catalog: Catalog, id: string) {
  const found = locate(catalog, id);
  if (!found?.category.required) return null;
  const list = offered(found.category);
  return list.length === 1 && list[0].id === id ? found.category : null;
}

/**
 * Bookings without an explicit menu or decor follow the catalog's defaults. Write those
 * defaults into them before the catalog changes, so their choice stays what it was.
 */
async function pinDefaults(catalog: Catalog) {
  const db = getDb();
  for (const c of catalog) {
    if (!c.required) continue;
    const list = offered(c);
    const inc = list.find((o) => o.price.type === "included") ?? list[0];
    if (!inc) continue;
    await db
      .update(bookings)
      .set({ extras: sql`jsonb_build_object(${c.id}::text, jsonb_build_array(${inc.id}::text)) || coalesce(${bookings.extras}, '{}'::jsonb)` })
      .where(and(isBanquet, sql`not (coalesce(${bookings.extras}, '{}'::jsonb) ? ${c.id})`));
  }
}

async function saveOption(category: CategoryId, option: ProgramOption) {
  const { id, ...data } = option;
  await getDb()
    .insert(programOptions)
    .values({ id, category, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: programOptions.id, set: { data, updatedAt: new Date() } });
}

export async function createOption(categoryId: CategoryId, input: OptionInput) {
  const catalog = await getCatalog();
  const category = catalog.find((c) => c.id === categoryId);
  if (!category) return { ok: false as const, error: "Нет такого раздела" };
  await pinDefaults(catalog);
  const option: ProgramOption = { ...input, id: `${categoryId}-${randomBytes(4).toString("hex")}` };
  await saveOption(categoryId, option);
  return { ok: true as const, option };
}

export async function updateOption(id: string, input: Partial<OptionInput>) {
  const catalog = await getCatalog();
  const found = locate(catalog, id);
  if (!found) return { ok: false as const, error: "Вариант не найден" };
  const required = input.hidden ? lastOffered(catalog, id) : null;
  if (required) return { ok: false as const, error: `В разделе «${required.title}» гостям должен остаться хотя бы один вариант` };
  await pinDefaults(catalog);
  const option: ProgramOption = { ...found.option, ...input };
  if (!option.hidden) delete option.hidden;
  await saveOption(found.category.id, option);
  return { ok: true as const, option };
}

/** Deleting keeps the option hidden in the store, so bookings that chose it still show what it was. */
export async function removeOption(id: string) {
  const catalog = await getCatalog();
  const found = locate(catalog, id);
  if (!found) return { ok: false as const, error: "Вариант не найден" };
  const required = lastOffered(catalog, id);
  if (required) return { ok: false as const, error: `В разделе «${required.title}» гостям должен остаться хотя бы один вариант` };
  await pinDefaults(catalog);
  await saveOption(found.category.id, { ...found.option, archived: true });
  return { ok: true as const };
}

/** Brings a deleted option back, hidden, so the manager can check it before guests see it again. */
export async function restoreOption(id: string) {
  const catalog = await getCatalog();
  for (const category of catalog) {
    const option = category.options.find((o) => o.id === id && o.archived);
    if (!option) continue;
    await pinDefaults(catalog);
    const restored: ProgramOption = { ...option, hidden: true };
    delete restored.archived;
    await saveOption(category.id, restored);
    return { ok: true as const, option: restored };
  }
  return { ok: false as const, error: "Вариант не найден" };
}

/** How many upcoming, not cancelled banquets have each option chosen. */
export async function optionUsage() {
  const rows = await getDb()
    .select({ extras: bookings.extras })
    .from(bookings)
    .where(and(isBanquet, active, gte(bookings.date, todayISO()), isNotNull(bookings.extras)));
  const usage: Record<string, number> = {};
  for (const { extras } of rows) for (const ids of Object.values(extras ?? {})) for (const id of ids ?? []) usage[id] = (usage[id] ?? 0) + 1;
  return usage;
}

/* ------------------------------------------------------------------ users */

/**
 * Admin sign-in. ADMIN_PASSWORD, when set, is the password of the "admin" account; on a
 * fresh production database that account is created on its first successful sign-in.
 */
export async function verifyAdmin(login: string, password: string): Promise<AdminUser | null> {
  const name = login.trim().toLowerCase();
  const db = getDb();
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.login, name)).limit(1);
  const envPassword = process.env.ADMIN_PASSWORD;

  if (name === "admin" && envPassword) {
    const a = Buffer.from(password);
    const b = Buffer.from(envPassword);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (user) return { id: user.id, login: user.login, name: user.name, role: "admin" };
    const created = { id: "u-admin", login: "admin", name: "Администратор", ...hashPassword(envPassword) };
    await db.insert(adminUsers).values(created).onConflictDoNothing();
    return { id: created.id, login: created.login, name: created.name, role: "admin" };
  }
  if (!user || !checkPassword(password, user.salt, user.hash)) return null;
  return { id: user.id, login: user.login, name: user.name, role: "admin" };
}

export async function getAdmin(id: string): Promise<AdminUser | null> {
  const [user] = await getDb().select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return user ? { id: user.id, login: user.login, name: user.name, role: "admin" } : null;
}
