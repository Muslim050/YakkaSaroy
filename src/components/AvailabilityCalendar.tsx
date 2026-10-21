"use client";

import { useMemo } from "react";
import type * as React from "react";
import { getDefaultClassNames, type DayButton } from "react-day-picker";
import { ru } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { dayState, fromISO, toISO, type DayState, type MonthAvailability } from "@/lib/availability";
import type { HallId } from "@/lib/data";

type Props = {
  hall: HallId;
  days: MonthAvailability | undefined;
  today: string;
  month: Date;
  onMonthChange: (d: Date) => void;
  selected?: string;
  onSelect: (iso: string) => void;
  size?: "sm" | "lg";
  /** Let people pick a fully booked day (the hero then suggests the nearest free dates). */
  allowFull?: boolean;
  className?: string;
};

const DOT: Record<DayState, string> = {
  free: "bg-gold",
  partial: "bg-gold/45",
  full: "bg-wine",
  past: "bg-transparent",
  unknown: "bg-transparent",
};

/**
 * shadcn Calendar that knows which days are free for a hall.
 * Each day gets a status dot; past and fully booked days are disabled.
 */
export function AvailabilityCalendar({ hall, days, today, month, onMonthChange, selected, onSelect, size = "sm", allowFull = false, className }: Props) {
  const states = useMemo(() => {
    const map: Record<string, DayState> = {};
    if (!days || !today) return map;
    for (const iso of Object.keys(days)) map[iso] = dayState(days[iso], hall, today, iso);
    return map;
  }, [days, hall, today]);

  const todayDate = today ? fromISO(today) : undefined;
  const startMonth = todayDate ? new Date(todayDate.getFullYear(), todayDate.getMonth(), 1) : undefined;
  const endMonth = todayDate ? new Date(todayDate.getFullYear(), todayDate.getMonth() + 11, 1) : undefined;
  const defaults = getDefaultClassNames();
  const lg = size === "lg";

  // DayPicker reads the current date while rendering, so it only renders in the browser.
  if (!today || !todayDate) {
    return <div aria-hidden="true" className={cn("animate-pulse rounded-2xl bg-ivory/5", lg ? "aspect-[7/6] w-full" : "h-80 w-72", className)} />;
  }

  return (
    <Calendar
      mode="single"
      locale={ru}
      today={todayDate}
      weekStartsOn={1}
      showOutsideDays={false}
      month={month}
      onMonthChange={onMonthChange}
      startMonth={startMonth}
      endMonth={endMonth}
      selected={selected ? fromISO(selected) : undefined}
      onSelect={(d) => d && onSelect(toISO(d))}
      disabled={(d) => {
        const iso = toISO(d);
        if (!today || iso < today) return true;
        const st = states[iso];
        return st === undefined || (st === "full" && !allowFull);
      }}
      modifiers={{
        free: (d) => states[toISO(d)] === "free",
        partial: (d) => states[toISO(d)] === "partial",
        full: (d) => states[toISO(d)] === "full",
      }}
      className={cn(
        "bg-transparent p-0",
        lg ? "w-full [--cell-radius:0.9rem] [--cell-size:--spacing(10)] sm:[--cell-size:--spacing(14)]" : "[--cell-radius:0.7rem] [--cell-size:--spacing(10)]",
        className,
      )}
      classNames={{
        root: cn(lg ? "w-full" : "w-fit", defaults.root),
        month_caption: cn("flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)", defaults.month_caption),
        caption_label: cn("font-display capitalize select-none", lg ? "text-3xl sm:text-4xl" : "text-2xl", defaults.caption_label),
        weekday: cn("flex-1 text-xs font-normal text-ivory/45 select-none", defaults.weekday),
        week: cn(lg ? "mt-1.5" : "mt-1", "flex w-full", defaults.week),
        today: cn("rounded-(--cell-radius) ring-1 ring-inset ring-gold/40", defaults.today),
        disabled: cn("text-ivory/25", defaults.disabled),
      }}
      components={{ DayButton: (p) => <StatusDayButton {...p} states={states} /> }}
    />
  );
}

function StatusDayButton({ states, children, className, ...props }: React.ComponentProps<typeof DayButton> & { states: Record<string, DayState> }) {
  const st = states[toISO(props.day.date)] ?? "unknown";
  const selected = props.modifiers.selected;
  return (
    <CalendarDayButton
      {...props}
      className={cn(
        "gap-1 text-[0.95rem] hover:bg-gold/15 data-[selected-single=true]:bg-gold data-[selected-single=true]:font-semibold data-[selected-single=true]:text-night data-[selected-single=true]:shadow-[0_0_24px_rgba(201,162,78,.45)]",
        st === "full" && "line-through decoration-wine/70",
        className,
      )}
    >
      {children}
      <i aria-hidden="true" className={cn("block size-1.5 rounded-full", selected ? "bg-night" : DOT[st])} />
    </CalendarDayButton>
  );
}

export function CalendarLegend({ hall, className }: { hall: HallId; className?: string }) {
  const r = hall === "restaurant";
  return (
    <div className={cn("flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ivory/60", className)}>
      <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-gold" />{r ? "много столиков" : "день и вечер свободны"}</span>
      <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-gold/45" />{r ? "осталось мало" : "свободно одно время"}</span>
      <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-wine" />всё занято</span>
    </div>
  );
}
