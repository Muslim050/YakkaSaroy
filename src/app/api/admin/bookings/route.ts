import { NextResponse, type NextRequest } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { createBooking, isFree } from "@/lib/store";
import { checkGuests, checkSlot, isEventType, isStatus } from "@/lib/validate";
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
    checkGuests(hall, guests) ??
    (name.length < 2 ? "Укажите имя клиента" : null) ??
    (phone.replace(/\D/g, "").length < 9 ? "Укажите телефон клиента" : null) ??
    (body.status !== undefined && !isStatus(body.status) ? "Неизвестный статус" : null);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  if (!(await isFree(hall, date, slot))) return NextResponse.json({ error: "Это время уже занято" }, { status: 409 });

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
    },
    "admin",
  );
  if (!booking) return NextResponse.json({ error: "Это время уже занято" }, { status: 409 });
  return NextResponse.json({ booking }, { status: 201 });
}
