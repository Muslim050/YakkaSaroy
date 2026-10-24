import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Monogram } from "@/components/Monogram";
import { HallPlan } from "@/components/login/HallPlan";
import { LoginForm } from "@/components/login/LoginForm";
import { getSession } from "@/lib/session";
import { CONTACTS } from "@/lib/data";

export const metadata: Metadata = { title: "Вход — Yakka Saroy" };

/** Already signed in? Go straight to your own area. */
async function SignedInRedirect() {
  const s = await getSession();
  if (s?.role === "admin") redirect("/admin");
  if (s?.role === "client") redirect("/cabinet");
  return null;
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <Suspense fallback={null}>
        <SignedInRedirect />
      </Suspense>

      <aside className="relative hidden flex-col justify-between bg-night px-10 py-10 text-ivory lg:flex xl:px-16 xl:py-12">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full border border-gold/60">
            <Monogram className="size-5 text-gold-2" />
          </span>
          <span className="font-display text-2xl">Yakka Saroy</span>
        </Link>

        <div className="my-12 max-w-xl">
          <h2 className="font-display text-5xl leading-[1.02] xl:text-6xl">Личный кабинет</h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ivory/60">
            Гости смотрят свои торжества, дегустацию и оплату. Менеджеры ведут заявки, календарь залов и клиентов.
          </p>
        </div>

        <div className="max-w-xl">
          <HallPlan />
        </div>

        <p className="mt-10 text-xs text-ivory/40">{CONTACTS.address}</p>
      </aside>

      <main data-theme="light" className="flex flex-col bg-ivory px-6 py-10 sm:px-12">
        <Link href="/" className="flex items-center gap-3 text-night lg:hidden">
          <span className="grid size-9 place-items-center rounded-full border border-gold">
            <Monogram className="size-5 text-gold-dim" />
          </span>
          <span className="font-display text-xl">Yakka Saroy</span>
        </Link>
        <div className="mx-auto my-auto w-full max-w-sm py-12">
          <h1 className="font-display text-4xl text-night">Вход</h1>
          <div className="mt-8">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
        <p className="mx-auto w-full max-w-sm text-sm text-mute">
          Не получается войти? Позвоните:{" "}
          <a href={CONTACTS.phoneHref} className="text-ink hover:text-gold-dim">
            {CONTACTS.phone}
          </a>
        </p>
      </main>
    </div>
  );
}
