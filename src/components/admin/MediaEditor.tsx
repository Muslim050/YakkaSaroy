"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ArrowDown, ArrowUp, Expand, ImagePlus, Link2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryId, Media } from "@/lib/program";
import { UPLOAD_MAX_BYTES, UPLOAD_TYPES } from "@/lib/uploads";
import { Input } from "@/components/ui/input";
import { MediaThumb } from "@/components/program/MediaView";
import { Lightbox } from "@/components/program/Lightbox";

type Pending = { key: string; name: string; percent: number; error?: string };

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** "Свадьба в зале.MOV" -> "svadba-v-zale.mov"-like safe names; Blob adds a random suffix. */
function blobPath(category: CategoryId, name: string, folder = "") {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";
  return `catalog/${category}/${folder}${base}${ext ? `.${ext}` : ""}`;
}

function captionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return (dot > 0 ? name.slice(0, dot) : name).replace(/[_-]+/g, " ").trim().slice(0, 120);
}

/** A still from about a second into the video, made in the browser, for the poster. */
async function videoPoster(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 10_000));
  const work = (async () => {
    await new Promise((res, rej) => {
      video.onloadeddata = res;
      video.onerror = rej;
    });
    video.currentTime = Math.min(1, (video.duration || 0) / 3);
    await new Promise((res) => (video.onseeked = res));
    const w = Math.min(1280, video.videoWidth);
    const h = Math.round((video.videoHeight * w) / video.videoWidth);
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
    return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
  })().catch(() => null);
  try {
    return await Promise.race([work, timeout]);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const send = (path: string, body: Blob, contentType: string, onProgress?: (p: number) => void) =>
  upload(path, body, {
    access: "public",
    handleUploadUrl: "/api/admin/catalog/upload",
    contentType,
    // Big videos go in parallel parts with retries.
    multipart: body.size > 50 * 1024 * 1024,
    onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
  });

/**
 * Photos and videos of one option: upload straight from the browser to Vercel Blob
 * (no 4.5 MB function limit), or paste a link when no storage is connected.
 */
export function MediaEditor({
  category,
  title,
  media,
  uploads,
  onChange,
  onBusy,
}: {
  category: CategoryId;
  title: string;
  media: Media[];
  uploads: boolean;
  onChange: React.Dispatch<React.SetStateAction<Media[]>>;
  onBusy: (busy: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const running = useRef(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const [view, setView] = useState<number | null>(null);
  const [link, setLink] = useState({ open: !uploads, src: "", poster: "", kind: "image" as Media["kind"], error: "" });

  const patch = (i: number, m: Partial<Media>) => onChange((cur) => cur.map((x, k) => (k === i ? ({ ...x, ...m } as Media) : x)));
  const move = (i: number, d: number) =>
    onChange((cur) => {
      const next = [...cur];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  const setOne = (key: string, p: Partial<Pending>) => setPending((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    const jobs: Pending[] = list.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, percent: 0 }));
    setPending((p) => [...p, ...jobs]);
    if (fileRef.current) fileRef.current.value = "";
    running.current += list.length;
    onBusy(true);
    await Promise.all(
      list.map(async (file, i) => {
        const key = jobs[i].key;
        const done = () => {
          running.current -= 1;
          if (running.current === 0) onBusy(false);
        };
        if (!UPLOAD_TYPES.includes(file.type)) {
          setOne(key, { error: "Подходят фото JPG, PNG, WebP, AVIF и видео MP4, WebM, MOV" });
          return done();
        }
        if (file.size > UPLOAD_MAX_BYTES) {
          setOne(key, { error: "Файл больше 500 МБ" });
          return done();
        }
        try {
          const isVideo = file.type.startsWith("video/");
          const blob = await send(blobPath(category, file.name), file, file.type, (percent) => setOne(key, { percent }));
          let item: Media;
          if (isVideo) {
            const still = await videoPoster(file);
            const poster = still ? (await send(blobPath(category, `${file.name}.jpg`, "posters/"), still, "image/jpeg")).url : undefined;
            item = { kind: "video", src: blob.url, alt: captionOf(file.name), ...(poster ? { poster } : {}) };
          } else {
            item = { kind: "image", src: blob.url, alt: captionOf(file.name) };
          }
          onChange((cur) => [...cur, item]);
          setPending((p) => p.filter((x) => x.key !== key));
        } catch (e) {
          setOne(key, { error: e instanceof Error && e.message ? `Не загрузилось: ${e.message}` : "Не загрузилось, попробуйте ещё раз" });
        }
        done();
      }),
    );
  }

  function addLink() {
    const src = link.src.trim();
    const poster = link.poster.trim();
    if (!/^https:\/\/\S+$/.test(src)) return setLink((l) => ({ ...l, error: "Ссылка должна начинаться с https://" }));
    if (poster && !/^https:\/\/\S+$/.test(poster)) return setLink((l) => ({ ...l, error: "Ссылка на обложку должна начинаться с https://" }));
    const item: Media = link.kind === "video" ? { kind: "video", src, alt: "", ...(poster ? { poster } : {}) } : { kind: "image", src, alt: "" };
    onChange((cur) => [...cur, item]);
    setLink((l) => ({ ...l, src: "", poster: "", error: "" }));
  }

  return (
    <div className="grid gap-3">
      {media.length > 0 ? (
        <ul className="grid gap-2">
          {media.map((m, i) => (
            <li key={`${i}-${m.src}`} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
              <button
                type="button"
                onClick={() => setView(i)}
                aria-label="Посмотреть крупно"
                className="group relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-night"
              >
                <MediaThumb media={m} sizes="80px" />
                <span className="absolute inset-0 grid place-items-center bg-night/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Expand className="size-4 text-ivory" />
                </span>
              </button>
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="text-[11px] text-muted-foreground">
                  {i === 0 ? "Обложка, " : ""}
                  {m.kind === "image" ? "фото" : m.poster ? "видео" : "видео без обложки"}
                </span>
                <Input value={m.alt} onChange={(e) => patch(i, { alt: e.target.value })} placeholder="Подпись, например «Той-плов на блюде»" aria-label="Подпись" className="h-7 text-[13px]" />
              </div>
              <div className="flex shrink-0 items-center">
                <IconButton label="Выше" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" />
                </IconButton>
                <IconButton label="Ниже" disabled={i === media.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-4" />
                </IconButton>
                <IconButton label="Убрать" onClick={() => onChange((cur) => cur.filter((_, k) => k !== i))} className="hover:bg-rose-50 hover:text-rose-800">
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          Пока нет фото и видео. Гости выбирают глазами, добавьте хотя бы одно.
        </p>
      )}

      {pending.map((p) => (
        <div key={p.key} className={cn("rounded-lg border px-3 py-2 text-sm", p.error ? "border-rose-300 bg-rose-50 text-rose-900" : "border-border")}>
          <div className="flex justify-between gap-3">
            <span className="truncate">{p.name}</span>
            {p.error ? (
              <button type="button" className="shrink-0 text-xs underline" onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))}>
                Скрыть
              </button>
            ) : (
              <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(p.percent)}%</span>
            )}
          </div>
          {p.error ? (
            <p className="mt-1 text-xs">{p.error}</p>
          ) : (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-gold transition-[width]" style={{ width: `${p.percent}%` }} />
            </div>
          )}
        </div>
      ))}

      {uploads ? (
        <>
          <input ref={fileRef} type="file" multiple accept={UPLOAD_TYPES.join(",")} className="sr-only" onChange={(e) => uploadFiles(e.target.files)} tabIndex={-1} aria-hidden />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-night/30 text-sm font-medium text-night transition-colors hover:border-night hover:bg-secondary/60"
          >
            <ImagePlus className="size-4" /> Загрузить фото или видео
          </button>
          <p className="-mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, MP4, MOV до 500 МБ. Обложку для видео сделаем сами из первой секунды.</p>
        </>
      ) : (
        <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          Загрузка файлов пока не подключена: для неё нужно хранилище Vercel Blob. Пока можно добавить фото или видео по ссылке.
        </p>
      )}

      {link.open ? (
        <div className="grid gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink/80">Добавить по ссылке</span>
            <div className="flex rounded-md border border-border p-0.5 text-xs" role="radiogroup" aria-label="Что по ссылке">
              {(["image", "video"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={link.kind === k}
                  onClick={() => setLink((l) => ({ ...l, kind: k }))}
                  className={cn("rounded px-2 py-0.5", link.kind === k ? "bg-night text-ivory" : "text-muted-foreground hover:text-ink")}
                >
                  {k === "image" ? "Фото" : "Видео"}
                </button>
              ))}
            </div>
          </div>
          <Input
            value={link.src}
            onChange={(e) => {
              const src = e.target.value;
              setLink((l) => ({ ...l, src, error: "", kind: VIDEO_EXT.test(src) ? "video" : l.kind }));
            }}
            placeholder="https://"
            aria-label="Ссылка на файл"
            inputMode="url"
          />
          {link.kind === "video" && (
            <Input value={link.poster} onChange={(e) => setLink((l) => ({ ...l, poster: e.target.value, error: "" }))} placeholder="Обложка видео, https:// (необязательно)" aria-label="Ссылка на обложку" inputMode="url" />
          )}
          {link.error && <p className="text-xs text-rose-800">{link.error}</p>}
          <button type="button" onClick={addLink} disabled={!link.src.trim()} className="h-8 rounded-lg bg-secondary text-sm font-medium text-night hover:bg-secondary/70 disabled:opacity-50">
            Добавить
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setLink((l) => ({ ...l, open: true }))} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-ink">
          <Link2 className="size-4" /> Добавить по ссылке
        </button>
      )}

      <Lightbox title={title || "Без названия"} description="" media={media} index={view} onIndex={setView} onClose={() => setView(null)} />
    </div>
  );
}

function IconButton({ label, className, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-ink disabled:pointer-events-none disabled:opacity-30", className)}
      {...props}
    />
  );
}
