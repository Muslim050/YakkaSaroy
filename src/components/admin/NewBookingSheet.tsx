"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Moon, Phone, Plus, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_TYPES, HALLS, MORNING_CAPACITY, MORNING_WINDOWS, RESTAURANT_HOURS, SLOTS, morningWindow, type BanquetHallId, type HallId, type SlotId } from "@/lib/data";
import { formatDateTime, formatDay, formatPhone, formatSum, hallCost, maskPhone, STATUS, type Booking, type BookingStatus } from "@/lib/bookings";
import { fromISO, monthKeyOf, useMonthAvailability, useToday, invalidateAvailability } from "@/lib/availability";
import { addDaysISO } from "@/lib/time";
import {
  defaultSelection,
  forEventType,
  offered,
  optionCost,
  programCost,
  selectedOptions,
  withDefaults,
  type Catalog,
  type ProgramCategory,
  type ProgramOption,
  type ProgramSelection,
} from "@/lib/program";
import { AvailabilityCalendar, CalendarLegend } from "@/components/AvailabilityCalendar";
import { MediaThumb, MediaView } from "@/components/program/MediaView";
import { Lightbox } from "@/components/program/Lightbox";
import { priceLabel } from "@/components/program/OptionCard";
import { StatusBadge } from "@/components/app/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Modal, ModalClose, ModalContent, ModalDescription, ModalTitle } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ErrorNote } from "./fields";

export type NewBookingPreset = { hall?: HallId; date?: string; slot?: string };

const HALL_ITEMS = Object.fromEntries(HALLS.map((h) => [h.id, h.name]));
const MORNING_EVENT = "Утренний плов";
/** The stages a manager sets by hand; cancelling has its own button and its own confirmation. */
const STAGES: BookingStatus[] = ["new", "confirmed", "prepaid", "done"];
const STAGE_ITEMS = Object.fromEntries(STAGES.map((st) => [st, STATUS[st].label]));
const STAGE_DOT: Record<BookingStatus, string> = { new: "bg-amber-500", confirmed: "bg-sky-500", prepaid: "bg-emerald-600", done: "bg-stone-400", cancelled: "bg-rose-500" };

/** What each category offers for an occasion. Options a booking already has stay on offer, even hidden ones. */
function offerFor(catalog: Catalog, eventType: string, kept?: ProgramSelection) {
  return Object.fromEntries(
    catalog.map((c) => {
      const list = forEventType(offered(c), eventType || undefined);
      const had = (kept?.[c.id] ?? []).map((id) => c.options.find((o) => o.id === id)).filter((o): o is ProgramOption => !!o && !list.includes(o));
      return [c.id, [...list, ...had]];
    }),
  ) as Record<string, ProgramOption[]>;
}

/** A choice that no longer fits is dropped; a required category then falls back to its included option. */
function resolveSelection(catalog: Catalog, onOffer: Record<string, ProgramOption[]>, sel: ProgramSelection) {
  const out: ProgramSelection = {};
  for (const c of catalog) {
    const allowed = onOffer[c.id];
    let ids = (sel[c.id] ?? []).filter((id) => allowed.some((o) => o.id === id));
    if (c.required && !ids.length) {
      const fallback = allowed.find((o) => o.price.type === "included") ?? allowed[0];
      ids = fallback ? [fallback.id] : [];
    }
    out[c.id] = ids;
  }
  return out;
}

/**
 * A booking taken over the phone. The month with free days, the hall, the occasion,
 * the menu and the client on the left, the services under them, and on the right a
 * receipt: the total, what is chosen and what is still missing.
 */
export function NewBookingSheet({ preset, catalog, onClose }: { preset: NewBookingPreset | null; catalog: Catalog; onClose: () => void }) {
  return (
    <Modal open={!!preset} onOpenChange={(o) => !o && onClose()}>
      <ModalContent className="bg-background sm:max-w-6xl">
        {preset && <Body key={JSON.stringify(preset)} preset={preset} catalog={catalog} onDone={onClose} />}
      </ModalContent>
    </Modal>
  );
}

/**
 * The same window for a banquet that is already booked: the date, the hall, the client,
 * the menu and the services are changed in one place, together with the stage,
 * the prepayment and the note for the team.
 */
export function EditBookingSheet({ booking, catalog, onClose, onSaved }: { booking: Booking | null; catalog: Catalog; onClose: () => void; onSaved?: (b: Booking) => void }) {
  return (
    <Modal open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <ModalContent className="bg-background sm:max-w-6xl">
        {booking && (
          <Body
            key={`${booking.id}-${booking.updatedAt}`}
            preset={{ hall: booking.hall, date: booking.date, slot: booking.slot }}
            booking={booking}
            catalog={catalog}
            onDone={onClose}
            onSaved={onSaved}
          />
        )}
      </ModalContent>
    </Modal>
  );
}

function Body({ preset, booking: b, catalog, onDone, onSaved }: { preset: NewBookingPreset; booking?: Booking; catalog: Catalog; onDone: () => void; onSaved?: (b: Booking) => void }) {
  const router = useRouter();
  const today = useToday();
  const [hall, setHall] = useState<HallId>(preset.hall ?? "grand");
  const [monthOverride, setMonth] = useState<Date | null>(preset.date ? fromISO(preset.date) : null);
  const [date, setDate] = useState(preset.date ?? "");
  const [slot, setSlot] = useState(preset.slot ?? (preset.hall === "restaurant" ? "" : "evening"));
  const [startTime, setStartTime] = useState(b?.startTime ?? "");
  const [calOpen, setCalOpen] = useState(false);
  const [peek, setPeek] = useState<{ option: ProgramOption; top: number; left: number } | null>(null);
  const [box, setBox] = useState<{ option: ProgramOption; index: number } | null>(null);
  const phone0 = b ? formatPhone(b.phone) : "+998";
  const [guests, setGuests] = useState(b ? String(b.guests) : "");
  const [name, setName] = useState(b?.name ?? "");
  const [phone, setPhone] = useState(phone0);
  const [eventType, setEventType] = useState<string>(b ? (b.eventType ?? "") : preset.slot === "day" ? MORNING_EVENT : EVENT_TYPES[0]);
  const [sel, setSel] = useState<ProgramSelection>(() => (b ? withDefaults(catalog, b.extras) : defaultSelection(catalog)));
  const [comment, setComment] = useState(b?.comment ?? "");
  // only an existing booking has these
  const [status, setStatus] = useState<BookingStatus>(b?.status ?? "new");
  const [prepayment, setPrepayment] = useState(b?.prepayment ? String(b.prepayment) : "");
  const [managerNote, setManagerNote] = useState(b?.managerNote ?? "");
  const [cancelOpen, setCancelOpen] = useState(false);
  /** The program as the booking has it, to tell whether it was changed. */
  const [programKey0] = useState(() => (b ? JSON.stringify(resolveSelection(catalog, offerFor(catalog, b.eventType ?? "", b.extras), withDefaults(catalog, b.extras))) : ""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const month = monthOverride ?? (today ? fromISO(today) : new Date(2026, 0, 1));
  const days = useMonthAvailability(today ? monthKeyOf(month) : "");
  const dateDays = useMonthAvailability(date ? monthKeyOf(fromISO(date)) : "");
  const entry = date ? dateDays?.[date] : undefined;
  const hallDef = HALLS.find((h) => h.id === hall)!;
  const table = hall === "restaurant";
  const eventTypes = EVENT_TYPES.filter((type) => (slot === "day" ? type === MORNING_EVENT : type !== MORNING_EVENT) || type === b?.eventType);
  const eventItems = Object.fromEntries(eventTypes.map((type) => [type, type]));
  const n = Number(guests) || 0;
  const hallSum = hallCost({ hall, guests: n }) ?? 0;

  // Every category offers only what fits the occasion; what no longer fits is dropped.
  const onOffer = offerFor(catalog, eventType, b?.extras);
  const selection = resolveSelection(catalog, onOffer, sel);
  const programSum = table ? 0 : programCost(catalog, selection, n);
  const chosen = table ? [] : selectedOptions(catalog, selection);
  // Every category, the menu first, is picked from tiles in the services block.
  const sections = catalog
    .map((c) => ({ category: c, options: onOffer[c.id] }))
    .filter((s) => s.options.length > 0);

  /** The time this booking already holds: the calendar counts it as taken, but it is its own. */
  const own = (slotId: string) => !!b && hall === b.hall && date === b.date && slotId === b.slot;

  /** The periods of the chosen day in this hall: the hours of the restaurant, or the day and the evening of a hall. */
  const periods: { id: string; label: string; sub: string; free: boolean }[] = table
    ? RESTAURANT_HOURS.map((h) => {
        const free = entry?.restaurant[h] ?? 0;
        return { id: h, label: h, sub: free > 0 ? `свободно ${free}` : "занято", free: free > 0 };
      })
    : SLOTS.map((s) => {
        const free = own(s.id) || entry?.[hall as BanquetHallId][s.id as SlotId] === "free";
        const open = s.id === "day" ? MORNING_CAPACITY - (entry?.morning?.[hall as BanquetHallId]?.length ?? 0) : 1;
        const sub = !entry && !free ? "проверяем…" : !free ? "занято" : s.id === "day" && entry ? `${s.time} · своб. ${open} из ${MORNING_CAPACITY}` : s.time;
        return { id: s.id, label: s.id === "day" ? "Утро" : "Вечер", sub, free };
      });

  const picked = periods.some((p) => p.id === slot && p.free) ? slot : "";
  const period = periods.find((p) => p.id === picked);
  /** Morning windows already taken in this hall; each is booked once. */
  const takenTimes = (entry?.morning?.[hall as BanquetHallId] ?? []).filter((t) => !(own("day") && t === b?.startTime));
  const morning = !table && picked === "day";
  const pickedWindow = morning && !takenTimes.includes(startTime) ? morningWindow(startTime) : undefined;

  /** What the receipt still waits for; the button opens once the list is empty. */
  const missing = [
    !date && "Выбрать день в календаре",
    date && !picked && (table ? "Выбрать час" : entry ? "Выберите свободное время" : "Проверяем доступность"),
    // an old morning booking without a window can stay that way until it is moved
    morning && !pickedWindow && !(own("day") && !b?.startTime) && "Выбрать утреннее окно",
    name.trim().length < 2 && "Имя заказчика",
    // a number saved long ago in another format is not asked for again until it is touched
    phone.replace(/\D/g, "").length < 12 && (!b || phone !== phone0) && "Телефон заказчика",
    n < 1 && "Количество гостей",
    table && n > hallDef.guestsMax && `За столик садятся до ${hallDef.guestsMax} человек`,
  ].filter((x): x is string => typeof x === "string" && x.length > 0);

  const total = hallSum + programSum;
  const prepaid = Number(prepayment) || 0;
  const paidPct = total ? Math.min(100, Math.round((prepaid / total) * 100)) : 0;
  /** What differs from the saved booking; only this is sent. */
  const changes: Record<string, unknown> = {};
  if (b) {
    if (name.trim() !== b.name) changes.name = name.trim();
    if (phone !== phone0) changes.phone = phone;
    if (n !== b.guests) changes.guests = n;
    if (eventType && eventType !== (b.eventType ?? "")) changes.eventType = eventType;
    if (comment !== (b.comment ?? "")) changes.comment = comment;
    if (hall !== b.hall) changes.hall = hall;
    if (date !== b.date) changes.date = date;
    if (picked && picked !== b.slot) changes.slot = picked;
    if (morning && pickedWindow && pickedWindow.id !== (b.startTime ?? "")) changes.startTime = pickedWindow.id;
    if (JSON.stringify(selection) !== programKey0) changes.extras = selection;
    if (status !== b.status) changes.status = status;
    if (prepaid !== (b.prepayment ?? 0)) changes.prepayment = prepaid;
    if (managerNote !== (b.managerNote ?? "")) changes.managerNote = managerNote;
  }
  const dirty = Object.keys(changes).length > 0;

  function pickHall(h: HallId) {
    setHall(h);
    if (h === "restaurant") setSlot("");
    else if (table) {
      setSlot("evening");
      setEventType(EVENT_TYPES[0]);
    }
    setError("");
  }

  function pickDay(d: string) {
    setDate(d);
    setMonth(fromISO(d));
    if (table) setSlot("");
    setError("");
  }

  /** Shows a service's picture large beside its tile; placed against the window, since the modal scrolls. */
  function showPeek(option: ProgramOption, el: HTMLElement) {
    if (!option.media[0]) return;
    const r = el.getBoundingClientRect();
    const w = 360;
    const h = 270;
    const left = r.right + 12 + w <= window.innerWidth ? r.right + 12 : Math.max(8, r.left - w - 12);
    const top = Math.min(Math.max(8, r.top + r.height / 2 - h / 2), window.innerHeight - h - 8);
    setPeek({ option, top, left });
  }

  function pickPeriod(id: string) {
    // the morning is for plov, the evening for the rest: the occasion follows the period when it changes
    if (!table && id !== slot) setEventType(id === "day" ? MORNING_EVENT : EVENT_TYPES[0]);
    setSlot(id);
    setError("");
  }

  function toggle(c: ProgramCategory, id: string) {
    setSel((s) => {
      const cur = s[c.id] ?? [];
      const on = cur.includes(id);
      let next: string[];
      if (c.pick === "one") next = on ? (c.required ? cur : []) : [id];
      else next = on ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...s, [c.id]: next };
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (missing.length) return setError(missing[0]);
    if (b) return void save(changes);
    setBusy(true);
    setError("");
    const r = await api("/api/admin/bookings", "POST", {
      hall,
      date,
      slot: picked,
      startTime: morning ? pickedWindow?.id : undefined,
      status: "new",
      eventType: table ? undefined : eventType,
      guests: n,
      name: name.trim(),
      phone,
      comment,
      extras: table ? undefined : selection,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    invalidateAvailability();
    router.refresh();
    onDone();
  }

  /** Sends changes of an existing booking and closes the window; false when the server refused. */
  async function save(patch: Record<string, unknown>) {
    if (!b) return false;
    if (patch.status === "prepaid" && !prepaid) return setError("Для статуса «Предоплата внесена» укажите сумму предоплаты"), false;
    setBusy(true);
    setError("");
    const r = await api(`/api/admin/bookings/${b.id}`, "PATCH", patch);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      invalidateAvailability();
      return false;
    }
    invalidateAvailability();
    onSaved?.(r.json.booking as Booking);
    router.refresh();
    onDone();
    return true;
  }

  const field = "grid min-w-0 gap-1.5 text-sm text-ink/80";

  /** Morning and evening (or the hours of the restaurant), shown beside the date. */
  const periodChips = periods.map((p) => {
                  const Icon = p.id === "day" ? Sun : Moon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!p.free}
                      aria-pressed={picked === p.id}
                      onClick={() => pickPeriod(p.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors",
                        !table && "w-full min-w-0",
                        picked === p.id ? "border-gold bg-gold/15" : p.free ? "border-border hover:border-gold" : "cursor-not-allowed border-border/60 text-muted-foreground/60",
                      )}
                    >
                      {!table && <Icon className="size-4 shrink-0 text-gold-dim" />}
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-sm font-medium">{p.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{p.sub}</span>
                      </span>
                      {!table && p.id === "day" && p.free && <Plus className="ml-auto size-4 shrink-0 text-gold-dim" />}
                    </button>
                  );
                });

  return (
    <form onSubmit={submit} className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
      {/* everything that is chosen */}
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="pr-8 lg:pr-0">
          {b ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <ModalTitle className="font-display text-3xl font-normal leading-none text-night">Бронь {b.code}</ModalTitle>
                <StatusBadge status={b.status} />
              </div>
              <ModalDescription className="mt-2">
                Заявка {formatDateTime(b.createdAt)}
                {b.source === "site" ? " с сайта" : b.source === "admin" ? ", записал менеджер" : ""}. Здесь меняется всё: дата, зал, клиент, меню и услуги.
              </ModalDescription>
            </>
          ) : (
            <>
              <ModalTitle className="font-display text-3xl font-normal leading-none text-night">Новая бронь</ModalTitle>
              <ModalDescription className="mt-2">Бронь появится как новая заявка, дальше статус меняется в её карточке.</ModalDescription>
            </>
          )}
        </div>

        <div className={cn("grid gap-5", !date && "md:grid-cols-2")}>
          {/* a call starts with the date: the month is open until a day is picked, then it folds into the bar below */}
          {!date && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <AvailabilityCalendar size="lg" tone="light" hall={hall} days={days} today={today} month={month} onMonthChange={setMonth} selected={date} onSelect={pickDay} className={cn("sm:[--cell-size:--spacing(11)]", !days && "opacity-60")} />
              <CalendarLegend hall={hall} tone="light" className="mt-4" />
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            {date ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Предыдущий день"
                  disabled={!today || addDaysISO(date, -1) < today}
                  onClick={() => pickDay(addDaysISO(date, -1))}
                  className="grid size-10 shrink-0 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger aria-label="Выбрать другую дату" className="flex h-10 shrink-0 items-center gap-2.5 rounded-lg border border-border px-3 whitespace-nowrap transition-colors hover:border-gold hover:bg-gold/10">
                    <CalendarDays className="size-4 text-gold-dim" />
                    <span className="font-display text-xl leading-none text-night">{formatDay(date, true)}</span>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-3">
                    <AvailabilityCalendar
                      size="sm"
                      tone="light"
                      hall={hall}
                      days={days}
                      today={today}
                      month={month}
                      onMonthChange={setMonth}
                      selected={date}
                      onSelect={(d) => {
                        pickDay(d);
                        setCalOpen(false);
                      }}
                    />
                    <CalendarLegend hall={hall} tone="light" className="mt-3 max-w-72" />
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  aria-label="Следующий день"
                  onClick={() => pickDay(addDaysISO(date, 1))}
                  className="grid size-10 shrink-0 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
                >
                  <ChevronRight className="size-4" />
                </button>
                {!table && (
                  <div role="group" aria-label="Период" className="ml-auto grid min-w-0 max-w-[27rem] flex-1 grid-cols-2 gap-2 pl-2">
                    {periodChips}
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-gold-dim">{hallDef.name}</p>
                <p className="mt-1 font-display text-3xl text-night">Выберите день в календаре</p>
              </>
            )}
            {/* a restaurant table is booked for an hour: the hours get a row of their own */}
            {date && table && (
              <div role="group" aria-label="Час" className="scroll-x mt-3 flex gap-2 overflow-x-auto pb-1">
                {periodChips}
              </div>
            )}

            {/* the morning is three one-hour windows; a taken one stays visible but cannot be picked */}
            {morning && (
              <div role="group" aria-label="Утреннее окно" className="mt-2 grid max-w-xl grid-cols-3 gap-2">
                {MORNING_WINDOWS.map((w) => {
                  const taken = takenTimes.includes(w.id);
                  const on = pickedWindow?.id === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      disabled={taken}
                      aria-pressed={on}
                      onClick={() => setStartTime(w.id)}
                      className={cn(
                        "flex flex-col items-center rounded-lg border px-2 py-1.5 text-center leading-tight transition-colors",
                        on ? "border-gold bg-gold/15" : taken ? "cursor-not-allowed border-border/60 bg-secondary/40 text-muted-foreground/60" : "border-border hover:border-gold",
                      )}
                    >
                      <span className="text-sm font-medium tabular-nums">{w.label}</span>
                      <span className="text-[11px] text-muted-foreground">{taken ? "занято" : on ? "выбрано" : "свободно"}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className={cn("mt-5 grid gap-4", date && "lg:grid-cols-2")}>
              <label className={field}>
                Имя заказчика
                <Input name="name" required autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
              </label>
              <label className={field}>
                Телефон
                <Input
                  name="phone"
                  type="tel"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
                  placeholder="+998 90 123 45 67"
                  className="h-10 tabular-nums"
                />
              </label>

              {/* hall, occasion and guests share a row now that the menu lives with the services */}
              <div className={cn("grid gap-4", table ? "sm:grid-cols-2" : "sm:grid-cols-3", date && "lg:col-span-2")}>
              <label className={field}>
                Зал
                <Select items={HALL_ITEMS} value={hall} onValueChange={(v) => v && pickHall(v as HallId)}>
                  <SelectTrigger className="h-10! w-full min-w-0"><SelectValue /></SelectTrigger>
                  {/* a banquet is moved between halls; a restaurant table is a different kind of booking */}
                  <SelectContent>{HALLS.filter((h) => !b || h.id !== "restaurant").map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                </Select>
              </label>
                {!table && (
                  <label className={field}>
                    Торжество
                    <Select items={eventItems} value={eventType || null} onValueChange={(v) => v && setEventType(String(v))}>
                      <SelectTrigger className="h-10! w-full min-w-0"><SelectValue placeholder="Не указано" /></SelectTrigger>
                      <SelectContent>
                        {eventTypes.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}
                <label className={field}>
                  Количество гостей
                  <Input
                    name="guests"
                    type="number"
                    required
                    min={1}
                    max={table ? hallDef.guestsMax : undefined}
                    inputMode="numeric"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    placeholder={table ? "2" : `от ${hallDef.guestsMin} до ${hallDef.guestsMax}`}
                    className="h-10"
                  />
                </label>
              </div>
              <label className={cn(field, date && "lg:col-span-2")}>
                Пожелания
                <Textarea name="comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например, без алкоголя" />
              </label>
            </div>
          </div>
        </div>

        {/* an existing booking also has a stage, a prepayment and a note */}
        {b && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h3 className="font-display text-2xl text-night">Статус и оплата</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={field}>
                Статус
                <Select items={STAGE_ITEMS} value={status} onValueChange={(v) => v && setStatus(v as BookingStatus)}>
                  <SelectTrigger className="h-10! w-full min-w-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((st) => (
                      <SelectItem key={st} value={st}>
                        <span className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", STAGE_DOT[st])} />
                          {STATUS[st].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className={field}>
                Предоплата, сум
                <Input type="number" min={0} step={100000} inputMode="numeric" value={prepayment} onChange={(e) => setPrepayment(e.target.value)} placeholder={total ? `30% — ${formatSum(Math.round((total * 0.3) / 1_000_000) * 1_000_000)}` : "Не внесена"} className="h-10" />
              </label>
              {/* how much of the banquet is paid; follows the sum as it is typed */}
              {total > 0 && (
                <div className="sm:col-span-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
                    <span>
                      Внесено <span className="font-medium text-ink">{prepaid ? formatSum(prepaid) : "—"}</span> из {formatSum(total)}
                    </span>
                    <span>
                      Остаток <span className="font-medium text-ink">{formatSum(Math.max(0, total - prepaid))}</span>
                    </span>
                  </div>
                  <div role="img" aria-label={`Оплачено ${paidPct}%`} className="relative mt-1.5 h-5 overflow-hidden rounded-full bg-secondary">
                    <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-300", paidPct >= 100 ? "bg-emerald-500" : "bg-gold")} style={{ width: prepaid ? `${Math.max(paidPct, 3)}%` : 0 }} />
                    <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-ink">{paidPct}%</span>
                  </div>
                </div>
              )}
              <label className={cn(field, "sm:col-span-2")}>
                Заметка для команды
                <Textarea rows={2} value={managerNote} onChange={(e) => setManagerNote(e.target.value)} placeholder="Клиент её не видит" />
              </label>
            </div>
          </div>
        )}

        {/* the rest of the program: decor, show, cake and photo */}
        {!table && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-2xl text-night">Меню и услуги</h3>
              {!b && <p className="text-sm text-muted-foreground">Выбор можно поменять потом в карточке брони.</p>}
            </div>
            <div className="mt-4 grid gap-5">


              {sections.map(({ category: c, options }) => (
                <section key={c.id}>
                  <div className="mb-2 flex items-baseline gap-2">
                    <h4 className="text-sm font-medium text-ink">{c.title}</h4>
                    <span className="text-xs text-muted-foreground">{c.pick === "one" ? (c.required ? "один вариант" : "один вариант или без него") : "сколько угодно"}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {options.map((o) => (
                      <OptionTile key={o.id} option={o} guests={n} selected={(selection[c.id] ?? []).includes(o.id)} onToggle={() => toggle(c, o.id)} onPeek={showPeek} onPeekEnd={() => setPeek(null)} onView={(option) => setBox({ option, index: 0 })} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {b && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h3 className="font-display text-2xl text-night">История</h3>
            <ol className="relative mt-4 ml-1.5 grid gap-3 border-l border-border pl-5 text-sm">
              {[...b.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className={cn("absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-card", i === 0 ? "bg-gold" : "bg-border")} />
                  <span className="block text-ink">{h.text}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(h.at)} · {h.by === "admin" ? "менеджер" : h.by === "client" ? "клиент" : "система"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* the receipt */}
      <aside className="border-t border-border bg-card/70 lg:border-t-0 lg:border-l">
        <div className="grid gap-5 p-5 sm:p-6 lg:sticky lg:top-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Итог брони</p>

          <div>
            <p className="text-sm text-muted-foreground">{table ? "Столик" : "Расчётная стоимость"}</p>
            <p className="mt-1 font-display text-3xl leading-none text-night tabular-nums">{table ? "по счёту" : n > 0 ? formatSum(total) : "—"}</p>
            {b && prepaid > 0 && (
              <dl className="mt-3 grid gap-1 text-sm">
                <Row label="Внесено" value={formatSum(prepaid)} />
                <Row label="Остаток" value={formatSum(Math.max(0, total - prepaid))} />
              </dl>
            )}
          </div>

          <dl className="grid gap-2 border-t border-border pt-4 text-sm">
            <Row label="Заказчик" value={name.trim() || undefined} />
            <Row label="Телефон" value={phone.replace(/\D/g, "").length === 12 || (b && phone === phone0) ? phone : undefined} />
            <Row label="Зал" value={hallDef.name} />
            <Row label="Дата" value={date ? formatDay(date, true) : undefined} />
            <Row label={table ? "Час" : "Период"} value={period ? (morning ? `Утро${pickedWindow ? `, ${pickedWindow.label}` : ""}` : table ? period.label : `${period.label}, ${period.sub}`) : undefined} />
            {!table && <Row label="Торжество" value={eventType || undefined} />}
            <Row label="Количество гостей" value={n > 0 ? String(n) : undefined} />
          </dl>

          {!table && (
            <ul className="grid gap-2 border-t border-border pt-4 text-sm">
              <li className="flex justify-between gap-3">
                <span className="min-w-0">
                  {hallDef.name}
                  <span className="block text-xs text-muted-foreground">{n > 0 ? `${n} × ${formatSum(hallDef.pricePerGuest ?? 0)}` : `${formatSum(hallDef.pricePerGuest ?? 0)} за гостя`}</span>
                </span>
                <span className="shrink-0 tabular-nums">{n > 0 ? formatSum(hallSum) : "—"}</span>
              </li>
              {chosen.map(({ category, option }) => {
                const cost = optionCost(option.price, n);
                return (
                  <li key={option.id} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {option.title}
                      <span className="block text-xs text-muted-foreground">{category.title}</span>
                    </span>
                    <span className={cn("shrink-0 tabular-nums", !cost && "text-muted-foreground")}>{cost ? `+${formatSum(cost)}` : "входит"}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {missing.length > 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-4 py-3">
              <p className="text-sm font-medium text-rose-900">Осталось заполнить!</p>
              <ul className="mt-2 grid gap-1.5">{missing.map((m) => <li key={m} className="flex items-center gap-2 text-sm text-rose-900/90"><Circle className="size-3 shrink-0 text-rose-400" />{m}</li>)}</ul>
            </div>
          ) : b ? (
            dirty && <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900"><Circle className="size-3 shrink-0 fill-amber-400 text-amber-400" /> Есть несохранённые изменения</p>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900"><Check className="size-4 shrink-0" /> Всё заполнено, можно бронировать</p>
          )}

          <ErrorNote error={error} />

          <div className="grid gap-2">
            <button
              type="submit"
              disabled={busy || missing.length > 0 || (!!b && !dirty)}
              className="h-12 rounded-xl brand-action font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Сохраняем" : b ? "Сохранить" : "Забронировать"}
            </button>
            {b && (
              <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm text-ink transition-colors hover:bg-secondary">
                <Phone className="size-4 text-gold-dim" /> Позвонить клиенту
              </a>
            )}
            <ModalClose className="h-10 rounded-xl text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-ink">{b ? "Закрыть" : "Отмена"}</ModalClose>
            {b && (
              <button type="button" onClick={() => setCancelOpen(true)} className="h-10 rounded-xl text-sm text-rose-800 transition-colors hover:bg-rose-50">
                Отменить бронь
              </button>
            )}
          </div>
        </div>
      </aside>
      {/* the hovered service picture, large; in a portal because the modal is transformed and scrolls */}
      {peek?.option.media[0] &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[70] w-[360px] overflow-hidden rounded-xl bg-night shadow-2xl ring-1 ring-black/10 animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ top: peek.top, left: peek.left }}
          >
            <div className="relative h-[230px] w-full">
              <MediaView media={peek.option.media[0]} sizes="360px" />
            </div>
            <p className="truncate px-3 py-2 text-sm text-ivory">{peek.option.title}</p>
          </div>,
          document.body,
        )}
      <Lightbox
        title={box?.option.title ?? ""}
        description={box?.option.description ?? ""}
        includes={box?.option.includes}
        price={box ? priceLabel(box.option) : undefined}
        media={box?.option.media ?? []}
        index={box ? box.index : null}
        onIndex={(i) => setBox((b) => (b ? { ...b, index: i } : b))}
        onClose={() => setBox(null)}
      />
      {b && (
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Отменить бронь {b.code}?</AlertDialogTitle>
              <AlertDialogDescription>
                {b.name}, {formatDay(b.date)}. Время освободится на сайте. Предоплату, если она была, верните отдельно.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Не отменять</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-700 text-white hover:bg-rose-800"
                onClick={async () => {
                  if (!(await save({ status: "cancelled" }))) setCancelOpen(false);
                }}
              >
                Отменить бронь
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </form>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right", value ? "text-ink" : "text-muted-foreground/60")}>{value ?? "—"}</dd>
    </div>
  );
}

function priceShort(o: ProgramOption, guests: number) {
  if (o.price.type === "included") return "входит";
  if (o.price.type === "perGuest") return `+${formatSum(o.price.amount)} за гостя${guests ? `, ${formatSum(optionCost(o.price, guests))}` : ""}`;
  return `+${formatSum(o.price.amount)}`;
}

/** One option in a row: a thumbnail, the name and the price; the chosen one is gold. */
function OptionTile({
  option: o,
  guests,
  selected,
  onToggle,
  onPeek,
  onPeekEnd,
  onView,
}: {
  option: ProgramOption;
  guests: number;
  selected: boolean;
  onToggle: () => void;
  /** The pointer is over the picture: show it large. */
  onPeek: (option: ProgramOption, el: HTMLElement) => void;
  onPeekEnd: () => void;
  /** The picture was clicked: open every photo and video of the option. */
  onView: (option: ProgramOption) => void;
}) {
  const m = o.media[0];
  return (
    <div
      className={cn(
        "flex items-stretch gap-1 rounded-lg border p-1.5 transition-colors",
        selected ? "border-gold bg-gold/10" : "border-border bg-background hover:border-gold/60",
      )}
    >
      <button
        type="button"
        disabled={!m}
        onMouseEnter={(e) => onPeek(o, e.currentTarget)}
        onMouseLeave={onPeekEnd}
        onClick={() => {
          onPeekEnd();
          onView(o);
        }}
        aria-label={m ? `Смотреть фото: ${o.title}` : `Без фото: ${o.title}`}
        className={cn("relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-night", m && "cursor-zoom-in hover:ring-2 hover:ring-gold focus-visible:ring-2 focus-visible:ring-gold")}
      >
        {m && <MediaThumb media={m} sizes="64px" iconClassName="size-3" />}
      </button>
      <button type="button" aria-pressed={selected} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 rounded-md pr-1.5 pl-2 text-left">
        <span className="min-w-0 flex-1 leading-tight">
          <span className="line-clamp-2 text-[13px] text-ink">{o.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{priceShort(o, guests)}</span>
        </span>
        <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", selected ? "border-gold bg-gold text-night" : "border-border text-transparent")}>
          <Check className="size-3" />
        </span>
      </button>
    </div>
  );
}
