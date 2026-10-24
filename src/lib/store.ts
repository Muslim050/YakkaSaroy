import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { HALLS, RESTAURANT_HOURS, RESTAURANT_TABLES, SLOTS, EVENT_TYPES, type HallId, type SlotId } from "./data";
import type { DayAvailability } from "./availability";
import { describeChange, type ProgramSelection } from "./program";
import {
  STATUS,
  estimateTotal,
  formatSum,
  phoneDigits,
  type Booking,
  type BookingStatus,
  type HistoryEntry,
} from "./bookings";

export type { Booking };

/* ------------------------------------------------------------------ types */

export type AdminUser = { id: string; login: string; name: string; role: "admin"; salt: string; hash: string };

type Store = {
  version: number;
  bookings: Booking[];
  users: AdminUser[];
  seededFrom?: string;
  seededUntil?: string;
};

const VERSION = 5;
const PAST_DAYS = 60;
const FUTURE_DAYS = 120;
const FILE = path.join(process.cwd(), "data", "bookings.json");

declare global {
  var __yakkaStore: Store | undefined;
}

/* ---------------------------------------------------------------- helpers */

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function newId() {
  return `b-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}
function newCode() {
  return `YS-${1000 + (randomBytes(2).readUInt16BE(0) % 9000)}`;
}
function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 32).toString("hex") };
}

/* ------------------------------------------------------------- demo seed */

const FIRST = ["Дилноза", "Тимур", "Шахноза", "Азиз", "Мадина", "Бехзод", "Нигора", "Жасур", "Камола", "Санжар", "Гульнора", "Отабек", "Феруза", "Рустам", "Малика", "Улугбек", "Севара", "Фаррух", "Лола", "Сардор"];
const LAST = ["Каримов", "Рахимов", "Юсупов", "Алимов", "Ташкентов", "Саидов", "Назаров", "Хамидов", "Усманов", "Мирзаев", "Абдуллаев", "Исмоилов", "Турсунов", "Ахмедов"];
const FEMALE = new Set(["Дилноза", "Шахноза", "Мадина", "Нигора", "Камола", "Гульнора", "Феруза", "Малика", "Севара", "Лола"]);

/** The two accounts documented in README for trying the client cabinet. */
const DEMO_CLIENTS = [
  { name: "Дилноза Каримова", phone: "+998 90 123 45 67" },
  { name: "Тимур Рахимов", phone: "+998 93 555 12 34" },
];

function seedStore(today: Date, keep: Booking[]): Store {
  const rand = mulberry(20261023);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const todayIso = toISODate(today);
  const out: Booking[] = [];
  let seq = 0;
  const taken = new Set<string>(); // hall|date|slot for banquet halls

  const person = () => {
    const f = pick(FIRST);
    const l = pick(LAST);
    const phone = `+998 9${Math.floor(rand() * 10)} ${String(Math.floor(rand() * 1000)).padStart(3, "0")} ${String(Math.floor(rand() * 100)).padStart(2, "0")} ${String(Math.floor(rand() * 100)).padStart(2, "0")}`;
    return { name: `${f} ${FEMALE.has(f) ? `${l}а` : l}`, phone };
  };

  const make = (b: Omit<Booking, "id" | "history" | "createdAt" | "updatedAt" | "source">, createdDaysBefore: number): Booking => {
    const created = addDays(new Date(`${b.date}T10:00:00`), -createdDaysBefore);
    const createdAt = (created > new Date() ? new Date(Date.now() - 86_400_000) : created).toISOString();
    const history: HistoryEntry[] = [{ at: createdAt, by: "client", text: "Заявка отправлена с сайта" }];
    if (b.status !== "new" && b.status !== "cancelled") history.push({ at: createdAt, by: "admin", text: "Менеджер подтвердил дату" });
    if (b.tastingAt) history.push({ at: createdAt, by: "admin", text: "Назначена дегустация" });
    if (b.prepayment) history.push({ at: createdAt, by: "admin", text: `Получена предоплата ${formatSum(b.prepayment)}` });
    if (b.status === "done") history.push({ at: `${b.date}T23:30:00`, by: "system", text: "Торжество проведено" });
    if (b.status === "cancelled") history.push({ at: createdAt, by: "client", text: "Заявка отменена" });
    return { ...b, id: `seed-${seq++}`, source: "seed", history, createdAt, updatedAt: createdAt };
  };

  // Demo client bookings first, so random seeds never take their slots.
  const d1 = addDays(today, 24);
  const d2 = addDays(today, 6);
  const d3 = addDays(today, 41);
  const demo: Booking[] = [
    make({ code: "YS-2026", hall: "grand", date: toISODate(d1), slot: "evening", guests: 420, ...DEMO_CLIENTS[0], eventType: "Свадьба", comment: "Детский стол на 20 человек", status: "prepaid", prepayment: 45_000_000, tastingAt: `${toISODate(addDays(today, -3))}T15:00`, extras: { menu: ["menu-dastarkhan"], decor: ["decor-flowers"], show: ["show-orchestra", "show-sparklers"], cake: ["cake-roses"], photo: ["photo-photographer"] }, demo: true }, 30),
    make({ code: "YS-2027", hall: "small", date: toISODate(d2), slot: "day", guests: 120, ...DEMO_CLIENTS[0], eventType: "Никох", status: "confirmed", tastingAt: `${toISODate(addDays(today, 2))}T13:00`, demo: true }, 9),
    make({ code: "YS-7341", hall: "small", date: toISODate(d3), slot: "evening", guests: 180, ...DEMO_CLIENTS[1], eventType: "Юбилей", comment: "60 лет отцу, нужен экран для видео", status: "new", demo: true }, 1),
  ];
  for (const b of demo) {
    out.push(b);
    taken.add(`${b.hall}|${b.date}|${b.slot}`);
  }

  for (let i = -PAST_DAYS; i < FUTURE_DAYS; i++) {
    const d = addDays(today, i);
    const iso = toISODate(d);
    const past = iso < todayIso;
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 5 || dow === 6;

    for (const hall of HALLS) {
      if (hall.id === "restaurant") {
        for (const h of RESTAURANT_HOURS) {
          const peak = h >= "18:00" && h <= "21:00";
          const base = (weekend ? 0.55 : 0.3) + (peak ? 0.3 : 0);
          const n = Math.round(rand() * base * RESTAURANT_TABLES);
          for (let t = 0; t < n; t++) {
            out.push(make({ code: `YS-${1000 + Math.floor(rand() * 9000)}`, hall: "restaurant", date: iso, slot: h, guests: 2 + Math.floor(rand() * 6), ...person(), status: past ? "done" : "confirmed", seeded: true }, 1 + Math.floor(rand() * 5)));
          }
        }
        continue;
      }
      for (const slot of SLOTS) {
        const p = weekend ? (slot.id === "evening" ? 0.85 : 0.5) : slot.id === "evening" ? 0.35 : 0.15;
        if (rand() >= p || taken.has(`${hall.id}|${iso}|${slot.id}`)) continue;
        const guests = Math.round(hall.guestsMax * (0.5 + rand() * 0.4));
        const r = rand();
        let status: BookingStatus;
        if (past) status = r < 0.05 ? "cancelled" : "done";
        else if (i <= 14) status = r < 0.7 ? "prepaid" : "confirmed";
        else status = r < 0.04 ? "new" : r < 0.55 ? "confirmed" : "prepaid";
        const total = estimateTotal({ hall: hall.id, guests }) ?? 0;
        const prepaid = status === "prepaid" || status === "done";
        out.push(
          make(
            {
              code: `YS-${1000 + Math.floor(rand() * 9000)}`,
              hall: hall.id,
              date: iso,
              slot: slot.id,
              guests,
              ...person(),
              eventType: pick(EVENT_TYPES.slice(0, 6)),
              status,
              prepayment: prepaid ? Math.round((total * 0.3) / 1_000_000) * 1_000_000 : undefined,
              tastingAt: status !== "new" && status !== "cancelled" ? `${toISODate(addDays(d, -10))}T15:00` : undefined,
              seeded: true,
            },
            20 + Math.floor(rand() * 70),
          ),
        );
        taken.add(`${hall.id}|${iso}|${slot.id}`);
      }
    }
  }

  const users: AdminUser[] = [
    { id: "u-admin", login: "admin", name: "Администратор", role: "admin", ...hashPassword("admin") },
    { id: "u-manager", login: "manager", name: "Шахноза, менеджер", role: "admin", ...hashPassword("manager") },
  ];

  return {
    version: VERSION,
    bookings: [...out, ...keep],
    users,
    seededFrom: toISODate(addDays(today, -PAST_DAYS)),
    seededUntil: toISODate(addDays(today, FUTURE_DAYS)),
  };
}

/** Bring bookings saved by an older version of the store up to the current shape. */
function migrate(b: Partial<Booking> & Pick<Booking, "id" | "hall" | "date" | "slot">): Booking {
  const createdAt = b.createdAt ?? new Date().toISOString();
  return {
    code: "",
    guests: 0,
    name: "",
    phone: "",
    status: "new",
    source: "site",
    history: [{ at: createdAt, by: "client", text: "Заявка отправлена с сайта" }],
    updatedAt: createdAt,
    ...b,
    createdAt,
  } as Booking;
}

/* ------------------------------------------------------------ persistence */

async function load(): Promise<Store> {
  // The cached copy survives hot reloads; drop it when the data shape has changed.
  if (globalThis.__yakkaStore?.version === VERSION) return globalThis.__yakkaStore;
  let raw: Partial<Store> = {};
  try {
    raw = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<Store>;
  } catch {
    /* first run */
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = toISODate(addDays(today, FUTURE_DAYS));
  // Real requests (from the site or the admin) always survive a re-seed.
  const real = (raw.bookings ?? []).filter((b) => !b.seeded && !b.demo).map(migrate);

  let store: Store;
  if (raw.version !== VERSION || !raw.seededUntil || raw.seededUntil < horizon) {
    store = seedStore(today, real);
    if (raw.version === VERSION && raw.users?.length) store.users = raw.users;
    await persist(store);
  } else {
    store = raw as Store;
  }
  globalThis.__yakkaStore = store;
  return store;
}

async function persist(store: Store) {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(store));
  } catch {
    /* read-only FS (e.g. serverless): keep in memory only */
  }
}

const active = (b: Booking) => b.status !== "cancelled";

/* ----------------------------------------------------------- availability */

export async function availabilityForMonth(month: string): Promise<Record<string, DayAvailability>> {
  const store = await load();
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const result: Record<string, DayAvailability> = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    result[iso] = {
      grand: { day: "free", evening: "free" },
      small: { day: "free", evening: "free" },
      terrace: { day: "free", evening: "free" },
      restaurant: Object.fromEntries(RESTAURANT_HOURS.map((h) => [h, RESTAURANT_TABLES])),
    };
  }
  for (const b of store.bookings) {
    const entry = result[b.date];
    if (!entry || !active(b)) continue;
    if (b.hall === "restaurant") {
      if (entry.restaurant[b.slot] !== undefined) entry.restaurant[b.slot] = Math.max(0, entry.restaurant[b.slot] - 1);
    } else {
      entry[b.hall][b.slot as SlotId] = "booked";
    }
  }
  return result;
}

export async function isFree(hall: HallId, date: string, slot: string, exceptId?: string) {
  const store = await load();
  const same = store.bookings.filter((b) => b.hall === hall && b.date === date && b.slot === slot && active(b) && b.id !== exceptId);
  if (hall === "restaurant") return same.length < RESTAURANT_TABLES;
  return same.length === 0;
}

/* --------------------------------------------------------------- bookings */

export type NewBooking = Pick<Booking, "hall" | "date" | "slot" | "guests" | "name" | "phone" | "eventType" | "comment"> &
  Partial<Pick<Booking, "status" | "managerNote">>;

export async function createBooking(input: NewBooking, by: "client" | "admin" = "client") {
  const store = await load();
  const now = new Date().toISOString();
  const status = input.status ?? (by === "admin" ? "confirmed" : "new");
  const history: HistoryEntry[] = [
    { at: now, by, text: by === "admin" ? "Бронь создана менеджером" : "Заявка отправлена с сайта" },
  ];
  if (status !== "new") history.push({ at: now, by, text: `Статус: ${STATUS[status].label.toLowerCase()}` });
  const booking: Booking = {
    ...input,
    id: newId(),
    code: newCode(),
    status,
    source: by === "admin" ? "admin" : "site",
    history,
    createdAt: now,
    updatedAt: now,
  };
  store.bookings.push(booking);
  await persist(store);
  return booking;
}

export async function getBooking(id: string) {
  const store = await load();
  return store.bookings.find((b) => b.id === id) ?? null;
}

export type BookingPatch = Partial<Pick<Booking, "status" | "guests" | "eventType" | "comment" | "prepayment" | "tastingAt" | "managerNote" | "name" | "phone">> & {
  extras?: ProgramSelection;
};

/** Apply a change and write a readable line into the booking's history. */
export async function updateBooking(id: string, patch: BookingPatch, by: "client" | "admin") {
  const store = await load();
  const b = store.bookings.find((x) => x.id === id);
  if (!b) return null;
  const now = new Date().toISOString();
  const log = (text: string) => b.history.push({ at: now, by, text });

  if (patch.status && patch.status !== b.status) {
    log(patch.status === "cancelled" && by === "client" ? "Клиент отменил заявку" : `Статус: ${STATUS[patch.status].label.toLowerCase()}`);
    b.status = patch.status;
  }
  if (patch.guests !== undefined && patch.guests !== b.guests) {
    log(`Гостей: ${b.guests} → ${patch.guests}`);
    b.guests = patch.guests;
  }
  if (patch.prepayment !== undefined && patch.prepayment !== (b.prepayment ?? 0)) {
    log(patch.prepayment ? `Предоплата: ${formatSum(patch.prepayment)}` : "Предоплата обнулена");
    b.prepayment = patch.prepayment || undefined;
  }
  if (patch.tastingAt !== undefined && patch.tastingAt !== (b.tastingAt ?? "")) {
    log(patch.tastingAt ? "Назначена дегустация" : "Дегустация отменена");
    b.tastingAt = patch.tastingAt || undefined;
  }
  if (patch.eventType !== undefined && patch.eventType !== b.eventType) {
    log(`Повод: ${patch.eventType}`);
    b.eventType = patch.eventType;
  }
  if (patch.comment !== undefined && patch.comment !== (b.comment ?? "")) {
    log(by === "client" ? "Клиент изменил пожелания" : "Изменены пожелания");
    b.comment = patch.comment || undefined;
  }
  if (patch.name !== undefined && patch.name !== b.name) {
    log("Изменено имя клиента");
    b.name = patch.name;
  }
  if (patch.phone !== undefined && patch.phone !== b.phone) {
    log("Изменён телефон клиента");
    b.phone = patch.phone;
  }
  if (patch.extras !== undefined) {
    const line = describeChange(b.extras, patch.extras);
    if (line) log(line);
    b.extras = patch.extras;
  }
  if (patch.managerNote !== undefined) b.managerNote = patch.managerNote || undefined;
  b.updatedAt = now;
  await persist(store);
  return b;
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
  const store = await load();
  const today = toISODate(new Date());
  const q = query.q?.trim().toLowerCase() ?? "";
  const qDigits = q.replace(/\D/g, "");
  let rows = store.bookings.filter((b) => (query.kind === "restaurant" ? b.hall === "restaurant" : b.hall !== "restaurant"));
  if (query.hall) rows = rows.filter((b) => b.hall === query.hall);
  const status = query.status ?? "upcoming";
  if (status === "upcoming") rows = rows.filter((b) => b.date >= today && active(b));
  else if (status !== "all") rows = rows.filter((b) => b.status === status);
  if (q)
    rows = rows.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && phoneDigits(b.phone).includes(qDigits)),
    );
  // Upcoming first by date; finished and cancelled ones newest first.
  const desc = status === "done" || status === "cancelled" || status === "all";
  rows.sort((a, b) => (desc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) || a.slot.localeCompare(b.slot));
  const pageSize = query.pageSize ?? 25;
  const total = rows.length;
  const page = Math.min(Math.max(1, query.page ?? 1), Math.max(1, Math.ceil(total / pageSize)));
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

export async function countByStatus(kind: "halls" | "restaurant") {
  const store = await load();
  const today = toISODate(new Date());
  const counts: Record<BookingStatus | "upcoming" | "all", number> = { upcoming: 0, all: 0, new: 0, confirmed: 0, prepaid: 0, done: 0, cancelled: 0 };
  for (const b of store.bookings) {
    if ((kind === "restaurant") !== (b.hall === "restaurant")) continue;
    counts.all++;
    counts[b.status]++;
    if (b.date >= today && active(b)) counts.upcoming++;
  }
  return counts;
}

/** Banquet bookings of one month for the admin calendar. */
export async function hallBookingsForMonth(month: string) {
  const store = await load();
  return store.bookings.filter((b) => b.hall !== "restaurant" && b.date.startsWith(month) && active(b));
}

/* ---------------------------------------------------------------- clients */

/** A client's own bookings, newest event first. */
export async function bookingsByPhone(phone: string) {
  const store = await load();
  const d = phoneDigits(phone);
  return store.bookings.filter((b) => phoneDigits(b.phone) === d).sort((a, b) => b.date.localeCompare(a.date));
}

/** Client login: the phone must own a booking with that code. */
export async function findClient(phone: string, code: string) {
  const store = await load();
  const d = phoneDigits(phone);
  const c = code.trim().toUpperCase().replace(/^YS-?/, "YS-");
  if (d.length !== 12 || !/^YS-\d{4}$/.test(c)) return null;
  const match = store.bookings.find((b) => phoneDigits(b.phone) === d && b.code.toUpperCase() === c);
  return match ? { phone: d, name: match.name } : null;
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
  const store = await load();
  const today = toISODate(new Date());
  const map = new Map<string, ClientSummary>();
  for (const b of store.bookings) {
    if (b.hall === "restaurant") continue;
    const key = phoneDigits(b.phone);
    const c = map.get(key) ?? { phone: b.phone, name: b.name, bookings: 0, upcoming: 0, lastDate: b.date, spent: 0 };
    c.bookings++;
    if (b.date >= today && active(b)) {
      c.upcoming++;
      if (!c.nextDate || b.date < c.nextDate) c.nextDate = b.date;
    }
    if (b.date > c.lastDate) c.lastDate = b.date;
    if (b.status === "done") c.spent += estimateTotal(b) ?? 0;
    else c.spent += b.prepayment ?? 0;
    map.set(key, c);
  }
  let rows = [...map.values()];
  const s = q?.trim().toLowerCase();
  if (s) {
    const digits = s.replace(/\D/g, "");
    rows = rows.filter((c) => c.name.toLowerCase().includes(s) || (digits.length >= 3 && phoneDigits(c.phone).includes(digits)));
  }
  return rows.sort((a, b) => (a.nextDate ?? "9999").localeCompare(b.nextDate ?? "9999") || b.lastDate.localeCompare(a.lastDate));
}

/* --------------------------------------------------------------- overview */

export async function overview() {
  const store = await load();
  const now = new Date();
  const today = toISODate(now);
  const in7 = toISODate(addDays(now, 7));
  const in30 = toISODate(addDays(now, 30));
  const halls = store.bookings.filter((b) => b.hall !== "restaurant");

  const newRequests = halls.filter((b) => b.status === "new").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const week = halls.filter((b) => b.date >= today && b.date < in7 && active(b)).sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
  const next30 = halls.filter((b) => b.date >= today && b.date < in30 && active(b));
  const prepaid30 = next30.reduce((s, b) => s + (b.prepayment ?? 0), 0);
  const expected30 = next30.reduce((s, b) => s + (estimateTotal(b) ?? 0), 0);
  const tastings = halls
    .filter((b) => b.tastingAt && b.tastingAt.slice(0, 10) >= today && b.tastingAt.slice(0, 10) < in7 && active(b))
    .sort((a, b) => (a.tastingAt ?? "").localeCompare(b.tastingAt ?? ""));

  // Share of the 60 day/evening slots of each hall taken in the next 30 days.
  const occupancy = HALLS.filter((h) => h.id !== "restaurant").map((h) => ({
    hall: h.id,
    name: h.name,
    taken: next30.filter((b) => b.hall === h.id).length,
    slots: 30 * SLOTS.length,
  }));
  const tablesToday = store.bookings.filter((b) => b.hall === "restaurant" && b.date === today && active(b)).length;

  return { newRequests, week, next30: next30.length, prepaid30, expected30, tastings, occupancy, tablesToday };
}

/* ------------------------------------------------------------------ users */

export async function verifyAdmin(login: string, password: string) {
  const store = await load();
  const user = store.users.find((u) => u.login === login.trim().toLowerCase());
  if (!user) return null;
  // ADMIN_PASSWORD, when set, replaces the demo password of the "admin" account.
  if (user.login === "admin" && process.env.ADMIN_PASSWORD) {
    const a = Buffer.from(password);
    const b = Buffer.from(process.env.ADMIN_PASSWORD);
    return a.length === b.length && timingSafeEqual(a, b) ? user : null;
  }
  const { hash } = hashPassword(password, user.salt);
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex")) ? user : null;
}

export async function getAdmin(id: string) {
  const store = await load();
  return store.users.find((u) => u.id === id) ?? null;
}
