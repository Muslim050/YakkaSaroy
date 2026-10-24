"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Media } from "@/lib/program";

/**
 * One photo or video. Videos play muted and looped only while they are on screen,
 * and never start by themselves for people who asked for reduced motion.
 */
export function MediaView({
  media,
  sizes,
  className,
  controls = false,
  priority = false,
}: {
  media: Media;
  sizes: string;
  className?: string;
  controls?: boolean;
  priority?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v || controls) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.6 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [controls, media.src]);

  if (media.kind === "image") {
    return <Image src={media.src} alt={media.alt} fill sizes={sizes} priority={priority} className={cn("object-cover", className)} />;
  }
  return (
    <video
      ref={ref}
      key={media.src}
      src={media.src}
      poster={media.poster}
      muted={!controls}
      loop
      playsInline
      controls={controls}
      autoPlay={controls}
      preload={controls ? "auto" : "metadata"}
      aria-label={media.alt}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
    />
  );
}
