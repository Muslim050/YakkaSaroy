import { NextResponse, type NextRequest } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { createBooking, getCatalog, isFree, isWindowFree } from "@/lib/store";
import { normalizeSelection, type ProgramSelection } from "@/lib/program";
import { checkGuests, checkSlot, isEventType, isMorningTime, isStatus } from "@/lib/validate";
import type { HallId } from "@/lib/data";

/** A manager adds a booking taken over the phone. */
export async function POST(request: NextRequest) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const hall = String(body.hall ?? "") as HallId;
  const date = String(body.date ?? "");
  const slot = String(body.slot ?? "");
  const guests = Number(body.guests);
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();

  const err =
    checkSlot(hall, date, slot) ??
    checkGuests(hall, guests, "admin") ??
    (name.length < 2 ? "Укажите имя клиента" : null) ??
    (phone.replace(/\D/g, "").length < 9 ? "Укажите телефон клиента" : null) ??
    (body.status !== undefined && !isStatus(body.status) ? "Неизвестный статус" : null);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  if (!(await isFree(hall, date, slot))) return NextResponse.json({ error: "Это время уже занято" }, { status: 409 });
  const startTime = slot === "day" && isMorningTime(body.startTime) ? body.startTime : undefined;
  if (startTime && !(await isWindowFree(hall, date, startTime))) return NextResponse.json({ error: "Это утреннее окно уже занято" }, { status: 409 });

  // The program (menu, decor, show, cake, photo) chosen while taking the booking.
  let extras: ProgramSelection | undefined;
  if (body.extras !== undefined && hall !== "restaurant") {
    const sel = normalizeSelection(await getCatalog(), body.extras);
    if (!sel.ok) return NextResponse.json({ error: sel.error }, { status: 400 });
    extras = sel.value;
  }

  const booking = await createBooking(
    {
      hall,
      date,
      slot,
      guests,
      name,
      phone,
      eventType: isEventType(body.eventType) ? String(body.eventType) : undefined,
      comment: body.comment ? String(body.comment).slice(0, 500) : undefined,
      managerNote: body.managerNote ? String(body.managerNote).slice(0, 1000) : undefined,
      status: isStatus(body.status) ? body.status : undefined,
      startTime,
      extras,
    },
    "admin",
  );
  if (!booking) return NextResponse.json({ error: "Это время уже занято" }, { status: 409 });
  return NextResponse.json({ booking }, { status: 201 });
}
