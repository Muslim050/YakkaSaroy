export type HallId = "grand" | "small" | "terrace" | "restaurant";
export type SlotId = "day" | "evening";

export const RESTAURANT_HOURS = ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];
export const RESTAURANT_TABLES = 24;

export const HALLS: {
  id: HallId;
  name: string;
  bestFor: string;
  seats: string;
  capacity: string;
  guestsMax: number;
  description: string;
  features: string[];
  image: string;
  price: string;
}[] = [
  {
    id: "grand",
    name: "Большой зал",
    bestFor: "Свадьбы",
    seats: "300–800",
    capacity: "от 300 до 800 гостей",
    guestsMax: 800,
    description:
      "Колонны, зеркальные стены и сцена со светом и звуком. Молодые выходят к гостям по красной дорожке, в углу играет оркестр.",
    features: ["Сцена и световое шоу", "Собственный оркестр", "Отдельный вход для молодожёнов", "Гардероб и зона фотосессии"],
    image: "https://images.unsplash.com/photo-1629030276727-ccbee4f883e2?w=1600&q=80&auto=format&fit=crop",
    price: "от 350 000 сум за гостя",
  },
  {
    id: "small",
    name: "Малый зал",
    bestFor: "Никох, юбилеи, корпоративы",
    seats: "80–250",
    capacity: "от 80 до 250 гостей",
    guestsMax: 250,
    description:
      "Тёплый свет люстр и круглые столы на десять человек. Зал небольшой, гости видят и слышат друг друга.",
    features: ["Круглые столы на 10 персон", "Экран для видеопоздравлений", "Отдельная детская зона", "Собственный бар"],
    image: "https://images.unsplash.com/photo-1777652564099-d2c1571a3cd9?w=1600&q=80&auto=format&fit=crop",
    price: "от 300 000 сум за гостя",
  },
  {
    id: "terrace",
    name: "Летняя терраса",
    bestFor: "Летние вечера, с мая по октябрь",
    seats: "40–150",
    capacity: "от 40 до 150 гостей",
    guestsMax: 150,
    description:
      "Сад с фонтаном, гирлянды над столами и вид на подсвеченный фасад. В прохладные вечера включаем обогреватели.",
    features: ["Фонтан и вечерняя подсветка", "Живая музыка", "Обогреватели и навес", "Мангал-меню"],
    image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1600&q=80&auto=format&fit=crop",
    price: "от 250 000 сум за гостя",
  },
  {
    id: "restaurant",
    name: "Ресторан",
    bestFor: "Ужин без повода",
    seats: "2–12",
    capacity: "столики на 2–12 персон",
    guestsMax: 12,
    description:
      "Плов, кебабы на углях и десерты каждый день. Столик бронируется на конкретный час, приходите без очереди.",
    features: ["Открыт ежедневно с 12:00 до 23:00", "Детское меню", "Кальянная зона", "Парковка"],
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80&auto=format&fit=crop",
    price: "средний чек 180 000 сум",
  },
];

export const SLOTS: { id: SlotId; name: string; time: string }[] = [
  { id: "day", name: "Дневное торжество", time: "12:00–17:00" },
  { id: "evening", name: "Вечернее торжество", time: "18:00–23:30" },
];

export const EVENT_TYPES = ["Свадьба", "Никох", "Юбилей", "Бешик-той", "Корпоратив", "Выпускной", "Другое"];

export const MENU = [
  {
    group: "Холодные закуски",
    items: [
      { name: "Ачичук с базиликом", desc: "Помидоры, лук, жгучий перец, зелень", price: "35 000" },
      { name: "Казы с хреном", desc: "Домашняя конская колбаса, маринованный лук", price: "95 000" },
      { name: "Сырное плато", desc: "Пять сортов, мёд, грецкий орех, инжир", price: "140 000" },
    ],
  },
  {
    group: "Горячее",
    items: [
      { name: "Той-плов", desc: "Баранина, жёлтая морковь, нут, казы, перепелиные яйца", price: "75 000" },
      { name: "Шашлык ассорти", desc: "Баранина, говядина, курица, люля, овощи на углях", price: "165 000" },
      { name: "Тандыр-кабоб", desc: "Томится в тандыре четыре часа, подаётся с лепёшкой", price: "120 000" },
      { name: "Стейк рибай", desc: "Мраморная говядина, соус из чёрного перца", price: "240 000" },
    ],
  },
  {
    group: "Десерты и чай",
    items: [
      { name: "Пахлава по-ташкентски", desc: "Грецкий орех, мёд, слоёное тесто", price: "40 000" },
      { name: "Чак-чак", desc: "Готовим утром, подаём с зелёным чаем", price: "30 000" },
      { name: "Чайная церемония", desc: "Кок-чой, лимон, навват, парварда", price: "25 000" },
    ],
  },
];

export const GALLERY: { src: string; alt: string; ratio: "wide" | "tall" }[] = [
  { src: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1600&q=80&auto=format&fit=crop", alt: "Зал с круглыми столами перед банкетом", ratio: "wide" },
  { src: "https://images.unsplash.com/photo-1769981493694-0560b2ac128b?w=1000&q=80&auto=format&fit=crop", alt: "Люстра и бордовые шторы", ratio: "tall" },
  { src: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1600&q=80&auto=format&fit=crop", alt: "Длинный банкетный стол с цветами", ratio: "wide" },
  { src: "https://images.unsplash.com/photo-1769018508631-fe4ebf3fba3a?w=1000&q=80&auto=format&fit=crop", alt: "Хрустальная люстра под лепным потолком", ratio: "tall" },
  { src: "https://images.unsplash.com/photo-1555244162-803834f70033?w=1600&q=80&auto=format&fit=crop", alt: "Горячие блюда на банкетном столе", ratio: "wide" },
  { src: "https://images.unsplash.com/photo-1776671069226-24e6d422a61b?w=1000&q=80&auto=format&fit=crop", alt: "Зал с рядами светильников", ratio: "tall" },
  { src: "https://images.unsplash.com/photo-1529636798458-92182e662485?w=1600&q=80&auto=format&fit=crop", alt: "Арка с цветами для церемонии", ratio: "wide" },
];

export const CONTACTS = {
  address: "Ташкент, Яккасарайский район, ул. Абдуллы Каххара, 40Г",
  phone: "+998 71 000 00 00",
  phoneHref: "tel:+998710000000",
  email: "info@yakkasaroy.com",
  instagram: "https://instagram.com/yakkasaroy.uz",
  hours: "Ежедневно с 12:00 до 23:00",
  mapQuery: "Yakka Saroy, Abdulla Qahhor ko'chasi 40, Tashkent",
};
