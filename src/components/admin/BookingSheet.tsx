"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Armchair, Banknote, CalendarDays, CircleCheckBig, Clock, Flag, Hourglass, MessageSquareText, PartyPopper, Phone, Receipt, StickyNote, Sunrise, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_TYPES, HALLS, MORNING_WINDOWS } from "@/lib/data";
import { estimateTotal, formatDateTime, formatDay, formatSum, hallName, slotLabel, STATUS, type Booking, type BookingStatus } from "@/lib/bookings";
import type { Catalog } from "@/lib/program";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ProgramSummary } from "@/components/program/ProgramSummary";
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/ui/modal";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ErrorNote, notifyBookingSaved } from "./fields";
import { PaymentsModal } from "./PaymentsModal";

const STATUS_DOT: Record<BookingStatus, string> = { new: "bg-amber-500", confirmed: "bg-sky-500", prepaid: "bg-emerald-600", done: "bg-stone-400", cancelled: "bg-rose-500" };

const CHIP = "grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-gold-dim";
const TILE = "flex min-w-0 gap-2.5 rounded-xl border border-border bg-background px-3 py-2";
/** A field inside a tile has no frame of its own: the tile is the frame. */
const BARE = "h-6 rounded-none border-0 bg-transparent p-0 text-sm font-medium text-ink focus-visible:border-0 focus-visible:ring-0 md:text-sm";

/** One fact about the booking: an icon, a label and the value. */
function Fact({ icon: Icon, label, value, valueClassName }: { icon: typeof Armchair; label: string; value: string; valueClassName?: string }) {
  return (
    <div className={cn(TILE, "items-center")}>
      <span className={CHIP}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd className={cn("truncate text-sm font-medium text-ink tabular-nums", valueClassName)}>{value}</dd>
      </span>
    </div>
  );
}

/** The same tile, but the value is a field to edit. `chip` replaces the icon, `top` is for tall fields. */
function Tile({
  icon: Icon,
  label,
  htmlFor,
  hint,
  chip,
  top,
  className,
  children,
}: {
  icon: typeof Armchair;
  label: string;
  htmlFor?: string;
  hint?: string;
  chip?: React.ReactNode;
  top?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(TILE, "transition-shadow focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25", top ? "items-start" : "items-center", className)}>
      {chip ?? (
        <span className={CHIP}>
          <Icon className="size-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={htmlFor} className="shrink-0 text-[11px] text-muted-foreground">
            {label}
          </label>
          {hint && <span className="truncate text-[11px] text-muted-foreground/80">{hint}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** A few tiles under one small heading. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** The window with everything about one booking; edits go straight to the API. */
export function BookingSheet({
  booking,
  catalog,
  onClose,
  onSaved,
}: {
  booking: Booking | null;
  catalog: Catalog;
  onClose: () => void;
  onSaved?: (b: Booking) => void;
}) {
  return (
    <Modal open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <ModalContent className="w-full gap-0 bg-card p-0 sm:max-w-3xl">
        {booking && <Body key={`${booking.id}-${booking.updatedAt}`} booking={booking} catalog={catalog} onSaved={onSaved} />}
      </ModalContent>
    </Modal>
  );
}

function Body({ booking: b, catalog, onSaved }: { booking: Booking; catalog: Catalog; onSaved?: (b: Booking) => void }) {
  const router = useRouter();
  const isTable = b.hall === "restaurant";
  const max = HALLS.find((h) => h.id === b.hall)?.guestsMax ?? 0;

  const [form, setForm] = useState({
    name: b.name,
    phone: b.phone,
    guests: String(b.guests),
    eventType: b.eventType ?? "",
    comment: b.comment ?? "",
    startTime: b.startTime ?? "",
    managerNote: b.managerNote ?? "",
    status: b.status,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };
  const total = estimateTotal({ hall: b.hall, guests: Number(form.guests) || 0, extras: b.extras }, catalog);
  const prepayment = b.prepayment ?? 0;
  const paidPct = total ? Math.min(100, Math.round((prepayment / total) * 100)) : null;

  const changes = () => {
    const p: Record<string, unknown> = {};
    if (form.name !== b.name) p.name = form.name;
    if (form.phone !== b.phone) p.phone = form.phone;
    if (Number(form.guests) !== b.guests) p.guests = Number(form.guests);
    if (form.eventType && form.eventType !== (b.eventType ?? "")) p.eventType = form.eventType;
    if (form.comment !== (b.comment ?? "")) p.comment = form.comment;
    if (form.startTime !== (b.startTime ?? "")) p.startTime = form.startTime;
    if (form.managerNote !== (b.managerNote ?? "")) p.managerNote = form.managerNote;
    if (form.status !== b.status) p.status = form.status;
    return p;
  };
  const dirty = Object.keys(changes()).length > 0;

  async function save(extra: Record<string, unknown> = {}) {
    if (changes().status === "prepaid" && !prepayment) return setError("Для статуса «Предоплата внесена» сначала добавьте поступление"), false;
    setBusy(true);
    setError("");
    const patch = { ...changes(), ...extra };
    const r = await api(`/api/admin/bookings/${b.id}`, "PATCH", patch);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    notifyBookingSaved(b, patch);
    setSaved(true);
    onSaved?.(r.json.booking as Booking);
    router.refresh();
    return true;
  }

  /** The statuses a manager sets by hand; cancelling has its own button and its own confirmation. */
  const statuses: BookingStatus[] = isTable ? ["new", "confirmed", "done"] : ["new", "confirmed", "prepaid", "done"];
  const statusItems = Object.fromEntries(statuses.map((st) => [st, STATUS[st].label]));

  return (
    <>
      <ModalHeader className="gap-4 border-b border-border bg-card px-6 py-5">
        <div>
          <div className="flex flex-wrap items-center gap-3 pr-8">
            <ModalTitle className="font-display text-3xl font-normal leading-none text-night">Бронь {b.code}</ModalTitle>
            <StatusBadge status={b.status} />
          </div>
          <ModalDescription className="mt-2 text-ink/80">
            {b.name}
            {b.eventType ? `, ${b.eventType.toLowerCase()}` : ""}. Заявка {formatDateTime(b.createdAt)}
            {b.source === "site" ? " с сайта" : b.source === "admin" ? ", записал менеджер" : ""}.
          </ModalDescription>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact icon={Armchair} label="Зал" value={hallName(b.hall)} />
          <Fact icon={CalendarDays} label="Дата" value={formatDay(b.date, true)} />
          <Fact icon={Clock} label={isTable ? "Час" : "Время"} value={slotLabel(b.hall, b.slot, b.startTime)} />
          <Fact icon={Users} label="Гостей" value={String(b.guests)} />
        </dl>
      </ModalHeader>

      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-5 p-4 sm:p-5">
          <Group title="Клиент и статус">
            <div className="grid gap-2 sm:grid-cols-3">
              <Tile icon={Flag} label="Статус">
                {b.status === "cancelled" ? (
                  <div className="flex h-6 items-center justify-between gap-2">
                    <span className="text-sm font-medium text-rose-800">Отменена</span>
                    <button type="button" disabled={busy} onClick={() => void save({ status: "new" })} className="text-xs font-medium text-night underline underline-offset-2 disabled:opacity-50">
                      Восстановить
                    </button>
                  </div>
                ) : (
                  <Select items={statusItems} value={form.status} onValueChange={(v) => v && setForm((f) => ({ ...f, status: v as BookingStatus }))}>
                    <SelectTrigger aria-label="Статус" className={cn(BARE, "h-6! w-full")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map((st) => (
                        <SelectItem key={st} value={st}>
                          <span className="flex items-center gap-2">
                            <span className={cn("size-2 rounded-full", STATUS_DOT[st])} />
                            {STATUS[st].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Tile>
              <Tile icon={UserRound} label="Имя" htmlFor="bs-name">
                <Input id="bs-name" value={form.name} onChange={set("name")} className={BARE} />
              </Tile>
              <Tile
                icon={Phone}
                label="Телефон"
                htmlFor="bs-phone"
                chip={
                  <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} aria-label="Позвонить" title="Позвонить" className={cn(CHIP, "transition-colors hover:bg-gold/25 hover:text-night")}>
                    <Phone className="size-4" />
                  </a>
                }
              >
                <Input id="bs-phone" type="tel" value={form.phone} onChange={set("phone")} className={BARE} />
              </Tile>
            </div>
            {b.status === "cancelled" && <p className="text-xs text-muted-foreground">Время свободно для других. Бронь можно вернуть, если его ещё не заняли.</p>}
          </Group>

          <Group title={isTable ? "Столик" : "Торжество"}>
            <div className={cn("grid gap-2", !isTable && (b.slot === "day" ? "sm:grid-cols-3" : "sm:grid-cols-2"))}>
              <Tile icon={Users} label="Количество гостей" htmlFor="bs-guests" hint={isTable ? `до ${max}` : b.slot === "day" ? undefined : `зал на ${HALLS.find((h) => h.id === b.hall)?.seats}`}>
                <Input id="bs-guests" type="number" min={1} max={isTable ? max : undefined} value={form.guests} onChange={set("guests")} className={BARE} />
              </Tile>
              {!isTable && (
                <Tile icon={PartyPopper} label="Торжество">
                  <Select value={form.eventType || null} onValueChange={(v) => { setForm((f) => ({ ...f, eventType: String(v ?? "") })); setSaved(false); }}>
                    <SelectTrigger aria-label="Торжество" className={cn(BARE, "h-6! w-full")}><SelectValue placeholder="Не указано" /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Tile>
              )}
              {b.slot === "day" && (
                <Tile icon={Sunrise} label="Утреннее окно">
                  <div role="group" aria-label="Утреннее окно" className="mt-0.5 flex gap-1">
                    {MORNING_WINDOWS.map((w) => {
                      const on = form.startTime === w.id;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          aria-pressed={on}
                          aria-label={w.label}
                          onClick={() => { setForm((f) => ({ ...f, startTime: w.id })); setSaved(false); }}
                          className={cn("h-6 flex-1 rounded-md border text-xs tabular-nums transition-colors", on ? "border-gold bg-gold/20 font-medium text-night" : "border-border bg-card hover:border-gold")}
                        >
                          {w.short}
                        </button>
                      );
                    })}
                  </div>
                </Tile>
              )}
            </div>
            <Tile top icon={MessageSquareText} label="Пожелания клиента" htmlFor="bs-comment">
              <Textarea id="bs-comment" rows={2} value={form.comment} onChange={set("comment")} placeholder="Не указаны" className={cn(BARE, "h-auto min-h-10 py-0.5")} />
            </Tile>
          </Group>

          {!isTable && (
            <Group title="Программа торжества">
              <ProgramSummary catalog={catalog} extras={b.extras} href={`/admin/bookings/${b.id}/program`} cta="Открыть программу с фото и видео" />
            </Group>
          )}

          {!isTable && (
            <Group title="Оплата">
              <dl className="grid gap-2 sm:grid-cols-3">
                <Fact icon={Receipt} label="По программе" value={total ? formatSum(total) : "—"} />
                <Fact icon={CircleCheckBig} label={paidPct !== null && prepayment ? `Внесено, ${paidPct}%` : "Внесено"} value={prepayment ? formatSum(prepayment) : "—"} valueClassName="text-emerald-800" />
                <Fact icon={Hourglass} label="Остаток" value={total ? formatSum(Math.max(0, total - prepayment)) : "—"} />
              </dl>
              {paidPct !== null && (
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`Оплачено ${paidPct}%`}>
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${paidPct}%` }} />
                </div>
              )}
              <button type="button" disabled={dirty} onClick={() => setPaying(true)} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
                <Banknote className="size-4 text-gold-dim" /> Поступления
              </button>
              {dirty && <p className="text-xs text-muted-foreground">Сохраните изменения, чтобы внести поступление.</p>}
            </Group>
          )}

          <Group title="Заметка для команды">
            <Tile top icon={StickyNote} label="Клиент её не видит" htmlFor="bs-note">
              <Textarea id="bs-note" rows={2} value={form.managerNote} onChange={set("managerNote")} placeholder="Например, перезвонить после шести" className={cn(BARE, "h-auto min-h-10 py-0.5")} />
            </Tile>
          </Group>

          <Group title="История">
            <ol className="relative mt-1 ml-1.5 grid gap-3 border-l border-border pl-5 text-sm">
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
          </Group>
        </div>

        <div className="sticky bottom-0 mt-auto grid gap-3 border-t border-border bg-card px-6 py-4">
          <ErrorNote error={error} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy || !dirty} className="h-10 rounded-xl brand-action px-5 text-sm font-semibold disabled:opacity-50">
              {busy ? "Сохраняем" : saved && !dirty ? "Сохранено" : "Сохранить"}
            </button>
            {b.status !== "cancelled" && b.status !== "done" && (
              <button type="button" onClick={() => setCancelOpen(true)} className="ml-auto h-10 rounded-lg px-3 text-sm text-rose-800 hover:bg-rose-50">
                Отменить бронь
              </button>
            )}
          </div>
        </div>
      </form>

      <PaymentsModal booking={paying ? b : null} catalog={catalog} onClose={() => setPaying(false)} onSaved={onSaved} />

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
                if (await save({ status: "cancelled" })) setCancelOpen(false);
              }}
            >
              Отменить бронь
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
