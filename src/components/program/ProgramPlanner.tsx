"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDay, formatSum, formatSumShort, hallCost, hallName, slotLabel, type Booking } from "@/lib/bookings";
import { HALLS } from "@/lib/data";
import {
  defaultSelection,
  offered,
  optionCost,
  programCost,
  selectedOptions,
  withDefaults,
  type Catalog,
  type ProgramCategory,
  type ProgramOption,
  type ProgramSelection,
} from "@/lib/program";
import { OptionCard } from "./OptionCard";

type PlannerBooking = Pick<Booking, "id" | "code" | "hall" | "date" | "slot" | "guests" | "eventType" | "extras">;

const canon = (catalog: Catalog, s: ProgramSelection) => catalog.map((c) => [...(s[c.id] ?? [])].sort().join(",")).join("|");

/** What a category shows: the options on offer, plus ones this booking chose before they were taken off. */
function visible(c: ProgramCategory, saved: ProgramSelection) {
  const list: { option: ProgramOption; gone: boolean }[] = offered(c).map((option) => ({ option, gone: false }));
  for (const id of saved[c.id] ?? []) {
    const option = c.options.find((o) => o.id === id);
    if (option && !list.some((x) => x.option.id === id)) list.push({ option, gone: true });
  }
  return list;
}

/** Menu, decor, show, cake and photo for one banquet, chosen by looking at photos and video. */
export function ProgramPlanner({
  booking: b,
  catalog,
  endpoint,
  editable,
  lockedNote,
  back,
}: {
  booking: PlannerBooking;
  catalog: Catalog;
  endpoint: string;
  editable: boolean;
  lockedNote?: string;
  back: { href: string; label: string };
}) {
  const router = useRouter();
  const saved = useMemo(() => withDefaults(catalog, b.extras), [catalog, b.extras]);
  const [sel, setSel] = useState<ProgramSelection>(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = canon(catalog, sel) !== canon(catalog, saved);
  const hall = hallCost(b) ?? 0;
  const extra = programCost(catalog, sel, b.guests);
  const chosen = selectedOptions(catalog, sel);
  const sections = catalog.map((c) => ({ category: c, items: visible(c, saved) })).filter((s) => s.items.length > 0);
  const pricePerGuest = HALLS.find((h) => h.id === b.hall)?.pricePerGuest ?? 0;

  function toggle(c: ProgramCategory, id: string) {
    setMsg(null);
    setSel((s) => {
      const cur = s[c.id] ?? [];
      const on = cur.includes(id);
      let next: string[];
      const gone = !offered(c).some((o) => o.id === id);
      // A required choice that is no longer offered falls back to the default when removed.
      if (c.pick === "one") next = on ? (c.required ? (gone ? (defaultSelection(catalog)[c.id] ?? []) : cur) : []) : [id];
      else next = on ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...s, [c.id]: next };
    });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extras: sel }) });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Не получилось сохранить" });
    setMsg({ ok: true, text: "Программа сохранена, менеджер её видит" });
    router.refresh();
  }

  return (
    <div className="pb-28 lg:pb-0">
      <Link href={back.href} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4" /> {back.label}
      </Link>
      <div className="mb-8 mt-4">
        <h1 className="font-display text-4xl leading-none text-night sm:text-5xl">Программа торжества</h1>
        <p className="mt-3 text-[15px] text-mute">
          {b.eventType ?? "Торжество"}, {hallName(b.hall).toLowerCase()}, {formatDay(b.date, true)}, {slotLabel(b.hall, b.slot)}, {b.guests} гостей. Бронь {b.code}.
        </p>
      </div>

      {!editable && lockedNote && (
        <p className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-ink/80">
          <Lock className="mt-0.5 size-4 shrink-0 text-gold-dim" /> {lockedNote}
        </p>
      )}

      <nav aria-label="Разделы программы" className="scroll-x -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:sticky lg:top-16 lg:z-30 lg:-mx-2 lg:bg-ivory/90 lg:px-2 lg:py-3 lg:backdrop-blur">
        {sections.map(({ category: c }) => {
          const n = sel[c.id]?.length ?? 0;
          return (
            <a key={c.id} href={`#cat-${c.id}`} className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-ink hover:border-night/40">
              {c.title}
              {n > 0 && <span className="grid size-5 place-items-center rounded-full bg-night text-[11px] text-ivory">{n}</span>}
            </a>
          );
        })}
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-12">
        <div className="grid gap-16">
          {sections.map(({ category: c, items }) => (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-36">
              <div className="mb-5">
                <h2 className="font-display text-3xl text-night">{c.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{c.hint}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map(({ option: o, gone }) => (
                  <OptionCard
                    key={o.id}
                    option={o}
                    category={c}
                    guests={b.guests}
                    gone={gone}
                    selected={(sel[c.id] ?? []).includes(o.id)}
                    disabled={!editable || busy}
                    onToggle={() => toggle(c, o.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* summary, like a receipt */}
        <aside className="h-fit rounded-xl border border-border bg-card lg:sticky lg:top-36">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-2xl text-night">Ваш выбор</h2>
          </div>
          <ul className="grid gap-3 px-5 py-4 text-sm">
            <li className="flex justify-between gap-4">
              <span>
                {hallName(b.hall)}
                <span className="block text-xs text-muted-foreground">
                  {b.guests} × {formatSum(pricePerGuest)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{formatSumShort(hall)}</span>
            </li>
            {chosen.map(({ category, option, gone }) => {
              const cost = optionCost(option.price, b.guests);
              return (
                <li key={option.id} className="flex justify-between gap-4">
                  <span className="min-w-0">
                    {option.title}
                    <span className="block text-xs text-muted-foreground">
                      {category.title}
                      {gone && ", больше не предлагается"}
                    </span>
                  </span>
                  <span className={cn("shrink-0 tabular-nums", !cost && "text-muted-foreground")}>{cost ? `+${formatSumShort(cost)}` : "входит"}</span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border px-5 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Итого, примерно</span>
              <span className="font-display text-3xl text-night tabular-nums">{formatSumShort(hall + extra)}</span>
            </div>
            <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">{formatSum(hall + extra)}</p>
          </div>
          {editable && (
            <div className="hidden border-t border-border px-5 py-4 lg:block">
              <SaveButton busy={busy} dirty={dirty} onSave={save} />
              {msg && <p role="status" className={cn("mt-2 text-sm", msg.ok ? "text-emerald-800" : "text-rose-800")}>{msg.text}</p>}
            </div>
          )}
        </aside>
      </div>

      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
            <span>
              <span className="block text-xs text-muted-foreground">Итого, примерно</span>
              <span className="font-display text-2xl text-night tabular-nums">{formatSumShort(hall + extra)}</span>
            </span>
            <div className="w-44">
              <SaveButton busy={busy} dirty={dirty} onSave={save} />
            </div>
          </div>
          {msg && <p role="status" className={cn("mx-auto mt-1 max-w-xl text-xs", msg.ok ? "text-emerald-800" : "text-rose-800")}>{msg.text}</p>}
        </div>
      )}
    </div>
  );
}

function SaveButton({ busy, dirty, onSave }: { busy: boolean; dirty: boolean; onSave: () => void }) {
  return (
    <button
      type="button"
      disabled={busy || !dirty}
      onClick={onSave}
      className="h-11 w-full rounded-lg bg-night text-sm font-medium text-ivory transition-colors hover:bg-night-3 disabled:opacity-50"
    >
      {busy ? "Сохраняем" : dirty ? "Сохранить программу" : "Всё сохранено"}
    </button>
  );
}
