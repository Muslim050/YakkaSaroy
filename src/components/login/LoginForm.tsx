"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "client" | "admin";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("as") === "admin" ? "admin" : "client");
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
      body: JSON.stringify({ type: mode, ...data }),
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
    <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setError(""); }} className="w-full">
      <TabsList variant="line" className="w-full justify-start gap-6 border-b border-border">
        <TabsTrigger value="client" className="flex-none px-0 pb-2 text-[15px]">Гость</TabsTrigger>
        <TabsTrigger value="admin" className="flex-none px-0 pb-2 text-[15px]">Администратор</TabsTrigger>
      </TabsList>

      <TabsContent value="client" className="pt-6">
        <form onSubmit={submit} className="grid gap-5">
          <p className="text-sm text-muted-foreground">
            Введите телефон, который указали при бронировании, и номер брони из подтверждения.
          </p>
          <Field id="phone" label="Телефон">
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" required className="h-11 text-base" />
          </Field>
          <Field id="code" label="Номер брони">
            <Input id="code" name="code" autoComplete="off" placeholder="YS-0000" required className="h-11 text-base uppercase placeholder:normal-case" />
          </Field>
          <Submit busy={busy}>Войти в кабинет</Submit>
          <ErrorText error={error} />
          <p className="text-sm text-muted-foreground">
            Ещё нет брони?{" "}
            <Link href="/#booking" className="font-medium text-foreground underline underline-offset-4 hover:text-gold-dim">
              Выберите дату на сайте
            </Link>
          </p>
        </form>
      </TabsContent>

      <TabsContent value="admin" className="pt-6">
        <form onSubmit={submit} className="grid gap-5">
          <Field id="login" label="Логин">
            <Input id="login" name="login" autoComplete="username" required className="h-11 text-base" />
          </Field>
          <Field id="password" label="Пароль">
            <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11 text-base" />
          </Field>
          <Submit busy={busy}>Войти</Submit>
          <ErrorText error={error} />
        </form>
      </TabsContent>
    </Tabs>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="h-11 rounded-lg bg-night px-5 text-[15px] font-medium text-ivory transition-colors hover:bg-night-3 disabled:opacity-60"
    >
      {busy ? "Проверяем" : children}
    </button>
  );
}

function ErrorText({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
      {error}
    </p>
  );
}
