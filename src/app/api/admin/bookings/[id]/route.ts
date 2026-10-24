import { NextResponse, type NextRequest } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { getBooking, isFree, updateBooking, type BookingPatch } from "@/lib/store";
import { checkGuests, isEventType, isStatus } from "@/lib/validate";
import { normalizeSelection } from "@/lib/program";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/bookings/[id]">) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
  const { id } = await ctx.params;
  const booking = await getBooking(id);
  if (!booking) return NextResponse.json({ error: "Бронь не найдена" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: BookingPatch = {};

  if (body.status !== undefined) {
    if (!isStatus(body.status)) return NextResponse.json({ error: "Неизвестный статус" }, { status: 400 });
    // Re-opening a cancelled booking needs the slot to still be free.
    if (booking.status === "cancelled" && body.status !== "cancelled" && !(await isFree(booking.hall, booking.date, booking.slot, booking.id)))
      return NextResponse.json({ error: "Это время уже заняли, восстановить бронь нельзя" }, { status: 409 });
    patch.status = body.status;
  }
  if (body.guests !== undefined) {
    const err = checkGuests(booking.hall, Number(body.guests));
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    patch.guests = Number(body.guests);
  }
  if (body.prepayment !== undefined) {
    const n = Number(body.prepayment);
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "Сумма предоплаты должна быть числом" }, { status: 400 });
    patch.prepayment = Math.round(n);
  }
  if (body.tastingAt !== undefined) {
    const t = String(body.tastingAt);
    if (t && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return NextResponse.json({ error: "Укажите дату и время дегустации" }, { status: 400 });
    patch.tastingAt = t;
  }
  if (body.eventType !== undefined) {
    if (!isEventType(body.eventType)) return NextResponse.json({ error: "Неизвестный повод" }, { status: 400 });
    patch.eventType = String(body.eventType);
  }
  if (body.comment !== undefined) patch.comment = String(body.comment).slice(0, 500);
  if (body.managerNote !== undefined) patch.managerNote = String(body.managerNote).slice(0, 1000);
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2) return NextResponse.json({ error: "Укажите имя клиента" }, { status: 400 });
    patch.name = name;
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (phone.replace(/\D/g, "").length < 9) return NextResponse.json({ error: "Укажите телефон клиента" }, { status: 400 });
    patch.phone = phone;
  }

  if (body.extras !== undefined) {
    if (booking.hall === "restaurant") return NextResponse.json({ error: "Для столика программа не нужна" }, { status: 400 });
    const sel = normalizeSelection(body.extras);
    if (!sel.ok) return NextResponse.json({ error: sel.error }, { status: 400 });
    patch.extras = sel.value;
  }

  const updated = await updateBooking(id, patch, "admin");
  return NextResponse.json({ booking: updated });
}
