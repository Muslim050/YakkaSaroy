import { cn } from "@/lib/utils";
import { Monogram } from "@/components/Monogram";
import { useId } from "react";

/**
 * What shows while a part of the page is on its way. `size="page"` is the full
 * picture: a wide thin ring with a soft glow inside, the monogram, the name and the
 * line that says what is loading, with a gold arc running round the ring.
 * `size="box"` is the same ring at a small size for a calendar or a widget.
 */
export function Loader({
  className,
  tone = "light",
  size = "page",
  label = "Загружаем…",
}: {
  className?: string;
  tone?: "light" | "dark";
  size?: "page" | "box";
  label?: string;
}) {
  const dark = tone === "dark";
  const page = size === "page";
  const gradientId = useId();
  return (
    <div role="status" aria-live="polite" className={cn("grid place-items-center overflow-hidden", className)}>
      <div
        className={cn("relative grid place-items-center", page ? "ys-loader-page" : "size-36")}
        style={page ? { width: "clamp(14rem, 46vmin, 26rem)", height: "clamp(14rem, 46vmin, 26rem)" } : undefined}
      >
        <span aria-hidden className={cn("ys-loader-glow absolute inset-[8%] rounded-full", dark ? "ys-loader-glow-dark" : "ys-loader-glow-light")} />
        <span aria-hidden className={cn("ys-loader-ring absolute inset-[3%] rounded-full", dark && "ys-loader-ring-dark")}>
          <svg viewBox="0 0 100 100" className="ys-loader-arc" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="100%" y1="50%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#f4dfb6" />
                <stop offset="45%" stopColor="#c99953" />
                <stop offset="100%" stopColor="#be8f47" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="48" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="75 227" />
            <circle cx="50" cy="50" r="48" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="75 227" transform="rotate(180 50 50)" />
          </svg>
        </span>

        <div className="relative flex flex-col items-center">
          <Monogram className={cn("ys-loader-mark", page ? "h-16 w-16 sm:h-20 sm:w-20" : "h-14 w-14")} />
          {page && (
            <>
              <span className={cn("mt-3 font-display text-2xl tracking-[0.08em] uppercase sm:text-[1.75rem]", dark ? "text-ivory" : "text-night")}>Yakka Saroy</span>
              <span className={cn("mt-1 text-[11px] tracking-[0.42em] uppercase", dark ? "text-ivory/45" : "text-muted-foreground")}>Платформа</span>
            </>
          )}
          <span className={cn(page ? "mt-4 text-sm" : "mt-3 text-xs", "ys-loader-label tracking-wide", dark ? "text-gold-2" : "text-gold-dim")}>{label}</span>
        </div>
      </div>
    </div>
  );
}
