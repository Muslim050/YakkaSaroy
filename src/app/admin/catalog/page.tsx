import { Suspense } from "react";
import { Loader } from "@/components/app/Loader";
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
      <Suspense fallback={<Loader className="min-h-[70vh]" label="Загружаем каталог…" />}>
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
