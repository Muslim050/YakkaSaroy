import { MENU } from "@/lib/data";
import { BookingButton } from "./QuickCheck";
import { SectionTitle } from "./SectionTitle";

export function Menu() {
  return (
    <section id="menu" className="bg-stone py-24 lg:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionTitle
              title="Меню ресторана"
              lead="Узбекская кухня и несколько европейских блюд. Банкетное меню собираем под каждое торжество отдельно, здесь то, что заказывают чаще всего."
            />
            <BookingButton
              hall="restaurant"
              className="mt-8 inline-flex rounded-full bg-night px-6 py-3.5 text-sm font-medium text-ivory transition-colors hover:bg-night-3"
            >
              Забронировать столик
            </BookingButton>
          </div>

          <div className="lg:col-span-8">
            <div className="grid gap-10 sm:grid-cols-2 lg:gap-x-14">
              {MENU.map((group, gi) => (
                <div key={group.group} className={gi === 1 ? "sm:row-span-2" : ""}>
                  <h3 className="border-b border-night/15 pb-3 font-display text-3xl text-night">{group.group}</h3>
                  <ul className="mt-5 space-y-5">
                    {group.items.map((item) => (
                      <li key={item.name}>
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-ink">{item.name}</span>
                          <span className="flex-1 border-b border-dotted border-gold-dim/60" />
                          <span className="whitespace-nowrap text-sm text-ink">{item.price}</span>
                        </div>
                        <p className="mt-1 text-sm text-mute">{item.desc}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-10 text-sm text-mute">Цены в сумах. Банкетное меню от 250 000 сум за гостя, включает три подачи и чайный стол.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
