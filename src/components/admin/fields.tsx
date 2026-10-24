"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** Small building blocks shared by the admin sheets. */
export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-4 border-b border-border px-6 py-5", className)}>
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
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

export async function api(url: string, method: "POST" | "PATCH", body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { error?: string; booking?: unknown };
  return res.ok ? { ok: true as const, json } : { ok: false as const, error: json.error ?? "Не получилось сохранить" };
}
