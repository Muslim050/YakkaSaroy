/* eslint-disable @next/next/no-img-element */
/** The gilded YS monogram from the Yakka Saroy sign; public/monogram.svg, cropped to the drawing. */
export function Monogram({ className = "h-9 w-9", alt = "" }: { className?: string; alt?: string }) {
  return <img src="/monogram.svg" alt={alt} aria-hidden={alt ? undefined : true} draggable={false} className={`object-contain ${className}`} />;
}
