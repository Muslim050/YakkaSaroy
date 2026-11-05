"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, Phone, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDay, formatPhone, formatSum, hallName, phoneDigits, slotLabel, type Booking } from "@/lib/bookings";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Client = { phone: string; name: string; bookings: number; upcoming: number; nextDate?: string; lastDate: string; spent: number; total: number };

/** How much of everything the client is to pay has come in, 0 to 100. */
function paidPct(c: Client) {
  return c.total ? Math.min(100, Math.round((c.spent / c.total) * 100)) : 0;
}

export function ClientsView({
  clients,
  bookings,
  total,
  page,
  pageSize,
  q: initialQ,
}: {
  clients: Client[];
  bookings: Record<string, Booking[]>;
  total: number;
  page: number;
  pageSize: number;
  q: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(initialQ);
  const [open, setOpen] = useState<Client | null>(null);
  const [view, setView] = useState<"grid" | "table">("grid");

  const go = (next: { q?: string; page?: number }) => {
    const p = new URLSearchParams();
    const qq = next.q ?? q;
    if (qq.trim()) p.set("q", qq.trim());
    if (next.page && next.page > 1) p.set("page", String(next.page));
    start(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (q === initialQ) return;
    const t = setTimeout(() => go({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const list = open ? (bookings[phoneDigits(open.phone)] ?? []) : [];

  return (
    <div className={cn("transition-opacity", pending && "opacity-60")}>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя или телефон" aria-label="Поиск клиента" className="h-10 bg-card pl-9" />
        </div>
        <div role="group" aria-label="Вид списка" className="ml-auto flex shrink-0 gap-1 rounded-lg border border-border bg-card p-1">
          {(
            [
              { id: "grid", label: "Карточками", icon: LayoutGrid },
              { id: "table", label: "Таблицей", icon: List },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn("grid size-8 place-items-center rounded-md transition-colors", view === id ? "bg-night text-ivory" : "text-muted-foreground hover:bg-secondary hover:text-ink")}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {view === "grid" && (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {clients.map((c) => (
              <li key={c.phone}>
                <button
                  type="button"
                  onClick={() => setOpen(c)}
                  className="grid h-full w-full gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-gold hover:shadow-sm focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30 focus-visible:outline-none"
                >
                  <span className="flex items-center gap-3">
                    <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary font-display text-xl text-gold-dim uppercase">
                      {c.name.trim().charAt(0) || "?"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{c.name}</span>
                      <span className="block text-sm tabular-nums text-muted-foreground">{formatPhone(c.phone)}</span>
                    </span>
                  </span>
                  <span className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2">
                    <span className="rounded-lg bg-background px-3 py-2">
                      <span className="block text-[11px] text-muted-foreground">Броней</span>
                      <span className="block text-sm font-medium text-ink tabular-nums">{c.bookings}</span>
                    </span>
                    <span className="rounded-lg bg-background px-3 py-2">
                      <span className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="shrink-0">Оплачено</span>
                        {c.total > 0 && <span className="truncate tabular-nums">из {formatSum(c.total)}</span>}
                      </span>
                      <span className={cn("block truncate text-sm font-medium tabular-nums", c.spent ? "text-emerald-800" : "text-muted-foreground")}>{c.spent ? formatSum(c.spent) : "—"}</span>
                      {/* the share of all the client's banquets that is paid */}
                      {c.total > 0 && (
                        <span role="img" aria-label={`Оплачено ${paidPct(c)}%`} className="relative mt-1.5 block h-4 overflow-hidden rounded-full bg-secondary">
                          <span className={cn("absolute inset-y-0 left-0 rounded-full", paidPct(c) >= 100 ? "bg-emerald-500" : "bg-gold")} style={{ width: c.spent ? `${Math.max(paidPct(c), 6)}%` : 0 }} />
                          <span className="absolute inset-0 grid place-items-center text-[10px] leading-none font-semibold text-ink">{paidPct(c)}%</span>
                        </span>
                      )}
                    </span>
                  </span>
                  <span className={cn("flex items-center gap-2 text-sm", c.nextDate ? "text-ink" : "text-muted-foreground")}>
                    <CalendarDays className="size-4 shrink-0 text-gold-dim" />
                    {c.nextDate ? `Торжество ${formatDay(c.nextDate, true)}` : "Торжеств впереди нет"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!clients.length && <p className="rounded-xl border border-border bg-card py-14 text-center text-muted-foreground">Никого не нашли. Проверьте имя или последние цифры телефона.</p>}
        </>
      )}

      {view === "table" && (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Клиент</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead className="text-right">Броней</TableHead>
              <TableHead>Ближайшее торжество</TableHead>
              <TableHead className="pr-5 text-right">Оплачено</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow
                key={c.phone}
                onClick={() => setOpen(c)}
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(c))}
                className="cursor-pointer"
              >
                <TableCell className="pl-5 font-medium">{c.name}</TableCell>
                <TableCell className="tabular-nums text-ink/80">{formatPhone(c.phone)}</TableCell>
                <TableCell className="text-right tabular-nums">{c.bookings}</TableCell>
                <TableCell>{c.nextDate ? formatDay(c.nextDate, true) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="pr-5 text-right tabular-nums">{c.spent ? formatSum(c.spent) : <span className="text-muted-foreground">—</span>}</TableCell>
              </TableRow>
            ))}
            {!clients.length && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-14 text-center text-muted-foreground">Никого не нашли. Проверьте имя или последние цифры телефона.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} из ${total}` : "0"}</span>
        <div className="flex gap-1">
          <button type="button" aria-label="Предыдущая страница" disabled={page <= 1} onClick={() => go({ page: page - 1 })} className="grid size-9 place-items-center rounded-lg border border-border bg-card disabled:opacity-40">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Следующая страница" disabled={page >= pages} onClick={() => go({ page: page + 1 })} className="grid size-9 place-items-center rounded-lg border border-border bg-card disabled:opacity-40">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <Modal open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <ModalContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          {open && (
            <>
              <ModalHeader className="border-b border-border px-6 py-5">
                <ModalTitle className="font-display text-2xl font-normal text-night">{open.name}</ModalTitle>
                <ModalDescription>
                  <a href={`tel:+${phoneDigits(open.phone)}`} className="inline-flex items-center gap-1.5 text-ink hover:text-gold-dim">
                    <Phone className="size-3.5" /> {formatPhone(open.phone)}
                  </a>
                </ModalDescription>
              </ModalHeader>
              <ul>
                {list.map((b) => (
                  <li key={b.id} className="border-b border-border">
                    <Link href={`/admin/bookings?status=all&open=${b.id}`} className="flex items-start justify-between gap-3 px-6 py-4 hover:bg-secondary/60">
                      <span>
                        <span className="block text-sm font-medium text-ink">{formatDay(b.date, true)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {hallName(b.hall)}, {slotLabel(b.hall, b.slot)}, {b.guests} гостей, {b.code}
                        </span>
                      </span>
                      <StatusBadge status={b.status} short />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
