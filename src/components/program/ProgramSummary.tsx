"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectedOptions, type Catalog, type ProgramOption, type ProgramSelection } from "@/lib/program";
import { MediaThumb } from "./MediaView";
import { Lightbox } from "./Lightbox";
import { priceLabel } from "./OptionCard";

/** Thumbnails of what is chosen for a banquet, with a way into the full program page. A thumbnail opens the photos large. */
export function ProgramSummary({
  catalog,
  extras,
  href,
  cta,
  className,
}: {
  catalog: Catalog;
  extras?: ProgramSelection;
  href: string;
  cta: string;
  className?: string;
}) {
  const chosen = selectedOptions(catalog, extras);
  const [box, setBox] = useState<{ option: ProgramOption; index: number } | null>(null);
  return (
    <div className={cn("grid gap-3", className)}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {chosen.map(({ category, option, gone }) => {
          const m = option.media[0];
          return (
            <li key={option.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background p-1.5 pr-3">
              {m ? (
                <button
                  type="button"
                  aria-label={`Смотреть фото: ${option.title}`}
                  onClick={() => setBox({ option, index: 0 })}
                  className="group relative h-14 w-20 shrink-0 cursor-zoom-in overflow-hidden rounded-md bg-night outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <MediaThumb media={m} sizes="80px" iconClassName="size-3" />
                  <span className="absolute inset-0 grid place-items-center bg-night/45 text-ivory opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Expand className="size-4" />
                  </span>
                </button>
              ) : (
                <span className="h-14 w-20 shrink-0 rounded-md bg-night" />
              )}
              <span className="min-w-0 leading-tight">
                <span className="block text-[13px] text-ink">{option.title}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {category.title}
                  {gone && ", больше не предлагается"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <Link href={href} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-night underline-offset-4 hover:underline">
        {cta} <ArrowRight className="size-4" />
      </Link>
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
    </div>
  );
}
