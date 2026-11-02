import { CalendarBoard } from "@/components/admin/CalendarBoard";
import { Loader } from "@/components/app/Loader";
import { requireAdmin } from "@/lib/auth";
import { HALLS, type HallId } from "@/lib/data";
import { getCatalog, hallBookingsForMonth, todayISO } from "@/lib/store";

type Params = Record<string, string | string[] | undefined>;

/** The hall calendar for the month and hall named in the page's query string. */
export async function HallCalendar({ searchParams, path = "/admin" }: { searchParams: Promise<Params>; path?: string }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const month = typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const hall = HALLS.some((h) => h.id === sp.hall && h.id !== "restaurant") ? (sp.hall as HallId) : "all";
  const [bookings, catalog] = await Promise.all([hallBookingsForMonth(month), getCatalog()]);

  return <CalendarBoard key={month} month={month} initialHall={hall} bookings={bookings} catalog={catalog} today={today} path={path} />;
}

export function HallCalendarSkeleton() {
  return <Loader className="h-[600px]" label="Загружаем календарь…" />;
}
