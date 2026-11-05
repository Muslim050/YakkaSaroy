"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EyeOff, ImageOff, Plus, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  editable,
  forEventType,
  offered,
  type Catalog,
  type ProgramCategory,
  type ProgramOption,
} from "@/lib/program";
import { EVENT_TYPES } from "@/lib/data";
import { priceLabel } from "@/components/program/OptionCard";
import { MediaThumb, MediaView } from "@/components/program/MediaView";
import { Lightbox } from "@/components/program/Lightbox";
import { OptionSheet, type OptionTarget } from "./OptionSheet";
import { api } from "./fields";

function mediaCount(o: ProgramOption) {
  const photos = o.media.filter((m) => m.kind === "image").length;
  const videos = o.media.length - photos;
  const parts = [
    photos && `${photos} фото`,
    videos && `${videos} видео`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "без фото";
}

/** Program options by category; a click opens the option in the side panel. */
export function CatalogView({
  catalog,
  usage,
  uploads,
}: {
  catalog: Catalog;
  usage: Record<string, number>;
  uploads: boolean;
}) {
  const [target, setTarget] = useState<{
    categoryId: string;
    optionId: string | null;
  } | null>(null);

  // Re-read from props after a refresh so the panel never edits a stale copy.
  const open: OptionTarget | null = (() => {
    if (!target) return null;
    const category = catalog.find((c) => c.id === target.categoryId);
    if (!category) return null;
    const list = editable(category);
    const option = target.optionId
      ? (list.find((o) => o.id === target.optionId) ?? null)
      : null;
    if (target.optionId && !option) return null;
    return {
      category,
      option,
      nextOrder: Math.max(0, ...list.map((o) => o.order)) + 10,
    };
  })();

  return (
    <>
      <nav
        aria-label="Разделы каталога"
        className="scroll-x -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        {catalog.map((c) => (
          <a
            key={c.id}
            href={`#cat-${c.id}`}
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-ink hover:border-night/40"
          >
            {c.title}
            <span className="text-xs text-muted-foreground">
              {editable(c).length}
            </span>
          </a>
        ))}
      </nav>

      <div className="grid gap-12">
        {catalog.map((c) => (
          <CategorySection
            key={c.id}
            category={c}
            usage={usage}
            onOpen={(optionId) => setTarget({ categoryId: c.id, optionId })}
          />
        ))}
      </div>

      <OptionSheet
        target={open}
        usage={usage}
        uploads={uploads}
        onClose={() => setTarget(null)}
      />
    </>
  );
}

function CategorySection({
  category: c,
  usage,
  onOpen,
}: {
  category: ProgramCategory;
  usage: Record<string, number>;
  onOpen: (optionId: string | null) => void;
}) {
  const [eventType, setEventType] = useState<string | null>(null);
  // The thumbnail under the pointer, shown large beside it; and the option whose media is open full screen.
  const [peek, setPeek] = useState<{ option: ProgramOption; top: number; left: number } | null>(null);
  const [box, setBox] = useState<{ option: ProgramOption; index: number } | null>(null);
  const all = editable(c);

  function showPeek(option: ProgramOption, el: HTMLElement) {
    if (!option.media[0]) return;
    const r = el.getBoundingClientRect();
    const w = 360;
    const h = 270;
    // Beside the thumbnail when there is room, otherwise over the row; never past the window's edges.
    const left = r.right + 12 + w <= window.innerWidth ? r.right + 12 : Math.max(8, r.left - w - 12);
    const top = Math.min(Math.max(8, r.top + r.height / 2 - h / 2), window.innerHeight - h - 8);
    setPeek({ option, top, left });
  }
  const list = eventType ? forEventType(all, eventType) : all;
  // An occasion with nothing to pick in a required category: guests with that occasion could not choose.
  const empty = c.required
    ? EVENT_TYPES.filter((t) => forEventType(offered(c), t).length === 0)
    : [];
  return (
    <section id={`cat-${c.id}`} className="scroll-mt-24">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl text-night">{c.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.pick === "one"
              ? c.required
                ? "Гость выбирает один вариант, без выбора нельзя."
                : "Гость выбирает один вариант или ничего."
              : "Гость может выбрать несколько."}
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

      <div className="mb-3 grid gap-2">
        <div
          role="group"
          aria-label="Повод"
          className="scroll-x -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          {[null, ...EVENT_TYPES].map((t) => {
            const n = t ? forEventType(all, t).length : all.length;
            return (
              <button
                key={t ?? "all"}
                type="button"
                aria-pressed={eventType === t}
                onClick={() => setEventType(t)}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                  eventType === t
                    ? "border-night bg-night text-ivory"
                    : "border-border bg-card text-ink/80 hover:border-gold hover:text-ink",
                )}
              >
                {t ?? "Все поводы"}
                <span
                  className={cn(
                    "text-xs",
                    eventType === t ? "text-ivory/70" : "text-muted-foreground",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {eventType
            ? `Что гость увидит при поводе «${eventType}»: отмеченное этим поводом и общее для всех.`
            : "У каждого варианта можно задать поводы, для которых он предлагается. Без поводов вариант общий и виден всем."}
        </p>
        {empty.length > 0 && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Нечего выбрать для {empty.length === 1 ? "повода" : "поводов"}:{" "}
            {empty.join(", ")}. Отметьте этот повод у какого-нибудь варианта или
            оставьте один вариант без поводов.
          </p>
        )}
      </div>

      {list.length ? (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {list.map((o) => {
            const used = usage[o.id] ?? 0;
            return (
              <li key={o.id} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
                {/* the picture: hover shows it large, a click opens every photo and video */}
                <button
                  type="button"
                  disabled={!o.media[0]}
                  onMouseEnter={(e) => showPeek(o, e.currentTarget)}
                  onMouseLeave={() => setPeek(null)}
                  onFocus={(e) => showPeek(o, e.currentTarget)}
                  onBlur={() => setPeek(null)}
                  onClick={() => {
                    setPeek(null);
                    setBox({ option: o, index: 0 });
                  }}
                  aria-label={o.media[0] ? `Смотреть фото: ${o.title}` : `Без фото: ${o.title}`}
                  className={cn(
                    "relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-night transition-shadow",
                    o.media[0] && "cursor-zoom-in hover:ring-2 hover:ring-gold focus-visible:ring-2 focus-visible:ring-gold",
                    o.hidden && "opacity-50",
                  )}
                >
                  {o.media[0] ? (
                    <MediaThumb media={o.media[0]} sizes="80px" />
                  ) : (
                    <ImageOff className="absolute inset-0 m-auto size-4 text-ivory/50" />
                  )}
                </button>
                {/* the text: opens the option to edit */}
                <button
                  type="button"
                  onClick={() => onOpen(o.id)}
                  className="-my-1.5 flex min-w-0 flex-1 items-center gap-4 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "font-medium text-ink",
                          o.hidden && "text-muted-foreground",
                        )}
                      >
                        {o.title}
                      </span>
                      {o.hidden && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                          <EyeOff className="size-3" /> скрыт
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-gold-dim">
                      {priceLabel(o)}
                      {o.eventTypes?.length ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {o.eventTypes.join(", ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {mediaCount(o)}
                      {used > 0 &&
                        `, в ${used} ${used === 1 ? "брони" : "бронях"}`}
                    </span>
                  </span>
                  <span
                    className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block"
                    title="Порядок"
                  >
                    № {o.order}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {eventType
            ? `Для повода «${eventType}» в этом разделе ничего нет.`
            : "В этом разделе пока нет вариантов."}
        </div>
      )}
      <Removed category={c} />

      {/* the large preview of the hovered picture; it never takes the pointer, so it cannot flicker */}
      {peek?.option.media[0] && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 w-[360px] overflow-hidden rounded-xl bg-night shadow-2xl ring-1 ring-black/10 animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ top: peek.top, left: peek.left }}
        >
          <div className="relative h-[230px] w-full">
            <MediaView media={peek.option.media[0]} sizes="360px" />
          </div>
          <p className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-ivory">
            <span className="truncate">{peek.option.title}</span>
            <span className="shrink-0 text-xs text-ivory/60">{mediaCount(peek.option)}</span>
          </p>
        </div>
      )}
      <Lightbox
        title={box?.option.title ?? ""}
        description={box?.option.description ?? ""}
        includes={box?.option.includes}
        price={box ? priceLabel(box.option) : undefined}
        media={box?.option.media ?? []}
        index={box ? box.index : null}
        onIndex={(i) => setBox((b) => (b ? { ...b, index: i } : b))}
        onClose={() => setBox(null)}
      />
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
        Удалённые: {list.length}{" "}
        <span className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <ul className="mt-2 grid gap-1">
        {list.map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 hover:bg-secondary/50"
          >
            <span className="text-muted-foreground">{o.title}</span>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => restore(o.id)}
              className="flex items-center gap-1.5 text-night hover:underline disabled:opacity-50"
            >
              <Undo2 className="size-3.5" />{" "}
              {busy === o.id ? "Возвращаем" : "Вернуть скрытым"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-rose-800">{error}</p>}
    </details>
  );
}
