import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, Phone } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { overview, todayISO } from "@/lib/store";
import { formatDateTime, formatDay, formatPhone, formatSumShort, hallName, slotLabel, type Booking } from "@/lib/bookings";

export default function AdminHome() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}

const open = (b: Booking) => `/admin/bookings?status=all&open=${b.id}`;

async function Overview() {
  await requireAdmin();
  const o = await overview();
  const today = todayISO();

  // group the week's events by day
  const byDay = new Map<string, Booking[]>();
  for (const b of o.week) byDay.set(b.date, [...(byDay.get(b.date) ?? []), b]);

  return (
    <>
      <PageHeader title="Обзор" description="Что требует внимания сегодня и какие торжества впереди на неделе.">
        <Link href="/admin/calendar" className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary">
          Открыть календарь
        </Link>
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        <Kpi label="Новые заявки" value={String(o.newRequests.length)} note="ждут звонка" href="/admin/bookings?status=new" alert={o.newRequests.length > 0} />
        <Kpi label="Торжеств за 30 дней" value={String(o.next30)} note="во всех залах" href="/admin/calendar" />
        <Kpi label="Предоплаты за 30 дней" value={formatSumShort(o.prepaid30)} note={`из ${formatSumShort(o.expected30)} по банкетному меню`} />
        <Kpi label="Столиков сегодня" value={String(o.tablesToday)} note="в ресторане" href="/admin/bookings?kind=restaurant" />
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

          {o.tastings.length > 0 && (
            <section className="rounded-xl border border-border bg-card">
              <header className="border-b border-border px-5 py-4">
                <h2 className="font-display text-2xl text-night">Дегустации</h2>
              </header>
              <ul>
                {o.tastings.slice(0, 5).map((b) => (
                  <li key={b.id} className="border-b border-border px-5 py-3 last:border-b-0">
                    <Link href={open(b)} className="flex items-center justify-between gap-3 text-sm hover:underline">
                      <span className="truncate">{b.name}, {hallName(b.hall).toLowerCase()}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{formatDateTime(b.tastingAt!)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, note, href, alert }: { label: string; value: string; note: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <p className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        {href && <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />}
      </p>
      <p className="mt-2 font-display text-3xl leading-none text-night tabular-nums sm:text-4xl">
        {value}
        {alert && <span className="ml-2 inline-block size-2 -translate-y-3 rounded-full bg-amber-500 align-middle" aria-label="есть новые" />}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </>
  );
  return href ? (
    <Link href={href} className="group bg-card p-5 transition-colors hover:bg-[#fffaf0]">{body}</Link>
  ) : (
    <div className="bg-card p-5">{body}</div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="h-12 w-60 animate-pulse rounded bg-secondary" />
      <div className="h-28 animate-pulse rounded-xl bg-secondary" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-xl bg-secondary" />
        <div className="h-96 animate-pulse rounded-xl bg-secondary" />
      </div>
    </div>
  );
}
