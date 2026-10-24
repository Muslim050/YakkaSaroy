"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

/** Top bar sections; the active one gets a brass bar along the bottom edge. */
export function NavLinks({ items, className }: { items: NavItem[]; className?: string }) {
  const pathname = usePathname();
  return <NavList items={items} className={className} pathname={pathname} />;
}

/** Same links before the current path is known (shown while NavLinks streams in). */
export function NavLinksFallback({ items, className }: { items: NavItem[]; className?: string }) {
  return <NavList items={items} className={className} pathname="" />;
}

function NavList({ items, className, pathname }: { items: NavItem[]; className?: string; pathname: string }) {
  const isActive = (href: string) => (href === "/admin" || href === "/cabinet" ? pathname === href : !!pathname && pathname.startsWith(href));
  return (
    <nav className={cn("flex items-stretch", className)} aria-label="Разделы">
      {items.map((item) => {
        const on = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center px-4 text-sm transition-colors",
              on ? "text-ivory" : "text-ivory/55 hover:text-ivory",
            )}
          >
            {item.label}
            <span className={cn("absolute inset-x-4 bottom-0 h-0.5 bg-gold transition-opacity", on ? "opacity-100" : "opacity-0")} />
          </Link>
        );
      })}
    </nav>
  );
}
