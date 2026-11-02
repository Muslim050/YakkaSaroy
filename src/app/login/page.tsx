import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Monogram } from "@/components/Monogram";
import { LoginForm } from "@/components/login/LoginForm";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Вход — Yakka Saroy" };

/** Already signed in? Go straight to the admin. */
async function SignedInRedirect() {
  if ((await getSession())?.role === "admin") redirect("/admin");
  return null;
}

export default function LoginPage() {
  return (
    <div className="grid min-h-[100svh] bg-[#f6f2e9] lg:grid-cols-[59.5fr_40.5fr]">
      <Suspense fallback={null}>
        <SignedInRedirect />
      </Suspense>

      <aside aria-label="Банкетный зал" className="relative hidden overflow-hidden bg-[#d9c4a5] lg:block">
        <div className="absolute inset-0 bg-[url('/login-hall-evening.avif')] bg-cover bg-center bg-no-repeat" />
      </aside>

      <main data-theme="light" className="relative flex min-h-[100svh] flex-col overflow-hidden bg-[#f6f2e9] px-6 py-10 sm:px-12 lg:px-[10%]">
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 hidden h-[min(55vh,520px)] w-[min(32%,200px)] bg-[url('/login-floral-extracted.svg?v=2')] bg-contain bg-right-top bg-no-repeat sm:block" />
        <div className="relative mx-auto my-auto w-full max-w-[400px] py-8">
          <Link href="/" aria-label="Yakka Saroy — на главную" className="mx-auto mb-12 flex w-fit flex-col items-center text-night sm:mb-16">
            <Monogram className="h-16 w-14 sm:h-20 sm:w-16" />
            <span className="mt-3 font-display text-[2rem] leading-none tracking-[0.1em] uppercase sm:text-[2.2rem]">Yakka Saroy</span>
            <span aria-hidden="true" className="mt-3 flex items-center gap-3 text-[#b8894d]"><span className="h-px w-12 bg-current/60" /><span className="size-1.5 rotate-45 border border-current" /><span className="h-px w-12 bg-current/60" /></span>
            <span className="mt-3 text-[10px] tracking-[0.45em] text-[#a87a3d] uppercase">Tashkent</span>
          </Link>
          <h1 className="font-display text-4xl leading-none text-night sm:text-[2.75rem]">Вход</h1>
          <div className="mt-8 sm:mt-10">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
        <p className="relative mx-auto w-full max-w-[400px] text-xs text-mute">
          Не получается войти? Обратитесь к администратору.
        </p>
      </main>
    </div>
  );
}
