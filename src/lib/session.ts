import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed cookie session. The payload is readable (base64url JSON) but cannot
 * be altered without AUTH_SECRET; it holds only the role, an id and a name.
 */
export type Session =
  | { role: "admin"; sub: string; name: string; exp: number }
  | { role: "client"; sub: string; name: string; exp: number }; // client sub = phone digits

const COOKIE = "ys_session";
const MAX_AGE = 60 * 60 * 24 * 7; // a week

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("Set AUTH_SECRET (32+ characters) to sign sessions.");
  return "dev-only-yakka-saroy-session-secret-do-not-use";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(data: Omit<Session, "exp">): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (!data.exp || data.exp < Date.now() / 1000) return null;
    if (data.role !== "admin" && data.role !== "client") return null;
    return data;
  } catch {
    return null;
  }
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  // The expiry check reads the clock, so mark this as request-time work.
  await connection();
  return decodeSession(token);
}

export async function setSession(data: Omit<Session, "exp">) {
  (await cookies()).set(COOKIE, encodeSession(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
