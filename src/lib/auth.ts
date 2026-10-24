import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import { getAdmin } from "./store";

/** Data Access Layer: every admin page, route and action goes through one of these. */
export async function requireAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") redirect("/login?as=admin");
  const user = await getAdmin(s.sub);
  if (!user) redirect("/login?as=admin");
  return { id: user.id, name: user.name, login: user.login };
}

export async function requireClient() {
  const s = await getSession();
  if (!s || s.role !== "client") redirect("/login");
  return { phone: s.sub, name: s.name };
}

/** For route handlers: a 401 instead of a redirect. */
export async function adminOrNull() {
  const s = await getSession();
  if (!s || s.role !== "admin") return null;
  return (await getAdmin(s.sub)) ? s : null;
}

export async function clientOrNull() {
  const s = await getSession();
  return s && s.role === "client" ? s : null;
}
