import { Suspense } from "react";
import { PageHeader } from "@/components/app/AppShell";
import { CatalogView } from "@/components/admin/CatalogView";
import { requireAdmin } from "@/lib/auth";
import { getCatalog, optionUsage } from "@/lib/store";
import { uploadsEnabled } from "@/lib/uploads";

export default function CatalogPage() {
  return (
    <>
      <PageHeader
        title="Каталог"
        description="Меню, оформление, шоу, торты и съёмка, из которых гости собирают программу в личном кабинете. Изменения видны гостям сразу после сохранения."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-secondary" />}>
        <Catalog />
      </Suspense>
    </>
  );
}

async function Catalog() {
  await requireAdmin();
  const [catalog, usage] = await Promise.all([getCatalog(), optionUsage()]);
  return <CatalogView catalog={catalog} usage={usage} uploads={uploadsEnabled()} />;
}
