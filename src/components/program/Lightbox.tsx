"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Media } from "@/lib/program";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MediaThumb, MediaView } from "./MediaView";

/** Full-screen look at an option's photos and videos, with sound and controls for video. */
export function Lightbox({
  title,
  description,
  media,
  index,
  onIndex,
  onClose,
}: {
  title: string;
  description: string;
  media: Media[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const open = index !== null;
  const i = index ?? 0;
  const m = media[i];
  const go = (d: number) => onIndex((i + d + media.length) % media.length);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-5xl gap-0 overflow-hidden bg-night p-0 text-ivory ring-white/10 sm:max-w-5xl"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        <div className="relative aspect-video w-full bg-black">
          {m && <MediaView key={m.src} media={m} sizes="90vw" controls className="object-contain" />}
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
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <DialogTitle className="font-display text-2xl font-normal text-ivory">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-ivory/65">{m?.alt ?? description}</DialogDescription>
          </div>
          {media.length > 1 && (
            <div className="flex gap-2">
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
