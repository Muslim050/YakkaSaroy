"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { HALLS, type HallId } from "@/lib/data";
import { goToBooking } from "./QuickCheck";
import { SectionTitle } from "./SectionTitle";

export function Halls() {
  const [active, setActive] = useState<HallId>("grand");
  const hall = HALLS.find((h) => h.id === active)!;

  return (
    <section id="halls" className="bg-night py-24 text-ivory lg:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionTitle tone="dark" title="Залы" lead="Выберите зал, чтобы увидеть фото, вместимость и цены." />

        <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-x-16">
          {/* list */}
          <div role="tablist" aria-label="Залы" className="border-t border-ivory/12 lg:col-span-5">
            {HALLS.map((h) => {
              const on = h.id === active;
              return (
                <button
                  key={h.id}
                  role="tab"
                  type="button"
                  id={`hall-tab-${h.id}`}
                  aria-selected={on}
                  aria-controls="hall-panel"
                  onClick={() => setActive(h.id)}
                  className={cn(
                    "group relative flex w-full items-baseline justify-between gap-4 border-b border-ivory/12 py-5 text-left transition-colors",
                    on ? "text-ivory" : "text-ivory/45 hover:text-ivory/80",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("absolute left-0 top-0 h-px bg-gold transition-all duration-500", on ? "w-full" : "w-0")}
                  />
                  <span className="font-display text-3xl sm:text-4xl">{h.name}</span>
                  <span className={cn("shrink-0 text-sm tabular-nums transition-colors", on ? "text-gold-2" : "")}>
                    {h.seats} {h.id === "restaurant" ? "чел. за столом" : "гостей"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* photo */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2px] lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:aspect-auto lg:min-h-[640px]">
            {HALLS.map((h) => (
              <Image
                key={h.id}
                src={h.image}
                alt={h.name}
                fill
                sizes="(min-width:1024px) 55vw, 100vw"
                className={cn(
                  "object-cover transition-[opacity,scale] duration-700 ease-out",
                  h.id === active ? "scale-100 opacity-100" : "scale-[1.04] opacity-0",
                )}
              />
            ))}
          </div>

          {/* details */}
          <div id="hall-panel" role="tabpanel" aria-labelledby={`hall-tab-${active}`} className="lg:col-span-5 lg:row-start-2">
            <p className="text-sm text-gold-2">{hall.bestFor}</p>
            <p className="mt-3 leading-relaxed text-ivory/80">{hall.description}</p>
            <ul className="mt-6 grid gap-x-6 gap-y-2 text-sm text-ivory/70 sm:grid-cols-2">
              {hall.features.map((f) => (
                <li key={f} className="border-l border-gold/40 pl-3">
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <button
                type="button"
                onClick={() => goToBooking({ hall: hall.id, date: "" })}
                className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-night transition-colors hover:bg-gold-2"
              >
                Свободные даты в этом зале
              </button>
              <span className="text-sm text-ivory/55">{hall.price}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
