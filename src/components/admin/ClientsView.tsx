"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Phone, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDay, formatPhone, formatSum, hallName, phoneDigits, slotLabel, type Booking } from "@/lib/bookings";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Client = { phone: string; name: string; bookings: number; upcoming: number; nextDate?: string; lastDate: string; spent: number };

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
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя или телефон" aria-label="Поиск клиента" className="h-10 bg-card pl-9" />
      </div>

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

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          {open && (
            <>
              <SheetHeader className="border-b border-border px-6 py-5">
                <SheetTitle className="font-display text-2xl font-normal text-night">{open.name}</SheetTitle>
                <SheetDescription>
                  <a href={`tel:+${phoneDigits(open.phone)}`} className="inline-flex items-center gap-1.5 text-ink hover:text-gold-dim">
                    <Phone className="size-3.5" /> {formatPhone(open.phone)}
                  </a>
                </SheetDescription>
              </SheetHeader>
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
        </SheetContent>
      </Sheet>
    </div>
  );
}
