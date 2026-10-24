import { NextResponse, type NextRequest } from "next/server";
import { clientOrNull } from "@/lib/auth";
import { getBooking, updateBooking, type BookingPatch } from "@/lib/store";
import { clientCanEdit, phoneDigits } from "@/lib/bookings";
import { checkGuests } from "@/lib/validate";
import { normalizeSelection } from "@/lib/program";

/** A client changes the guest count or wishes, or cancels, on their own booking only. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/cabinet/bookings/[id]">) {
  const session = await clientOrNull();
  if (!session) return NextResponse.json({ error: "Войдите в личный кабинет" }, { status: 401 });
  const { id } = await ctx.params;
  const booking = await getBooking(id);
  // Same answer for "missing" and "someone else's", so ids cannot be probed.
  if (!booking || phoneDigits(booking.phone) !== session.sub) return NextResponse.json({ error: "Бронь не найдена" }, { status: 404 });
  if (!clientCanEdit(booking))
    return NextResponse.json({ error: "После предоплаты изменения согласуются с менеджером по телефону" }, { status: 409 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: BookingPatch = {};
  if (body.action === "cancel") patch.status = "cancelled";
  if (body.guests !== undefined) {
    const err = checkGuests(booking.hall, Number(body.guests));
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    patch.guests = Number(body.guests);
  }
  if (body.comment !== undefined) patch.comment = String(body.comment).slice(0, 500);

  if (body.extras !== undefined) {
    if (booking.hall === "restaurant") return NextResponse.json({ error: "Для столика программа не нужна" }, { status: 400 });
    const sel = normalizeSelection(body.extras);
    if (!sel.ok) return NextResponse.json({ error: sel.error }, { status: 400 });
    patch.extras = sel.value;
  }

  const updated = await updateBooking(id, patch, "client");
  return NextResponse.json({ booking: updated });
}
