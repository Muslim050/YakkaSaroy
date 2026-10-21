"use client";

import { useEffect, useState } from "react";
import { EVENT_TYPES, HALLS, RESTAURANT_HOURS, SLOTS, type HallId, type SlotId } from "@/lib/data";
import { formatDate, fromISO, invalidateAvailability, monthKeyOf, useMonthAvailability, useToday } from "@/lib/availability";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvailabilityCalendar, CalendarLegend } from "./AvailabilityCalendar";
import { QUICK_CHECK_EVENT, type QuickCheckDetail } from "./QuickCheck";
import { SectionTitle } from "./SectionTitle";

export function Booking() {
  const today = useToday();
  const [hall, setHall] = useState<HallId>("grand");
  const [monthOverride, setMonth] = useState<Date | null>(null);
  const [date, setDate] = useState<string>("");
  const [slot, setSlot] = useState<string>("");
  const [form, setForm] = useState({ guests: "", name: "", phone: "", eventType: EVENT_TYPES[0], comment: "" });
  const [status, setStatus] = useState<{ kind: "idle" | "sending" | "error" | "done"; message?: string; code?: string }>({ kind: "idle" });

  const month = monthOverride ?? (today ? fromISO(today) : new Date(2026, 0, 1));
  const days = useMonthAvailability(today ? monthKeyOf(month) : "");
  const dateDays = useMonthAvailability(date ? monthKeyOf(fromISO(date)) : "");

  // Hand-off from the hero check or a hall card: hall, maybe a date, maybe an exact time.
  useEffect(() => {
    const handler = (e: Event) => {
      const { hall: h, date: d, slot: sl } = (e as CustomEvent<QuickCheckDetail>).detail;
      setHall(h);
      setSlot(sl ?? "");
      setStatus({ kind: "idle" });
      if (d) {
        setMonth(fromISO(d));
        setDate(d);
      } else {
        setDate("");
      }
    };
    window.addEventListener(QUICK_CHECK_EVENT, handler);
    return () => window.removeEventListener(QUICK_CHECK_EVENT, handler);
  }, []);

  const hallDef = HALLS.find((h) => h.id === hall)!;
  const entry = date ? dateDays?.[date] : undefined;

  function pickDay(d: string) {
    setDate(d);
    setSlot("");
    setStatus({ kind: "idle" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "sending" });
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hall, date, slot, ...form, guests: Number(form.guests) }),
    });
    const json = (await res.json()) as { error?: string; code?: string };
    if (!res.ok) {
      setStatus({ kind: "error", message: json.error ?? "Не получилось отправить. Позвоните нам." });
      if (res.status === 409) invalidateAvailability();
      return;
    }
    setStatus({ kind: "done", code: json.code });
    // refresh every calendar so the slot shows as taken
    invalidateAvailability();
  }

  const slotOptions: { id: string; label: string; sub: string; free: boolean }[] =
    hall === "restaurant"
      ? RESTAURANT_HOURS.map((h) => {
          const free = entry?.restaurant[h] ?? 0;
          return { id: h, label: h, sub: free > 0 ? `${free} ${plural(free, "столик", "столика", "столиков")}` : "занято", free: free > 0 };
        })
      : SLOTS.map((s) => ({
          id: s.id,
          label: s.name,
          sub: entry?.[hall][s.id as SlotId] === "free" ? s.time : "занято",
          free: entry?.[hall][s.id as SlotId] === "free",
        }));

  return (
    <section id="booking" className="bg-night py-24 text-ivory lg:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionTitle
          tone="dark"
          title="Свободные даты"
          lead="Выберите зал, день и время. Менеджер перезвонит в течение часа и подтвердит бронь."
        >
          <div role="group" aria-label="Зал" className="scroll-x flex max-w-full gap-1 overflow-x-auto rounded-full border border-ivory/12 p-1">
            {HALLS.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  setHall(h.id);
                  setSlot("");
                  setStatus({ kind: "idle" });
                }}
                aria-pressed={hall === h.id}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                  hall === h.id ? "bg-gold font-medium text-night" : "text-ivory/70 hover:text-ivory"
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>
        </SectionTitle>

        <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Calendar */}
          <div className="rounded-xl border border-ivory/10 bg-night-2 p-4 sm:p-8 lg:col-span-7">
            <AvailabilityCalendar
              size="lg"
              hall={hall}
              days={days}
              today={today}
              month={month}
              onMonthChange={setMonth}
              selected={date}
              onSelect={pickDay}
              className={days ? "" : "opacity-60"}
            />
            <CalendarLegend hall={hall} className="mt-6" />
          </div>

          {/* Slot + form */}
          <div className="lg:col-span-5">
            {!date ? (
              <div className="flex h-full min-h-[320px] flex-col justify-center rounded-xl border border-dashed border-ivory/15 p-8 text-center">
                <p className="font-display text-3xl">Выберите день в календаре</p>
                <p className="mt-3 text-ivory/60">Покажем, какое время свободно в зале «{hallDef.name}», и возьмём ваши контакты.</p>
              </div>
            ) : status.kind === "done" ? (
              <div className="rounded-xl border border-gold/50 bg-night-2 p-8">
                <Seal code={status.code ?? ""} />
                <p className="mt-6 text-sm text-gold-2">Заявка принята</p>
                <p className="mt-2 font-display text-4xl">Номер брони {status.code}</p>
                <p className="mt-4 leading-relaxed text-ivory/75">
                  {hallDef.name}, {formatDate(date)}, {slotLabel(hall, slot)}. Менеджер позвонит на {form.phone} в течение часа, чтобы подтвердить детали.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDate("");
                    setSlot("");
                    setStatus({ kind: "idle" });
                    setForm({ guests: "", name: "", phone: "", eventType: EVENT_TYPES[0], comment: "" });
                  }}
                  className="mt-8 rounded-full border border-gold/50 px-5 py-2.5 text-sm text-gold-2 hover:bg-gold hover:text-night"
                >
                  Выбрать другую дату
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="rounded-xl border border-ivory/10 bg-night-2 p-6 sm:p-8">
                <p className="text-sm text-gold-2">{hallDef.name}</p>
                <p className="mt-1 font-display text-4xl">{formatDate(date)}</p>

                <p className="mt-6 text-sm text-ivory/60">Время</p>
                <div className={`mt-2 ${hall === "restaurant" ? "scroll-x flex gap-2 overflow-x-auto pb-2" : "grid gap-2 sm:grid-cols-2"}`}>
                  {slotOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      disabled={!o.free}
                      onClick={() => setSlot(o.id)}
                      aria-pressed={slot === o.id}
                      className={`shrink-0 rounded-xl border px-4 py-3 text-left transition ${
                        slot === o.id
                          ? "border-gold bg-gold text-night"
                          : o.free
                            ? "border-gold/40 hover:border-gold"
                            : "border-ivory/10 text-ivory/30 cursor-not-allowed"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{o.label}</span>
                      <span className={`block text-xs ${slot === o.id ? "text-night/70" : "text-ivory/55"}`}>{o.sub}</span>
                    </button>
                  ))}
                </div>

                {slot && (
                  <div className="mt-6 grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm text-ivory/60">
                        Гостей
                        <input
                          type="number"
                          required
                          min={1}
                          max={hallDef.guestsMax}
                          inputMode="numeric"
                          value={form.guests}
                          onChange={(e) => setForm({ ...form, guests: e.target.value })}
                          placeholder={hall === "restaurant" ? "2" : `до ${hallDef.guestsMax}`}
                          className="input"
                        />
                      </label>
                      {hall !== "restaurant" && (
                        <label className="grid gap-1 text-sm text-ivory/60">
                          Повод
                          <Select value={form.eventType} onValueChange={(v) => v && setForm({ ...form, eventType: v })}>
                            <SelectTrigger className="input h-auto! w-full justify-between [&_svg]:text-gold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-gold/30 p-1.5 ring-0">
                              {EVENT_TYPES.map((t) => (
                                <SelectItem key={t} value={t} className="rounded-lg py-2 pl-3 focus:bg-gold/15 focus:text-gold-2">
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                      )}
                    </div>
                    <label className="grid gap-1 text-sm text-ivory/60">
                      Как к вам обращаться
                      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" autoComplete="name" />
                    </label>
                    <label className="grid gap-1 text-sm text-ivory/60">
                      Телефон
                      <input
                        required
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+998"
                        className="input"
                        autoComplete="tel"
                      />
                    </label>
                    <label className="grid gap-1 text-sm text-ivory/60">
                      Пожелания
                      <textarea
                        rows={2}
                        value={form.comment}
                        onChange={(e) => setForm({ ...form, comment: e.target.value })}
                        placeholder="Живая музыка, детский стол, аллергии"
                        className="input resize-none"
                      />
                    </label>

                    {status.kind === "error" && (
                      <p role="alert" className="rounded-xl border border-wine bg-wine/20 px-4 py-3 text-sm">
                        {status.message}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={status.kind === "sending"}
                      className="mt-2 rounded-xl bg-gold px-6 py-3.5 font-semibold text-night transition hover:bg-gold-2 disabled:opacity-60"
                    >
                      {status.kind === "sending" ? "Отправляем" : "Забронировать"}
                    </button>
                    <p className="text-xs text-ivory/45">Бронь бесплатная. Предоплата только после подтверждения менеджером.</p>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Brass seal on the confirmation: the booking code in the middle, the name around it. */
function Seal({ code }: { code: string }) {
  return (
    <svg viewBox="0 0 160 160" className="h-36 w-36" role="img" aria-label={`Печать с номером брони ${code}`}>
      <defs>
        <path id="sealPath" d="M80 80 m-58 0 a58 58 0 1 1 116 0 a58 58 0 1 1 -116 0" />
      </defs>
      <circle cx="80" cy="80" r="74" fill="none" stroke="#c4a36b" strokeWidth="1" strokeOpacity=".5" />
      <circle cx="80" cy="80" r="44" fill="none" stroke="#c4a36b" strokeWidth="1" />
      <g>
        <text fill="#e2cc9f" fontSize="11" letterSpacing="3" fontFamily="var(--font-sans)">
          <textPath href="#sealPath" startOffset="0">YAKKA SAROY   ✦   ТАШКЕНТ   ✦   ЯККАСАРАЙ   ✦   </textPath>
        </text>
      </g>
      <text x="80" y="76" textAnchor="middle" fill="#f7f3ec" fontSize="10" fontFamily="var(--font-sans)">бронь</text>
      <text x="80" y="98" textAnchor="middle" fill="#e2cc9f" fontSize="20" fontFamily="var(--font-display)">{code}</text>
    </svg>
  );
}



function slotLabel(hall: HallId, slot: string) {
  if (hall === "restaurant") return `столик на ${slot}`;
  const s = SLOTS.find((x) => x.id === slot);
  return s ? `${s.name.toLowerCase()} (${s.time})` : slot;
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
