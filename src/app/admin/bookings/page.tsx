import { Suspense } from "react";
import { Loader } from "@/components/app/Loader";
import { PageHeader } from "@/components/app/AppShell";
import { BookingsView } from "@/components/admin/BookingsView";
import { requireAdmin } from "@/lib/auth";
import { bookingStats, countByStatus, getBooking, getCatalog, listBookings, todayISO } from "@/lib/store";
import { isStatus } from "@/lib/validate";
import { HALLS, type HallId } from "@/lib/data";

export default function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  return (
    <>
      <PageHeader title="Брони" description="Заявки с сайта и брони менеджеров. Нажмите на строку, чтобы открыть карточку." />
      <Suspense fallback={<Loader className="min-h-[70vh]" label="Загружаем брони…" />}>
        <Bookings searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Bookings({ searchParams }: { searchParams: PageProps<"/admin/bookings">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const kind = one("kind") === "restaurant" ? "restaurant" : "halls";
  const rawStatus = one("status");
  const status = rawStatus === "all" || isStatus(rawStatus) ? rawStatus : "upcoming";
  const hall = HALLS.some((h) => h.id === one("hall") && h.id !== "restaurant") ? (one("hall") as HallId) : undefined;
  const q = one("q");
  const page = Number(one("page")) || 1;
  const currentMonth = todayISO().slice(0, 7);
  // "2026-11" or "all"; without one, the month we are in
  const rawMonth = one("month");
  const period = rawMonth === "all" || /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : currentMonth;
  const month = period === "all" ? undefined : period;
  // a search looks through every month: a client is looked for by name, not by date
  const listMonth = q ? undefined : month;

  const catalog = await getCatalog();
  const [list, counts, stats] = await Promise.all([
    listBookings({ kind, status, hall, month: listMonth, q, page }),
    countByStatus(kind, listMonth),
    kind === "halls" ? bookingStats(catalog, month, hall) : null,
  ]);
  const focus = one("open") ? await getBooking(one("open")) : null;

  return (
    <BookingsView
      rows={list.rows}
      total={list.total}
      page={list.page}
      pageSize={list.pageSize}
      counts={counts}
      query={{ kind, status, hall: hall ?? "", q, period }}
      currentMonth={currentMonth}
      stats={stats}
      focus={focus}
      catalog={catalog}
    />
  );
}
