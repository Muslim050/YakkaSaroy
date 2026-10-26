import { NextResponse, type NextRequest } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { getBooking, getCatalog, isFree, SlotTakenError, updateBooking, type BookingPatch } from "@/lib/store";
import { checkGuests, checkSlot, isEventType, isStatus } from "@/lib/validate";
import { todayISO } from "@/lib/time";
import { normalizeSelection } from "@/lib/program";
import { hallName } from "@/lib/bookings";
import { HALLS, type HallId } from "@/lib/data";

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
  // Moving a banquet to another hall, date or time, e.g. by dragging it on the calendar.
  if (body.hall !== undefined || body.date !== undefined || body.slot !== undefined) {
    const to = { hall: String(body.hall ?? booking.hall), date: String(body.date ?? booking.date), slot: String(body.slot ?? booking.slot) };
    if (booking.hall === "restaurant" || to.hall === "restaurant") return NextResponse.json({ error: "Столик в ресторане так не переносится" }, { status: 400 });
    if (booking.status === "cancelled" || booking.status === "done") return NextResponse.json({ error: "Отменённую или проведённую бронь перенести нельзя" }, { status: 400 });
    const err = checkSlot(to.hall, to.date, to.slot);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    if (to.date < todayISO()) return NextResponse.json({ error: "Перенести можно только на сегодня или позже" }, { status: 400 });
    const hall = to.hall as HallId;
    const max = HALLS.find((h) => h.id === hall)?.guestsMax ?? 0;
    if (Number(body.guests ?? booking.guests) > max) return NextResponse.json({ error: `${hallName(hall)} вмещает до ${max} гостей` }, { status: 400 });
    if (!(await isFree(hall, to.date, to.slot, booking.id))) return NextResponse.json({ error: "Это время уже занято" }, { status: 409 });
    Object.assign(patch, { hall, date: to.date, slot: to.slot });
  }
  if (body.guests !== undefined) {
    const err = checkGuests(patch.hall ?? booking.hall, Number(body.guests));
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
    const sel = normalizeSelection(await getCatalog(), body.extras, booking.extras);
    if (!sel.ok) return NextResponse.json({ error: sel.error }, { status: 400 });
    patch.extras = sel.value;
  }

  let updated;
  try {
    updated = await updateBooking(id, patch, "admin");
  } catch (e) {
    if (e instanceof SlotTakenError)
      return NextResponse.json({ error: patch.date ? "Это время только что заняли" : "Это время уже заняли, восстановить бронь нельзя" }, { status: 409 });
    throw e;
  }
  return NextResponse.json({ booking: updated });
}
