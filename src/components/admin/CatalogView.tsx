"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EyeOff, ImageOff, Plus, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { editable, type Catalog, type ProgramCategory, type ProgramOption } from "@/lib/program";
import { priceLabel } from "@/components/program/OptionCard";
import { MediaThumb } from "@/components/program/MediaView";
import { OptionSheet, type OptionTarget } from "./OptionSheet";
import { api } from "./fields";

function mediaCount(o: ProgramOption) {
  const photos = o.media.filter((m) => m.kind === "image").length;
  const videos = o.media.length - photos;
  const parts = [photos && `${photos} фото`, videos && `${videos} видео`].filter(Boolean);
  return parts.length ? parts.join(", ") : "без фото";
}

/** Program options by category; a click opens the option in the side panel. */
export function CatalogView({ catalog, usage, uploads }: { catalog: Catalog; usage: Record<string, number>; uploads: boolean }) {
  const [target, setTarget] = useState<{ categoryId: string; optionId: string | null } | null>(null);

  // Re-read from props after a refresh so the panel never edits a stale copy.
  const open: OptionTarget | null = (() => {
    if (!target) return null;
    const category = catalog.find((c) => c.id === target.categoryId);
    if (!category) return null;
    const list = editable(category);
    const option = target.optionId ? (list.find((o) => o.id === target.optionId) ?? null) : null;
    if (target.optionId && !option) return null;
    return { category, option, nextOrder: Math.max(0, ...list.map((o) => o.order)) + 10 };
  })();

  return (
    <>
      <nav aria-label="Разделы каталога" className="scroll-x -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {catalog.map((c) => (
          <a key={c.id} href={`#cat-${c.id}`} className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-ink hover:border-night/40">
            {c.title}
            <span className="text-xs text-muted-foreground">{editable(c).length}</span>
          </a>
        ))}
      </nav>

      <div className="grid gap-12">
        {catalog.map((c) => (
          <CategorySection key={c.id} category={c} usage={usage} onOpen={(optionId) => setTarget({ categoryId: c.id, optionId })} />
        ))}
      </div>

      <OptionSheet target={open} usage={usage} uploads={uploads} onClose={() => setTarget(null)} />
    </>
  );
}

function CategorySection({ category: c, usage, onOpen }: { category: ProgramCategory; usage: Record<string, number>; onOpen: (optionId: string | null) => void }) {
  const list = editable(c);
  return (
    <section id={`cat-${c.id}`} className="scroll-mt-24">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl text-night">{c.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.pick === "one" ? (c.required ? "Гость выбирает один вариант, без выбора нельзя." : "Гость выбирает один вариант или ничего.") : "Гость может выбрать несколько."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpen(null)}
          className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-night transition-colors hover:border-night/40"
        >
          <Plus className="size-4" /> Добавить вариант
        </button>
      </div>

      {list.length ? (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {list.map((o) => {
            const used = usage[o.id] ?? 0;
            return (
              <li key={o.id} className="border-b border-border last:border-b-0">
                <button type="button" onClick={() => onOpen(o.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-secondary/50">
                  <span className={cn("relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-night", o.hidden && "opacity-50")}>
                    {o.media[0] ? <MediaThumb media={o.media[0]} sizes="80px" /> : <ImageOff className="absolute inset-0 m-auto size-4 text-ivory/50" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium text-ink", o.hidden && "text-muted-foreground")}>{o.title}</span>
                      {o.hidden && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                          <EyeOff className="size-3" /> скрыт
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-gold-dim">{priceLabel(o)}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {mediaCount(o)}
                      {used > 0 && `, в ${used} ${used === 1 ? "брони" : "бронях"}`}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block" title="Порядок">
                    № {o.order}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">В этом разделе пока нет вариантов.</div>
      )}
      <Removed category={c} />
    </section>
  );
}

/** Deleted options stay in the store for old bookings; here they can be brought back. */
function Removed({ category }: { category: ProgramCategory }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const list = category.options.filter((o) => o.archived);
  if (!list.length) return null;

  async function restore(id: string) {
    setBusy(id);
    setError("");
    const r = await api(`/api/admin/catalog/${id}`, "PATCH", { restore: true });
    setBusy("");
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <details className="group mt-3 text-sm">
      <summary className="w-fit cursor-pointer list-none text-muted-foreground hover:text-ink">
        Удалённые: {list.length} <span className="inline-block transition-transform group-open:rotate-90">›</span>
      </summary>
      <ul className="mt-2 grid gap-1">
        {list.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 hover:bg-secondary/50">
            <span className="text-muted-foreground">{o.title}</span>
            <button type="button" disabled={!!busy} onClick={() => restore(o.id)} className="flex items-center gap-1.5 text-night hover:underline disabled:opacity-50">
              <Undo2 className="size-3.5" /> {busy === o.id ? "Возвращаем" : "Вернуть скрытым"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-rose-800">{error}</p>}
    </details>
  );
}
