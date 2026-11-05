"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { HALLS } from "@/lib/data";
import { estimateTotal, formatDay, formatPhone, formatSum, hallName, slotLabel, type Booking, type BookingStatus } from "@/lib/bookings";
import type { Catalog } from "@/lib/program";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingSheet } from "./BookingSheet";
import { EditBookingSheet, NewBookingSheet, type NewBookingPreset } from "./NewBookingSheet";

type Counts = Record<BookingStatus | "upcoming" | "all", number>;
type Filter = BookingStatus | "upcoming" | "all";

/** The open booking may leave the current list after a save (e.g. a status filter); keep the freshest copy. */
function freshest(...items: (Booking | null | undefined)[]) {
  return items.filter((b): b is Booking => !!b).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "upcoming", label: "Предстоящие" },
  { id: "new", label: "Новые" },
  { id: "confirmed", label: "Придержаны" },
  { id: "prepaid", label: "С предоплатой" },
  { id: "done", label: "Проведены" },
  { id: "cancelled", label: "Отменены" },
  { id: "all", label: "Все" },
];
const HALL_ITEMS: Record<string, string> = { all: "Все залы", ...Object.fromEntries(HALLS.filter((h) => h.id !== "restaurant").map((h) => [h.id, h.name])) };

export function BookingsView({
  rows,
  total,
  page,
  pageSize,
  counts,
  query,
  focus,
  catalog,
}: {
  rows: Booking[];
  total: number;
  page: number;
  pageSize: number;
  counts: Counts;
  query: { kind: "halls" | "restaurant"; status: Filter; hall: string; q: string };
  focus: Booking | null;
  catalog: Catalog;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(focus?.id ?? null);
  const [creating, setCreating] = useState<NewBookingPreset | null>(null);
  const [q, setQ] = useState(query.q);
  const [saved, setSaved] = useState<Booking | null>(null);

  const open = openId
    ? freshest(rows.find((r) => r.id === openId), saved?.id === openId ? saved : null, focus?.id === openId ? focus : null)
    : null;
  const inForm = !!open && open.hall !== "restaurant" && open.status !== "cancelled" && open.status !== "done";

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    next.delete("open");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // Search as you type, with a short pause.
  useEffect(() => {
    if (q === query.q) return;
    const t = setTimeout(() => go({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const isTable = query.kind === "restaurant";

  return (
    <div className={cn("transition-opacity", pending && "opacity-60")}>
      {/* banquets vs restaurant */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {(["halls", "restaurant"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => go({ kind: k === "halls" ? null : k, hall: null, status: null })}
              className={cn("h-8 rounded-md px-4 text-sm transition-colors", query.kind === k ? "bg-night text-ivory" : "text-ink/70 hover:text-ink")}
            >
              {k === "halls" ? "Банкетные залы" : "Столики в ресторане"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCreating({ hall: isTable ? "restaurant" : "grand" })}
          className="inline-flex h-10 items-center gap-2 rounded-lg brand-action px-4 text-sm font-medium"
        >
          <Plus className="size-4" /> Новая бронь
        </button>
      </div>

      {/* status tabs with counts */}
      <div className="scroll-x -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => {
          const on = query.status === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => go({ status: f.id === "upcoming" ? null : f.id })}
              className={cn(
                "relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-1 text-sm transition-colors",
                on ? "text-ink" : "text-muted-foreground hover:text-ink",
              )}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", on ? "bg-night text-ivory" : "bg-secondary text-ink/70", f.id === "new" && counts.new > 0 && !on && "bg-amber-200 text-amber-950")}>
                {counts[f.id]}
              </span>
              <span className={cn("absolute inset-x-2 -bottom-px h-0.5 bg-gold", on ? "opacity-100" : "opacity-0")} />
            </button>
          );
        })}
      </div>

      {/* search and hall */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, телефон или номер брони" aria-label="Поиск" className="h-10 bg-card pl-9" />
        </div>
        {!isTable && (
          <Select items={HALL_ITEMS} value={query.hall || "all"} onValueChange={(v) => go({ hall: v === "all" ? null : String(v) })}>
            <SelectTrigger className="h-10! w-full bg-card sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(HALL_ITEMS).map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Дата</TableHead>
              <TableHead>{isTable ? "Время" : "Зал и время"}</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead className="text-right">Гостей</TableHead>
              {!isTable && <TableHead>Сумма / предоплата</TableHead>}
              {!isTable && <TableHead className="text-right">Остаток</TableHead>}
              <TableHead>Статус</TableHead>
              <TableHead className="pr-5 text-right">Бронь</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => {
              const t = estimateTotal(b, catalog);
              const paid = b.prepayment ?? 0;
              const pct = t ? Math.min(100, Math.round((paid / t) * 100)) : 0;
              return (
                <TableRow
                  key={b.id}
                  onClick={() => setOpenId(b.id)}
                  className="cursor-pointer"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpenId(b.id))}
                >
                  <TableCell className="whitespace-nowrap pl-5 font-medium tabular-nums">{formatDay(b.date, true)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {isTable ? b.slot : (
                      <>
                        <span className="block">{hallName(b.hall)}</span>
                        <span className="block text-xs text-muted-foreground">{slotLabel(b.hall, b.slot, b.startTime)}</span>
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="block">{b.name}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{formatPhone(b.phone)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{b.guests}</TableCell>
                  {!isTable && (
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {t ? (
                        <div className="w-56">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-xs text-muted-foreground">{formatSum(t)}</span>
                            <span className={cn("font-medium", paid ? "text-ink" : "text-muted-foreground")}>{paid ? formatSum(paid) : "—"}</span>
                          </div>
                          {/* how much of the banquet is paid: the bar fills with gold, the share is written on it */}
                          <div role="img" aria-label={`Оплачено ${pct}%`} className="relative mt-1.5 h-5 overflow-hidden rounded-full bg-secondary">
                            <span className={cn("absolute inset-y-0 left-0 rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-gold")} style={{ width: paid ? `${Math.max(pct, 5)}%` : 0 }} />
                            <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-ink">{pct}%</span>
                          </div>
                        </div>
                      ) : paid ? (
                        formatSum(paid)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {!isTable && (
                    <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                      {t ? formatSum(Math.max(0, t - paid)) : <span className="font-normal text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  <TableCell>
                    <StatusBadge status={b.status} short />
                  </TableCell>
                  <TableCell className="pr-5 text-right text-xs text-muted-foreground tabular-nums">{b.code}</TableCell>
                </TableRow>
              );
            })}
            {!rows.length && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-14 text-center text-muted-foreground">
                  Под эти условия броней нет. Сбросьте поиск или выберите другой статус.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">
          {total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} из ${total}` : "0"}
        </span>
        <div className="flex gap-1">
          <button type="button" aria-label="Предыдущая страница" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })} className="grid size-9 place-items-center rounded-lg border border-border bg-card disabled:opacity-40">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Следующая страница" disabled={page >= pages} onClick={() => go({ page: String(page + 1) })} className="grid size-9 place-items-center rounded-lg border border-border bg-card disabled:opacity-40">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* An active banquet opens in the same window as a new booking; a restaurant table, a cancelled or a past booking keeps its card. */}
      <EditBookingSheet booking={inForm ? open : null} catalog={catalog} onClose={() => setOpenId(null)} onSaved={setSaved} />
      <BookingSheet booking={inForm ? null : open} catalog={catalog} onClose={() => setOpenId(null)} onSaved={setSaved} />
      <NewBookingSheet preset={creating} catalog={catalog} onClose={() => setCreating(null)} />
    </div>
  );
}
