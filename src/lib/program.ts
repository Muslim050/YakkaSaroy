/**
 * Event program: what a banquet consists of besides the hall. Guests pick it in the
 * cabinet, managers in the admin. Every option carries photos or video so the choice
 * is made by looking, not by reading.
 *
 * The catalog itself lives in the store and is edited in the admin (/admin/catalog);
 * the server reads it and hands it to the components, so every helper here takes it
 * as an argument. Bookings keep option ids, so an option a manager hides or deletes
 * stays readable in old bookings ("больше не предлагается").
 */

export type Media =
  | { kind: "image"; src: string; alt: string }
  /** poster is the still shown before the video plays; uploads get one made in the browser. */
  | { kind: "video"; src: string; poster?: string; alt: string };

export type Price = { type: "included" } | { type: "perGuest"; amount: number } | { type: "fixed"; amount: number };

export type ProgramOption = {
  id: string;
  title: string;
  description: string;
  includes: string[];
  price: Price;
  media: Media[];
  /** Position inside the category, smaller first. */
  order: number;
  /** Not offered for new choices; bookings that already have it keep it. */
  hidden?: boolean;
  /** Deleted in the admin: gone from the lists, kept only so old bookings can show it. */
  archived?: boolean;
};

export type CategoryId = "menu" | "decor" | "show" | "cake" | "photo";

export type ProgramCategory = {
  id: CategoryId;
  title: string;
  /** one: exactly one or none; many: any number */
  pick: "one" | "many";
  /** one-of categories that always have a choice (the included option by default) */
  required?: boolean;
  hint: string;
  options: ProgramOption[];
};

export type Catalog = ProgramCategory[];

export type ProgramSelection = Partial<Record<CategoryId, string[]>>;

const byOrder = (a: ProgramOption, b: ProgramOption) => a.order - b.order || a.title.localeCompare(b.title, "ru");

/** Options a guest can pick right now, in the manager's order. */
export function offered(c: ProgramCategory) {
  return c.options.filter((o) => !o.hidden && !o.archived).sort(byOrder);
}

/** Options a manager works with: everything except deleted ones. */
export function editable(c: ProgramCategory) {
  return c.options.filter((o) => !o.archived).sort(byOrder);
}

export function isOffered(o: ProgramOption) {
  return !o.hidden && !o.archived;
}

export function findOption(catalog: Catalog, id: string) {
  for (const category of catalog) {
    const option = category.options.find((o) => o.id === id);
    if (option) return { category, option };
  }
  return null;
}

/** Required categories start on their included option. */
export function defaultSelection(catalog: Catalog): ProgramSelection {
  const sel: ProgramSelection = {};
  for (const c of catalog) {
    if (!c.required) continue;
    const list = offered(c);
    const inc = list.find((o) => o.price.type === "included") ?? list[0];
    if (inc) sel[c.id] = [inc.id];
  }
  return sel;
}

/**
 * Validate a selection from the outside; returns the cleaned selection or an error.
 * Options no longer offered are accepted only if the booking already had them.
 */
export function normalizeSelection(
  catalog: Catalog,
  input: unknown,
  previous?: ProgramSelection,
): { ok: true; value: ProgramSelection } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Не удалось прочитать выбор" };
  const out = defaultSelection(catalog);
  for (const c of catalog) {
    const raw = (input as Record<string, unknown>)[c.id];
    if (raw === undefined) continue;
    if (!Array.isArray(raw) || !raw.every((x) => typeof x === "string")) return { ok: false, error: `Неверный выбор: ${c.title.toLowerCase()}` };
    const ids = [...new Set(raw as string[])];
    const kept = new Set(previous?.[c.id] ?? []);
    const allowed = (id: string) => kept.has(id) || c.options.some((o) => o.id === id && isOffered(o));
    if (!ids.every(allowed)) return { ok: false, error: `Этого варианта уже нет: ${c.title.toLowerCase()}. Обновите страницу.` };
    if (c.pick === "one" && ids.length > 1) return { ok: false, error: `${c.title}: выберите один вариант` };
    if (c.required && ids.length === 0) continue; // keep the default
    out[c.id] = ids;
  }
  return { ok: true, value: out };
}

/** Selection with defaults filled in, for bookings made before the program existed. */
export function withDefaults(catalog: Catalog, sel: ProgramSelection | undefined): ProgramSelection {
  return { ...defaultSelection(catalog), ...(sel ?? {}) };
}

export function optionCost(price: Price, guests: number) {
  if (price.type === "perGuest") return price.amount * guests;
  if (price.type === "fixed") return price.amount;
  return 0;
}

/** Cost of everything chosen on top of the hall price. Unknown ids cost nothing. */
export function programCost(catalog: Catalog, sel: ProgramSelection | undefined, guests: number) {
  let total = 0;
  for (const ids of Object.values(withDefaults(catalog, sel)))
    for (const id of ids ?? []) total += optionCost(findOption(catalog, id)?.option.price ?? { type: "included" }, guests);
  return total;
}

/** Stand-in for an id that is not in the catalog at all any more. */
function missingOption(id: string): ProgramOption {
  return { id, title: "Вариант удалён из каталога", description: "", includes: [], price: { type: "included" }, media: [], order: 0, archived: true };
}

/** Chosen options in catalog order; `gone` marks the ones no longer offered. */
export function selectedOptions(catalog: Catalog, sel: ProgramSelection | undefined) {
  const s = withDefaults(catalog, sel);
  return catalog.flatMap((category) =>
    (s[category.id] ?? []).map((id) => {
      const option = category.options.find((o) => o.id === id) ?? missingOption(id);
      return { category, option, gone: !isOffered(option) };
    }),
  );
}

/** One readable history line, e.g. "Программа: меню — Той-дастурхан, добавлено: Живой оркестр". */
export function describeChange(catalog: Catalog, before: ProgramSelection | undefined, after: ProgramSelection) {
  const a = withDefaults(catalog, before);
  const b = withDefaults(catalog, after);
  const parts: string[] = [];
  const name = (id: string) => findOption(catalog, id)?.option.title ?? id;
  for (const c of catalog) {
    const was = new Set(a[c.id] ?? []);
    const now = new Set(b[c.id] ?? []);
    if (c.pick === "one") {
      const w = [...was][0];
      const n = [...now][0];
      if (w !== n) parts.push(n ? `${c.title.toLowerCase()}: ${name(n)}` : `${c.title.toLowerCase()}: убран`);
    } else {
      const added = [...now].filter((x) => !was.has(x)).map(name);
      const removed = [...was].filter((x) => !now.has(x)).map(name);
      if (added.length) parts.push(`добавлено: ${added.join(", ")}`);
      if (removed.length) parts.push(`убрано: ${removed.join(", ")}`);
    }
  }
  return parts.length ? `Программа: ${parts.join("; ")}` : null;
}

/** Hosts next/image may resize (see images.remotePatterns); links to anything else are shown as they are. */
const OPTIMIZED_HOSTS = [/^images\.unsplash\.com$/, /^assets\.mixkit\.co$/, /\.public\.blob\.vercel-storage\.com$/];

export function canOptimize(src: string) {
  if (src.startsWith("/")) return true;
  try {
    const host = new URL(src).hostname;
    return OPTIMIZED_HOSTS.some((re) => re.test(host));
  } catch {
    return false;
  }
}
