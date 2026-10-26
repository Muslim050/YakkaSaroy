"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Moon, Phone, Plus, Sun, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { HALLS, SLOTS, type HallId, type SlotId } from "@/lib/data";
import { STATUS, formatDay, formatPhone, hallName, type Booking, type BookingStatus } from "@/lib/bookings";
import { addDaysISO, weekdayISO } from "@/lib/time";
import type { Catalog } from "@/lib/program";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/StatusBadge";
import { BookingSheet } from "./BookingSheet";
import { NewBookingSheet, type NewBookingPreset } from "./NewBookingSheet";

const BLOCK: Record<BookingStatus, string> = {
  new: "border-l-amber-500 bg-amber-50 hover:bg-amber-100",
  confirmed: "border-l-sky-500 bg-sky-50 hover:bg-sky-100",
  prepaid: "border-l-emerald-600 bg-emerald-50 hover:bg-emerald-100",
  done: "border-l-stone-400 bg-stone-100 hover:bg-stone-200",
  cancelled: "border-l-rose-500 bg-rose-50",
};
const DOT: Record<BookingStatus, string> = {
  new: "bg-amber-500",
  confirmed: "bg-sky-500",
  prepaid: "bg-emerald-600",
  done: "bg-stone-400",
  cancelled: "bg-rose-500",
};
const LEGEND: BookingStatus[] = ["new", "confirmed", "prepaid", "done"];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEK = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const BANQUET = HALLS.filter((h) => h.id !== "restaurant");
const SHORT: Partial<Record<HallId, string>> = { grand: "Большой", small: "Малый", terrace: "Терраса" };
/** Banquets are planned around Friday to Sunday evenings. */
const isWeekend = (d: string) => [0, 5, 6].includes(weekdayISO(d));
const MOVABLE: BookingStatus[] = ["new", "confirmed", "prepaid"];

type HallFilter = HallId | "all";
type Target = { hall: HallId; date: string; slot: SlotId };
const keyOf = (date: string, hall: HallId, slot: string) => `${date}|${hall}|${slot}`;

function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function hrefFor(month: string, hall: HallFilter) {
  return `/admin/calendar?month=${month}${hall === "all" ? "" : `&hall=${hall}`}`;
}

const slotName = (s: string) => (s === "day" ? "день" : "вечер");
const where = (t: { hall: HallId; date: string; slot: string }) => `${hallName(t.hall)}, ${formatDay(t.date)}, ${slotName(t.slot)}`;

/**
 * Month of the banquet halls: weeks as rows, every day shows each hall's day and
 * evening. Free time is visible at a glance and booked with one click; a booking is
 * moved by dragging it onto free time; a day opens on its own with all the details.
 */
export function CalendarBoard({
  month,
  initialHall,
  bookings,
  catalog,
  today,
}: {
  month: string;
  initialHall: HallFilter;
  bookings: Booking[];
  catalog: Catalog;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hall, setHall] = useState<HallFilter>(initialHall);
  const [focus, setFocus] = useState<BookingStatus | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Booking | null>(null);
  const [creating, setCreating] = useState<NewBookingPreset | null>(null);
  const [drag, setDrag] = useState<Booking | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [move, setMove] = useState<{ booking: Booking; to: Target } | null>(null);
  const [moveError, setMoveError] = useState("");
  const [moving, setMoving] = useState(false);
  const [notice, setNotice] = useState("");

  // A cancelled booking leaves the board; keep showing its saved copy until the sheet is closed.
  const fromBoard = openId ? bookings.find((b) => b.id === openId) : undefined;
  const fromSave = saved?.id === openId ? saved : undefined;
  const open = fromBoard && fromSave ? (fromSave.updatedAt > fromBoard.updatedAt ? fromSave : fromBoard) : (fromBoard ?? fromSave ?? null);

  const index = new Map<string, Booking>();
  for (const b of bookings) index.set(keyOf(b.date, b.hall, b.slot), b);

  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const lead = (weekdayISO(days[0]) + 6) % 7;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  const halls = hall === "all" ? BANQUET : BANQUET.filter((h) => h.id === hall);
  const shown = bookings.filter((b) => halls.some((h) => h.id === b.hall));
  const total = days.length * halls.length * SLOTS.length;
  const freeAhead = days.filter((d) => d >= today).reduce((n, d) => n + halls.reduce((k, h) => k + SLOTS.filter((s) => !index.has(keyOf(d, h.id, s.id))).length, 0), 0);
  const weekends = days
    .filter((d) => d >= today && isWeekend(d))
    .map((d) => ({ d, free: halls.filter((h) => !index.has(keyOf(d, h.id, "evening"))) }))
    .filter((x) => x.free.length > 0);
  const byStatus = (s: BookingStatus) => shown.filter((b) => b.status === s).length;

  function go(to: string) {
    startTransition(() => router.push(hrefFor(to, hall), { scroll: false }));
  }

  function pickHall(h: HallFilter) {
    setHall(h);
    window.history.replaceState(null, "", hrefFor(month, h));
  }

  // ← and → turn the month when nothing else has the keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (document.querySelector("[role=dialog], [role=alertdialog]")) return;
      startTransition(() => router.push(hrefFor(shiftMonth(month, e.key === "ArrowLeft" ? -1 : 1), hall), { scroll: false }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, month, hall]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const fits = (b: Booking, h: HallId) => b.guests <= (HALLS.find((x) => x.id === h)?.guestsMax ?? 0);

  async function confirmMove() {
    if (!move) return;
    setMoving(true);
    setMoveError("");
    const res = await fetch(`/api/admin/bookings/${move.booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(move.to),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setMoving(false);
    if (!res.ok) {
      setMoveError(json.error ?? "Не удалось перенести бронь");
      return;
    }
    setNotice(`${move.booking.name}: перенесено на ${formatDay(move.to.date)}, ${slotName(move.to.slot)}`);
    setMove(null);
    router.refresh();
  }

  /** One hall's day or evening inside a day cell. */
  function block(date: string, h: HallId, slot: SlotId, large: boolean) {
    const k = keyOf(date, h, slot);
    const b = index.get(k);
    const past = date < today;
    const Icon = slot === "day" ? Sun : Moon;
    const label = `${hallName(h)}, ${formatDay(date)}, ${slotName(slot)}`;

    if (b) {
      const movable = !past && MOVABLE.includes(b.status);
      return (
        <button
          type="button"
          draggable={movable}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", b.id);
            setDrag(b);
          }}
          onDragEnd={() => {
            setDrag(null);
            setOver(null);
          }}
          onClick={() => setOpenId(b.id)}
          title={`${b.name} · ${b.guests} гостей · ${STATUS[b.status].label}${movable ? "\nПеретащите, чтобы перенести" : ""}`}
          aria-label={`${label}: ${b.name}, ${b.guests} гостей, ${STATUS[b.status].label}`}
          className={cn(
            "flex min-w-0 flex-col justify-center rounded-[5px] border-l-[3px] px-1.5 text-left transition-[opacity,box-shadow]",
            large ? "h-12 w-full" : "h-6 flex-1",
            BLOCK[b.status],
            movable && "cursor-grab active:cursor-grabbing",
            past && "opacity-60",
            focus && focus !== b.status && "opacity-25",
            drag?.id === b.id && "opacity-40 ring-2 ring-gold",
          )}
        >
          <span className={cn("block w-full truncate text-ink", large ? "text-[13px]" : "text-[11px] leading-none")}>{b.name}</span>
          {large && (
            <span className="block truncate text-[11px] text-muted-foreground">
              {b.guests} гостей{b.eventType ? ` · ${b.eventType.toLowerCase()}` : ""}
            </span>
          )}
        </button>
      );
    }

    if (past) return <span className={cn(large ? "h-12 w-full" : "h-6 flex-1")} aria-hidden />;

    const target = drag !== null;
    const ok = drag ? fits(drag, h) : true;
    const hovered = over === k;
    return (
      <button
        type="button"
        onClick={() => setCreating({ hall: h, date, slot })}
        onDragOver={(e) => {
          if (!drag) return;
          setOver(k);
          if (!ok) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={() => setOver((o) => (o === k ? null : o))}
        onDrop={(e) => {
          e.preventDefault();
          if (drag && ok) {
            setMoveError("");
            setMove({ booking: drag, to: { hall: h, date, slot } });
          }
          setDrag(null);
          setOver(null);
        }}
        aria-label={`Свободно: ${label}. Записать бронь`}
        title={`${SHORT[h]} · ${slotName(slot)} · свободно`}
        className={cn(
          "group/free flex min-w-0 items-center justify-center gap-1 rounded-[5px] border border-dashed text-muted-foreground transition-colors",
          large ? "h-12 w-full" : "h-6 flex-1",
          target
            ? ok
              ? hovered
                ? "border-gold bg-gold/25 text-night"
                : "border-gold/60 bg-gold/5"
              : hovered
                ? "border-rose-400 bg-rose-50 text-rose-800"
                : "border-border opacity-40"
            : "border-border/80 hover:border-gold hover:bg-gold/10 hover:text-night focus-visible:border-gold",
          focus && !target && "opacity-40",
        )}
      >
        {target && hovered ? (
          <span className="truncate text-[11px] font-medium">{ok ? "Сюда" : "Не вместит"}</span>
        ) : (
          <>
            <Icon className={cn("size-3 opacity-40 group-hover/free:hidden", large && "size-3.5")} />
            <Plus className={cn("hidden size-3.5 group-hover/free:block")} />
            {large && <span className="text-[11px] group-hover/free:hidden">{SLOTS.find((x) => x.id === slot)?.time}</span>}
            {large && <span className="hidden text-[11px] group-hover/free:inline">Записать</span>}
          </>
        )}
      </button>
    );
  }

  return (
    <>
      {/* month and hall */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <button type="button" onClick={() => go(shiftMonth(month, -1))} aria-label="Предыдущий месяц" className="grid size-8 place-items-center rounded-md hover:bg-secondary">
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-40 text-center font-display text-xl text-night">
              {MONTHS[m - 1]} {y}
            </span>
            <button type="button" onClick={() => go(shiftMonth(month, 1))} aria-label="Следующий месяц" className="grid size-8 place-items-center rounded-md hover:bg-secondary">
              <ChevronRight className="size-4" />
            </button>
          </div>
          {month !== today.slice(0, 7) && (
            <button type="button" onClick={() => go(today.slice(0, 7))} className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-ink hover:bg-secondary">
              Сегодня
            </button>
          )}
          <span className="hidden text-xs text-muted-foreground xl:inline">{pending ? "Загружаем…" : "← → листают месяцы"}</span>
        </div>

        <div role="group" aria-label="Зал" className="scroll-x -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {(["all", ...BANQUET.map((h) => h.id)] as HallFilter[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={hall === id}
              onClick={() => pickHall(id)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-4 text-sm transition-colors",
                hall === id ? "border-night bg-night text-ivory" : "border-border bg-card text-ink/80 hover:border-gold hover:text-ink",
              )}
            >
              {id === "all" ? "Все залы" : hallName(id)}
            </button>
          ))}
        </div>
      </div>

      {/* what the month looks like */}
      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Занято за месяц</p>
          <p className="mt-1 font-display text-3xl text-night tabular-nums">
            {shown.length} <span className="text-lg text-muted-foreground">из {total}</span>
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gold" style={{ width: `${total ? Math.round((shown.length / total) * 100) : 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Впереди свободно торжеств: {freeAhead}</p>
        </div>

        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Свободные вечера пт, сб и вс</p>
          {weekends.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {weekends.map(({ d, free }) => (
                <li key={d}>
                  <button
                    type="button"
                    onClick={() => setDay(d)}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-gold hover:bg-gold/10"
                  >
                    <span className="font-medium tabular-nums text-ink">{Number(d.slice(8))}</span>
                    <span className="text-muted-foreground">{WD[weekdayISO(d)]}</span>
                    <span className="text-xs text-gold-dim">{hall === "all" ? (free.length === BANQUET.length ? "все залы" : free.map((h) => SHORT[h.id]).join(", ")) : "свободен"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink/80">В этом месяце все выходные вечера заняты.</p>
          )}
        </div>
      </div>

      {/* status legend doubles as a highlight filter */}
      <div className="mb-3 flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
        {LEGEND.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={focus === s}
            onClick={() => setFocus((f) => (f === s ? null : s))}
            className={cn(
              "flex items-center gap-2 rounded-full px-2.5 py-1 transition-colors",
              focus === s ? "bg-night text-ivory" : "text-muted-foreground hover:bg-secondary hover:text-ink",
            )}
          >
            <span className={cn("h-3 w-1 rounded-sm", DOT[s])} />
            {STATUS[s].label}
            <span className="tabular-nums opacity-70">{byStatus(s)}</span>
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-3 text-muted-foreground md:flex">
          <span className="flex items-center gap-1">
            <Sun className="size-3" /> день {SLOTS[0].time}
          </span>
          <span className="flex items-center gap-1">
            <Moon className="size-3" /> вечер {SLOTS[1].time}
          </span>
        </span>
      </div>

      {/* the month */}
      <div aria-busy={pending} className={cn("overflow-hidden rounded-xl border border-border bg-card transition-opacity", pending && "opacity-50")}>
        <div className="grid grid-cols-7 border-b border-border bg-secondary/40 text-xs text-muted-foreground">
          {WEEK.map((w, i) => (
            <div key={w} className={cn("px-2 py-2 md:px-3", i >= 4 && "text-ink")}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const col = i % 7;
            const edge = cn(col < 6 && "border-r", i < cells.length - 7 && "border-b", "border-border");
            if (!d) return <div key={`x${i}`} className={cn("min-h-16 bg-secondary/30", edge)} />;
            const past = d < today;
            const isToday = d === today;
            const free = halls.reduce((n, h) => n + SLOTS.filter((s) => !index.has(keyOf(d, h.id, s.id))).length, 0);
            const slots = halls.length * SLOTS.length;
            return (
              <div key={d} className={cn("relative min-w-0", edge, isWeekend(d) && !past && "bg-gold/[0.04]", isToday && "bg-gold/10")}>
                {/* phone: the whole day is one button with a tiny map of the slots */}
                <button type="button" onClick={() => setDay(d)} className="flex min-h-16 w-full flex-col gap-1.5 p-1.5 text-left md:hidden" aria-label={`${formatDay(d, true)}: свободно ${free} из ${slots}`}>
                  <span className={cn("grid size-6 place-items-center rounded-full text-xs tabular-nums", isToday ? "bg-night text-ivory" : past ? "text-muted-foreground" : "text-ink")}>{Number(d.slice(8))}</span>
                  <span className="grid w-full gap-[3px]">
                    {halls.map((h) => (
                      <span key={h.id} className="flex gap-[3px]">
                        {SLOTS.map((s) => {
                          const b = index.get(keyOf(d, h.id, s.id));
                          return <span key={s.id} className={cn("h-1.5 flex-1 rounded-full", b ? DOT[b.status] : past ? "bg-transparent" : "bg-border")} />;
                        })}
                      </span>
                    ))}
                  </span>
                </button>

                {/* desktop: every slot is clickable and a drop target */}
                <div className={cn("hidden flex-col gap-1 p-2 md:flex", past && "opacity-80")}>
                  <button
                    type="button"
                    onClick={() => setDay(d)}
                    className="group/day -mx-1 flex items-center justify-between rounded-md px-1 py-0.5 text-left hover:bg-secondary"
                    aria-label={`Открыть день: ${formatDay(d, true)}`}
                  >
                    <span className={cn("grid size-7 place-items-center rounded-full text-sm tabular-nums", isToday ? "bg-night text-ivory" : past ? "text-muted-foreground" : "font-medium text-ink")}>
                      {Number(d.slice(8))}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {isToday && <span className="text-gold-dim">сегодня</span>}
                      {!past && !isToday && (free === slots ? <span>свободен</span> : free === 0 ? <span className="text-ink/70">занят</span> : <span>своб. {free}</span>)}
                      <ArrowRight className="size-3 opacity-0 transition-opacity group-hover/day:opacity-100" />
                    </span>
                  </button>
                  {halls.map((h) => (
                    <div key={h.id} className="flex items-center gap-1">
                      {hall === "all" && (
                        <span className="w-3 shrink-0 text-[10px] text-muted-foreground" title={h.name}>
                          {SHORT[h.id]?.[0]}
                        </span>
                      )}
                      <div className={cn("flex min-w-0 flex-1 gap-1", hall !== "all" && "flex-col")}>
                        {SLOTS.map((s) => (
                          <Fragment key={s.id}>{block(d, h.id, s.id, hall !== "all")}</Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {hall === "all" && (
        <p className="mt-3 hidden text-xs text-muted-foreground md:block">
          Б — Большой зал, М — Малый зал, Т — Летняя терраса. В каждой строке слева день, справа вечер. Бронь можно перетащить на свободное время.
        </p>
      )}

      <DaySheet
        day={day}
        month={days}
        today={today}
        index={index}
        onDay={setDay}
        onOpen={(id) => {
          setDay(null);
          setOpenId(id);
        }}
        onCreate={(p) => {
          setDay(null);
          setCreating(p);
        }}
      />
      <BookingSheet booking={open} catalog={catalog} onClose={() => setOpenId(null)} onSaved={setSaved} />
      <NewBookingSheet preset={creating} onClose={() => setCreating(null)} />

      <AlertDialog open={!!move} onOpenChange={(o) => !o && !moving && setMove(null)}>
        <AlertDialogContent>
          {move && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Перенести бронь {move.booking.code}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {move.booking.name}, {move.booking.guests} гостей.
                  <span className="mt-3 block text-ink/80">Было: {where(move.booking)}</span>
                  <span className="block text-ink">Станет: {where(move.to)}</span>
                  <span className="mt-3 block">Перенос попадёт в историю брони. Предупредите клиента о новой дате.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              {moveError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">{moveError}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={moving}>Не переносить</AlertDialogCancel>
                <Button onClick={() => void confirmMove()} disabled={moving}>
                  {moving ? "Переносим…" : "Перенести"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {notice && <p className="pointer-events-auto rounded-full bg-night px-5 py-2.5 text-sm text-ivory shadow-lg">{notice}</p>}
      </div>
    </>
  );
}

/** Everything about one day: each hall's day and evening, with the client or a button to book. */
function DaySheet({
  day,
  month,
  today,
  index,
  onDay,
  onOpen,
  onCreate,
}: {
  day: string | null;
  month: string[];
  today: string;
  index: Map<string, Booking>;
  onDay: (d: string | null) => void;
  onOpen: (id: string) => void;
  onCreate: (p: NewBookingPreset) => void;
}) {
  const prev = day ? addDaysISO(day, -1) : "";
  const next = day ? addDaysISO(day, 1) : "";
  return (
    <Sheet open={!!day} onOpenChange={(o) => !o && onDay(null)}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {day && (
          <>
            <SheetHeader className="border-b border-border px-6 py-5">
              <div className="flex items-center gap-2 pr-8">
                <SheetTitle className="font-display text-2xl font-normal text-night">{formatDay(day, true)}</SheetTitle>
              </div>
              <SheetDescription className="text-ink/70">
                {day < today ? "Прошедший день" : day === today ? "Сегодня" : isWeekend(day) ? "Выходной: вечера разбирают первыми" : "Будний день"}
              </SheetDescription>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" disabled={!month.includes(prev)} onClick={() => onDay(prev)}>
                  <ChevronLeft /> Предыдущий
                </Button>
                <Button variant="outline" size="sm" disabled={!month.includes(next)} onClick={() => onDay(next)}>
                  Следующий <ChevronRight />
                </Button>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 px-6 py-5">
              {BANQUET.map((h) => (
                <section key={h.id}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="font-display text-lg text-night">{h.name}</h3>
                    <span className="text-xs text-muted-foreground">{h.capacity}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {SLOTS.map((s) => {
                      const b = index.get(keyOf(day, h.id, s.id));
                      const Icon = s.id === "day" ? Sun : Moon;
                      return b ? (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onOpen(b.id)}
                          className={cn("flex flex-col gap-1.5 rounded-lg border-l-[3px] px-3 py-2.5 text-left transition-colors", BLOCK[b.status])}
                        >
                          <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Icon className="size-3.5" /> {s.time}
                            </span>
                            <StatusBadge status={b.status} short />
                          </span>
                          <span className="text-[15px] text-ink">
                            {b.name}
                            {b.eventType && <span className="text-muted-foreground"> · {b.eventType}</span>}
                          </span>
                          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70">
                            <span className="flex items-center gap-1">
                              <Users className="size-3.5" /> {b.guests} гостей
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="size-3.5" /> {formatPhone(b.phone)}
                            </span>
                            <span className="tabular-nums">{b.code}</span>
                          </span>
                        </button>
                      ) : (
                        <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Icon className="size-3.5" /> {s.time}
                            <span className="text-ink/80">{day < today ? "· не было брони" : "· свободно"}</span>
                          </span>
                          {day >= today && (
                            <Button size="sm" variant="secondary" onClick={() => onCreate({ hall: h.id, date: day, slot: s.id })}>
                              <Plus /> Записать
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
