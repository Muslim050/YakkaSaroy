"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The only way in: a manager's login and password. */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; redirect?: string };
    if (!res.ok || !json.redirect) {
      setError(json.error ?? "Не удалось войти. Попробуйте ещё раз.");
      setBusy(false);
      return;
    }
    router.replace(json.redirect);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="login">Логин</Label>
        <Input id="login" name="login" autoComplete="username" required className="h-11 text-base" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Пароль</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11 text-base" />
      </div>
      <button type="submit" disabled={busy} className="h-11 rounded-lg bg-night px-5 text-[15px] font-medium text-ivory transition-colors hover:bg-night-3 disabled:opacity-60">
        {busy ? "Проверяем" : "Войти"}
      </button>
      {error && (
        <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
          {error}
        </p>
      )}
    </form>
  );
}
