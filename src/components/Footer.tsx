import { CONTACTS } from "@/lib/data";
import { Monogram } from "./Header";

export function Footer() {
  return (
    <footer className="bg-night py-12 text-ivory/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3 text-ivory">
            <Monogram className="size-9 text-gold" />
            <span className="font-display text-3xl">Yakka Saroy</span>
          </div>
          <p className="mt-3 max-w-sm text-sm">{CONTACTS.address}</p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <a href="#halls" className="hover:text-gold-2">Залы</a>
          <a href="#menu" className="hover:text-gold-2">Меню</a>
          <a href="#gallery" className="hover:text-gold-2">Галерея</a>
          <a href="#booking" className="hover:text-gold-2">Свободные даты</a>
          <a href="#contacts" className="hover:text-gold-2">Контакты</a>
        </div>
        <p className="text-xs text-ivory/40">© Yakka Saroy, Ташкент</p>
      </div>
    </footer>
  );
}
