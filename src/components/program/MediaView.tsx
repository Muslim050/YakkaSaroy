"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { canOptimize, type Media } from "@/lib/program";

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
    return <Image src={media.src} alt={media.alt} fill sizes={sizes} priority={priority} unoptimized={!canOptimize(media.src)} className={cn("object-cover", className)} />;
  }
  return (
    <video
      ref={ref}
      key={media.src}
      // Without a poster the first frame stands in for one.
      src={media.poster ? media.src : `${media.src}#t=0.1`}
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

/** Small still of a photo or video for strips and lists; fills its positioned parent. */
export function MediaThumb({ media, sizes, iconClassName }: { media: Media; sizes: string; iconClassName?: string }) {
  const still = media.kind === "image" ? media.src : media.poster;
  return (
    <>
      {still ? (
        <Image src={still} alt="" fill sizes={sizes} unoptimized={!canOptimize(still)} className="object-cover" />
      ) : (
        <video src={`${media.src}#t=0.1`} muted playsInline preload="metadata" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      )}
      {media.kind === "video" && <Play className={cn("absolute inset-0 m-auto size-3.5 fill-ivory text-ivory drop-shadow", iconClassName)} />}
    </>
  );
}
