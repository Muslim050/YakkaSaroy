import { HALLS, SLOTS, type HallId } from "./data";
import { programCost, type Catalog, type ProgramSelection } from "./program";

/**
 * Booking lifecycle, in the same order as the steps on the public page:
 * request -> manager holds the date -> prepayment fixes it -> event happens.
 */
export type BookingStatus = "new" | "confirmed" | "prepaid" | "done" | "cancelled";

export const STATUS: Record<BookingStatus, { label: string; short: string; className: string }> = {
  new: { label: "Новая заявка", short: "Новая", className: "bg-amber-100 text-amber-900 ring-amber-300/60" },
  confirmed: { label: "Дата придержана", short: "Придержана", className: "bg-sky-100 text-sky-900 ring-sky-300/60" },
  prepaid: { label: "Предоплата внесена", short: "Предоплата", className: "bg-emerald-100 text-emerald-900 ring-emerald-300/60" },
  done: { label: "Проведено", short: "Проведено", className: "bg-stone-200 text-stone-700 ring-stone-300/60" },
  cancelled: { label: "Отменена", short: "Отменена", className: "bg-rose-100 text-rose-900 ring-rose-300/60" },
};
export const STATUS_ORDER: BookingStatus[] = ["new", "confirmed", "prepaid", "done", "cancelled"];

export type HistoryEntry = { at: string; by: "client" | "admin" | "system"; text: string };

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
  status: BookingStatus;
  /** Prepayment received, in sum. */
  prepayment?: number;
  /** Tasting appointment, "YYYY-MM-DDTHH:mm". */
  tastingAt?: string;
  managerNote?: string;
  /** Chosen menu, decor, show, cake, photo; missing required parts mean the included defaults. */
  extras?: ProgramSelection;
  source: "site" | "admin" | "seed";
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
  /** Generated demo data: replaced whenever the demo calendar is re-seeded. */
  seeded?: boolean;
  demo?: boolean;
};

/** Uzbek numbers as 12 digits with the 998 country code, so "+998 90 123-45-67" and "901234567" match. */
export function phoneDigits(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 9) return `998${d}`;
  return d;
}

export function formatPhone(phone: string) {
  const d = phoneDigits(phone);
  if (d.length !== 12) return phone;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
}

export function hallName(hall: HallId) {
  return HALLS.find((h) => h.id === hall)?.name ?? hall;
}

export function slotLabel(hall: HallId, slot: string) {
  if (hall === "restaurant") return `столик на ${slot}`;
  const s = SLOTS.find((x) => x.id === slot);
  return s ? `${s.name.toLowerCase()}, ${s.time}` : slot;
}

/** Banquet estimate: hall price per guest plus the chosen program. Restaurant tables have no estimate. */
export function estimateTotal(b: Pick<Booking, "hall" | "guests"> & { extras?: ProgramSelection }, catalog: Catalog) {
  const price = HALLS.find((h) => h.id === b.hall)?.pricePerGuest;
  return price ? price * b.guests + programCost(catalog, b.extras, b.guests) : null;
}

/** Hall part of the estimate only (includes the classic menu and decor). */
export function hallCost(b: Pick<Booking, "hall" | "guests">) {
  const price = HALLS.find((h) => h.id === b.hall)?.pricePerGuest;
  return price ? price * b.guests : null;
}

/** "1,26 млрд сум", "45 млн сум" for tight spots like dashboard tiles. */
export function formatSumShort(n: number) {
  const f = (x: number) => x.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  if (n >= 1e9) return `${f(n / 1e9)} млрд сум`;
  if (n >= 1e6) return `${f(n / 1e6)} млн сум`;
  return formatSum(n);
}

export function formatSum(n: number) {
  return `${n.toLocaleString("ru-RU").replace(/,/g, " ")} сум`;
}

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

/** "23 октября 2026" */
export function formatDay(iso: string, withWeekday = false) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${withWeekday ? `${wd}, ` : ""}${d} ${MONTHS_GEN[m - 1]} ${y}`;
}

/** "23 окт, 14:30" for timestamps and tasting appointments */
export function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()].slice(0, 3)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Statuses a client may still change or cancel. */
export function clientCanEdit(b: Pick<Booking, "status">) {
  return b.status === "new" || b.status === "confirmed";
}

/** What a client may see of their own booking: no internal notes or bookkeeping flags. */
export type ClientBooking = Omit<Booking, "managerNote" | "source" | "seeded" | "demo">;

export function toClientView(b: Booking): ClientBooking {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { managerNote, source, seeded, demo, ...rest } = b;
  return { ...rest, history: rest.history.filter((h) => h.by !== "system" || h.text === "Торжество проведено") };
}
