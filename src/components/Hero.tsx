import Image from "next/image";
import { CONTACTS } from "@/lib/data";
import { QuickCheck } from "./QuickCheck";

export function Hero() {
  return (
    <section id="top" className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-night text-ivory">
      <div className="hero-photo absolute inset-0 -z-10">
        <Image
          src="https://images.unsplash.com/photo-1775346098928-cab0ac41b9a2?w=2400&q=82&auto=format&fit=crop"
          alt="Банкетный зал с хрустальными люстрами"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_40%]"
        />
      </div>
      {/* darken where the text sits, keep the chandeliers bright */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(13,24,40,.55)_0%,rgba(13,24,40,0)_28%,rgba(13,24,40,.25)_55%,rgba(13,24,40,.92)_88%,var(--night)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(13,24,40,.55)_0%,rgba(13,24,40,0)_60%)]" />

      <div className="hero-copy mx-auto w-full max-w-6xl px-5 pb-8 pt-36 sm:px-8">
        <h1 className="rise font-display text-[clamp(4.25rem,14vw,11.5rem)] leading-[0.86] tracking-[-0.01em]">Yakka Saroy</h1>
        <p className="rise rise-2 mt-6 max-w-lg text-lg leading-relaxed text-ivory/85">
          Банкетные залы и ресторан в Яккасарайском районе Ташкента. Свадьбы, никох и юбилеи на 40–800 гостей.
        </p>

        <div className="rise rise-3 mt-9">
          <QuickCheck />
        </div>

        <dl className="rise rise-4 mt-10 grid gap-x-8 gap-y-3 border-t border-ivory/15 pt-5 text-sm text-ivory/70 sm:grid-cols-3">
          <div>
            <dt className="sr-only">Адрес</dt>
            <dd>{CONTACTS.address.replace("Ташкент, Яккасарайский район, ", "")}</dd>
          </div>
          <div>
            <dt className="sr-only">Часы работы</dt>
            <dd>{CONTACTS.hours}</dd>
          </div>
          <div className="sm:text-right">
            <dt className="sr-only">Телефон</dt>
            <dd>
              <a href={CONTACTS.phoneHref} className="text-ivory hover:text-gold-2">
                {CONTACTS.phone}
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
