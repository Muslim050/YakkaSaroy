import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "@/lib/session";
import { verifyAdmin } from "@/lib/store";
import { clearFailures, recordFailure, tooManyAttempts } from "@/lib/rateLimit";

/** Managers sign in with a login and a password; there is no other way in. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать запрос" }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const login = String(body.login ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const key = `admin:${ip}:${login}`;
  if (await tooManyAttempts(key)) return NextResponse.json({ error: "Слишком много попыток. Попробуйте через 15 минут." }, { status: 429 });
  const user = login && password ? await verifyAdmin(login, password) : null;
  if (!user) {
    await recordFailure(key);
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }
  await clearFailures(key);
  await setSession({ role: "admin", sub: user.id, name: user.name });
  return NextResponse.json({ redirect: "/admin" });
}
