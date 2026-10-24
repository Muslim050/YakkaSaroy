"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { HALLS, SLOTS, type HallId } from "@/lib/data";
import { type Booking, type BookingStatus } from "@/lib/bookings";
import { BookingSheet } from "./BookingSheet";
import { NewBookingSheet, type NewBookingPreset } from "./NewBookingSheet";

const BAR: Record<BookingStatus, string> = {
  new: "border-l-amber-500 bg-amber-50",
  confirmed: "border-l-sky-500 bg-sky-50",
  prepaid: "border-l-emerald-600 bg-emerald-50",
  done: "border-l-stone-400 bg-stone-100",
  cancelled: "border-l-rose-500 bg-rose-50",
};
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const BANQUET = HALLS.filter((h) => h.id !== "restaurant");

/** Month board: one row per day, a day and an evening column per hall. */
export function CalendarBoard({ days, bookings, today }: { days: string[]; bookings: Booking[]; today: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<NewBookingPreset | null>(null);
  const [saved, setSaved] = useState<Booking | null>(null);
  // A cancelled booking leaves the board; keep showing its saved copy until the sheet is closed.
  const fromBoard = openId ? bookings.find((b) => b.id === openId) : undefined;
  const fromSave = saved?.id === openId ? saved : undefined;
  const open = fromBoard && fromSave ? (fromSave.updatedAt > fromBoard.updatedAt ? fromSave : fromBoard) : (fromBoard ?? fromSave ?? null);

  const index = new Map<string, Booking>();
  for (const b of bookings) index.set(`${b.date}|${b.hall}|${b.slot}`, b);

  return (
    <>
      <div className="scroll-x overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th rowSpan={2} className="w-24 px-4 py-3 text-left font-medium text-muted-foreground">День</th>
              {BANQUET.map((h) => (
                <th key={h.id} colSpan={2} className="border-l border-border px-3 pt-3 text-left font-display text-lg font-normal text-night">
                  {h.name}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border text-xs text-muted-foreground">
              {BANQUET.map((h) =>
                SLOTS.map((s, i) => (
                  <th key={h.id + s.id} className={cn("px-3 pb-2 text-left font-normal", i === 0 && "border-l border-border")}>
                    {s.id === "day" ? "День" : "Вечер"}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const [y, m, dd] = d.split("-").map(Number);
              const wd = new Date(y, m - 1, dd).getDay();
              const weekend = wd === 0 || wd === 6 || wd === 5;
              const past = d < today;
              return (
                <tr key={d} className={cn("border-b border-border last:border-b-0", weekend && "bg-secondary/40", d === today && "bg-gold/10")}>
                  <td className={cn("whitespace-nowrap px-4 py-1.5 tabular-nums", past ? "text-muted-foreground" : "text-ink")}>
                    <span className="font-medium">{dd}</span> <span className="text-muted-foreground">{WD[wd]}</span>
                    {d === today && <span className="ml-2 text-xs text-gold-dim">сегодня</span>}
                  </td>
                  {BANQUET.map((h) =>
                    SLOTS.map((s, i) => {
                      const b = index.get(`${d}|${h.id}|${s.id}`);
                      return (
                        <td key={h.id + s.id} className={cn("h-12 p-1", i === 0 && "border-l border-border")}>
                          {b ? (
                            <button
                              type="button"
                              onClick={() => setOpenId(b.id)}
                              className={cn("flex h-full w-full min-w-0 flex-col justify-center rounded-md border-l-[3px] px-2 text-left transition-shadow hover:shadow-sm", BAR[b.status], past && "opacity-60")}
                            >
                              <span className="block w-full truncate text-[13px] text-ink">{b.name}</span>
                              <span className="block text-[11px] text-muted-foreground">{b.guests} гостей</span>
                            </button>
                          ) : !past ? (
                            <button
                              type="button"
                              aria-label={`Новая бронь: ${h.name}, ${dd} число, ${s.id === "day" ? "день" : "вечер"}`}
                              onClick={() => setCreating({ hall: h.id as HallId, date: d, slot: s.id })}
                              className="group grid h-full w-full place-items-center rounded-md text-muted-foreground/0 transition-colors hover:bg-secondary hover:text-muted-foreground focus-visible:text-muted-foreground"
                            >
                              <Plus className="size-4" />
                            </button>
                          ) : null}
                        </td>
                      );
                    }),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BookingSheet booking={open} onClose={() => setOpenId(null)} onSaved={setSaved} />
      <NewBookingSheet preset={creating} onClose={() => setCreating(null)} />
    </>
  );
}
