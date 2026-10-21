import Image from "next/image";
import { SectionTitle } from "./SectionTitle";

const STEPS = [
  { title: "Выберите зал и дату", text: "В календаре видно, какие дни свободны. Днём и вечером в каждом зале проходит по одному торжеству." },
  { title: "Оставьте телефон", text: "Менеджер перезвонит в течение часа, ответит на вопросы и придержит дату за вами на три дня." },
  { title: "Приезжайте на дегустацию", text: "Покажем зал, попробуете блюда и соберёте меню под своё число гостей." },
  { title: "Внесите предоплату", text: "После неё дата закреплена за вами. Остаток оплачивается в день торжества." },
];

export function About() {
  return (
    <section className="bg-ivory py-24 lg:py-36">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
        <div className="relative hidden overflow-hidden rounded-[2px] lg:col-span-5 lg:block">
          <Image
            src="https://images.unsplash.com/photo-1732596290095-5aa0420af78f?w=1200&q=80&auto=format&fit=crop"
            alt="Парадная лестница с красной дорожкой"
            fill
            sizes="40vw"
            className="parallax-img object-cover"
          />
        </div>

        <div className="lg:col-span-7">
          <SectionTitle
            title="Как проходит бронирование"
            lead="Три банкетных зала, летняя терраса и ресторан в одном здании. Кухню, оформление, свет и звук готовит наша команда, от вас нужны дата и список гостей."
          />

          <ol className="mt-12 border-b border-night/12">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[3rem_1fr] gap-x-4 border-t border-night/12 py-6 sm:grid-cols-[4.5rem_1fr]">
                <span className="font-display text-4xl leading-none text-gold-dim sm:text-5xl">{i + 1}</span>
                <div>
                  <h3 className="text-lg font-medium text-night">{s.title}</h3>
                  <p className="mt-1 text-mute">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <a
            href="#booking"
            className="mt-10 inline-flex items-center rounded-full bg-night px-6 py-3.5 text-sm font-medium text-ivory transition-colors hover:bg-night-3"
          >
            Посмотреть свободные даты
          </a>
        </div>
      </div>
    </section>
  );
}
