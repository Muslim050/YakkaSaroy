"use client";

import { useState } from "react";
import { Check, Expand, Minus, Play, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSum, formatSumShort } from "@/lib/bookings";
import { optionCost, type ProgramCategory, type ProgramOption } from "@/lib/program";
import { MediaThumb, MediaView } from "./MediaView";
import { Lightbox } from "./Lightbox";

export function priceLabel(o: Pick<ProgramOption, "price">) {
  if (o.price.type === "included") return "Входит в стоимость зала";
  if (o.price.type === "perGuest") return `+${formatSum(o.price.amount)} за гостя`;
  return `+${formatSum(o.price.amount)}`;
}

export function OptionCard({
  option: o,
  category,
  selected,
  guests,
  disabled,
  gone = false,
  onToggle,
}: {
  option: ProgramOption;
  category: ProgramCategory;
  selected: boolean;
  guests: number;
  disabled: boolean;
  /** Was chosen earlier but is no longer offered: it can only be removed. */
  gone?: boolean;
  onToggle: () => void;
}) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<number | null>(null);
  const m = o.media[i];
  const cost = optionCost(o.price, guests);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow",
        selected ? "border-gold shadow-[0_0_0_1px_var(--gold),0_18px_40px_-24px_rgba(13,24,40,.45)]" : "border-border hover:shadow-[0_18px_40px_-28px_rgba(13,24,40,.5)]",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-night">
        <button type="button" onClick={() => setBox(i)} aria-label={`Смотреть крупно: ${o.title}`} className="absolute inset-0 z-10 cursor-zoom-in" />
        {m && <MediaView media={m} sizes="(min-width:1280px) 26vw, (min-width:640px) 45vw, 92vw" className="transition-transform duration-700 group-hover:scale-[1.03]" />}
        {m?.kind === "video" && !gone && (
          <span className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-night/70 px-2.5 py-1 text-xs text-ivory backdrop-blur">
            <Play className="size-3 fill-ivory" /> видео
          </span>
        )}
        <span className="pointer-events-none absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-night/60 text-ivory opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Expand className="size-4" />
        </span>
        {selected && (
          <span className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-medium text-night">
            <Check className="size-3.5" /> Выбрано
          </span>
        )}
        {gone && (
          <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-ivory/90 px-2.5 py-1 text-xs font-medium text-night backdrop-blur">
            Больше не предлагается
          </span>
        )}
        {!m && <span className="absolute inset-0 grid place-items-center text-sm text-ivory/50">Фото скоро появится</span>}
        {o.media.length > 1 && (
          <div className="absolute bottom-3 right-3 z-20 flex gap-1.5">
            {o.media.map((x, k) => (
              <button
                key={`${k}-${x.src}`}
                type="button"
                aria-label={`Показать: ${x.alt}`}
                onClick={() => setI(k)}
                className={cn("relative h-9 w-12 overflow-hidden rounded-md ring-2 transition", k === i ? "ring-ivory" : "opacity-70 ring-transparent hover:opacity-100")}
              >
                <MediaThumb media={x} sizes="48px" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl leading-tight text-night">{o.title}</h3>
        </div>
        <p className="mt-1 text-sm font-medium text-gold-dim">
          {priceLabel(o)}
          {o.price.type === "perGuest" && guests > 0 && <span className="font-normal text-muted-foreground">, {formatSumShort(cost)} на {guests} гостей</span>}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink/80">{o.description}</p>
        <ul className="mt-3 grid gap-1 text-sm text-ink/70">
          {o.includes.map((x) => (
            <li key={x} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-gold" />
              {x}
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={disabled || (gone && !selected)}
          onClick={onToggle}
          aria-pressed={selected}
          className={cn(
            "mt-5 flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            selected ? "bg-gold text-night hover:bg-gold-2" : "border border-night/20 text-night hover:border-night hover:bg-night hover:text-ivory",
          )}
        >
          {gone ? (
            selected ? (
              <>
                <Minus className="size-4" /> Убрать из программы
              </>
            ) : (
              "Больше не предлагается"
            )
          ) : (
            <>
              {selected ? <Check className="size-4" /> : category.pick === "many" ? <Plus className="size-4" /> : null}
              {selected
                ? category.pick === "many" || !category.required
                  ? "Выбрано, нажмите чтобы убрать"
                  : "Выбрано"
                : category.pick === "many"
                  ? "Добавить"
                  : "Выбрать"}
            </>
          )}
        </button>
      </div>

      <Lightbox title={o.title} description={o.description} media={o.media} index={box} onIndex={setBox} onClose={() => setBox(null)} />
    </article>
  );
}
