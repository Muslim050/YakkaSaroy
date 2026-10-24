import { EVENT_TYPES, HALLS, RESTAURANT_HOURS, SLOTS, type HallId } from "./data";
import { STATUS_ORDER, type BookingStatus } from "./bookings";

/** Shared checks for booking fields coming from forms. Returns an error message or null. */
export function checkSlot(hall: string, date: string, slot: string): string | null {
  if (!HALLS.some((h) => h.id === hall)) return "Выберите зал";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Выберите дату";
  const ok = hall === "restaurant" ? RESTAURANT_HOURS.includes(slot) : SLOTS.some((s) => s.id === slot);
  return ok ? null : "Выберите время";
}

export function checkGuests(hall: HallId, guests: number): string | null {
  const max = HALLS.find((h) => h.id === hall)?.guestsMax ?? 0;
  return Number.isInteger(guests) && guests >= 1 && guests <= max ? null : `Количество гостей: от 1 до ${max}`;
}

export function isStatus(v: unknown): v is BookingStatus {
  return typeof v === "string" && (STATUS_ORDER as string[]).includes(v);
}

export function isEventType(v: unknown) {
  return typeof v === "string" && EVENT_TYPES.includes(v);
}
