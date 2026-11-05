"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Media } from "@/lib/program";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MediaThumb, MediaView } from "./MediaView";

/**
 * A closer look at an option: its photos and videos (video with sound and controls)
 * and, beside them, what the option is: the description, what is included and the price.
 * Without any of those it is just the picture with its name.
 */
export function Lightbox({
  title,
  description,
  includes,
  price,
  media,
  index,
  onIndex,
  onClose,
}: {
  title: string;
  description: string;
  /** What the option consists of, one line each. */
  includes?: string[];
  /** The price as it is said to a client, "+700 000 сум за гостя". */
  price?: string;
  media: Media[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const open = index !== null;
  const i = index ?? 0;
  const m = media[i];
  const go = (d: number) => onIndex((i + d + media.length) % media.length);
  const list = (includes ?? []).filter(Boolean);
  const detailed = Boolean(description || list.length || price);

  const thumbs = media.length > 1 && (
    <div className="flex flex-wrap gap-2">
      {media.map((x, k) => (
        <button
          key={`${k}-${x.src}`}
          type="button"
          aria-label={`Показать: ${x.alt}`}
          onClick={() => onIndex(k)}
          className={cn("relative h-12 w-16 overflow-hidden rounded-md ring-2 transition", k === i ? "ring-gold" : "opacity-60 ring-transparent hover:opacity-100")}
        >
          <MediaThumb media={x} sizes="64px" iconClassName="size-4" />
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] gap-0 overflow-y-auto bg-night p-0 text-ivory ring-white/10",
          detailed ? "max-w-7xl sm:max-w-7xl md:grid md:grid-cols-[minmax(0,1fr)_21rem] md:overflow-hidden" : "max-w-5xl sm:max-w-5xl",
        )}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        <div className={cn("relative w-full bg-black", detailed ? "aspect-[4/3] md:aspect-auto md:h-[min(80vh,46rem)]" : "aspect-video")}>
          {m && <MediaView key={m.src} media={m} sizes={detailed ? "75vw" : "90vw"} controls className={detailed ? "object-cover" : "object-contain"} />}
          {media.length > 1 && (
            <>
              <button type="button" aria-label="Предыдущее" onClick={() => go(-1)} className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-night/70 text-ivory backdrop-blur hover:bg-night">
                <ChevronLeft className="size-5" />
              </button>
              <button type="button" aria-label="Следующее" onClick={() => go(1)} className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-night/70 text-ivory backdrop-blur hover:bg-night">
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        {detailed ? (
          <div className="flex flex-col gap-4 p-5 pr-12 md:h-[min(80vh,46rem)] md:overflow-y-auto md:p-6 md:pr-12">
            <div>
              <DialogTitle className="font-display text-2xl leading-tight font-normal text-ivory">{title}</DialogTitle>
              {price && <p className="mt-2 text-sm text-gold-2">{price}</p>}
            </div>
            {description ? (
              <DialogDescription className="text-sm leading-relaxed text-ivory/75">{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
            {list.length > 0 && (
              <div>
                <p className="text-[11px] tracking-[0.12em] text-ivory/45 uppercase">Что входит</p>
                <ul className="mt-2 grid gap-1.5 text-sm text-ivory/85">
                  {list.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-gold" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {thumbs && <div className="mt-auto pt-2">{thumbs}</div>}
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <DialogTitle className="font-display text-2xl font-normal text-ivory">{title}</DialogTitle>
              <DialogDescription className="mt-1 text-ivory/65">{m?.alt ?? title}</DialogDescription>
            </div>
            {thumbs}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
