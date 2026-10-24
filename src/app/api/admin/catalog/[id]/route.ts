import { NextResponse, type NextRequest } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { removeOption, restoreOption, updateOption } from "@/lib/store";
import { parseOption } from "@/lib/validate";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/catalog/[id]">) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.restore === true) {
    const r = await restoreOption(id);
    return r.ok ? NextResponse.json({ option: r.option }) : NextResponse.json({ error: r.error }, { status: 404 });
  }
  const parsed = parseOption(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const r = await updateOption(id, parsed.value);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "Вариант не найден" ? 404 : 409 });
  return NextResponse.json({ option: r.option });
}

/** Takes the option out of the catalog; bookings that already chose it keep it. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/catalog/[id]">) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
  const { id } = await ctx.params;
  const r = await removeOption(id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "Вариант не найден" ? 404 : 409 });
  return NextResponse.json({ ok: true });
}
