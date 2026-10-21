import Image from "next/image";
import { cn } from "@/lib/utils";
import { GALLERY } from "@/lib/data";
import { SectionTitle } from "./SectionTitle";

export function Gallery() {
  return (
    <section id="gallery" className="hscroll relative bg-ivory">
      <div className="hscroll-sticky py-24 lg:py-0">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <SectionTitle title="Галерея" lead="Залы, кухня и вечера последнего сезона.">
            <div aria-hidden="true" className="hscroll-meter relative h-px w-48 bg-night/15">
              <div className="hscroll-count absolute inset-0 bg-night" />
            </div>
          </SectionTitle>
        </div>

        <div className="hscroll-pad mt-12">
          <div className="hscroll-track pr-5">
            {GALLERY.map((g) => (
              <figure
                key={g.src}
                className={cn(
                  "relative h-[64vw] max-h-[62vh] shrink-0 overflow-hidden rounded-[2px] sm:h-[420px] lg:h-[58vh]",
                  g.ratio === "wide" ? "aspect-[3/2]" : "aspect-[4/5]",
                )}
              >
                <Image src={g.src} alt={g.alt} fill loading="eager" sizes="(min-width:1024px) 50vw, 85vw" className="object-cover" />
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
