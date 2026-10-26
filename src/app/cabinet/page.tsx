import Link from "next/link";
import { Suspense } from "react";
import { Phone } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { BookingCard } from "@/components/cabinet/BookingCard";
import { requireClient } from "@/lib/auth";
import { bookingsByPhone, getCatalog, todayISO } from "@/lib/store";
import { toClientView } from "@/lib/bookings";
import { CONTACTS } from "@/lib/data";

export default function CabinetPage() {
  return (
    <Suspense fallback={<CabinetSkeleton />}>
      <Cabinet />
    </Suspense>
  );
}

async function Cabinet() {
  const me = await requireClient();
  const today = todayISO();
  const [all, catalog] = await Promise.all([bookingsByPhone(me.phone).then((list) => list.map(toClientView)), getCatalog()]);
  const upcoming = all.filter((b) => b.date >= today && b.status !== "cancelled").sort((a, b) => a.date.localeCompare(b.date));
  const past = all.filter((b) => !(b.date >= today && b.status !== "cancelled"));
  const firstName = me.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Здравствуйте, ${firstName}`} description="Здесь ваши брони в Yakka Saroy: что уже сделано, что впереди и сколько осталось оплатить.">
        <Link href="/#booking" className="inline-flex h-10 items-center rounded-lg bg-night px-4 text-sm font-medium text-ivory transition-colors hover:bg-night-3">
          Новая бронь
        </Link>
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-10">
          <section className="grid gap-5">
            <h2 className="text-sm font-medium text-muted-foreground">Предстоящие</h2>
            {upcoming.length ? (
              upcoming.map((b) => <BookingCard key={b.id} booking={b} catalog={catalog} today={today} />)
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="font-display text-2xl text-night">Впереди пока ничего нет</p>
                <p className="mt-2 text-sm text-muted-foreground">Выберите свободную дату на сайте, заявка сразу появится здесь.</p>
                <Link href="/#booking" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-secondary">
                  Посмотреть свободные даты
                </Link>
              </div>
            )}
          </section>
          {past.length > 0 && (
            <section className="grid gap-5">
              <h2 className="text-sm font-medium text-muted-foreground">Прошедшие и отменённые</h2>
              {past.map((b) => (
                <BookingCard key={b.id} booking={b} catalog={catalog} today={today} />
              ))}
            </section>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card p-6 lg:sticky lg:top-24">
          <p className="font-display text-2xl text-night">Ваш менеджер</p>
          <p className="mt-2 text-sm text-muted-foreground">Ответит на вопросы о меню, оформлении и оплате. {CONTACTS.hours}.</p>
          <a href={CONTACTS.phoneHref} className="mt-5 flex items-center gap-2 text-[15px] font-medium text-ink hover:text-gold-dim">
            <Phone className="size-4" /> {CONTACTS.phone}
          </a>
          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">{CONTACTS.address}</p>
        </aside>
      </div>
    </>
  );
}

function CabinetSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="h-12 w-80 animate-pulse rounded bg-secondary" />
      <div className="h-72 animate-pulse rounded-xl bg-secondary" />
    </div>
  );
}
