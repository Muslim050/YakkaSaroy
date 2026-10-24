import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "@/lib/session";
import { findClient, verifyAdmin } from "@/lib/store";
import { phoneDigits } from "@/lib/bookings";
import { clearFailures, recordFailure, tooManyAttempts } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать запрос" }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  if (body.type === "admin") {
    const login = String(body.login ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const key = `admin:${ip}:${login}`;
    if (tooManyAttempts(key)) return NextResponse.json({ error: "Слишком много попыток. Попробуйте через 15 минут." }, { status: 429 });
    const user = login && password ? await verifyAdmin(login, password) : null;
    if (!user) {
      recordFailure(key);
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }
    clearFailures(key);
    await setSession({ role: "admin", sub: user.id, name: user.name });
    return NextResponse.json({ redirect: "/admin" });
  }

  if (body.type === "client") {
    const phone = String(body.phone ?? "");
    const code = String(body.code ?? "");
    const key = `client:${ip}:${phoneDigits(phone)}`;
    if (tooManyAttempts(key)) return NextResponse.json({ error: "Слишком много попыток. Попробуйте через 15 минут или позвоните нам." }, { status: 429 });
    const client = await findClient(phone, code);
    if (!client) {
      recordFailure(key);
      return NextResponse.json({ error: "Не нашли бронь с таким телефоном и номером. Проверьте номер брони из подтверждения." }, { status: 401 });
    }
    clearFailures(key);
    await setSession({ role: "client", sub: client.phone, name: client.name });
    return NextResponse.json({ redirect: "/cabinet" });
  }

  return NextResponse.json({ error: "Выберите, как войти" }, { status: 400 });
}
