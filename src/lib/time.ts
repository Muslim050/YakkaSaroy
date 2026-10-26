/**
 * Dates of the venue are Tashkent dates. Servers (Vercel) run in UTC, so "today" is
 * computed in Asia/Tashkent explicitly instead of from the server clock's local day.
 */
export const VENUE_TZ = "Asia/Tashkent";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: VENUE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** "YYYY-MM-DD" of the given moment in Tashkent (now by default). */
export function todayISO(now = new Date()) {
  return dayFormat.format(now);
}

/** Calendar arithmetic on "YYYY-MM-DD" strings, independent of any time zone. */
export function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday for a "YYYY-MM-DD" date. */
export function weekdayISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
