"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { ru } from "react-day-picker/locale";
import { EVENT_TYPES, HALLS, RESTAURANT_HOURS, SLOTS, type HallId, type SlotId } from "@/lib/data";
import { formatDay, STATUS, type BookingStatus } from "@/lib/bookings";
import { fromISO, monthKeyOf, toISO, useMonthAvailability, useToday, invalidateAvailability } from "@/lib/availability";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ErrorNote, Field, Section } from "./fields";

export type NewBookingPreset = { hall?: HallId; date?: string; slot?: string };

const HALL_ITEMS = Object.fromEntries(HALLS.map((h) => [h.id, h.name]));
const STATUS_ITEMS = Object.fromEntries((["new", "confirmed", "prepaid"] as BookingStatus[]).map((s) => [s, STATUS[s].label]));

/** A booking taken over the phone. Only free times can be chosen. */
export function NewBookingSheet({ preset, onClose }: { preset: NewBookingPreset | null; onClose: () => void }) {
  return (
    <Sheet open={!!preset} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {preset && <Body key={JSON.stringify(preset)} preset={preset} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ preset, onDone }: { preset: NewBookingPreset; onDone: () => void }) {
  const router = useRouter();
  const today = useToday() || "2026-01-01";
  const [hall, setHall] = useState<HallId>(preset.hall ?? "grand");
  const [date, setDate] = useState(preset.date ?? "");
  const [slot, setSlot] = useState(preset.slot ?? "");
  const [month, setMonth] = useState<Date>(fromISO(preset.date ?? today));
  const [dateOpen, setDateOpen] = useState(false);
  const [status, setStatus] = useState<BookingStatus>("confirmed");
  const [eventType, setEventType] = useState<string>(hall === "restaurant" ? "" : EVENT_TYPES[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const days = useMonthAvailability(monthKeyOf(date ? fromISO(date) : month));
  const entry = date ? days?.[date] : undefined;
  const max = HALLS.find((h) => h.id === hall)?.guestsMax ?? 0;

  const slots =
    hall === "restaurant"
      ? RESTAURANT_HOURS.map((h) => ({ id: h, label: h, free: (entry?.restaurant[h] ?? 0) > 0, note: entry ? `${entry.restaurant[h]} свободно` : "" }))
      : SLOTS.map((s) => {
          const free = entry ? entry[hall as Exclude<HallId, "restaurant">][s.id as SlotId] === "free" : false;
          return { id: s.id, label: `${s.name}, ${s.time}`, free, note: free ? "" : "занято" };
        });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!date) return setError("Выберите дату");
    if (!slot) return setError("Выберите время");
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const r = await api("/api/admin/bookings", "POST", {
      hall,
      date,
      slot,
      status,
      eventType: hall === "restaurant" ? undefined : eventType,
      guests: Number(f.get("guests")),
      name: f.get("name"),
      phone: f.get("phone"),
      comment: f.get("comment"),
      managerNote: f.get("managerNote"),
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

  return (
    <>
      <SheetHeader className="border-b border-border px-6 py-5">
        <SheetTitle className="font-display text-2xl font-normal text-night">Новая бронь</SheetTitle>
        <SheetDescription>Для заявок по телефону. Номер брони клиент получит от вас, с ним он войдёт в кабинет.</SheetDescription>
      </SheetHeader>

      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Section title="Зал и время">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Зал">
              <Select
                items={HALL_ITEMS}
                value={hall}
                onValueChange={(v) => {
                  if (!v) return;
                  setHall(v as HallId);
                  setSlot("");
                  if (v === "restaurant") setEventType("");
                  else if (!eventType) setEventType(EVENT_TYPES[0]);
                }}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HALLS.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Дата">
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger className="flex h-8 w-full items-center gap-2 rounded-lg border border-input px-2.5 text-left text-sm hover:bg-secondary/60">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  {date ? formatDay(date, true) : <span className="text-muted-foreground">Выберите день</span>}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <Calendar
                    mode="single"
                    locale={ru}
                    weekStartsOn={1}
                    month={month}
                    onMonthChange={setMonth}
                    selected={date ? fromISO(date) : undefined}
                    disabled={{ before: fromISO(today) }}
                    onSelect={(d) => {
                      if (!d) return;
                      setDate(toISO(d));
                      setSlot("");
                      setDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </Field>
          </div>
          {date && (
            <div className={hall === "restaurant" ? "grid grid-cols-4 gap-2" : "grid gap-2 sm:grid-cols-2"}>
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={!s.free}
                  onClick={() => setSlot(s.id)}
                  aria-pressed={slot === s.id}
                  className={
                    slot === s.id
                      ? "rounded-lg border border-night bg-night px-3 py-2 text-left text-sm text-ivory"
                      : "rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-night/40 disabled:cursor-not-allowed disabled:opacity-40"
                  }
                >
                  <span className="block font-medium">{s.label}</span>
                  {s.note && <span className="block text-xs opacity-70">{s.note}</span>}
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title="Клиент">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="nb-name" label="Имя">
              <Input id="nb-name" name="name" required autoComplete="off" />
            </Field>
            <Field id="nb-phone" label="Телефон">
              <Input id="nb-phone" name="phone" type="tel" required placeholder="+998" autoComplete="off" />
            </Field>
            <Field id="nb-guests" label={`Гостей, до ${max}`}>
              <Input id="nb-guests" name="guests" type="number" min={1} max={max} required />
            </Field>
            {hall !== "restaurant" && (
              <Field label="Повод">
                <Select value={eventType} onValueChange={(v) => v && setEventType(String(v))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <Field id="nb-comment" label="Пожелания клиента">
            <Textarea id="nb-comment" name="comment" rows={2} />
          </Field>
        </Section>

        <Section title="Статус и заметка" className="border-b-0">
          <Field label="Статус">
            <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => v && setStatus(v as BookingStatus)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["new", "confirmed", "prepaid"] as BookingStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="nb-note" label="Заметка для команды">
            <Textarea id="nb-note" name="managerNote" rows={2} placeholder="Клиент её не видит" />
          </Field>
        </Section>

        <div className="sticky bottom-0 mt-auto grid gap-3 border-t border-border bg-popover px-6 py-4">
          <ErrorNote error={error} />
          <button type="submit" disabled={busy} className="h-10 rounded-lg bg-night px-4 text-sm font-medium text-ivory transition-colors hover:bg-night-3 disabled:opacity-60">
            {busy ? "Сохраняем" : "Создать бронь"}
          </button>
        </div>
      </form>
    </>
  );
}
