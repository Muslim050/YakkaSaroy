"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Armchair, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Layers, Moon, Phone, Plus, Sun, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { HALLS, SLOTS, morningWindow, slotCapacity, type HallId, type SlotId } from "@/lib/data";
import { STATUS, formatDay, formatPhone, hallName, type Booking, type BookingStatus } from "@/lib/bookings";
import { addDaysISO, weekdayISO } from "@/lib/time";
import type { Catalog } from "@/lib/program";
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/ui/modal";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
const SHORT: Partial<Record<HallId, string>> = { grand: "Большой 1", second: "Большой 2", third: "Третий", fourth: "Четвёртый" };
/** The mark in front of a hall's row when every hall is on the board. */
const MARK: Partial<Record<HallId, string>> = { grand: "1", second: "2", third: "3", fourth: "4" };
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

function monthLabel(month: string) {
  const [yy, mm] = month.split("-").map(Number);
  return `${MONTHS[mm - 1]} ${yy}`;
}

function hrefFor(path: string, month: string, hall: HallFilter) {
  return `${path}?month=${month}${hall === "all" ? "" : `&hall=${hall}`}`;
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
  path = "/admin",
}: {
  month: string;
  initialHall: HallFilter;
  bookings: Booking[];
  catalog: Catalog;
  today: string;
  /** Page the month and hall are written to, so the board can live on another page. */
  path?: string;
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

  const index = new Map<string, Booking[]>();
  for (const b of bookings) index.set(keyOf(b.date, b.hall, b.slot), [...(index.get(keyOf(b.date, b.hall, b.slot)) ?? []), b]);
  for (const list of index.values()) list.sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
  const at = (d: string, h: HallId, slot: string) => index.get(keyOf(d, h, slot)) ?? [];
  /** Places still open in a slot: the morning takes several events, the evening one. */
  const room = (d: string, h: HallId, slot: string) => Math.max(0, slotCapacity(slot) - at(d, h, slot).length);

  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const lead = (weekdayISO(days[0]) + 6) % 7;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  const halls = hall === "all" ? BANQUET : BANQUET.filter((h) => h.id === hall);
  const shown = bookings.filter((b) => halls.some((h) => h.id === b.hall));
  const perDay = SLOTS.reduce((n, s) => n + slotCapacity(s.id), 0);
  // Evenings and morning windows are counted apart: an evening is the main event of a day, a morning takes three.
  const ahead = days.filter((d) => d >= today);
  const taken = (slot: SlotId, list = days) => list.reduce((n, d) => n + halls.reduce((k, h) => k + at(d, h.id, slot).length, 0), 0);
  const evenings = { taken: taken("evening"), total: days.length * halls.length, freeAhead: ahead.length * halls.length - taken("evening", ahead) };
  const mornings = { taken: taken("day"), total: days.length * halls.length * slotCapacity("day"), freeAhead: ahead.length * halls.length * slotCapacity("day") - taken("day", ahead) };
  const weekends = days
    .filter((d) => d >= today && isWeekend(d))
    .map((d) => ({
      d,
      free: halls.filter((h) => room(d, h.id, "evening") > 0),
      // every booking of the day, morning included, so a new request shows up here too
      statuses: LEGEND.filter((status) => halls.some((h) => SLOTS.some((s) => at(d, h.id, s.id).some((b) => b.status === status)))),
      fresh: halls.reduce((n, h) => n + SLOTS.reduce((k, s) => k + at(d, h.id, s.id).filter((b) => b.status === "new").length, 0), 0),
    }))
    .filter((x) => x.free.length > 0);
  const byStatus = (s: BookingStatus) => shown.filter((b) => b.status === s).length;

  const pct = evenings.total ? Math.round((evenings.taken / evenings.total) * 1000) / 10 : 0;
  const monthOptions = Array.from({ length: 14 }, (_, i) => shiftMonth(today.slice(0, 7), i - 1));
  if (!monthOptions.includes(month)) monthOptions.push(month);
  const monthItems = Object.fromEntries(monthOptions.map((mm) => [mm, monthLabel(mm)]));

  function go(to: string) {
    startTransition(() => router.push(hrefFor(path, to, hall), { scroll: false }));
  }

  function pickHall(h: HallFilter) {
    setHall(h);
    window.history.replaceState(null, "", hrefFor(path, month, h));
  }

  // ← and → turn the month when nothing else has the keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (document.querySelector("[role=dialog], [role=alertdialog]")) return;
      startTransition(() => router.push(hrefFor(path, shiftMonth(month, e.key === "ArrowLeft" ? -1 : 1), hall), { scroll: false }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, path, month, hall]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

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

  /** One hall's morning or evening inside a day cell: its bookings and, while there is room, a place to add one. */
  function block(date: string, h: HallId, slot: SlotId, large: boolean) {
    const list = at(date, h, slot);
    const past = date < today;
    const open = room(date, h, slot);
    return (
      <div className={cn("flex min-w-0 flex-col gap-1", large ? "w-full" : "flex-1 self-stretch")}>
        {list.map((b) => chip(b, slot, large))}
        {!past && open > 0 && freeCell(date, h, slot, large, list.length > 0 ? `ещё ${open}` : undefined)}
        {past && !list.length && <span className={cn(large ? "h-12 w-full" : "h-5 w-full")} aria-hidden />}
      </div>
    );
  }

  /** One booking in a cell; dragged to move. */
  function chip(b: Booking, slot: SlotId, large: boolean) {
    const past = b.date < today;
    const label = `${hallName(b.hall)}, ${formatDay(b.date)}, ${slotName(slot)}`;
    const movable = !past && MOVABLE.includes(b.status);
    const when = slot === "day" && morningWindow(b.startTime) ? `${morningWindow(b.startTime)!.short} ` : "";
    {
      return (
        <button
          key={b.id}
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
            "flex w-full min-w-0 flex-col justify-center rounded-[5px] border-l-[3px] px-1.5 text-left transition-[opacity,box-shadow]",
            large ? "h-12" : slot === "evening" ? "min-h-5 flex-1" : "h-5",
            BLOCK[b.status],
            movable && "cursor-grab active:cursor-grabbing",
            past && "opacity-60",
            focus && focus !== b.status && "opacity-25",
            drag?.id === b.id && "opacity-40 ring-2 ring-gold",
          )}
        >
          <span className={cn("block w-full min-w-0 truncate text-ink", large ? "text-[13px]" : "text-[11px] leading-none")}>
            {when && <span className="tabular-nums text-muted-foreground">{when}</span>}
            {b.name}
          </span>
          {large && (
            <span className="block truncate text-[11px] text-muted-foreground">
              {b.guests} гостей{b.eventType ? ` · ${b.eventType.toLowerCase()}` : ""}
            </span>
          )}
        </button>
      );
    }
  }

  /** A free place in a slot: click to book, drop a booking to move it. */
  function freeCell(date: string, h: HallId, slot: SlotId, large: boolean, more?: string) {
    const k = keyOf(date, h, slot);
    const Icon = slot === "day" ? Sun : Moon;
    const label = `${hallName(h)}, ${formatDay(date)}, ${slotName(slot)}`;
    const target = drag !== null;
    const hovered = over === k;
    return (
      <button
        key="free"
        type="button"
        onClick={() => setCreating({ hall: h, date, slot })}
        onDragOver={(e) => {
          if (!drag) return;
          setOver(k);
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={() => setOver((o) => (o === k ? null : o))}
        onDrop={(e) => {
          e.preventDefault();
          if (drag) {
            setMoveError("");
            setMove({ booking: drag, to: { hall: h, date, slot } });
          }
          setDrag(null);
          setOver(null);
        }}
        aria-label={`Свободно: ${label}. Записать бронь`}
        title={`${SHORT[h]} · ${slotName(slot)} · свободно`}
        className={cn(
          "group/free flex w-full min-w-0 items-center justify-center gap-1 rounded-[5px] border text-muted-foreground transition-colors",
          large ? "h-12" : slot === "evening" ? "min-h-5 flex-1" : "h-5",
          target
            ? hovered
              ? "border-gold bg-gold/25 text-night"
              : "border-gold/60 bg-gold/5"
            : "border-border/80 hover:border-gold hover:bg-gold/10 hover:text-night focus-visible:border-gold",
          focus && !target && "opacity-40",
        )}
      >
        {target && hovered ? (
          <span className="truncate text-[11px] font-medium">Сюда</span>
        ) : (
          <>
            <Icon className={cn("opacity-40 group-hover/free:hidden", large ? "size-3.5" : "size-3")} />
            {more && <span className="text-[10px] leading-none group-hover/free:hidden">{more}</span>}
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
      {/* heading and the way in */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Календарь залов</h2>
          <p className="mt-1 text-sm text-muted-foreground">Выберите дату и зал, чтобы создать или перенести бронь.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating({ hall: hall === "all" ? undefined : hall })}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl brand-action px-5 text-sm font-medium"
        >
          <Plus className="size-4" /> Новая заявка
        </button>
      </div>

      {/* month and hall */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(shiftMonth(month, -1))} aria-label="Предыдущий месяц" className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card transition-colors hover:bg-secondary">
            <ChevronLeft className="size-4" />
          </button>
          <Select items={monthItems} value={month} onValueChange={(v) => v && go(String(v))}>
            <SelectTrigger aria-label="Месяц" className="h-10! rounded-xl border-border bg-card px-3 text-sm font-medium text-night">
              <CalendarDays className="size-4 text-gold-dim" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((mm) => (
                <SelectItem key={mm} value={mm}>{monthLabel(mm)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button type="button" onClick={() => go(shiftMonth(month, 1))} aria-label="Следующий месяц" className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card transition-colors hover:bg-secondary">
            <ChevronRight className="size-4" />
          </button>
          {month !== today.slice(0, 7) && (
            <button type="button" onClick={() => go(today.slice(0, 7))} className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-ink hover:bg-secondary">
              Сегодня
            </button>
          )}
          {pending && <span className="text-xs text-muted-foreground">Загружаем…</span>}
        </div>

        <div role="group" aria-label="Зал" className="scroll-x -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {(["all", ...BANQUET.map((h) => h.id)] as HallFilter[]).map((id) => {
            const Icon = id === "all" ? Layers : Armchair;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={hall === id}
                onClick={() => pickHall(id)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
                  hall === id ? "border-night bg-night text-ivory" : "border-border bg-card text-ink/80 hover:border-gold hover:text-ink",
                )}
              >
                <Icon className="size-3.5 opacity-70" />
                {id === "all" ? "Все залы" : hallName(id)}
              </button>
            );
          })}
        </div>
      </div>

      {/* what the month looks like */}
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-ink">Занято за месяц</p>
          <div className="mt-3 flex items-center gap-4">
            <Ring pct={pct} />
            <dl className="grid gap-1.5 text-sm leading-none tabular-nums">
              <div>
                <dt className="text-[11px] text-muted-foreground">Вечера</dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {evenings.taken} <span className="font-medium text-muted-foreground">из {evenings.total}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Утренние окна</dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {mornings.taken} <span className="font-medium text-muted-foreground">из {mornings.total}</span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`Занято вечеров: ${pct}%`}>
            <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Впереди свободно: вечеров {evenings.freeAhead}, утренних окон {mornings.freeAhead}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-ink">Свободные вечера пт, сб и вс</p>
          {weekends.length ? (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
              {weekends.map(({ d, free, statuses, fresh }) => (
                <li key={d}>
                  <button
                    type="button"
                    onClick={() => setDay(d)}
                    className={cn("flex h-full min-h-12 w-full flex-col items-start rounded-xl border border-border px-3 py-1.5 text-left shadow-sm transition-colors hover:border-gold hover:bg-gold/10", free.length < halls.length && "border-[#efd6b3] bg-[#fbefe1]")}
                  >
                    <span className="flex w-full items-center gap-1 text-sm leading-tight">
                      <span className="font-semibold tabular-nums text-ink">{Number(d.slice(8))}</span> <span className="text-muted-foreground">{WD[weekdayISO(d)]}</span>
                      {statuses.length > 0 && (
                        <span className="ml-auto flex items-center gap-1" aria-label={`Брони в этот день: ${statuses.map((status) => STATUS[status].label).join(", ")}`} title={`Брони в этот день: ${statuses.map((status) => STATUS[status].label).join(", ")}`}>
                          {fresh > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-900 tabular-nums">{fresh} нов.</span>}
                          {statuses.map((status) => <span key={status} className={cn("size-2 rounded-full", DOT[status])} />)}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] leading-tight text-gold-dim">
                      {hall === "all" ? (free.length === BANQUET.length ? "Все залы" : free.map((h) => SHORT[h.id]).join(", ")) : "Свободен"}
                    </span>
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
            <span className={cn("size-2.5 rounded-full", DOT[s])} />
            {STATUS[s].label}
            <span className="tabular-nums opacity-70">{byStatus(s)}</span>
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-4 text-muted-foreground md:flex">
          <span className="flex items-center gap-1.5">
            <Sun className="size-3.5 text-gold-dim" /> День: {SLOTS[0].time}
          </span>
          <span className="flex items-center gap-1.5">
            <Moon className="size-3.5 text-gold-dim" /> Вечер: {SLOTS[1].time}
          </span>
        </span>
      </div>

      {/* which row is which hall, when every hall is on the board */}
      {hall === "all" && (
        <div className="mb-3 hidden flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground md:flex">
          <span>Строки в дне:</span>
          {BANQUET.map((h) => (
            <button key={h.id} type="button" onClick={() => pickHall(h.id)} title={`Показать только ${h.name}`} className="flex items-center gap-1.5 rounded-full py-0.5 pr-2 pl-0.5 text-ink/80 transition-colors hover:bg-secondary hover:text-ink">
              <HallMark id={h.id} />
              {h.name}
            </button>
          ))}
          <span>в строке слева день, справа вечер</span>
        </div>
      )}

      {/* the month */}
      <div aria-busy={pending} className={cn("overflow-clip rounded-2xl border border-border bg-card transition-opacity", pending && "opacity-50")}>
        {/* stays under the top bar while the month scrolls, so a column always says its weekday */}
        <div className="sticky top-16 z-10 grid grid-cols-7 rounded-t-2xl border-b border-border bg-secondary text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase shadow-[0_1px_0_var(--border)]">
          {WEEK.map((w, i) => (
            <div key={w} className={cn("px-2 py-2.5 md:px-3", i >= 4 && "text-ink")}>
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
            const free = halls.reduce((n, h) => n + SLOTS.reduce((k, s) => k + room(d, h.id, s.id), 0), 0);
            const slots = halls.length * perDay;
            const dayHalls = past ? halls.filter((h) => SLOTS.some((s) => at(d, h.id, s.id).length > 0)) : halls;
            return (
              <div key={d} className={cn("relative min-w-0", edge, isWeekend(d) && !past && "bg-gold/[0.04]", isToday && "bg-gold/10")}>
                {/* phone: the whole day is one button with a tiny map of the slots */}
                <button type="button" onClick={() => setDay(d)} className="flex min-h-16 w-full flex-col gap-1.5 p-1.5 text-left md:hidden" aria-label={`${formatDay(d, true)}: свободно ${free} из ${slots}`}>
                  <span className={cn("grid size-6 place-items-center rounded-full text-xs tabular-nums", isToday ? "bg-night text-ivory" : past ? "text-muted-foreground" : "text-ink")}>{Number(d.slice(8))}</span>
                  <span className="grid w-full gap-[3px]">
                    {halls.map((h) => (
                      <span key={h.id} className="flex gap-[3px]">
                        {SLOTS.map((s) => {
                          const b = at(d, h.id, s.id)[0];
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
                    <span className="flex items-center gap-1">
                      {hall === "all" && dayHalls.length > 0 && (
                        <span aria-hidden className="flex flex-col items-center text-[8px] leading-[1.05] text-muted-foreground/80" title="Строки ниже: залы">
                          <span>з</span>
                          <span>а</span>
                          <span>л</span>
                        </span>
                      )}
                      <span className={cn("grid size-7 place-items-center rounded-full text-sm tabular-nums", isToday ? "bg-night text-ivory" : past ? "text-muted-foreground" : "font-semibold text-ink")}>
                        {Number(d.slice(8))}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {isToday && <span className="rounded-md bg-gold/25 px-1.5 py-0.5 font-medium text-night">Сегодня</span>}
                      {!past && !isToday && (free === slots ? <span>Свободен</span> : free === 0 ? <span className="text-ink/70">Занят</span> : <span className="whitespace-nowrap" title={`Свободно ${free} из ${slots}`}>{free} из {slots}</span>)}
                      <ArrowRight className="size-3 opacity-0 transition-opacity group-hover/day:opacity-100" />
                    </span>
                  </button>
                  {/* a past day keeps only what happened in it; rows sit straight in the column so long names cannot widen it */}
                  {dayHalls.map((h) => (
                    <div key={h.id} className="flex min-w-0 items-start gap-1">
                      {hall === "all" && (
                        <button type="button" onClick={() => pickHall(h.id)} title={`${h.name}: показать только его`} aria-label={`${h.name}: показать только его`} className="mt-0.5 shrink-0 rounded transition-colors hover:bg-night hover:text-ivory">
                          <HallMark id={h.id} />
                        </button>
                      )}
                      <div className={cn("flex min-w-0 flex-1 items-stretch gap-1", hall !== "all" && "flex-col")}>
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
      <NewBookingSheet preset={creating} catalog={catalog} onClose={() => setCreating(null)} />

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

/** Share of the month's slots that are taken, as a ring with the number inside. */
function Ring({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-14 shrink-0 place-items-center" role="img" aria-label={`Занято ${pct}%`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--secondary)" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(pct, 100) / 100)} />
      </svg>
      <span className="text-[11px] font-medium text-ink tabular-nums">{pct.toLocaleString("ru-RU")}%</span>
    </span>
  );
}

/** The small numbered square in front of a hall's row; the same in the key and in every day. */
function HallMark({ id }: { id: HallId }) {
  return <span className="grid size-4 place-items-center rounded-md bg-secondary text-[10px] font-semibold text-ink/80">{MARK[id]}</span>;
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
  index: Map<string, Booking[]>;
  onDay: (d: string | null) => void;
  onOpen: (id: string) => void;
  onCreate: (p: NewBookingPreset) => void;
}) {
  const prev = day ? addDaysISO(day, -1) : "";
  const next = day ? addDaysISO(day, 1) : "";
  return (
    <Modal open={!!day} onOpenChange={(o) => !o && onDay(null)}>
      <ModalContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {day && (
          <>
            <ModalHeader className="border-b border-border px-6 py-5">
              <div className="flex items-center gap-2 pr-8">
                <ModalTitle className="font-display text-2xl font-normal text-night">{formatDay(day, true)}</ModalTitle>
              </div>
              <ModalDescription className="text-ink/70">
                {day < today ? "Прошедший день" : day === today ? "Сегодня" : isWeekend(day) ? "Выходной: вечера разбирают первыми" : "Будний день"}
              </ModalDescription>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" disabled={!month.includes(prev)} onClick={() => onDay(prev)}>
                  <ChevronLeft /> Предыдущий
                </Button>
                <Button variant="outline" size="sm" disabled={!month.includes(next)} onClick={() => onDay(next)}>
                  Следующий <ChevronRight />
                </Button>
              </div>
            </ModalHeader>

            <div className="flex flex-col gap-6 px-6 py-5">
              {BANQUET.map((h) => (
                <section key={h.id}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="font-display text-lg text-night">{h.name}</h3>
                    <span className="text-xs text-muted-foreground">{h.capacity}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {SLOTS.flatMap((s) => {
                      const list = index.get(keyOf(day, h.id, s.id)) ?? [];
                      const open = slotCapacity(s.id) - list.length;
                      const Icon = s.id === "day" ? Sun : Moon;
                      const cards = list.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => onOpen(b.id)}
                          className={cn("flex flex-col gap-1.5 rounded-lg border-l-[3px] px-3 py-2.5 text-left transition-colors", BLOCK[b.status])}
                        >
                          <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Icon className="size-3.5" /> {s.id === "day" && morningWindow(b.startTime) ? morningWindow(b.startTime)!.label : s.time}
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
                      ));
                      if (open <= 0 || (day < today && list.length)) return cards;
                      return [
                        ...cards,
                        <div key={`${s.id}-free`} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Icon className="size-3.5" /> {s.time}
                            <span className="text-ink/80">
                              {day < today ? "· не было брони" : s.id === "day" ? `· свободно ${open} из ${slotCapacity("day")}` : "· свободно"}
                            </span>
                          </span>
                          {day >= today && (
                            <Button size="sm" variant="secondary" onClick={() => onCreate({ hall: h.id, date: day, slot: s.id })}>
                              <Plus /> Записать
                            </Button>
                          )}
                        </div>,
                      ];
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
