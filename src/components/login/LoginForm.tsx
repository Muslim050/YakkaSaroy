"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The only way in: a manager's login and password. */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        <div className="relative">
          <UserRound aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c8d8a]" />
          <Input id="login" name="login" autoComplete="username" required placeholder="Логин" className="h-12 rounded-md border-[#ded6ca] bg-transparent pl-11 text-base shadow-none" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Пароль</Label>
        <div className="relative">
          <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c8d8a]" />
          <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Пароль" className="h-12 rounded-md border-[#ded6ca] bg-transparent pr-24 pl-11 text-base shadow-none" />
          <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex items-center gap-1.5 px-3 text-xs text-mute hover:text-night">
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {showPassword ? "Скрыть" : "Показать"}
          </button>
        </div>
      </div>
      <button type="submit" disabled={busy} className="mt-1 flex h-12 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#594027] via-[#89653e] to-[#d9b17b] px-5 font-display text-xl text-white shadow-sm transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a77d43] disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "Проверяем" : "Войти"} <ArrowRight aria-hidden="true" className="size-5" />
      </button>
      {error && (
        <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
          {error}
        </p>
      )}
    </form>
  );
}
