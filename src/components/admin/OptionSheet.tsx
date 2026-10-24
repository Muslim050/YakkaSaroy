"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSum } from "@/lib/bookings";
import type { Media, Price, ProgramCategory, ProgramOption } from "@/lib/program";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ErrorNote, Field, Section } from "./fields";
import { MediaEditor } from "./MediaEditor";

export type OptionTarget = { category: ProgramCategory; option: ProgramOption | null; nextOrder: number };

const PRICE_ITEMS: Record<Price["type"], string> = {
  included: "Входит в стоимость зала",
  perGuest: "Доплата за гостя",
  fixed: "Доплата за всё",
};

/** Create or edit one program option: texts, price, order, visibility, photos and videos. */
export function OptionSheet({ target, usage, uploads, onClose }: { target: OptionTarget | null; usage: Record<string, number>; uploads: boolean; onClose: () => void }) {
  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {target && <Body key={target.option?.id ?? `new-${target.category.id}`} target={target} usage={usage} uploads={uploads} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ target: { category, option, nextOrder }, usage, uploads, onDone }: { target: OptionTarget; usage: Record<string, number>; uploads: boolean; onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: option?.title ?? "",
    description: option?.description ?? "",
    priceType: option?.price.type ?? ("fixed" as Price["type"]),
    amount: option && option.price.type !== "included" ? String(option.price.amount) : "",
    order: String(option?.order ?? nextOrder),
    hidden: option?.hidden ?? false,
  });
  const [includes, setIncludes] = useState<string[]>(option?.includes.length ? option.includes : [""]);
  const [media, setMedia] = useState<Media[]>(option?.media ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const used = option ? (usage[option.id] ?? 0) : 0;

  const set = (k: "title" | "description" | "amount" | "order") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount.replace(/\s/g, ""));
    const price: Price = form.priceType === "included" ? { type: "included" } : { type: form.priceType, amount };
    const body = {
      title: form.title,
      description: form.description,
      includes: includes.map((x) => x.trim()).filter(Boolean),
      price,
      order: Number(form.order) || 0,
      hidden: form.hidden,
      media: media.map((m) => ({ ...m, alt: m.alt.trim() })),
    };
    setBusy(true);
    setError("");
    const r = option ? await api(`/api/admin/catalog/${option.id}`, "PATCH", body) : await api("/api/admin/catalog", "POST", { ...body, category: category.id });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
    onDone();
  }

  async function remove() {
    if (!option) return;
    setBusy(true);
    const r = await api(`/api/admin/catalog/${option.id}`, "DELETE");
    setBusy(false);
    if (!r.ok) {
      setRemoveOpen(false);
      return setError(r.error);
    }
    router.refresh();
    onDone();
  }

  const amountNumber = Number(form.amount.replace(/\s/g, ""));

  return (
    <>
      <SheetHeader className="border-b border-border px-6 py-5">
        <SheetTitle className="font-display text-2xl font-normal text-night">{option ? option.title : "Новый вариант"}</SheetTitle>
        <SheetDescription>
          {category.title}. {category.pick === "one" ? "Гость выбирает один вариант из раздела." : "Гость может выбрать несколько вариантов."}
          {used > 0 && ` Выбран в ${used} ${used === 1 ? "предстоящей брони" : "предстоящих бронях"}.`}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Section title="Что видит гость">
          <Field id="op-title" label="Название">
            <Input id="op-title" value={form.title} onChange={set("title")} required minLength={2} maxLength={80} placeholder="Например, «Той-дастурхан»" />
          </Field>
          <Field id="op-desc" label="Описание" hint="Одно-два предложения: чем вариант хорош.">
            <Textarea id="op-desc" value={form.description} onChange={set("description")} rows={3} maxLength={600} />
          </Field>
          <Field label="Что входит">
            <ul className="grid gap-2">
              {includes.map((x, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="size-1 shrink-0 rounded-full bg-gold" />
                  <Input
                    value={x}
                    onChange={(e) => setIncludes((list) => list.map((y, k) => (k === i ? e.target.value : y)))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setIncludes((list) => [...list.slice(0, i + 1), "", ...list.slice(i + 1)]);
                      }
                    }}
                    maxLength={140}
                    aria-label={`Пункт ${i + 1}`}
                    placeholder="Например, «12 салатов и закусок»"
                  />
                  <button
                    type="button"
                    aria-label="Убрать пункт"
                    onClick={() => setIncludes((list) => (list.length > 1 ? list.filter((_, k) => k !== i) : [""]))}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            {includes.length < 15 && (
              <button type="button" onClick={() => setIncludes((list) => [...list, ""])} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-ink">
                <Plus className="size-4" /> Добавить пункт
              </button>
            )}
          </Field>
        </Section>

        <Section title="Фото и видео">
          <MediaEditor category={category.id} title={form.title} media={media} uploads={uploads} onChange={setMedia} onBusy={setUploading} />
        </Section>

        <Section title="Цена">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Как считается">
              <Select items={PRICE_ITEMS} value={form.priceType} onValueChange={(v) => v && setForm((f) => ({ ...f, priceType: v as Price["type"] }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRICE_ITEMS) as Price["type"][]).map((k) => (
                    <SelectItem key={k} value={k}>{PRICE_ITEMS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {form.priceType !== "included" && (
              <Field id="op-amount" label={form.priceType === "perGuest" ? "Сумма за гостя, сум" : "Сумма, сум"} hint={amountNumber > 0 ? formatSum(amountNumber) : undefined}>
                <Input id="op-amount" value={form.amount} onChange={set("amount")} inputMode="numeric" required placeholder="5000000" />
              </Field>
            )}
          </div>
        </Section>

        <Section title="Показ" className="border-b-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="op-order" label="Порядок" hint="Меньше — выше в разделе.">
              <Input id="op-order" value={form.order} onChange={set("order")} type="number" step={1} />
            </Field>
            <Field label="Гостям">
              <button
                type="button"
                role="switch"
                aria-checked={!form.hidden}
                onClick={() => setForm((f) => ({ ...f, hidden: !f.hidden }))}
                className="flex h-8 items-center gap-2.5 text-left text-sm"
              >
                <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", form.hidden ? "bg-input" : "bg-night")}>
                  <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left]", form.hidden ? "left-0.5" : "left-[18px]")} />
                </span>
                {form.hidden ? "Скрыт, гости не видят" : "Показывается"}
              </button>
            </Field>
          </div>
          {form.hidden && used > 0 && <p className="text-xs text-muted-foreground">В бронях, где вариант уже выбран, он останется с пометкой «больше не предлагается».</p>}
        </Section>

        <div className="sticky bottom-0 mt-auto grid gap-3 border-t border-border bg-popover px-6 py-4">
          <ErrorNote error={error} />
          <div className="flex items-center gap-3">
            {option && (
              <button type="button" onClick={() => setRemoveOpen(true)} disabled={busy} className="h-10 rounded-lg px-3 text-sm text-rose-800 hover:bg-rose-50 disabled:opacity-60">
                Удалить
              </button>
            )}
            <button
              type="submit"
              disabled={busy || uploading}
              className="ml-auto h-10 min-w-40 rounded-lg bg-night px-4 text-sm font-medium text-ivory transition-colors hover:bg-night-3 disabled:opacity-60"
            >
              {uploading ? "Дождитесь загрузки" : busy ? "Сохраняем" : option ? "Сохранить" : "Добавить вариант"}
            </button>
          </div>
        </div>
      </form>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить «{option?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Гости больше не увидят этот вариант.
              {used > 0
                ? ` Он выбран в ${used} ${used === 1 ? "предстоящей брони" : "предстоящих бронях"}: там он останется с пометкой «больше не предлагается».`
                : " Если нужно убрать его только на время, лучше скрыть."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Не удалять</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-700 text-white hover:bg-rose-800" onClick={remove}>
              Удалить вариант
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
