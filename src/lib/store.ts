import { promises as fs } from "node:fs";
import path from "node:path";
import { HALLS, RESTAURANT_HOURS, RESTAURANT_TABLES, SLOTS, type HallId, type SlotId } from "./data";
import type { DayAvailability } from "./availability";

export type Booking = {
  id: string;
  code: string;
  hall: HallId;
  date: string; // YYYY-MM-DD
  slot: string; // "day" | "evening" | "19:00"
  guests: number;
  name: string;
  phone: string;
  eventType?: string;
  comment?: string;
  createdAt: string;
  seeded?: boolean;
};

const FILE = path.join(process.cwd(), "data", "bookings.json");

type Store = { bookings: Booking[]; seededUntil?: string };

declare global {
  var __yakkaStore: Store | undefined;
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

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Deterministic demo bookings: weekends are mostly taken, weekdays are mostly free. */
function seedBookings(from: Date, days: number): Booking[] {
  const out: Booking[] = [];
  const rand = mulberry(20261019);
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const iso = toISODate(d);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6 || dow === 5;
    for (const hall of HALLS) {
      if (hall.id === "restaurant") {
        for (const h of RESTAURANT_HOURS) {
          const peak = h >= "18:00" && h <= "21:00";
          const base = (weekend ? 0.55 : 0.3) + (peak ? 0.3 : 0);
          const taken = Math.round(rand() * base * RESTAURANT_TABLES);
          for (let t = 0; t < taken; t++) {
            out.push(mk(hall.id, iso, h, 2 + Math.floor(rand() * 6), out.length));
          }
        }
        continue;
      }
      for (const slot of SLOTS) {
        const p = weekend ? (slot.id === "evening" ? 0.85 : 0.5) : slot.id === "evening" ? 0.35 : 0.15;
        if (rand() < p) out.push(mk(hall.id, iso, slot.id, Math.round(hall.guestsMax * (0.5 + rand() * 0.4)), out.length));
      }
    }
  }
  return out;

  function mk(hall: HallId, date: string, slot: string, guests: number, n: number): Booking {
    return {
      id: `seed-${n}`,
      code: "",
      hall,
      date,
      slot,
      guests,
      name: "",
      phone: "",
      createdAt: new Date(0).toISOString(),
      seeded: true,
    };
  }
}

async function load(): Promise<Store> {
  if (globalThis.__yakkaStore) return globalThis.__yakkaStore;
  let store: Store = { bookings: [] };
  try {
    store = JSON.parse(await fs.readFile(FILE, "utf8")) as Store;
  } catch {
    /* first run */
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 120);
  if (!store.seededUntil || store.seededUntil < toISODate(horizon)) {
    const real = store.bookings.filter((b) => !b.seeded);
    store = { bookings: [...seedBookings(today, 120), ...real], seededUntil: toISODate(horizon) };
    await persist(store);
  }
  globalThis.__yakkaStore = store;
  return store;
}

async function persist(store: Store) {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(store, null, 2));
  } catch {
    /* read-only FS (e.g. serverless): keep in memory only */
  }
}

export async function availabilityForMonth(month: string): Promise<Record<string, DayAvailability>> {
  const store = await load();
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const result: Record<string, DayAvailability> = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const entry: DayAvailability = {
      grand: { day: "free", evening: "free" },
      small: { day: "free", evening: "free" },
      terrace: { day: "free", evening: "free" },
      restaurant: Object.fromEntries(RESTAURANT_HOURS.map((h) => [h, RESTAURANT_TABLES])),
    };
    for (const b of store.bookings) {
      if (b.date !== iso) continue;
      if (b.hall === "restaurant") {
        if (entry.restaurant[b.slot] !== undefined) entry.restaurant[b.slot] = Math.max(0, entry.restaurant[b.slot] - 1);
      } else {
        entry[b.hall][b.slot as SlotId] = "booked";
      }
    }
    result[iso] = entry;
  }
  return result;
}

export async function isFree(hall: HallId, date: string, slot: string) {
  const store = await load();
  const same = store.bookings.filter((b) => b.hall === hall && b.date === date && b.slot === slot);
  if (hall === "restaurant") return same.length < RESTAURANT_TABLES;
  return same.length === 0;
}

export async function createBooking(input: Omit<Booking, "id" | "code" | "createdAt" | "seeded">) {
  const store = await load();
  const id = `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const code = `YS-${String(Math.floor(1000 + Math.random() * 9000))}`;
  const booking: Booking = { ...input, id, code, createdAt: new Date().toISOString() };
  store.bookings.push(booking);
  await persist(store);
  return booking;
}
