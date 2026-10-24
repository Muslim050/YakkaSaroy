import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectedOptions, type Catalog, type ProgramSelection } from "@/lib/program";
import { MediaThumb } from "./MediaView";

/** Thumbnails of what is chosen for a banquet, with a way into the full program page. */
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
  return (
    <div className={cn("grid gap-3", className)}>
      <ul className="flex flex-wrap gap-2">
        {chosen.map(({ category, option, gone }) => {
          const m = option.media[0];
          return (
            <li key={option.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-background py-1.5 pl-1.5 pr-3">
              <span className="relative h-9 w-12 shrink-0 overflow-hidden rounded-md bg-night">{m && <MediaThumb media={m} sizes="48px" iconClassName="size-3" />}</span>
              <span className="leading-tight">
                <span className="block text-[13px] text-ink">{option.title}</span>
                <span className="block text-[11px] text-muted-foreground">
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
    </div>
  );
}
