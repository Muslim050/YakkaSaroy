import { cn } from "@/lib/utils";

/** Section heading: a plain name in Forum and, if needed, one sentence of help. */
export function SectionTitle({
  title,
  lead,
  tone = "light",
  className,
  children,
}: {
  title: string;
  lead?: string;
  tone?: "light" | "dark";
  className?: string;
  /** right-hand slot on wide screens, e.g. a link or a switcher */
  children?: React.ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between", className)}>
      <div className="max-w-2xl">
        <h2 className={cn("font-display text-[2.75rem] leading-[1.02] sm:text-6xl", dark ? "text-ivory" : "text-night")}>{title}</h2>
        {lead && <p className={cn("mt-5 max-w-xl text-[1.0625rem] leading-relaxed", dark ? "text-ivory/70" : "text-mute")}>{lead}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}
