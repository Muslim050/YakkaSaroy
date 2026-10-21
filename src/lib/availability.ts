"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { RESTAURANT_TABLES, type HallId, type SlotId } from "./data";

/** Shape returned by GET /api/availability for one day. */
export type DayAvailability = {
  grand: Record<SlotId, "free" | "booked">;
  small: Record<SlotId, "free" | "booked">;
  terrace: Record<SlotId, "free" | "booked">;
  restaurant: Record<string, number>; // hour -> free tables
};
export type MonthAvailability = Record<string, DayAvailability>;
export type DayState = "past" | "free" | "partial" | "full" | "unknown";

export const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function fromISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** "23 октября 2026" */
export function formatDate(s: string) {
  const d = fromISO(s);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}
/** "четверг, 23 октября" */
export function formatDateShort(s: string) {
  const d = fromISO(s);
  return `${WEEKDAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function dayState(entry: DayAvailability | undefined, hall: HallId, today: string, date: string): DayState {
  if (date < today) return "past";
  if (!entry) return "unknown";
  if (hall === "restaurant") {
    const free = Object.values(entry.restaurant);
    const total = free.length * RESTAURANT_TABLES;
    const sum = free.reduce((a, b) => a + b, 0);
    if (sum === 0) return "full";
    return sum < total * 0.35 ? "partial" : "free";
  }
  const freeCount = Object.values(entry[hall]).filter((s) => s === "free").length;
  if (freeCount === 2) return "free";
  if (freeCount === 1) return "partial";
  return "full";
}

/* ---------- today, read on the client only so the prerendered HTML stays stable ---------- */
const noSubscribe = () => () => {};
const todayISO = () => toISO(new Date());
export function useToday() {
  return useSyncExternalStore(noSubscribe, todayISO, () => "");
}

/* ---------- month cache shared by the hero check and the booking section ---------- */
const cache = new Map<string, Promise<MonthAvailability>>();
let version = 0;
const listeners = new Set<() => void>();

export function fetchMonth(key: string): Promise<MonthAvailability> {
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/availability?month=${key}`)
      .then((r) => {
        if (!r.ok) throw new Error(`availability ${r.status}`);
        return r.json() as Promise<{ days: MonthAvailability }>;
      })
      .then((j) => j.days);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** Call after a booking (or a 409) so every calendar refetches. */
export function invalidateAvailability() {
  cache.clear();
  version++;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Availability for one month ("YYYY-MM"); undefined while loading. */
export function useMonthAvailability(key: string): MonthAvailability | undefined {
  const v = useSyncExternalStore(subscribe, () => version, () => 0);
  const [data, setData] = useState<{ key: string; v: number; days: MonthAvailability } | null>(null);

  useEffect(() => {
    if (!key) return;
    let active = true;
    fetchMonth(key)
      .then((days) => {
        if (active) setData({ key, v, days });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [key, v]);

  return data && data.key === key ? data.days : undefined;
}
