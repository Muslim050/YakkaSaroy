import Link from "next/link";
import { Suspense } from "react";
import { Monogram } from "@/components/Monogram";
import { NavLinks, NavLinksFallback, type NavItem } from "./NavLinks";

/**
 * Workspace frame for the admin and the client cabinet: a night top bar with the
 * sections in a row, light pages underneath. The account slot reads the session,
 * so it streams in behind its own Suspense boundary.
 */
export function AppShell({
  home,
  label,
  nav,
  account,
  children,
}: {
  home: string;
  label: string;
  nav: NavItem[];
  account: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div data-theme="light" className="min-h-screen bg-ivory text-ink">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-night text-ivory">
        <div className="mx-auto flex h-16 max-w-[1320px] items-stretch gap-2 px-4 sm:px-6 lg:gap-4">
          <Link href={home} className="flex shrink-0 items-center gap-3 pr-4 sm:border-r sm:border-white/10 sm:pr-6">
            <span className="grid size-9 place-items-center rounded-full border border-gold/60">
              <Monogram className="size-5 text-gold-2" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-xl">Yakka Saroy</span>
              <span className="block text-[11px] text-ivory/45">{label}</span>
            </span>
          </Link>
          {nav.length > 1 && (
            <Suspense fallback={<NavLinksFallback items={nav} className="hidden md:flex" />}>
              <NavLinks items={nav} className="hidden md:flex" />
            </Suspense>
          )}
          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <Link href="/" className="hidden rounded-full px-3 py-2 text-sm text-ivory/55 transition-colors hover:text-ivory sm:block">
              На сайт
            </Link>
            <Suspense fallback={<div className="h-10 w-10 animate-pulse rounded-full bg-white/10 lg:w-44" />}>{account}</Suspense>
          </div>
        </div>
        {nav.length > 1 && (
          <Suspense fallback={<NavLinksFallback items={nav} className="scroll-x h-11 overflow-x-auto border-t border-white/10 px-2 md:hidden" />}>
            <NavLinks items={nav} className="scroll-x h-11 overflow-x-auto border-t border-white/10 px-2 md:hidden" />
          </Suspense>
        )}
      </header>
      <main className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:py-10">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-4xl leading-none text-night sm:text-[2.75rem]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-[15px] text-mute">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
