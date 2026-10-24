import type { Catalog, Media, ProgramCategory, ProgramOption } from "./program";

/**
 * The first version of the program catalog. The store copies it once; after that
 * managers edit the catalog in the admin and this file is only a starting point.
 *
 * Media are placeholders: photos from Unsplash, video from Mixkit (both free licenses).
 * Replace them with Yakka Saroy's own shots in the admin before launch.
 */

type SeedCategory = Omit<ProgramCategory, "options"> & { options: Omit<ProgramOption, "order">[] };

const img = (id: string, alt: string): Media => ({
  kind: "image",
  src: `https://images.unsplash.com/${id}?w=1400&q=80&auto=format&fit=crop`,
  alt,
});
const vid = (id: number, alt: string): Media => ({
  kind: "video",
  src: `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`,
  poster: `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`,
  alt,
});

const SEED: SeedCategory[] = [
  {
    id: "menu",
    title: "Банкетное меню",
    pick: "one",
    required: true,
    hint: "Одно меню на всех гостей. Узбекская классика уже входит в стоимость зала.",
    options: [
      {
        id: "menu-classic",
        title: "Узбекская классика",
        description: "Той-плов в казане на весь зал, шашлык на углях и щедрый стол закусок.",
        includes: ["Той-плов с казы и перепелиными яйцами", "Шашлык ассорти", "8 салатов и закусок", "Фрукты и чайный стол"],
        price: { type: "included" },
        media: [img("photo-1671048116127-6c9369284699", "Той-плов на блюде"), vid(31741, "Шашлык на мангале"), img("photo-1661685452870-e89b6e8c14fa", "Стол с закусками")],
      },
      {
        id: "menu-dastarkhan",
        title: "Той-дастурхан",
        description: "Большой праздничный стол: всё из классики и вдвое больше закусок, два горячих и национальные сладости.",
        includes: ["Казы, нарын и самса из тандыра", "12 салатов и закусок", "Два горячих на выбор", "Пахлава, чак-чак, парварда"],
        price: { type: "perGuest", amount: 60_000 },
        media: [img("photo-1661685452870-e89b6e8c14fa", "Праздничный дастархан"), vid(6969, "Угли для тандыра и мангала"), img("photo-1729370146699-d552925ab445", "Кебаб с рисом и овощами")],
      },
      {
        id: "menu-premium",
        title: "Европейский премиум",
        description: "Авторская подача от шефа и фуршет с шампанским, пока гости собираются.",
        includes: ["Фуршет при встрече гостей", "Стейки и рыба на гриле", "Подача каждого блюда официантом", "Десертный стол"],
        price: { type: "perGuest", amount: 120_000 },
        media: [vid(13261, "Шеф завершает подачу блюда"), img("photo-1414235077428-338989a2e8c0", "Подача в ресторане"), vid(51554, "Бокалы шампанского на фуршете")],
      },
    ],
  },
  {
    id: "decor",
    title: "Оформление зала",
    pick: "one",
    required: true,
    hint: "Один стиль на весь зал. Белое и золото входит в стоимость.",
    options: [
      {
        id: "decor-classic",
        title: "Белое и золото",
        description: "Белые скатерти до пола, золотые стулья и свечи на каждом столе.",
        includes: ["Скатерти и чехлы", "Стулья кьявари", "Свечи на столах", "Подсветка зала"],
        price: { type: "included" },
        media: [img("photo-1676734627786-a3662ff6a243", "Круглые столы в белом"), vid(3453, "Свечи на столах"), img("photo-1519167758481-83f550bb49b3", "Зал с люстрами перед банкетом")],
      },
      {
        id: "decor-flowers",
        title: "Живые цветы и арка",
        description: "Цветочная арка для молодых, композиции на каждом столе и цветы под потолком.",
        includes: ["Арка из живых цветов", "Композиция на каждый стол", "Цветы и подвесы под потолком", "Лепестки на дорожке"],
        price: { type: "fixed", amount: 18_000_000 },
        media: [img("photo-1529636798458-92182e662485", "Цветочная арка"), vid(5213, "Цветы и подвесы под потолком"), img("photo-1511795409834-ef04bbd61622", "Длинный стол с цветами"), vid(18204, "Букет из белых роз")],
      },
      {
        id: "decor-oriental",
        title: "Восточный стиль",
        description: "Сцена молодых в красном и золоте, сюзане ручной работы, бархат и медь.",
        includes: ["Сцена молодых", "Сюзане на стенах и столах", "Бархатные скатерти", "Медные светильники"],
        price: { type: "fixed", amount: 15_000_000 },
        media: [img("photo-1745573674471-e057af420757", "Сцена молодых в красном и золоте"), img("photo-1791598639401-26748dda45a7", "Сюзане ручной работы"), img("photo-1791598639278-0bf45597d2eb", "Вышивка сюзане")],
      },
      {
        id: "decor-greenery",
        title: "Зелень и свечи",
        description: "Длинные столы с гирляндами из эвкалипта, много свечей и тёплый свет.",
        includes: ["Гирлянды из зелени по столам", "Свечи в стекле", "Деревянные подставки", "Тёплая подсветка"],
        price: { type: "fixed", amount: 12_000_000 },
        media: [img("photo-1522413452208-996ff3f3e740", "Стол с гирляндой из зелени"), vid(5227, "Банкетный стол сверху"), img("photo-1561593367-66c79c2294e6", "Длинный стол в зелени")],
      },
    ],
  },
  {
    id: "show",
    title: "Программа и музыка",
    pick: "many",
    hint: "Можно выбрать несколько или ничего.",
    options: [
      {
        id: "show-orchestra",
        title: "Живой оркестр",
        description: "Струнный состав на встречу гостей и вечер, плюс эстрадные музыканты на танцы.",
        includes: ["Струнный квартет на встречу", "Живой звук весь вечер", "Музыка на выход молодых"],
        price: { type: "fixed", amount: 8_000_000 },
        media: [vid(21758, "Струнный оркестр"), img("photo-1641835951289-f289458718ca", "Квартет на торжестве"), img("photo-1644940679345-abe04b74d863", "Скрипач")],
      },
      {
        id: "show-dj",
        title: "Диджей и световое шоу",
        description: "Танцевальная часть со световыми экранами и дымом.",
        includes: ["Диджей до конца вечера", "Световые панели и лучи", "Тяжёлый дым на первый танец"],
        price: { type: "fixed", amount: 5_000_000 },
        media: [vid(4187, "Диджей на сцене со световыми экранами"), vid(344, "Гости на танцполе")],
      },
      {
        id: "show-sparklers",
        title: "Выход молодых с огнями",
        description: "Холодные фонтаны и бенгальские огни для гостей на выходе молодых.",
        includes: ["Холодные фонтаны у сцены", "Бенгальские огни для гостей", "Безопасно в помещении"],
        price: { type: "fixed", amount: 4_000_000 },
        media: [img("photo-1622580627606-645c16c2fd2f", "Молодые среди бенгальских огней"), vid(45743, "Фейерверк над парой"), img("photo-1473652502225-6b6af0664e32", "Гости с огнями")],
      },
    ],
  },
  {
    id: "cake",
    title: "Торт",
    pick: "one",
    hint: "Один торт или без торта. Нажмите ещё раз, чтобы отменить выбор.",
    options: [
      {
        id: "cake-roses",
        title: "Классический с розами",
        description: "Четыре яруса, бисквит с ягодами и сливочный крем, розы из мастики.",
        includes: ["4 яруса, около 12 кг", "Начинка на выбор", "Подставка и нож для разрезания"],
        price: { type: "fixed", amount: 3_500_000 },
        media: [img("photo-1525257831700-183b9b8bf5c4", "Торт с розами"), vid(50017, "Кондитер покрывает торт кремом")],
      },
      {
        id: "cake-flowers",
        title: "Нежный с живыми цветами",
        description: "Белый торт с живыми цветами и ягодами, украшаем в день торжества.",
        includes: ["4 яруса, около 12 кг", "Живые цветы и ягоды", "Подставка и нож для разрезания"],
        price: { type: "fixed", amount: 4_200_000 },
        media: [img("photo-1535254973040-607b474cb50d", "Торт с живыми цветами"), img("photo-1623428454614-abaf00244e52", "Ярусный торт с ягодами")],
      },
      {
        id: "cake-mini",
        title: "Минималистичный",
        description: "Два яруса без лишнего декора, для никоха и камерных торжеств.",
        includes: ["2 яруса, около 5 кг", "Начинка на выбор"],
        price: { type: "fixed", amount: 1_800_000 },
        media: [img("photo-1595272568891-123402d0fb3b", "Небольшой белый торт")],
      },
    ],
  },
  {
    id: "photo",
    title: "Фото и видео",
    pick: "many",
    hint: "Можно выбрать оба варианта.",
    options: [
      {
        id: "photo-photographer",
        title: "Фотограф на весь вечер",
        description: "Репортаж с утра до конца торжества и прогулка молодых.",
        includes: ["До 10 часов съёмки", "500+ обработанных фото", "Готово через 3 недели"],
        price: { type: "fixed", amount: 5_000_000 },
        media: [img("photo-1623783356340-95375aac85ce", "Фотограф снимает молодых"), img("photo-1622277430358-f4d134452e2e", "Невеста у окна"), img("photo-1519741497674-611481863552", "Букет невесты")],
      },
      {
        id: "photo-video",
        title: "Видеосъёмка и клип",
        description: "Фильм о вашем дне и короткий клип для соцсетей.",
        includes: ["Две камеры", "Фильм на 40–60 минут", "Клип на 3 минуты"],
        price: { type: "fixed", amount: 7_000_000 },
        media: [vid(40601, "Молодые позируют"), vid(44076, "Видеокамера на съёмке"), vid(40591, "Невеста с букетом")],
      },
    ],
  },
];

/** Options keep their written order, spaced by ten so a new one fits in between. */
export function seedCatalog(): Catalog {
  return structuredClone(SEED).map((c) => ({ ...c, options: c.options.map((o, i) => ({ ...o, order: (i + 1) * 10 })) }));
}
