import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "@/lib/session";
import { verifyAdmin } from "@/lib/store";
import { settleLoginAttempt, takeLoginAttempt } from "@/lib/rateLimit";

const WRONG = { error: "Неверный логин или пароль" };
const MAX_IP = 64;
const MAX_LOGIN = 64;
const MAX_PASSWORD = 1024;

/** Managers sign in with a login and a password; there is no other way in. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать запрос" }, { status: 400 });
  }
  // Vercel sets this header itself. Elsewhere a client can forge it, and then only the limit per login holds.
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local").slice(0, MAX_IP);
  const login = String(body.login ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  // Nothing to guess with, and a key this long would not fit the limiter's index.
  if (!login || !password || login.length > MAX_LOGIN || password.length > MAX_PASSWORD) return NextResponse.json(WRONG, { status: 401 });
  if (!(await takeLoginAttempt(ip, login))) return NextResponse.json({ error: "Слишком много попыток. Попробуйте через 15 минут." }, { status: 429 });
  const user = await verifyAdmin(login, password);
  if (!user) return NextResponse.json(WRONG, { status: 401 });
  await settleLoginAttempt(ip, login);
  await setSession({ role: "admin", sub: user.id, name: user.name });
  return NextResponse.json({ redirect: "/admin" });
}
