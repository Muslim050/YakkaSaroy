"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { HALLS, RESTAURANT_HOURS, RESTAURANT_TABLES, SLOTS, type BanquetHallId, type HallId } from "@/lib/data";
import { formatDateShort, monthKeyOf, fromISO, useMonthAvailability, useToday, type DayAvailability } from "@/lib/availability";

const noSubscribe = () => () => {};

/** Floor plan of the venue with today's state of every hall, like the pavilion plan on the Global Expo login. */
export function HallPlan() {
  const today = useToday();
  const days = useMonthAvailability(today ? monthKeyOf(fromISO(today)) : "");
  const entry = today ? days?.[today] : undefined;

  // current hour, read in the browser only so the prerendered HTML stays stable
  const hour = useSyncExternalStore(noSubscribe, () => new Date().getHours(), () => 19);
  const tableHour = RESTAURANT_HOURS.find((h) => Number(h.slice(0, 2)) >= hour) ?? "19:00";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-ivory/45">
        <span>{today ? `Сегодня, ${formatDateShort(today)}` : "Сегодня"}</span>
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-gold" />свободно</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-wine" />занято</span>
        </span>
      </div>
      <div className="grid grid-cols-6 grid-rows-[repeat(3,minmax(84px,auto))] gap-1.5 rounded-lg border border-white/15 p-1.5">
        <Room hall="grand" entry={entry} className="col-[1/5] row-[1/3]" big />
        <Room hall="second" entry={entry} className="col-[5/7] row-[1/2]" />
        <Room hall="third" entry={entry} className="col-[5/7] row-[2/3]" note="2-й этаж" />
        <Room hall="restaurant" entry={entry} className="col-[1/4] row-[3/4]" tableHour={tableHour} />
        <Room hall="fourth" entry={entry} className="col-[4/7] row-[3/4]" />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-ivory/40">
        <span>Главный вход, ул. Абдуллы Каххара</span>
        <span>План без масштаба</span>
      </div>
    </div>
  );
}

function Room({
  hall,
  entry,
  className,
  big,
  note,
  tableHour = "19:00",
}: {
  hall: HallId;
  entry?: DayAvailability;
  className: string;
  big?: boolean;
  /** Where the hall is, when the plan alone does not say. */
  note?: string;
  tableHour?: string;
}) {
  const h = HALLS.find((x) => x.id === hall)!;
  return (
    <div
      className={cn("flex flex-col justify-between rounded-md border border-white/15 bg-white/[0.04] p-3", className)}
    >
      <div>
        <p className={cn("font-display leading-tight text-ivory", big ? "text-2xl" : "text-lg")}>{h.name}</p>
        <p className="text-[11px] text-ivory/40">
          {h.seats} {hall === "restaurant" ? "чел. за столом" : "гостей"}
          {note && <span className="text-ivory/30"> · {note}</span>}
        </p>
      </div>
      {hall === "restaurant" ? (
        <p className="mt-3 text-xs text-ivory/70">
          {entry ? (
            <>
              в {tableHour} свободно <span className="text-gold-2">{entry.restaurant[tableHour] ?? 0}</span> из {RESTAURANT_TABLES} столиков
            </>
          ) : (
            "…"
          )}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ivory/70">
          {SLOTS.map((s) => {
            const st = entry?.[hall as BanquetHallId][s.id];
            return (
              <span key={s.id} className="flex items-center gap-1.5">
                <i className={cn("size-2 rounded-full", !st ? "bg-white/20" : st === "free" ? "bg-gold" : "bg-wine")} />
                {s.id === "day" ? "днём" : "вечером"}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
