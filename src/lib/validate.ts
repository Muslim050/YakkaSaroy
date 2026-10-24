import { EVENT_TYPES, HALLS, RESTAURANT_HOURS, SLOTS, type HallId } from "./data";
import { STATUS_ORDER, type BookingStatus } from "./bookings";
import type { CategoryId, Media } from "./program";
import type { OptionInput } from "./store";

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

/* ---------------------------------------------------------------- catalog */

const isLink = (v: unknown): v is string => typeof v === "string" && v.length <= 2000 && (/^https:\/\/\S+$/.test(v) || /^\/[^/\s]\S*$/.test(v));
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function parseMedia(raw: unknown): Media[] | string {
  if (!Array.isArray(raw)) return "Не удалось прочитать фото и видео";
  if (raw.length > 12) return "Не больше 12 фото и видео на вариант";
  const out: Media[] = [];
  for (const m of raw as Record<string, unknown>[]) {
    if (!m || typeof m !== "object" || !isLink(m.src)) return "Ссылка на фото или видео должна начинаться с https://";
    const alt = text(m.alt, 120);
    if (m.kind === "image") out.push({ kind: "image", src: m.src, alt });
    else if (m.kind === "video") {
      if (m.poster !== undefined && m.poster !== "" && !isLink(m.poster)) return "Ссылка на обложку видео должна начинаться с https://";
      out.push({ kind: "video", src: m.src, alt, ...(m.poster ? { poster: String(m.poster) } : {}) });
    } else return "Неизвестный тип медиа";
  }
  return out;
}

/**
 * A catalog option from the admin form. With `partial`, only the fields present are
 * checked and returned (for edits); otherwise title and price are required.
 */
export function parseOption(body: Record<string, unknown>, partial: boolean): { ok: true; value: Partial<OptionInput> } | { ok: false; error: string } {
  const v: Partial<OptionInput> = {};
  const has = (k: string) => !partial || body[k] !== undefined;

  if (has("title")) {
    const title = text(body.title, 80);
    if (title.length < 2) return { ok: false, error: "Укажите название варианта" };
    v.title = title;
  }
  if (has("description")) v.description = text(body.description, 600);
  if (has("includes")) {
    if (body.includes !== undefined && !Array.isArray(body.includes)) return { ok: false, error: "Состав должен быть списком" };
    v.includes = ((body.includes as unknown[]) ?? []).map((x) => text(x, 140)).filter(Boolean).slice(0, 15);
  }
  if (has("price")) {
    const p = body.price as { type?: unknown; amount?: unknown } | undefined;
    const amount = Number(p?.amount);
    if (p?.type === "included") v.price = { type: "included" };
    else if (p?.type === "perGuest" || p?.type === "fixed") {
      if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000_000) return { ok: false, error: "Укажите сумму целым числом больше нуля" };
      v.price = { type: p.type, amount };
    } else return { ok: false, error: "Выберите, как считается цена" };
  }
  if (has("order")) {
    const order = Number(body.order ?? 0);
    if (!Number.isInteger(order) || Math.abs(order) > 100_000) return { ok: false, error: "Порядок должен быть целым числом" };
    v.order = order;
  }
  if (has("hidden")) v.hidden = body.hidden === true;
  if (has("media")) {
    const media = parseMedia(body.media ?? []);
    if (typeof media === "string") return { ok: false, error: media };
    v.media = media;
  }
  return { ok: true, value: v };
}

export function isCategoryId(v: unknown): v is CategoryId {
  return typeof v === "string" && ["menu", "decor", "show", "cake", "photo"].includes(v);
}
