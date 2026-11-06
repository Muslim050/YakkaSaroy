import { NextResponse, type NextRequest } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { addPayment, getBooking, listPayments } from "@/lib/store";
import { parsePayment } from "@/lib/validate";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/admin/bookings/[id]/payments">) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await getBooking(id))) return NextResponse.json({ error: "Бронь не найдена" }, { status: 404 });
  return NextResponse.json({ payments: await listPayments(id) });
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/bookings/[id]/payments">) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
  const { id } = await ctx.params;
  const booking = await getBooking(id);
  if (!booking) return NextResponse.json({ error: "Бронь не найдена" }, { status: 404 });
  if (booking.hall === "restaurant") return NextResponse.json({ error: "За столик в ресторане поступления не ведутся" }, { status: 400 });
  const input = parsePayment((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  return NextResponse.json(await addPayment(id, input.value));
}
