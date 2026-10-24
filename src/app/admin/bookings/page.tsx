import { Suspense } from "react";
import { PageHeader } from "@/components/app/AppShell";
import { BookingsView } from "@/components/admin/BookingsView";
import { requireAdmin } from "@/lib/auth";
import { countByStatus, getBooking, getCatalog, listBookings } from "@/lib/store";
import { isStatus } from "@/lib/validate";
import { HALLS, type HallId } from "@/lib/data";

export default function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  return (
    <>
      <PageHeader title="Брони" description="Заявки с сайта и брони менеджеров. Нажмите на строку, чтобы открыть карточку." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-secondary" />}>
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

  const [list, counts, catalog] = await Promise.all([listBookings({ kind, status, hall, q, page }), countByStatus(kind), getCatalog()]);
  const focus = one("open") ? await getBooking(one("open")) : null;

  return (
    <BookingsView
      rows={list.rows}
      total={list.total}
      page={list.page}
      pageSize={list.pageSize}
      counts={counts}
      query={{ kind, status, hall: hall ?? "", q }}
      focus={focus}
      catalog={catalog}
    />
  );
}
