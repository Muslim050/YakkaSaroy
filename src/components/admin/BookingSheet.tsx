"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Armchair, CalendarDays, Clock, Flag, History, Phone, Sparkles, StickyNote, UserRound, Users, Wallet } from "lucide-react";
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
import { api, ErrorNote, Field, Section } from "./fields";

const STATUS_DOT: Record<BookingStatus, string> = { new: "bg-amber-500", confirmed: "bg-sky-500", prepaid: "bg-emerald-600", done: "bg-stone-400", cancelled: "bg-rose-500" };
const STATUS_HINT: Record<BookingStatus, string> = {
  new: "Заявка ждёт звонка менеджера.",
  confirmed: "Дата придержана за клиентом, до предоплаты её могут занять другие.",
  prepaid: "Предоплата получена, дата закреплена.",
  done: "Торжество прошло.",
  cancelled: "Бронь отменена.",
};

/** One fact in the booking's header: an icon, a label and the value. */
function Fact({ icon: Icon, label, value }: { icon: typeof Armchair; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-gold-dim">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium text-ink">{value}</dd>
      </span>
    </div>
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
      <ModalContent className="w-full gap-0 p-0 sm:max-w-3xl">
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
    prepayment: b.prepayment ? String(b.prepayment) : "",
    tastingAt: b.tastingAt ?? "",
    startTime: b.startTime ?? "",
    managerNote: b.managerNote ?? "",
    status: b.status,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };
  const total = estimateTotal({ hall: b.hall, guests: Number(form.guests) || 0, extras: b.extras }, catalog);
  const prepayment = Number(form.prepayment) || 0;
  const paidPct = total ? Math.min(100, Math.round((prepayment / total) * 100)) : null;

  const changes = () => {
    const p: Record<string, unknown> = {};
    if (form.name !== b.name) p.name = form.name;
    if (form.phone !== b.phone) p.phone = form.phone;
    if (Number(form.guests) !== b.guests) p.guests = Number(form.guests);
    if (form.eventType && form.eventType !== (b.eventType ?? "")) p.eventType = form.eventType;
    if (form.comment !== (b.comment ?? "")) p.comment = form.comment;
    if (prepayment !== (b.prepayment ?? 0)) p.prepayment = prepayment;
    if (form.tastingAt !== (b.tastingAt ?? "")) p.tastingAt = form.tastingAt;
    if (form.startTime !== (b.startTime ?? "")) p.startTime = form.startTime;
    if (form.managerNote !== (b.managerNote ?? "")) p.managerNote = form.managerNote;
    if (form.status !== b.status) p.status = form.status;
    return p;
  };
  const dirty = Object.keys(changes()).length > 0;

  async function save(extra: Record<string, unknown> = {}) {
    if (changes().status === "prepaid" && !prepayment) return setError("Для статуса «Предоплата внесена» укажите сумму предоплаты"), false;
    setBusy(true);
    setError("");
    const r = await api(`/api/admin/bookings/${b.id}`, "PATCH", { ...changes(), ...extra });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
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
        <Section title="Статус" icon={Flag}>
          {b.status === "cancelled" ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusBadge status="cancelled" />
              <span className="text-muted-foreground">Время свободно для других. Бронь можно вернуть, если его ещё не заняли.</span>
              <button type="button" disabled={busy} onClick={() => void save({ status: "new" })} className="h-9 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50">
                Восстановить бронь
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[16rem_1fr] sm:items-end">
              <Field label="Стадия брони">
                <Select items={statusItems} value={form.status} onValueChange={(v) => v && setForm((f) => ({ ...f, status: v as BookingStatus }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
              </Field>
              <p className="text-xs text-muted-foreground">{STATUS_HINT[form.status]}</p>
            </div>
          )}
        </Section>

        <Section title="Клиент" icon={UserRound}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="bs-name" label="Имя">
              <Input id="bs-name" value={form.name} onChange={set("name")} />
            </Field>
            <Field id="bs-phone" label="Телефон">
              <div className="flex gap-2">
                <Input id="bs-phone" type="tel" value={form.phone} onChange={set("phone")} />
                <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} aria-label="Позвонить" className="grid size-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-secondary">
                  <Phone className="size-4" />
                </a>
              </div>
            </Field>
          </div>
        </Section>

        <Section title={isTable ? "Столик" : "Торжество"} icon={Sparkles}>
          <div className="grid gap-4 sm:grid-cols-2">
            {b.slot === "day" && (
              <Field label="Утреннее окно" hint="Утром в зале три окна по часу, в каждом одно торжество">
                <div role="group" aria-label="Утреннее окно" className="flex flex-wrap gap-1.5">
                  {MORNING_WINDOWS.map((w) => {
                    const on = form.startTime === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => { setForm((f) => ({ ...f, startTime: w.id })); setSaved(false); }}
                        className={cn("h-8 rounded-lg border px-2.5 text-sm tabular-nums transition-colors", on ? "border-gold bg-gold/15 text-night" : "border-border hover:border-gold")}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}
            <Field id="bs-guests" label="Гостей" hint={isTable ? `За столик до ${max}` : `Зал рассчитан на ${HALLS.find((h) => h.id === b.hall)?.seats}`}>
              <Input id="bs-guests" type="number" min={1} max={isTable ? max : undefined} value={form.guests} onChange={set("guests")} />
            </Field>
            {!isTable && (
              <Field label="Повод">
                <Select value={form.eventType || null} onValueChange={(v) => { setForm((f) => ({ ...f, eventType: String(v ?? "") })); setSaved(false); }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Не указан" /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <Field id="bs-comment" label="Пожелания клиента">
            <Textarea id="bs-comment" rows={3} value={form.comment} onChange={set("comment")} />
          </Field>
        </Section>

        {!isTable && (
          <Section title="Программа торжества" icon={Sparkles}>
            <ProgramSummary catalog={catalog} extras={b.extras} href={`/admin/bookings/${b.id}/program`} cta="Открыть программу с фото и видео" />
          </Section>
        )}

        {!isTable && (
          <Section title="Оплата и дегустация" icon={Wallet}>
            <div className="rounded-xl border border-border bg-card p-4">
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">По программе</dt>
                  <dd className="mt-1 font-display text-xl leading-none text-night tabular-nums">{total ? formatSum(total) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Внесено</dt>
                  <dd className="mt-1 font-display text-xl leading-none text-emerald-800 tabular-nums">{prepayment ? formatSum(prepayment) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Остаток</dt>
                  <dd className="mt-1 font-display text-xl leading-none text-night tabular-nums">{total ? formatSum(Math.max(0, total - prepayment)) : "—"}</dd>
                </div>
              </dl>
              {paidPct !== null && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`Оплачено ${paidPct}%`}>
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${paidPct}%` }} />
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="bs-prepay" label="Предоплата, сум" hint={total ? `30% это ${formatSum(Math.round((total * 0.3) / 1_000_000) * 1_000_000)}` : undefined}>
                <Input id="bs-prepay" type="number" min={0} step={100000} inputMode="numeric" value={form.prepayment} onChange={set("prepayment")} />
              </Field>
              <Field id="bs-tasting" label="Дегустация">
                <Input id="bs-tasting" type="datetime-local" value={form.tastingAt} onChange={set("tastingAt")} />
              </Field>
            </div>
          </Section>
        )}

        <Section title="Заметка для команды" icon={StickyNote}>
          <Textarea aria-label="Заметка для команды" rows={3} value={form.managerNote} onChange={set("managerNote")} placeholder="Клиент её не видит" />
        </Section>

        <Section title="История" icon={History} className="border-b-0">
          <ol className="relative ml-1.5 grid gap-3 border-l border-border pl-5 text-sm">
            {[...b.history].reverse().map((h, i) => (
              <li key={i} className="relative">
                <span className={cn("absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-popover", i === 0 ? "bg-gold" : "bg-border")} />
                <span className="block text-ink">{h.text}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(h.at)} · {h.by === "admin" ? "менеджер" : h.by === "client" ? "клиент" : "система"}
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <div className="sticky bottom-0 mt-auto grid gap-3 border-t border-border bg-popover px-6 py-4">
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
