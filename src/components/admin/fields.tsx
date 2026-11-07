"use client";

import { toast } from "sonner";
import { LayoutGrid, List, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Booking } from "@/lib/bookings";
import { Label } from "@/components/ui/label";

/** Small building blocks shared by the admin sheets. */
export function Section({ title, icon: Icon, children, className }: { title: string; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-4 border-b border-border px-6 py-5", className)}>
      <h3 className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {Icon && <Icon className="size-3.5 text-gold-dim" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Field({ id, label, hint, children, className }: { id?: string; label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-[13px] text-ink/80">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
      {error}
    </p>
  );
}

/** Cards or a plain list, for the pages that show both. */
export function ViewSwitch({ view, onChange, listLabel }: { view: "grid" | "table"; onChange: (view: "grid" | "table") => void; listLabel: string }) {
  return (
    <div role="group" aria-label="Вид списка" className="ml-auto flex shrink-0 gap-1 rounded-lg border border-border bg-card p-1">
      {(
        [
          { id: "grid", label: "Карточками", icon: LayoutGrid },
          { id: "table", label: listLabel, icon: List },
        ] as const
      ).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={view === id}
          onClick={() => onChange(id)}
          className={cn("grid size-8 place-items-center rounded-md transition-colors", view === id ? "bg-night text-ivory" : "text-muted-foreground hover:bg-secondary hover:text-ink")}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

/** Tells the manager what a saved change did to a booking: `booking` is its state before the change. */
export function notifyBookingSaved(booking: Booking, patch: Record<string, unknown>) {
  if (patch.status === "cancelled") toast.success(`Бронь ${booking.code} отменена`);
  else if (patch.status && booking.status === "cancelled") toast.success(`Бронь ${booking.code} восстановлена`);
  else toast.success(`Бронь ${booking.code} успешно обновлена`);
}

export async function api(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { error?: string; booking?: unknown };
  return res.ok ? { ok: true as const, json } : { ok: false as const, error: json.error ?? "Не получилось сохранить" };
}
