import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A figure on a tile, used above the overview and the bookings list. */
export function Kpi({ icon: Icon, label, value, note, href, alert }: { icon: LucideIcon; label: string; value: string; note: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <span className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-[#b77a2a]">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-xs font-medium text-ink">{label}{href && <ArrowUpRight className="ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />}</span>
          <span className="mt-1 block text-2xl font-semibold leading-none text-ink tabular-nums">{value}</span>
          <span className="mt-1.5 block text-[11px] leading-snug text-muted-foreground">{note}</span>
        </span>
      </span>
    </>
  );
  const cls = cn(
    "group rounded-2xl border px-4 py-3 transition-colors shadow-[0_8px_22px_-14px_rgba(50,38,28,.3)]",
    label === "Новые заявки" || alert ? "border-[#efd6b3] bg-[#fbefe1]" : "border-border bg-card",
    href && "hover:border-gold/60",
  );
  return href ? (
    <Link href={href} className={cls}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
