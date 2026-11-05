import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, CalendarCheck, Coins, Gem, Phone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/app/StatusBadge";
import { HallCalendar } from "@/components/admin/HallCalendar";
import { Loader } from "@/components/app/Loader";
import { requireAdmin } from "@/lib/auth";
import { overview, todayISO } from "@/lib/store";
import { formatDateTime, formatDay, formatPhone, formatSumShort, hallName, slotLabel, type Booking } from "@/lib/bookings";

export default function AdminHome({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

const open = (b: Booking) => `/admin/bookings?status=all&open=${b.id}`;

async function Overview({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await requireAdmin();
  const o = await overview();
  const today = todayISO();

  // group the week's events by day
  const byDay = new Map<string, Booking[]>();
  for (const b of o.week) byDay.set(b.date, [...(byDay.get(b.date) ?? []), b]);

  return (
    <>
      <h1 className="sr-only">Обзор</h1>
      <div className="mb-8 rounded-[24px] border border-border bg-[#f6f2ee] p-4 shadow-[0_16px_45px_-30px_rgba(50,38,28,.3)] sm:p-5">
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <Kpi icon={CalendarCheck} label="Новые заявки" value={String(o.newRequests.length)} note="ждут звонка" href="/admin/bookings?status=new" alert={o.newRequests.length > 0} />
        <Kpi icon={Gem} label="Торжеств за 30 дней" value={String(o.next30)} note="во всех залах" href="#calendar" />
        <Kpi icon={Coins} label="Предоплаты за 30 дней" value={formatSumShort(o.prepaid30)} note={`из ${formatSumShort(o.expected30)} по банкетному меню`} />
      </div>

      <section id="calendar" className="mb-8 scroll-mt-6">
        <HallCalendar searchParams={searchParams} path="/admin" />
      </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-2xl text-night">Ближайшие 7 дней</h2>
            <Link href="/admin/bookings" className="text-sm text-muted-foreground hover:text-ink">Все брони</Link>
          </header>
          {byDay.size ? (
            <ol>
              {[...byDay.entries()].map(([day, list]) => (
                <li key={day} className="grid gap-2 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[150px_1fr]">
                  <p className="text-sm font-medium text-ink">
                    {day === today ? "Сегодня" : formatDay(day, true).replace(/ \d{4}$/, "")}
                  </p>
                  <ul className="grid gap-2">
                    {list.map((b) => (
                      <li key={b.id}>
                        <Link href={open(b)} className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg px-2 py-1.5 -mx-2 hover:bg-secondary/70">
                          <span className="min-w-0">
                            <span className="block text-sm text-ink">{b.name}, {b.eventType?.toLowerCase() ?? "торжество"}</span>
                            <span className="block text-xs text-muted-foreground">
                              {hallName(b.hall)}, {slotLabel(b.hall, b.slot)}, {b.guests} гостей
                            </span>
                          </span>
                          <StatusBadge status={b.status} short />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">На этой неделе торжеств нет.</p>
          )}
        </section>

        <div className="grid h-fit gap-6">
          <section className="rounded-xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-2xl text-night">Позвонить по заявкам</h2>
              <span className="text-sm text-muted-foreground tabular-nums">{o.newRequests.length}</span>
            </header>
            {o.newRequests.length ? (
              <ul>
                {o.newRequests.slice(0, 6).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0">
                    <Link href={open(b)} className="min-w-0 hover:underline">
                      <span className="block truncate text-sm text-ink">{b.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hallName(b.hall)}, {formatDay(b.date)}, заявка {formatDateTime(b.createdAt)}
                      </span>
                    </Link>
                    <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs tabular-nums hover:bg-secondary">
                      <Phone className="size-3.5" /> {formatPhone(b.phone)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Все заявки обработаны.</p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card px-5 py-4">
            <h2 className="font-display text-2xl text-night">Загрузка залов</h2>
            <p className="mt-1 text-xs text-muted-foreground">Занятые дневные и вечерние торжества на 30 дней вперёд</p>
            <ul className="mt-4 grid gap-3">
              {o.occupancy.map((h) => {
                const pct = Math.round((h.taken / h.slots) * 100);
                return (
                  <li key={h.hall}>
                    <div className="flex justify-between text-sm">
                      <span>{h.name}</span>
                      <span className="tabular-nums text-muted-foreground">{h.taken} из {h.slots}, {pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value, note, href, alert }: { icon: LucideIcon; label: string; value: string; note: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <span className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-[#b77a2a]">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-xs font-medium text-ink">{label}{href && <ArrowUpRight className="ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />}</span>
          <span className="mt-1 block text-2xl font-semibold leading-none text-ink tabular-nums">{value}</span>
          <span className="mt-1.5 block text-[11px] leading-snug text-muted-foreground">{note}</span>
        </span>
      </span>
    </>
  );
  const cls = cn(
    "group rounded-2xl border px-4 py-3 transition-colors shadow-[0_8px_22px_-14px_rgba(50,38,28,.3)]",
    label === "Новые заявки" || alert ? "border-[#efd6b3] bg-[#fbefe1]" : "border-border bg-card",
    href && "hover:border-gold/60",
  );
  return href ? (
    <Link href={href} className={cls}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function OverviewSkeleton() {
  return <Loader className="min-h-[80vh]" label="Загружаем обзор…" />;
}
