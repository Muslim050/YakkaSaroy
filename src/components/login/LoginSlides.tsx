"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SLIDES = [
  "/login/facade.webp",
  "/login-hall-evening.avif",
  "/login/hall-1.webp",
  "/login/hall-2.webp",
  "/login/hall-3.webp",
  "/login/hall-4.webp",
  "/login/hall-5.webp",
  "/login/hall-6.webp",
];
/** How long a photo stays, its fade included. */
const SLIDE_MS = 4000;
const AUTO_FADE_MS = 1200;
/** The slow push-in on a photo. Longer than any photo stays, so it is still moving when the next one covers it. */
const ZOOM_MS = 10000;
const ZOOM_TO = "scale(1.1)";
/** A photo picked by hand answers sooner, so the arrows and dots do not feel slow. */
const MANUAL_FADE_MS = 700;
const REDUCED_FADE_MS = 200;
/** easeInOutSine: an even change from start to end, where a stronger curve would rush the middle of a slow fade. */
const FADE_EASING = "cubic-bezier(0.37, 0, 0.63, 1)";

const ARROW = "absolute top-1/2 z-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white transition-[background-color,scale] duration-150 hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-white active:scale-95";

/** A photo starts to appear only once it is ready to paint, so the fade neither stutters nor shows an empty frame. */
function whenReady(img: HTMLImageElement | null, then: () => void) {
  if (img) img.decode().then(then, then);
  else then();
}

/** Photos of the venue beside the login form: they change on their own, by the arrows or by the dots below. */
export function LoginSlides() {
  const [{ index, previous, fadeMs }, setSlide] = useState<{ index: number; previous: number | null; fadeMs: number }>({ index: 0, previous: null, fadeMs: 0 });
  const [paused, setPaused] = useState(false);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  /** The last photo asked for, which may still be decoding: quick clicks count from it, and the latest one wins. */
  const target = useRef(0);
  const zooms = useRef(new Map<number, Animation>());

  const go = useCallback((next: number, fade: number) => {
    target.current = next;
    whenReady(images.current[next], () => {
      if (target.current === next) setSlide((s) => (s.index === next ? s : { index: next, previous: s.index, fadeMs: fade }));
    });
  }, []);

  const step = (by: number) => go((target.current + by + SLIDES.length) % SLIDES.length, MANUAL_FADE_MS);

  // Restarts with every change of photo, so one picked by hand stays for its full time.
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => go((index + 1) % SLIDES.length, AUTO_FADE_MS), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, go]);

  // The new photo fades in on top while the one before stays solid beneath it, so the background never shows through.
  // Cancelling a fade cut short makes that photo solid at once, ready to lie beneath the next one.
  useLayoutEffect(() => {
    if (!fadeMs) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? REDUCED_FADE_MS : fadeMs;
    const fade = images.current[index]?.animate({ opacity: [0, 1] }, { duration, easing: FADE_EASING });
    return () => fade?.cancel();
  }, [index, fadeMs]);

  // The photo being covered keeps its zoom until it is out of sight: resetting it earlier would make it jump under the fade.
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const [i, zoom] of zooms.current) {
      if (i === previous) continue;
      zoom.cancel();
      zooms.current.delete(i);
    }
    const zoom = images.current[index]?.animate({ transform: ["scale(1)", ZOOM_TO] }, { duration: ZOOM_MS, easing: "linear", fill: "forwards" });
    if (zoom) zooms.current.set(index, zoom);
  }, [index, previous]);

  return (
    <div className="absolute inset-0" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {SLIDES.map((src, i) => (
        <Image
          key={src}
          ref={(el) => {
            images.current[i] = el;
          }}
          src={src}
          alt=""
          fill
          preload={i === 0}
          sizes="60vw"
          className={cn("object-cover", i === index ? "z-2 opacity-100" : i === previous ? "z-1 opacity-100" : "opacity-0")}
        />
      ))}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-3 h-28 bg-gradient-to-t from-black/45 to-transparent" />
      <button type="button" aria-label="Предыдущее фото" onClick={() => step(-1)} className={cn(ARROW, "left-5")}>
        <ChevronLeft className="size-6" />
      </button>
      <button type="button" aria-label="Следующее фото" onClick={() => step(1)} className={cn(ARROW, "right-5")}>
        <ChevronRight className="size-6" />
      </button>
      <div role="group" aria-label="Фотографии зала" className="absolute inset-x-0 bottom-5 z-3 flex justify-center">
        {SLIDES.map((src, i) => (
          <button
            key={src}
            type="button"
            aria-label={`Фото ${i + 1} из ${SLIDES.length}`}
            aria-current={i === index}
            onClick={() => go(i, MANUAL_FADE_MS)}
            className="group grid size-7 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
          >
            <span className={cn("block h-2 rounded-full transition-[width,background-color] duration-300", i === index ? "w-5 bg-white" : "w-2 bg-white/55 group-hover:bg-white/85")} />
          </button>
        ))}
      </div>
    </div>
  );
}
