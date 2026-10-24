"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Phone } from "lucide-react";
import { EVENT_TYPES, HALLS } from "@/lib/data";
import { estimateTotal, formatDateTime, formatDay, formatSum, hallName, slotLabel, type Booking, type BookingStatus } from "@/lib/bookings";
import type { Catalog } from "@/lib/program";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ProgramSummary } from "@/components/program/ProgramSummary";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { useToday } from "@/lib/availability";
import { api, ErrorNote, Field, Section } from "./fields";

/** Right-hand panel with everything about one booking; edits go straight to the API. */
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
    <Sheet open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {booking && <Body key={`${booking.id}-${booking.updatedAt}`} booking={booking} catalog={catalog} onSaved={onSaved} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ booking: b, catalog, onSaved }: { booking: Booking; catalog: Catalog; onSaved?: (b: Booking) => void }) {
  const router = useRouter();
  const today = useToday() || "0000-00-00";
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
    managerNote: b.managerNote ?? "",
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

  const changes = () => {
    const p: Record<string, unknown> = {};
    if (form.name !== b.name) p.name = form.name;
    if (form.phone !== b.phone) p.phone = form.phone;
    if (Number(form.guests) !== b.guests) p.guests = Number(form.guests);
    if (form.eventType && form.eventType !== (b.eventType ?? "")) p.eventType = form.eventType;
    if (form.comment !== (b.comment ?? "")) p.comment = form.comment;
    if (prepayment !== (b.prepayment ?? 0)) p.prepayment = prepayment;
    if (form.tastingAt !== (b.tastingAt ?? "")) p.tastingAt = form.tastingAt;
    if (form.managerNote !== (b.managerNote ?? "")) p.managerNote = form.managerNote;
    return p;
  };
  const dirty = Object.keys(changes()).length > 0;

  async function save(extra: Record<string, unknown> = {}) {
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

  const next: { status: BookingStatus; label: string; needsPrepayment?: boolean } | null =
    b.status === "new"
      ? { status: "confirmed", label: "Придержать дату" }
      : b.status === "confirmed" && !isTable
        ? { status: "prepaid", label: "Отметить предоплату", needsPrepayment: true }
        : (b.status === "prepaid" || (isTable && b.status === "confirmed")) && b.date <= today
          ? { status: "done", label: "Отметить проведённым" }
          : b.status === "cancelled"
            ? { status: "new", label: "Восстановить бронь" }
            : null;

  return (
    <>
      <SheetHeader className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3 pr-8">
          <SheetTitle className="font-display text-2xl font-normal text-night">Бронь {b.code}</SheetTitle>
          <StatusBadge status={b.status} />
        </div>
        <SheetDescription className="text-ink/80">
          {hallName(b.hall)}, {formatDay(b.date, true)}, {slotLabel(b.hall, b.slot)}
        </SheetDescription>
      </SheetHeader>

      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Section title="Клиент">
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

        <Section title={isTable ? "Столик" : "Торжество"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="bs-guests" label={`Гостей, до ${max}`}>
              <Input id="bs-guests" type="number" min={1} max={max} value={form.guests} onChange={set("guests")} />
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
          <Section title="Программа торжества">
            <ProgramSummary catalog={catalog} extras={b.extras} href={`/admin/bookings/${b.id}/program`} cta="Открыть программу с фото и видео" />
          </Section>
        )}

        {!isTable && (
          <Section title="Оплата и дегустация">
            <dl className="grid grid-cols-2 gap-4 rounded-lg bg-secondary/60 p-4 text-sm">
              <div>
                <dt className="text-muted-foreground">По программе</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{total ? formatSum(total) : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Остаток</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{total ? formatSum(Math.max(0, total - prepayment)) : "—"}</dd>
              </div>
            </dl>
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

        <Section title="Заметка для команды">
          <Textarea aria-label="Заметка для команды" rows={3} value={form.managerNote} onChange={set("managerNote")} placeholder="Клиент её не видит" />
        </Section>

        <Section title="История" className="border-b-0">
          <ul className="grid gap-2 text-sm">
            {[...b.history].reverse().map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-28 shrink-0 text-muted-foreground tabular-nums">{formatDateTime(h.at)}</span>
                <span className="text-ink">
                  {h.text}
                  <span className="text-muted-foreground"> · {h.by === "admin" ? "менеджер" : h.by === "client" ? "клиент" : "система"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="sticky bottom-0 mt-auto grid gap-3 border-t border-border bg-popover px-6 py-4">
          <ErrorNote error={error} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy || !dirty} className="h-10 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50">
              {saved && !dirty ? "Сохранено" : "Сохранить"}
            </button>
            {next && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (next.needsPrepayment && !prepayment) return setError("Сначала укажите сумму предоплаты");
                  void save({ status: next.status });
                }}
                className="h-10 rounded-lg bg-night px-4 text-sm font-medium text-ivory transition-colors hover:bg-night-3 disabled:opacity-60"
              >
                {next.label}
              </button>
            )}
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
