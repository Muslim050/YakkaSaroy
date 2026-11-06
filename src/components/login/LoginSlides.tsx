"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SLIDES = [
  "/login-hall-evening.avif",
  "/login/hall-1.webp",
  "/login/hall-2.webp",
  "/login/hall-3.webp",
  "/login/hall-4.webp",
  "/login/hall-5.webp",
  "/login/hall-6.webp",
  "/login/facade.webp",
];
/** How long a photo stays, the two seconds of its fade included. */
const SLIDE_MS = 7000;
/** easeInOutSine: an even change from start to end, where a stronger curve would rush the middle of a slow fade. */
const FADE = "transition-opacity duration-2000 ease-[cubic-bezier(0.37,0,0.63,1)] motion-reduce:duration-200";

/** A photo starts to appear only once it is ready to paint, so the fade neither stutters nor shows an empty frame. */
function whenReady(img: HTMLImageElement | null, then: () => void) {
  if (img) img.decode().then(then, then);
  else then();
}

/** Photos of the venue beside the login form: they change on their own, or by the dots below. */
export function LoginSlides() {
  const [{ index, previous }, setSlide] = useState<{ index: number; previous: number | null }>({ index: 0, previous: null });
  const [paused, setPaused] = useState(false);
  const images = useRef<(HTMLImageElement | null)[]>([]);

  const show = (next: number) => setSlide((s) => (s.index === next ? s : { index: next, previous: s.index }));

  // Restarts with every change of photo, so one picked by hand stays for its full time.
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const next = (index + 1) % SLIDES.length;
    const timer = setTimeout(() => whenReady(images.current[next], () => setSlide((s) => (s.index === index ? { index: next, previous: index } : s))), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, paused]);

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
          // The new photo fades in on top while the old one stays solid beneath it, so the background never shows through.
          className={cn(
            "object-cover",
            i === index && `z-2 opacity-100 ${FADE}`,
            i === previous && `z-1 opacity-100 ${FADE}`,
            i !== index && i !== previous && "opacity-0",
          )}
        />
      ))}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-3 h-28 bg-gradient-to-t from-black/45 to-transparent" />
      <div role="group" aria-label="Фотографии зала" className="absolute inset-x-0 bottom-5 z-3 flex justify-center">
        {SLIDES.map((src, i) => (
          <button
            key={src}
            type="button"
            aria-label={`Фото ${i + 1} из ${SLIDES.length}`}
            aria-current={i === index}
            onClick={() => whenReady(images.current[i], () => show(i))}
            className="group grid size-7 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
          >
            <span className={cn("block h-2 rounded-full transition-[width,background-color] duration-300", i === index ? "w-5 bg-white" : "w-2 bg-white/55 group-hover:bg-white/85")} />
          </button>
        ))}
      </div>
    </div>
  );
}
