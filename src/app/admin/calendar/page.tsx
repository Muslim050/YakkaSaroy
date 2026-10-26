import { Suspense } from "react";
import { PageHeader } from "@/components/app/AppShell";
import { CalendarBoard } from "@/components/admin/CalendarBoard";
import { requireAdmin } from "@/lib/auth";
import { HALLS, type HallId } from "@/lib/data";
import { getCatalog, hallBookingsForMonth, todayISO } from "@/lib/store";

export default function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  return (
    <>
      <PageHeader title="Календарь залов" description="Свободное время видно сразу: нажмите на него, чтобы записать бронь, или перетащите бронь, чтобы перенести её." />
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-xl bg-secondary" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Board({ searchParams }: { searchParams: PageProps<"/admin/calendar">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const month = typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const hall = HALLS.some((h) => h.id === sp.hall && h.id !== "restaurant") ? (sp.hall as HallId) : "all";
  const [bookings, catalog] = await Promise.all([hallBookingsForMonth(month), getCatalog()]);

  return <CalendarBoard key={month} month={month} initialHall={hall} bookings={bookings} catalog={catalog} today={today} />;
}
