import { NextResponse, type NextRequest } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { removePayment, updatePayment } from "@/lib/store";
import { parsePayment } from "@/lib/validate";

const NOT_FOUND = { error: "Поступление не найдено" };

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/bookings/[id]/payments/[paymentId]">) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
  const { id, paymentId } = await ctx.params;
  const input = parsePayment((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  const state = await updatePayment(id, paymentId, input.value);
  return state ? NextResponse.json(state) : NextResponse.json(NOT_FOUND, { status: 404 });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/bookings/[id]/payments/[paymentId]">) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
  const { id, paymentId } = await ctx.params;
  const state = await removePayment(id, paymentId);
  return state ? NextResponse.json(state) : NextResponse.json(NOT_FOUND, { status: 404 });
}
