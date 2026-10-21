import { CONTACTS } from "@/lib/data";
import { SectionTitle } from "./SectionTitle";

export function Contacts() {
  return (
    <section id="contacts" className="bg-stone py-24 lg:py-36">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionTitle title="Приезжайте посмотреть" lead="Покажем залы и посчитаем банкет под ваше число гостей. Приезжайте в любой день, только позвоните заранее." />
          <dl className="mt-10 space-y-6 text-ink">
            <Row label="Адрес" value={CONTACTS.address} />
            <Row label="Телефон" value={<a href={CONTACTS.phoneHref} className="hover:text-wine">{CONTACTS.phone}</a>} />
            <Row label="Почта" value={<a href={`mailto:${CONTACTS.email}`} className="hover:text-wine">{CONTACTS.email}</a>} />
            <Row label="Instagram" value={<a href={CONTACTS.instagram} target="_blank" rel="noreferrer" className="hover:text-wine">@yakkasaroy.uz</a>} />
            <Row label="Часы работы" value={CONTACTS.hours} />
          </dl>
        </div>
        <div className="overflow-hidden rounded-[2px] lg:col-span-7">
          <iframe
            title="Yakka Saroy на карте"
            src={`https://www.google.com/maps?q=${encodeURIComponent(CONTACTS.mapQuery)}&z=16&output=embed`}
            className="h-[380px] w-full grayscale-[.35] lg:h-full lg:min-h-[480px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 border-b border-gold-dim/30 pb-4">
      <dt className="text-sm text-mute">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
