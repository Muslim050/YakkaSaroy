"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Landmark, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HALLS, RESTAURANT_HOURS, RESTAURANT_TABLES, SLOTS, type HallId, type SlotId } from "@/lib/data";
import {
  dayState,
  formatDateShort,
  fromISO,
  monthKeyOf,
  useMonthAvailability,
  useToday,
  type DayAvailability,
  type MonthAvailability,
} from "@/lib/availability";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvailabilityCalendar, CalendarLegend } from "./AvailabilityCalendar";

export const QUICK_CHECK_EVENT = "yakka:quickcheck";
export type QuickCheckDetail = { hall: HallId; date: string; slot?: string };

const HALL_LABELS = Object.fromEntries(HALLS.map((h) => [h.id, h.name])) as Record<HallId, string>;

/** Hand a hall/date/slot to the booking section and scroll to it. */
export function goToBooking(detail: QuickCheckDetail) {
  window.dispatchEvent(new CustomEvent<QuickCheckDetail>(QUICK_CHECK_EVENT, { detail }));
  document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** A button that opens the booking section with a hall preselected. */
export function BookingButton({ hall, className, children }: { hall: HallId; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => goToBooking({ hall, date: "" })} className={className}>
      {children}
    </button>
  );
}

export function QuickCheck() {
  const today = useToday();
  const [hall, setHall] = useState<HallId>("grand");
  const [date, setDate] = useState("");
  const [open, setOpen] = useState(false);
  const [monthOverride, setMonth] = useState<Date | null>(null);

  const month = monthOverride ?? (date ? fromISO(date) : today ? fromISO(today) : new Date(2026, 0, 1));
  const days = useMonthAvailability(today ? monthKeyOf(month) : "");

  // the chosen date's month and the one after, for the result card and "nearest free dates"
  const dateMonth = date ? fromISO(date) : null;
  const resultDays = useMonthAvailability(dateMonth ? monthKeyOf(dateMonth) : "");
  const nextDays = useMonthAvailability(dateMonth ? monthKeyOf(new Date(dateMonth.getFullYear(), dateMonth.getMonth() + 1, 1)) : "");

  return (
    <div className="space-y-3">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-gold/35 bg-gold/20 shadow-[0_20px_60px_-20px_rgba(0,0,0,.7)] backdrop-blur-md sm:grid-cols-[1fr_1.15fr_auto]">
        {/* Hall */}
        <div className="flex items-center gap-3 bg-night/85 px-4 py-3 sm:px-5">
          <Landmark className="size-5 shrink-0 text-gold" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p id="qc-hall" className="text-xs text-ivory/55">Зал</p>
            <Select items={HALL_LABELS} value={hall} onValueChange={(v) => v && setHall(v as HallId)}>
              <SelectTrigger
                aria-labelledby="qc-hall"
                className="h-auto w-full border-0 bg-transparent p-0 text-base font-medium text-ivory hover:text-gold-2 focus-visible:ring-0 dark:bg-transparent [&_svg]:text-gold"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} sideOffset={14} className="min-w-64 rounded-xl border border-gold/30 p-1.5 ring-0">
                {HALLS.map((h) => (
                  <SelectItem key={h.id} value={h.id} className="rounded-lg py-2.5 pl-3 focus:bg-gold/15 focus:text-gold-2">
                    <span className="flex flex-col">
                      <span className="font-medium">{h.name}</span>
                      <span className="text-xs text-ivory/50">{h.capacity}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="group flex items-center gap-3 bg-night/85 px-4 py-3 text-left transition-colors hover:bg-night/70 sm:px-5">
            <CalendarDays className="size-5 shrink-0 text-gold" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-ivory/55">Дата</span>
              <span className={cn("block truncate text-base font-medium", date ? "text-ivory" : "text-ivory/45")}>
                {date ? formatDateShort(date) : "Выберите день в календаре"}
              </span>
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={14} className="w-auto rounded-2xl border border-gold/30 p-4 ring-0">
            <p className="text-sm text-gold-2">{HALL_LABELS[hall]}</p>
            <AvailabilityCalendar
              allowFull
              hall={hall}
              days={days}
              today={today}
              month={month}
              onMonthChange={setMonth}
              selected={date}
              onSelect={(d) => {
                setDate(d);
                setMonth(null);
                setOpen(false);
              }}
            />
            <CalendarLegend hall={hall} className="max-w-72 border-t border-gold/20 pt-3" />
          </PopoverContent>
        </Popover>

        {/* CTA */}
        <div className="bg-night/85 p-2">
          <button
            type="button"
            onClick={() => (date ? goToBooking({ hall, date }) : setOpen(true))}
            className="h-full w-full rounded-xl bg-gold px-6 py-3 font-semibold text-night transition hover:bg-gold-2"
          >
            {date ? "Забронировать" : "Проверить дату"}
          </button>
        </div>
      </div>

      {date && (
        <ResultCard
          key={`${hall}-${date}`}
          hall={hall}
          date={date}
          today={today}
          entry={resultDays?.[date]}
          pool={{ ...resultDays, ...nextDays }}
          onPickDate={setDate}
          onClear={() => setDate("")}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- */

function ResultCard({
  hall,
  date,
  today,
  entry,
  pool,
  onPickDate,
  onClear,
}: {
  hall: HallId;
  date: string;
  today: string;
  entry: DayAvailability | undefined;
  pool: MonthAvailability;
  onPickDate: (d: string) => void;
  onClear: () => void;
}) {
  const state = entry ? dayState(entry, hall, today, date) : "unknown";
  const verdict = {
    free: { text: hall === "restaurant" ? "Столики есть весь вечер" : "Свободно весь день", tone: "text-gold-2" },
    partial: { text: hall === "restaurant" ? "Осталось немного столиков" : "Свободно одно время", tone: "text-gold-2" },
    full: { text: "Этот день уже занят", tone: "text-[#e2808f]" },
    past: { text: "Дата прошла", tone: "text-ivory/60" },
    unknown: { text: "Смотрим расписание", tone: "text-ivory/60" },
  }[state];

  const nearest = useMemo(() => {
    if (state !== "full") return [];
    return Object.keys(pool)
      .filter((d) => d > date && dayState(pool[d], hall, today, d) !== "full")
      .sort()
      .slice(0, 4);
  }, [pool, state, date, hall, today]);

  return (
    <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-gold/30 bg-night/85 p-4 backdrop-blur-md duration-300 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-ivory/55">
            {HALLS.find((h) => h.id === hall)?.name}, {formatDateShort(date)}
          </p>
          <p className={cn("mt-1 flex items-center gap-2 font-display text-2xl sm:text-3xl", verdict.tone)}>
            {state === "full" ? <X className="size-5" /> : state === "unknown" ? null : <Check className="size-5" />}
            {verdict.text}
          </p>
        </div>
        <button type="button" onClick={onClear} aria-label="Сбросить дату" className="rounded-full p-1.5 text-ivory/50 hover:bg-ivory/10 hover:text-ivory">
          <X className="size-4" />
        </button>
      </div>

      {!entry ? (
        <div className="mt-4 h-16 animate-pulse rounded-xl bg-ivory/5" />
      ) : hall === "restaurant" ? (
        <TableBars entry={entry} onPick={(slot) => goToBooking({ hall, date, slot })} />
      ) : state === "full" ? (
        <NearestDates dates={nearest} hall={hall} onPick={onPickDate} />
      ) : (
        <Timeline slots={entry[hall]} onPick={(slot) => goToBooking({ hall, date, slot })} />
      )}
    </div>
  );
}

/** A 12:00–24:00 track with the day and evening slots painted free or taken; free ones are buttons. */
function Timeline({ slots, onPick }: { slots: Record<SlotId, "free" | "booked">; onPick: (slot: SlotId) => void }) {
  const START = 12;
  const SPAN = 12;
  const pos = (h: number) => `${((h - START) / SPAN) * 100}%`;
  const ranges: Record<SlotId, [number, number]> = { day: [12, 17], evening: [18, 23.5] };

  return (
    <div className="mt-5">
      <div className="relative h-14">
        <div className="absolute inset-x-0 top-1/2 h-px bg-ivory/15" />
        {SLOTS.map((s) => {
          const [a, b] = ranges[s.id];
          const free = slots[s.id] === "free";
          return (
            <button
              key={s.id}
              type="button"
              disabled={!free}
              onClick={() => onPick(s.id)}
              style={{ left: pos(a), width: `calc(${pos(b)} - ${pos(a)})` }}
              className={cn(
                "group absolute inset-y-0 flex items-center justify-between gap-2 rounded-xl px-3 text-left text-sm transition",
                free
                  ? "border border-gold bg-gold/15 text-ivory hover:bg-gold hover:text-night"
                  : "cursor-not-allowed border border-wine/50 bg-[repeating-linear-gradient(135deg,rgba(122,31,46,.35)_0_6px,transparent_6px_12px)] text-ivory/45",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block text-xs opacity-75">{s.time}</span>
              </span>
              {free ? (
                <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold sm:flex">
                  <Check className="size-3.5" /> Выбрать
                </span>
              ) : (
                <span className="hidden shrink-0 text-xs sm:block">занято</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-ivory/40">
        {[12, 15, 18, 21, 24].map((h) => (
          <span key={h} className="absolute -translate-x-1/2" style={{ left: pos(h) }}>
            {h === 24 ? "00:00" : `${h}:00`}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Restaurant: one bar per hour, height = free tables; tap a bar to book that hour. */
function TableBars({ entry, onPick }: { entry: DayAvailability; onPick: (hour: string) => void }) {
  return (
    <>
    <p className="mt-2 text-xs text-ivory/55">Высота столбика показывает свободные столики. Нажмите на час, чтобы забронировать.</p>
    <div className="mt-4 flex h-28 items-end gap-1.5 sm:gap-2">
      {RESTAURANT_HOURS.map((h) => {
        const free = entry.restaurant[h] ?? 0;
        const pct = Math.max(6, (free / RESTAURANT_TABLES) * 100);
        return (
          <button
            key={h}
            type="button"
            disabled={free === 0}
            onClick={() => onPick(h)}
            title={`${h}: свободно ${free} из ${RESTAURANT_TABLES}`}
            aria-label={`${h}, свободно столиков: ${free}`}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-1 disabled:cursor-not-allowed"
          >
            <span className="text-[10px] text-gold-2 opacity-0 transition group-hover:opacity-100">{free}</span>
            <span
              className={cn(
                "w-full rounded-t-md transition-all duration-500",
                free === 0 ? "bg-wine/60" : free < 6 ? "bg-gold/45 group-hover:bg-gold" : "bg-gold/80 group-hover:bg-gold-2",
              )}
              style={{ height: `${pct}%` }}
            />
            <span className="text-[10px] text-ivory/45">{h}</span>
          </button>
        );
      })}
    </div>
    </>
  );
}

function NearestDates({ dates, hall, onPick }: { dates: string[]; hall: HallId; onPick: (d: string) => void }) {
  if (!dates.length) return <p className="mt-4 text-sm text-ivory/60">Позвоните нам, подберём дату вместе.</p>;
  return (
    <div className="mt-4">
      <p className="text-sm text-ivory/60">Ближайшие свободные даты в зале «{HALLS.find((h) => h.id === hall)?.name}»:</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {dates.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onPick(d)}
            className="rounded-full border border-gold/50 px-4 py-2 text-sm text-ivory transition hover:bg-gold hover:text-night"
          >
            {formatDateShort(d)}
          </button>
        ))}
      </div>
    </div>
  );
}
