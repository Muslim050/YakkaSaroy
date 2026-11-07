"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { estimateTotal, formatAmount, formatPaidAt, formatSum, type Booking, type Payment } from "@/lib/bookings";
import type { Catalog } from "@/lib/program";
import { nowLocalISO } from "@/lib/time";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { api, ErrorNote, Field } from "./fields";

const FIELD = "h-11 rounded-lg px-3";
const READ_ONLY = "h-11 rounded-lg bg-secondary/50 px-3 tabular-nums";

/**
 * Money received for one banquet: a new sum on the first tab, what came in before on the
 * second. The list behind the window is refreshed once it closes.
 */
export function PaymentsModal({ booking, catalog, onClose, onSaved }: { booking: Booking | null; catalog: Catalog; onClose: () => void; onSaved?: (b: Booking) => void }) {
  const router = useRouter();
  const changed = useRef<Booking | null>(null);

  function close() {
    if (changed.current) {
      onSaved?.(changed.current);
      changed.current = null;
      router.refresh();
    }
    onClose();
  }

  return (
    <Modal open={!!booking} onOpenChange={(o) => !o && close()}>
      <ModalContent className="sm:max-w-md">
        {booking && <Body key={booking.id} booking={booking} catalog={catalog} onChanged={(b) => (changed.current = b)} onClose={close} />}
      </ModalContent>
    </Modal>
  );
}

function Body({ booking: b, catalog, onChanged, onClose }: { booking: Booking; catalog: Catalog; onChanged: (b: Booking) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"add" | "history">("add");
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [removing, setRemoving] = useState<Payment | null>(null);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => nowLocalISO());
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stale = false;
    fetch(`/api/admin/bookings/${b.id}/payments`)
      .then(async (res) => {
        const json = (await res.json()) as { payments?: Payment[]; error?: string };
        if (stale) return;
        if (json.payments) setPayments(json.payments);
        else setError(json.error ?? "Не удалось загрузить историю поступлений");
      })
      .catch(() => !stale && setError("Не удалось загрузить историю поступлений"));
    return () => {
      stale = true;
    };
  }, [b.id]);

  const total = estimateTotal(b, catalog);
  const paid = payments ? payments.reduce((sum, p) => sum + p.amount, 0) : (b.prepayment ?? 0);
  const pct = total ? Math.min(100, Math.round((paid / total) * 100)) : null;

  function resetForm() {
    setEditing(null);
    setAmount("");
    setPaidAt(nowLocalISO());
    setComment("");
    setError("");
  }

  function startEdit(p: Payment) {
    setEditing(p);
    setAmount(String(p.amount));
    setPaidAt(p.paidAt);
    setComment(p.comment ?? "");
    setError("");
    setTab("add");
  }

  function pickTab(next: "add" | "history") {
    if (editing) resetForm();
    setTab(next);
  }

  async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setError("");
    const r = await api(url, method, body);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    const state = r.json as { booking: Booking; payments: Payment[] };
    setPayments(state.payments);
    onChanged(state.booking);
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // React bubbles through portals: opened from the booking form, this submit would also save and close that form.
    e.stopPropagation();
    if (!Number(amount)) return setError("Укажите сумму поступления");
    const body = { amount: Number(amount), paidAt, comment };
    const url = `/api/admin/bookings/${b.id}/payments`;
    if (await send(editing ? `${url}/${editing.id}` : url, editing ? "PATCH" : "POST", body)) {
      resetForm();
      setTab("history");
    }
  }

  async function remove() {
    if (!removing) return;
    if (await send(`/api/admin/bookings/${b.id}/payments/${removing.id}`, "DELETE")) setRemoving(null);
  }

  return (
    <>
      <ModalHeader className="pr-12">
        <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          Поступления
          {pct !== null && <span className="rounded-full bg-secondary px-2 py-0.5 tracking-normal text-ink tabular-nums">{pct}%</span>}
        </p>
        <ModalTitle>Бронь {b.code}</ModalTitle>
        <ModalDescription>{b.name}</ModalDescription>
      </ModalHeader>

      <div className="grid gap-4 px-4 pb-4">
        <Tabs value={tab} onValueChange={(v) => pickTab(v as "add" | "history")}>
          <TabsList className="w-full rounded-full border border-border bg-transparent p-1 group-data-horizontal/tabs:h-11">
            <TabsTrigger value="add" className="rounded-full data-active:bg-secondary data-active:shadow-none!">Поступление</TabsTrigger>
            <TabsTrigger value="history" className="rounded-full data-active:bg-secondary data-active:shadow-none!">
              История поступлений
              {!!payments?.length && <span className="tabular-nums text-muted-foreground">{payments.length}</span>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "add" ? (
          <form onSubmit={submit} className="grid gap-4">
            <Field id="pay-total" label="Сумма банкета">
              <Input id="pay-total" readOnly tabIndex={-1} value={total ? formatSum(total) : "—"} className={READ_ONLY} />
            </Field>
            <Field id="pay-paid" label="Оплачено">
              <Input id="pay-paid" readOnly tabIndex={-1} value={formatSum(paid)} className={READ_ONLY} />
            </Field>
            <Field id="pay-amount" label="Поступление" hint={editing ? "Заменит прежнюю сумму." : "Прибавится к оплаченному."}>
              <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base font-medium text-emerald-700">+</span>
                <Input
                  id="pay-amount"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={amount ? formatAmount(Number(amount)) : ""}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13))}
                  className="h-11 rounded-lg pl-8 tabular-nums"
                />
              </div>
            </Field>
            <Field id="pay-date" label="Дата поступления">
              <Input id="pay-date" type="datetime-local" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={FIELD} />
            </Field>
            <Field id="pay-comment" label="Комментарий">
              <Input id="pay-comment" maxLength={200} placeholder="Необязательно" value={comment} onChange={(e) => setComment(e.target.value)} className={FIELD} />
            </Field>
            <ErrorNote error={error} />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="brand-action h-11 flex-1 rounded-lg text-sm font-medium disabled:opacity-60">
                {busy ? "Сохраняем" : "Сохранить"}
              </button>
              <button type="button" onClick={() => (editing ? pickTab("history") : onClose())} className="h-11 rounded-lg border border-border bg-card px-5 text-sm hover:bg-secondary">
                Отмена
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-2">
            {payments === null && !error && <p className="py-6 text-center text-muted-foreground">Загружаем историю…</p>}
            {payments?.length === 0 && <p className="py-6 text-center text-muted-foreground">Поступлений пока нет.</p>}
            {!!payments?.length && (
              <ol className="grid gap-2">
                {payments.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 py-1.5 pr-1.5 pl-3">
                    <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-muted-foreground tabular-nums">{formatPaidAt(p.paidAt)}</span>
                      {p.comment && <span className="block truncate text-xs text-muted-foreground" title={p.comment}>{p.comment}</span>}
                    </span>
                    <span className="shrink-0 font-semibold text-emerald-700 tabular-nums">+ {formatAmount(p.amount)}</span>
                    <span className="flex shrink-0">
                      <button type="button" aria-label={`Изменить поступление ${formatSum(p.amount)}`} onClick={() => startEdit(p)} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-ink">
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" aria-label={`Удалить поступление ${formatSum(p.amount)}`} onClick={() => { setError(""); setRemoving(p); }} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-rose-700">
                        <Trash2 className="size-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-3 py-3">
              <span className="text-muted-foreground">Всего оплачено</span>
              <span className="font-semibold text-ink tabular-nums">{formatAmount(paid)}</span>
            </p>
            <ErrorNote error={error} />
          </div>
        )}
      </div>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить поступление?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing && `${formatSum(removing.amount)} от ${formatPaidAt(removing.paidAt)}. Оплаченная сумма уменьшится.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ErrorNote error={error} />
          <AlertDialogFooter>
            <AlertDialogCancel>Оставить</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-700 text-white hover:bg-rose-800" disabled={busy} onClick={remove}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
