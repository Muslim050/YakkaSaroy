import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { UserMenu } from "@/components/app/UserMenu";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Админка — Yakka Saroy" };

const NAV = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/bookings", label: "Брони" },
  { href: "/admin/calendar", label: "Календарь" },
  { href: "/admin/clients", label: "Клиенты" },
  { href: "/admin/catalog", label: "Каталог" },
];

async function Account() {
  const me = await requireAdmin();
  return <UserMenu name={me.name} caption={`Администратор, ${me.login}`} />;
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell home="/admin" label="Администрирование" nav={NAV} account={<Account />}>
      {children}
    </AppShell>
  );
}
