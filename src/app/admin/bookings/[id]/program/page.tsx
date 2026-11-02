import { Suspense } from "react";
import { Loader } from "@/components/app/Loader";
import { notFound } from "next/navigation";
import { ProgramPlanner } from "@/components/program/ProgramPlanner";
import { requireAdmin } from "@/lib/auth";
import { getBooking, getCatalog } from "@/lib/store";

export default function AdminProgramPage({ params }: PageProps<"/admin/bookings/[id]/program">) {
  return (
    <Suspense fallback={<Loader className="min-h-[80vh]" label="Загружаем программу…" />}>
      <Program params={params} />
    </Suspense>
  );
}

async function Program({ params }: { params: PageProps<"/admin/bookings/[id]/program">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const b = await getBooking(id);
  if (!b || b.hall === "restaurant") notFound();
  const editable = b.status !== "cancelled" && b.status !== "done";

  return (
    <ProgramPlanner
      booking={{ id: b.id, code: b.code, hall: b.hall, date: b.date, slot: b.slot, startTime: b.startTime, guests: b.guests, eventType: b.eventType, extras: b.extras }}
      catalog={await getCatalog()}
      endpoint={`/api/admin/bookings/${b.id}`}
      editable={editable}
      lockedNote={b.status === "cancelled" ? "Бронь отменена, программу менять нельзя." : "Торжество уже прошло."}
      back={{ href: `/admin/bookings?status=all&open=${b.id}`, label: `${b.name}, бронь ${b.code}` }}
    />
  );
}
