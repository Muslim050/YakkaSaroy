import { Suspense } from "react";
import { PageHeader } from "@/components/app/AppShell";
import { ClientsView } from "@/components/admin/ClientsView";
import { requireAdmin } from "@/lib/auth";
import { bookingsByPhone, listClients } from "@/lib/store";
import { phoneDigits } from "@/lib/bookings";

const PAGE = 30;

export default function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  return (
    <>
      <PageHeader title="Клиенты" description="Все, кто бронировал банкетные залы. Один телефон считается одним клиентом." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-secondary" />}>
        <Clients searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Clients({ searchParams }: { searchParams: PageProps<"/admin/clients">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const all = await listClients(q);
  const pages = Math.max(1, Math.ceil(all.length / PAGE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pages);
  const clients = all.slice((page - 1) * PAGE, page * PAGE);
  const entries = await Promise.all(clients.map(async (c) => [phoneDigits(c.phone), await bookingsByPhone(c.phone)] as const));

  return <ClientsView clients={clients} bookings={Object.fromEntries(entries)} total={all.length} page={page} pageSize={PAGE} q={q} />;
}
