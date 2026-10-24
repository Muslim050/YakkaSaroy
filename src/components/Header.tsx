"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTACTS } from "@/lib/data";
import { Monogram } from "./Monogram";

const NAV = [
  { id: "halls", label: "Залы" },
  { id: "menu", label: "Меню" },
  { id: "gallery", label: "Галерея" },
  { id: "booking", label: "Свободные даты" },
  { id: "contacts", label: "Контакты" },
];

export function Header() {
  const [solid, setSolid] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");

  // Denser once the hero is scrolled; slides away while scrolling down, back while scrolling up.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setSolid(y > 40);
      if (y > 160 && y > last + 4) setHidden(true);
      else if (y < last - 4 || y <= 160) setHidden(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the section that crosses the middle of the screen.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    const top = document.getElementById("top");
    const watch = [top, ...NAV.map((n) => document.getElementById(n.id))].filter(Boolean) as HTMLElement[];
    watch.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 px-3 pt-3 transition-transform duration-500 sm:px-5 sm:pt-4",
        hidden && !open && "-translate-y-[130%]",
      )}
    >
      <div
        className={cn(
          "relative mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border pl-2 pr-2 transition-all duration-500",
                    solid || open
            ? "border-ivory/12 bg-night/90 py-1.5 shadow-[0_16px_40px_-20px_rgba(0,0,0,.7)] backdrop-blur-xl"
            : "border-ivory/15 bg-night/35 py-2 backdrop-blur-md",
        )}
      >
        <a href="#top" className="group flex items-center gap-3 rounded-full py-1 pl-1 pr-3 text-ivory" aria-label="Yakka Saroy, наверх">
          <span className="grid size-10 place-items-center rounded-full border border-gold/60 transition-colors group-hover:border-gold-2">
            <Monogram className="size-5 text-gold-2" />
          </span>
          <span className="whitespace-nowrap font-display text-2xl leading-none">Yakka Saroy</span>
        </a>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Разделы">
          {NAV.map((n) => {
            const on = active === n.id;
            return (
              <a
                key={n.id}
                href={`#${n.id}`}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "relative whitespace-nowrap rounded-full px-3 py-2 text-sm transition-colors xl:px-4",
                  on ? "bg-gold/15 text-gold-2" : "text-ivory/75 hover:bg-ivory/5 hover:text-ivory",
                )}
              >
                {n.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rotate-45 bg-gold transition-all duration-300",
                    on ? "opacity-100" : "scale-0 opacity-0",
                  )}
                />
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={CONTACTS.phoneHref}
            aria-label={`Позвонить ${CONTACTS.phone}`}
            className="hidden size-10 items-center justify-center gap-2 rounded-full border border-gold/40 text-sm text-ivory/85 transition hover:border-gold hover:text-gold-2 md:flex xl:w-auto xl:py-2 xl:pl-3 xl:pr-4"
          >
            <Phone className="size-4 text-gold" />
            <span className="hidden whitespace-nowrap xl:inline">{CONTACTS.phone}</span>
          </a>
          <Link
            href="/login"
            aria-label="Личный кабинет"
            className="hidden size-10 items-center justify-center rounded-full border border-gold/40 text-ivory/85 transition hover:border-gold hover:text-gold-2 md:flex"
          >
            <UserRound className="size-4 text-gold" />
          </Link>
          <a
            href="#booking"
            className="hidden whitespace-nowrap rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-night transition-colors hover:bg-gold-2 sm:block"
          >
            Забронировать
          </a>
          <button
            type="button"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex size-11 items-center justify-center rounded-full border border-gold/40 text-ivory lg:hidden"
          >
            <span className="relative block h-3 w-5">
              <span className={cn("absolute left-0 top-0 h-px w-full bg-current transition", open && "translate-y-1.5 rotate-45")} />
              <span className={cn("absolute left-0 top-1.5 h-px w-full bg-current transition", open && "opacity-0")} />
              <span className={cn("absolute left-0 top-3 h-px w-full bg-current transition", open && "-translate-y-1.5 -rotate-45")} />
            </span>
          </button>
        </div>

        <div className="progress" aria-hidden="true" />
      </div>

      {open && (
        <nav
          aria-label="Разделы"
          className="animate-in fade-in slide-in-from-top-2 mx-auto mt-2 max-w-6xl rounded-3xl border border-gold/30 bg-night/95 px-6 pb-6 pt-2 backdrop-blur-xl duration-300 lg:hidden"
        >
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={() => setOpen(false)}
              className={cn("block border-b border-ivory/10 py-3 font-display text-2xl", active === n.id ? "text-gold-2" : "text-ivory")}
            >
              {n.label}
            </a>
          ))}
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={CONTACTS.phoneHref} className="flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2.5 text-sm text-ivory">
              <Phone className="size-4 text-gold" /> {CONTACTS.phone}
            </a>
            <a href="#booking" onClick={() => setOpen(false)} className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-night">
              Забронировать
            </a>
            <Link href="/login" className="flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2.5 text-sm text-ivory">
              <UserRound className="size-4 text-gold" /> Личный кабинет
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export { Monogram } from "./Monogram";
