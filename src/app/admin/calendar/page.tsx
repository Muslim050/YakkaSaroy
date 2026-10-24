import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { CalendarBoard } from "@/components/admin/CalendarBoard";
import { requireAdmin } from "@/lib/auth";
import { hallBookingsForMonth, toISODate } from "@/lib/store";
import { STATUS, STATUS_ORDER } from "@/lib/bookings";

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

export default function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-xl bg-secondary" />}>
      <Board searchParams={searchParams} />
    </Suspense>
  );
}

async function Board({ searchParams }: { searchParams: PageProps<"/admin/calendar">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const now = new Date();
  const today = toISODate(now);
  const raw = typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const [y, m] = raw.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  const days = Array.from({ length: count }, (_, i) => `${raw}-${String(i + 1).padStart(2, "0")}`);
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const bookings = await hallBookingsForMonth(raw);

  return (
    <>
      <PageHeader title="Календарь залов" description="Пустая ячейка свободна: нажмите на неё, чтобы записать бронь на это время.">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <Link href={`/admin/calendar?month=${shift(-1)}`} aria-label="Предыдущий месяц" className="grid size-8 place-items-center rounded-md hover:bg-secondary">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-36 text-center font-display text-xl text-night">
            {MONTHS[m - 1]} {y}
          </span>
          <Link href={`/admin/calendar?month=${shift(1)}`} aria-label="Следующий месяц" className="grid size-8 place-items-center rounded-md hover:bg-secondary">
            <ChevronRight className="size-4" />
          </Link>
        </div>
        {raw !== today.slice(0, 7) && (
          <Link href="/admin/calendar" className="h-10 rounded-lg px-3 text-sm leading-10 text-muted-foreground hover:text-ink">
            Сегодня
          </Link>
        )}
      </PageHeader>

      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {STATUS_ORDER.filter((s) => s !== "cancelled").map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`h-3 w-1 rounded-sm ${s === "new" ? "bg-amber-500" : s === "confirmed" ? "bg-sky-500" : s === "prepaid" ? "bg-emerald-600" : "bg-stone-400"}`} />
            {STATUS[s].label}
          </li>
        ))}
      </ul>

      <CalendarBoard days={days} bookings={bookings} today={today} />
    </>
  );
}
