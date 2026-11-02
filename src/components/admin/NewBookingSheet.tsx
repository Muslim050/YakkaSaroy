"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Circle, Moon, Plus, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_TYPES, HALLS, MORNING_CAPACITY, MORNING_WINDOWS, RESTAURANT_HOURS, SLOTS, morningWindow, type BanquetHallId, type HallId, type SlotId } from "@/lib/data";
import { formatDay, formatSum, hallCost, maskPhone } from "@/lib/bookings";
import { formatDate, fromISO, monthKeyOf, useMonthAvailability, useToday, invalidateAvailability } from "@/lib/availability";
import {
  defaultSelection,
  forEventType,
  offered,
  optionCost,
  programCost,
  selectedOptions,
  type Catalog,
  type ProgramCategory,
  type ProgramOption,
  type ProgramSelection,
} from "@/lib/program";
import { AvailabilityCalendar, CalendarLegend } from "@/components/AvailabilityCalendar";
import { MediaThumb } from "@/components/program/MediaView";
import { Modal, ModalClose, ModalContent, ModalDescription, ModalTitle } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ErrorNote } from "./fields";

export type NewBookingPreset = { hall?: HallId; date?: string; slot?: string };

const HALL_ITEMS = Object.fromEntries(HALLS.map((h) => [h.id, h.name]));
const MORNING_EVENT = "Утренний плов";

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

function Body({ preset, catalog, onDone }: { preset: NewBookingPreset; catalog: Catalog; onDone: () => void }) {
  const router = useRouter();
  const today = useToday();
  const [hall, setHall] = useState<HallId>(preset.hall ?? "grand");
  const [monthOverride, setMonth] = useState<Date | null>(preset.date ? fromISO(preset.date) : null);
  const [date, setDate] = useState(preset.date ?? "");
  const [slot, setSlot] = useState(preset.slot ?? (preset.hall === "restaurant" ? "" : "evening"));
  const [startTime, setStartTime] = useState("");
  const [guests, setGuests] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [eventType, setEventType] = useState<string>(preset.slot === "day" ? MORNING_EVENT : EVENT_TYPES[0]);
  const [sel, setSel] = useState<ProgramSelection>(() => defaultSelection(catalog));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const month = monthOverride ?? (today ? fromISO(today) : new Date(2026, 0, 1));
  const days = useMonthAvailability(today ? monthKeyOf(month) : "");
  const dateDays = useMonthAvailability(date ? monthKeyOf(fromISO(date)) : "");
  const entry = date ? dateDays?.[date] : undefined;
  const hallDef = HALLS.find((h) => h.id === hall)!;
  const table = hall === "restaurant";
  const eventTypes = EVENT_TYPES.filter((type) => slot === "day" ? type === MORNING_EVENT : type !== MORNING_EVENT);
  const eventItems = Object.fromEntries(eventTypes.map((type) => [type, type]));
  const n = Number(guests) || 0;
  const hallSum = hallCost({ hall, guests: n }) ?? 0;

  // Every category offers only what fits the occasion. A choice that no longer fits is
  // dropped; a required category then falls back to its included option.
  const onOffer = Object.fromEntries(catalog.map((c) => [c.id, forEventType(offered(c), eventType)])) as Record<string, ProgramOption[]>;
  const selection: ProgramSelection = {};
  for (const c of catalog) {
    const allowed = onOffer[c.id];
    let ids = (sel[c.id] ?? []).filter((id) => allowed.some((o) => o.id === id));
    if (c.required && !ids.length) {
      const fallback = allowed.find((o) => o.price.type === "included") ?? allowed[0];
      ids = fallback ? [fallback.id] : [];
    }
    selection[c.id] = ids;
  }
  // The menu is picked from a list; the other categories are tiles below.
  const menuCategory = catalog.find((c) => c.id === "menu");
  const menus = menuCategory ? onOffer.menu : [];
  const menuItems = Object.fromEntries(menus.map((o) => [o.id, o.title]));
  const menuId = selection.menu?.[0] ?? null;
  const programSum = table ? 0 : programCost(catalog, selection, n);
  const chosen = table ? [] : selectedOptions(catalog, selection);
  const sections = catalog
    .filter((c) => c.id !== "menu")
    .map((c) => ({ category: c, options: onOffer[c.id] }))
    .filter((s) => s.options.length > 0);

  /** The periods of the chosen day in this hall: the hours of the restaurant, or the day and the evening of a hall. */
  const periods: { id: string; label: string; sub: string; free: boolean }[] = table
    ? RESTAURANT_HOURS.map((h) => {
        const free = entry?.restaurant[h] ?? 0;
        return { id: h, label: h, sub: free > 0 ? `свободно ${free}` : "занято", free: free > 0 };
      })
    : SLOTS.map((s) => {
        const free = entry?.[hall as BanquetHallId][s.id as SlotId] === "free";
        const open = s.id === "day" ? MORNING_CAPACITY - (entry?.morning?.[hall as BanquetHallId]?.length ?? 0) : 1;
        const sub = !entry ? "проверяем…" : !free ? "занято" : s.id === "day" ? `${s.time}, свободно ${open} из ${MORNING_CAPACITY}` : s.time;
        return { id: s.id, label: s.id === "day" ? "Утром" : "Вечером", sub, free };
      });

  const picked = periods.some((p) => p.id === slot && p.free) ? slot : "";
  const period = periods.find((p) => p.id === picked);
  /** Morning windows already taken in this hall; each is booked once. */
  const takenTimes = entry?.morning?.[hall as BanquetHallId] ?? [];
  const morning = !table && picked === "day";
  const pickedWindow = morning && !takenTimes.includes(startTime) ? morningWindow(startTime) : undefined;

  /** What the receipt still waits for; the button opens once the list is empty. */
  const missing = [
    !date && "Выбрать день в календаре",
    date && !picked && (table ? "Выбрать час" : entry ? "Выберите свободное время" : "Проверяем доступность"),
    morning && !pickedWindow && "Выбрать утреннее окно",
    name.trim().length < 2 && "Имя заказчика",
    phone.replace(/\D/g, "").length < 12 && "Телефон заказчика, девять цифр",
    n < 1 && "Сколько гостей",
    table && n > hallDef.guestsMax && `За столик садятся до ${hallDef.guestsMax} человек`,
  ].filter((x): x is string => typeof x === "string" && x.length > 0);

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
    if (table) setSlot("");
    setError("");
  }

  function pickPeriod(id: string) {
    setSlot(id);
    if (!table) setEventType(id === "day" ? MORNING_EVENT : EVENT_TYPES[0]);
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
    const f = new FormData(e.currentTarget);
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
      comment: f.get("comment"),
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

  const field = "grid min-w-0 gap-1.5 text-sm text-ink/80";

  return (
    <form onSubmit={submit} className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
      {/* everything that is chosen */}
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="pr-8 lg:pr-0">
          <ModalTitle className="font-display text-3xl font-normal leading-none text-night">Новая бронь</ModalTitle>
          <ModalDescription className="mt-2">Для заявок по телефону. Бронь появится как новая заявка, дальше статус меняется в её карточке.</ModalDescription>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <AvailabilityCalendar size="lg" tone="light" hall={hall} days={days} today={today} month={month} onMonthChange={setMonth} selected={date} onSelect={pickDay} className={cn("sm:[--cell-size:--spacing(11)]", !days && "opacity-60")} />
            <CalendarLegend hall={hall} tone="light" className="mt-4" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <p className="text-sm text-gold-dim">{hallDef.name}</p>
            <p className="mt-1 font-display text-3xl text-night">{date ? formatDate(date) : "Выберите день в календаре"}</p>
            {date && (
              <div role="group" aria-label={table ? "Час" : "Период"} className={cn("mt-3 gap-2", table ? "scroll-x flex overflow-x-auto pb-1" : "grid grid-cols-2")}>
                {periods.map((p) => {
                  const Icon = p.id === "day" ? Sun : Moon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!p.free}
                      aria-pressed={picked === p.id}
                      onClick={() => pickPeriod(p.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                        picked === p.id ? "border-gold bg-gold/15" : p.free ? "border-border hover:border-gold" : "cursor-not-allowed border-border/60 text-muted-foreground/60",
                      )}
                    >
                      {!table && <Icon className="size-4 shrink-0 text-gold-dim" />}
                      <span className="min-w-0 leading-tight">
                        <span className="block text-sm font-medium">{p.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{p.sub}</span>
                      </span>
                      {!table && p.id === "day" && p.free && <Plus className="ml-auto size-4 shrink-0 text-gold-dim" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* the morning is three one-hour windows; a taken one stays visible but cannot be picked */}
            {morning && (
              <div role="group" aria-label="Утреннее окно" className="mt-2 grid grid-cols-3 gap-2">
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

            <div className="mt-5 grid gap-4">
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

              <div className="grid gap-4 sm:grid-cols-2">
              <label className={field}>
                Зал
                <Select items={HALL_ITEMS} value={hall} onValueChange={(v) => v && pickHall(v as HallId)}>
                  <SelectTrigger className="h-10! w-full min-w-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{HALLS.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                </Select>
              </label>
                {!table && (
                  <label className={field}>
                    Повод
                    <Select items={eventItems} value={eventType} onValueChange={(v) => v && setEventType(String(v))}>
                      <SelectTrigger className="h-10! w-full min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {eventTypes.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={field}>
                  Гостей
                  <Input
                    name="guests"
                    type="number"
                    required
                    min={1}
                    max={table ? hallDef.guestsMax : undefined}
                    inputMode="numeric"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    placeholder={table ? "2" : `обычно ${hallDef.seats}`}
                    className="h-10"
                  />
                </label>
                {!table && menuCategory && (
                  <label className={field}>
                    Меню
                    <Select items={menuItems} value={menuId} onValueChange={(v) => v && setSel((s) => ({ ...s, menu: [String(v)] }))}>
                      <SelectTrigger className="h-10! w-full min-w-0"><SelectValue placeholder="Выберите меню" /></SelectTrigger>
                      {/* wider than the field, so a price with its total fits on its own lines */}
                      <SelectContent className="w-max min-w-(--anchor-width) max-w-[calc(100vw-2rem)]">
                        {menus.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            <span className="flex flex-col gap-0.5">
                              <span>{o.title}</span>
                              <span className="text-xs text-muted-foreground">{priceLine(o)}</span>
                              {n > 0 && optionCost(o.price, n) > 0 && <span className="text-xs text-muted-foreground">за {n} гостей: +{formatSum(optionCost(o.price, n))}</span>}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}
              </div>
              <label className={field}>
                Пожелания
                <Textarea name="comment" rows={2} placeholder="Живая музыка, детский стол, аллергии" />
              </label>
            </div>
          </div>
        </div>

        {/* the rest of the program: decor, show, cake and photo */}
        {!table && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-2xl text-night">Услуги</h3>
              <p className="text-sm text-muted-foreground">Выбор можно поменять потом в карточке брони.</p>
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
                      <OptionTile key={o.id} option={o} guests={n} selected={(selection[c.id] ?? []).includes(o.id)} onToggle={() => toggle(c, o.id)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* the receipt */}
      <aside className="border-t border-border bg-card/70 lg:border-t-0 lg:border-l">
        <div className="grid gap-5 p-5 sm:p-6 lg:sticky lg:top-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Итог брони</p>

          <div>
            <p className="text-sm text-muted-foreground">{table ? "Столик" : "Расчётная стоимость"}</p>
            <p className="mt-1 font-display text-3xl leading-none text-night tabular-nums">{table ? "по счёту" : n > 0 ? formatSum(hallSum + programSum) : "—"}</p>
          </div>

          <dl className="grid gap-2 border-t border-border pt-4 text-sm">
            <Row label="Заказчик" value={name.trim() || undefined} />
            <Row label="Телефон" value={phone.replace(/\D/g, "").length === 12 ? phone : undefined} />
            <Row label="Зал" value={hallDef.name} />
            <Row label="Дата" value={date ? formatDay(date, true) : undefined} />
            <Row label={table ? "Час" : "Период"} value={period ? (morning ? `Утром${pickedWindow ? `, ${pickedWindow.label}` : ""}` : table ? period.label : `${period.label}, ${period.sub}`) : undefined} />
            {!table && <Row label="Повод" value={eventType} />}
            <Row label="Гостей" value={n > 0 ? String(n) : undefined} />
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
              <p className="text-sm font-medium text-rose-900">Осталось заполнить</p>
              <ul className="mt-2 grid gap-1.5">{missing.map((m) => <li key={m} className="flex items-center gap-2 text-sm text-rose-900/90"><Circle className="size-3 shrink-0 text-rose-400" />{m}</li>)}</ul>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900"><Check className="size-4 shrink-0" /> Всё заполнено, можно бронировать</p>
          )}

          <ErrorNote error={error} />

          <div className="grid gap-2">
            <button
              type="submit"
              disabled={busy || missing.length > 0}
              className="h-12 rounded-xl brand-action font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Сохраняем" : "Забронировать"}
            </button>
            <ModalClose className="h-10 rounded-xl text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-ink">Отмена</ModalClose>
          </div>
        </div>
      </aside>
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

/** The price as the catalog states it, without the total for the current guests. */
function priceLine(o: ProgramOption) {
  if (o.price.type === "included") return "входит в стоимость зала";
  if (o.price.type === "perGuest") return `+${formatSum(o.price.amount)} за гостя`;
  return `+${formatSum(o.price.amount)}`;
}

function priceShort(o: ProgramOption, guests: number) {
  if (o.price.type === "included") return "входит";
  if (o.price.type === "perGuest") return `+${formatSum(o.price.amount)} за гостя${guests ? `, ${formatSum(optionCost(o.price, guests))}` : ""}`;
  return `+${formatSum(o.price.amount)}`;
}

/** One option in a row: a thumbnail, the name and the price; the chosen one is gold. */
function OptionTile({ option: o, guests, selected, onToggle }: { option: ProgramOption; guests: number; selected: boolean; onToggle: () => void }) {
  const m = o.media[0];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      title={o.description}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-1.5 pr-3 text-left transition-colors",
        selected ? "border-gold bg-gold/10" : "border-border bg-background hover:border-gold/60",
      )}
    >
      <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-night">{m && <MediaThumb media={m} sizes="64px" iconClassName="size-3" />}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="line-clamp-2 text-[13px] text-ink">{o.title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{priceShort(o, guests)}</span>
      </span>
      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", selected ? "border-gold bg-gold text-night" : "border-border text-transparent")}>
        <Check className="size-3" />
      </span>
    </button>
  );
}
