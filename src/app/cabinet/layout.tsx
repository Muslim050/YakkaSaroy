import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { UserMenu } from "@/components/app/UserMenu";
import { requireClient } from "@/lib/auth";
import { formatPhone } from "@/lib/bookings";

export const metadata: Metadata = { title: "Кабинет гостя — Yakka Saroy" };

async function Account() {
  const me = await requireClient();
  return <UserMenu name={me.name} caption={formatPhone(me.phone)} />;
}

export default function CabinetLayout({ children }: LayoutProps<"/cabinet">) {
  return (
    <AppShell home="/cabinet" label="Кабинет гостя" nav={[{ href: "/cabinet", label: "Мои торжества" }]} account={<Account />}>
      {children}
    </AppShell>
  );
}
