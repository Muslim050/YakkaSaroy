import { NextResponse, type NextRequest } from "next/server";
import { HALLS, RESTAURANT_HOURS, SLOTS, type HallId } from "@/lib/data";
import { createBooking, isFree, todayISO } from "@/lib/store";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать запрос" }, { status: 400 });
  }

  const hall = String(body.hall ?? "") as HallId;
  const date = String(body.date ?? "");
  const slot = String(body.slot ?? "");
  const guests = Number(body.guests);
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const eventType = body.eventType ? String(body.eventType) : undefined;
  const comment = body.comment ? String(body.comment).slice(0, 500) : undefined;

  const hallDef = HALLS.find((h) => h.id === hall);
  if (!hallDef) return NextResponse.json({ error: "Выберите зал" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Выберите дату" }, { status: 400 });
  const today = todayISO();
  if (date < today) return NextResponse.json({ error: "Эта дата уже прошла" }, { status: 400 });

  const validSlot = hall === "restaurant" ? RESTAURANT_HOURS.includes(slot) : SLOTS.some((s) => s.id === slot);
  if (!validSlot) return NextResponse.json({ error: "Выберите время" }, { status: 400 });

  if (!Number.isFinite(guests) || guests < 1 || guests > hallDef.guestsMax) {
    return NextResponse.json({ error: `Количество гостей: от 1 до ${hallDef.guestsMax}` }, { status: 400 });
  }
  if (name.length < 2) return NextResponse.json({ error: "Укажите имя" }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 9) return NextResponse.json({ error: "Укажите номер телефона" }, { status: 400 });

  if (!(await isFree(hall, date, slot))) {
    return NextResponse.json({ error: "Это время только что заняли. Выберите другое." }, { status: 409 });
  }

  const booking = await createBooking({ hall, date, slot, guests, name, phone, eventType, comment });
  if (!booking) return NextResponse.json({ error: "Это время только что заняли. Выберите другое." }, { status: 409 });
  return NextResponse.json({ ok: true, code: booking.code, booking: { hall, date, slot, guests, name } }, { status: 201 });
}
