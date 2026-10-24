"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTACTS, HALLS } from "@/lib/data";
import {
  clientCanEdit,
  estimateTotal,
  formatDateTime,
  formatDay,
  formatSum,
  hallName,
  slotLabel,
  type ClientBooking,
} from "@/lib/bookings";
import type { Catalog } from "@/lib/program";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ProgramSummary } from "@/components/program/ProgramSummary";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StepState = "done" | "current" | "todo";

function steps(b: ClientBooking, today: string) {
  const confirmed = b.status === "confirmed" || b.status === "prepaid" || b.status === "done";
  const prepaid = b.status === "prepaid" || b.status === "done";
  const tastingPast = !!b.tastingAt && b.tastingAt.slice(0, 10) < today;
  const list: { title: string; note?: string; state: StepState }[] = [
    { title: "Заявка отправлена", note: formatDateTime(b.createdAt), state: "done" },
    { title: "Менеджер придержал дату", state: confirmed ? "done" : "current" },
    {
      title: "Дегустация",
      note: b.tastingAt ? formatDateTime(b.tastingAt) : "назначим после звонка",
      state: tastingPast || prepaid ? "done" : b.tastingAt ? "current" : "todo",
    },
    { title: "Предоплата", note: b.prepayment ? formatSum(b.prepayment) : undefined, state: prepaid ? "done" : confirmed ? "current" : "todo" },
    { title: "Торжество", note: formatDay(b.date), state: b.status === "done" ? "done" : prepaid ? "current" : "todo" },
  ];
  // Only the first unfinished step is "current".
  let seen = false;
  return list.map((s) => {
    if (s.state === "current") {
      if (seen) return { ...s, state: "todo" as StepState };
      seen = true;
    }
    return s;
  });
}

export function BookingCard({ booking: b, catalog, today }: { booking: ClientBooking; catalog: Catalog; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isTable = b.hall === "restaurant";
  const total = estimateTotal(b, catalog);
  const editable = clientCanEdit(b) && b.date >= today;
  const max = HALLS.find((h) => h.id === b.hall)?.guestsMax ?? 0;

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/cabinet/bookings/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Не получилось сохранить");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <article className={cn("rounded-xl border border-border bg-card", b.status === "cancelled" && "opacity-70")}>
      <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {isTable ? "Столик в ресторане" : `${b.eventType ?? "Торжество"}, ${hallName(b.hall).toLowerCase()}`}
          </p>
          <h2 className="mt-1 font-display text-3xl leading-tight text-night sm:text-4xl">{formatDay(b.date, true)}</h2>
          <p className="mt-1 text-sm text-ink/80">{slotLabel(b.hall, b.slot)}</p>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <StatusBadge status={b.status} />
          <span className="text-xs text-muted-foreground">Бронь {b.code}</span>
        </div>
      </header>

      {!isTable && b.status !== "cancelled" && (
        <ol className="grid gap-x-4 gap-y-3 border-b border-border p-5 sm:grid-cols-5 sm:p-6">
          {steps(b, today).map((s, i) => (
            <li key={s.title} className="flex gap-3 sm:flex-col sm:gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium",
                  s.state === "done" && "bg-night text-ivory",
                  s.state === "current" && "bg-gold text-night ring-4 ring-gold/25",
                  s.state === "todo" && "border border-border text-muted-foreground",
                )}
              >
                {s.state === "done" ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span>
                <span className={cn("block text-sm", s.state === "todo" ? "text-muted-foreground" : "font-medium text-ink")}>{s.title}</span>
                {s.note && <span className="block text-xs text-muted-foreground">{s.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_1fr]">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <Fact label="Гостей" value={String(b.guests)} />
          {total !== null && <Fact label="По программе торжества" value={`≈ ${formatSum(total)}`} />}
          {total !== null && <Fact label="Предоплата" value={b.prepayment ? formatSum(b.prepayment) : "ещё нет"} />}
          {total !== null && <Fact label="Остаток в день торжества" value={`≈ ${formatSum(Math.max(0, total - (b.prepayment ?? 0)))}`} />}
        </dl>
        <div className="text-sm">
          <p className="text-muted-foreground">Пожелания</p>
          <p className="mt-1 whitespace-pre-line text-ink">{b.comment || "Пока нет. Добавьте, если что-то важно."}</p>
        </div>
      </div>

      {!isTable && b.status !== "cancelled" && (
        <section className="border-t border-border p-5 sm:p-6">
          <h3 className="text-sm text-muted-foreground">Программа торжества</h3>
          <ProgramSummary
            className="mt-3"
            catalog={catalog}
            extras={b.extras}
            href={`/cabinet/program/${b.id}`}
            cta={editable ? "Выбрать меню, оформление и шоу" : "Посмотреть программу"}
          />
        </section>
      )}

      <footer className="flex flex-col gap-3 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <details className="group text-sm">
          <summary className="cursor-pointer list-none text-muted-foreground hover:text-ink">
            История изменений <span className="inline-block transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-3 grid gap-1.5">
            {[...b.history].reverse().map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-28 shrink-0 text-muted-foreground">{formatDateTime(h.at)}</span>
                <span className="text-ink">{h.text}</span>
              </li>
            ))}
          </ul>
        </details>

        {editable ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirmCancel(true)} className="h-10 rounded-lg px-4 text-sm text-rose-800 transition-colors hover:bg-rose-50">
              Отменить заявку
            </button>
            <button type="button" onClick={() => setEditing(true)} className="h-10 rounded-lg bg-night px-4 text-sm font-medium text-ivory transition-colors hover:bg-night-3">
              Изменить гостей и пожелания
            </button>
          </div>
        ) : (
          b.status !== "cancelled" &&
          b.status !== "done" && (
            <a href={CONTACTS.phoneHref} className="flex items-center gap-2 text-sm text-ink hover:text-gold-dim">
              <Phone className="size-4" /> Изменения после предоплаты: {CONTACTS.phone}
            </a>
          )
        )}
      </footer>

      <Sheet open={editing} onOpenChange={(o) => { setEditing(o); setError(""); }}>
        <SheetContent className="w-full sm:max-w-md">
          <form
            className="flex h-full flex-col"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const ok = await send({ guests: Number(f.get("guests")), comment: String(f.get("comment") ?? "") });
              if (ok) setEditing(false);
            }}
          >
            <SheetHeader className="border-b border-border p-6">
              <SheetTitle className="font-display text-2xl font-normal">Изменить бронь {b.code}</SheetTitle>
              <SheetDescription>Менеджер увидит изменения и при необходимости перезвонит.</SheetDescription>
            </SheetHeader>
            <div className="grid gap-5 p-6">
              <div className="grid gap-2">
                <Label htmlFor={`g-${b.id}`}>Гостей, до {max}</Label>
                <Input id={`g-${b.id}`} name="guests" type="number" min={1} max={max} defaultValue={b.guests} required className="h-11" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`c-${b.id}`}>Пожелания</Label>
                <Textarea id={`c-${b.id}`} name="comment" rows={5} defaultValue={b.comment ?? ""} placeholder="Живая музыка, детский стол, аллергии" />
              </div>
              {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">{error}</p>}
            </div>
            <SheetFooter className="border-t border-border p-6">
              <button type="submit" disabled={busy} className="h-11 rounded-lg bg-night text-sm font-medium text-ivory hover:bg-night-3 disabled:opacity-60">
                {busy ? "Сохраняем" : "Сохранить изменения"}
              </button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить заявку {b.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              {formatDay(b.date)}, {hallName(b.hall).toLowerCase()}. Дата освободится для других гостей, вернуть её можно будет только через менеджера.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Оставить</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-rose-700 text-white hover:bg-rose-800"
              onClick={async () => {
                if (await send({ action: "cancel" })) setConfirmCancel(false);
              }}
            >
              Отменить заявку
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}
