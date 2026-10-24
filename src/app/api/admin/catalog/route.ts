import { NextResponse, type NextRequest } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { createOption, type OptionInput } from "@/lib/store";
import { isCategoryId, parseOption } from "@/lib/validate";

/** A new program option in one of the catalog categories. */
export async function POST(request: NextRequest) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isCategoryId(body.category)) return NextResponse.json({ error: "Выберите раздел" }, { status: 400 });
  const parsed = parseOption(body, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const r = await createOption(body.category, parsed.value as OptionInput);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ option: r.option }, { status: 201 });
}
