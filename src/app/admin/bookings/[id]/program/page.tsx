import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProgramPlanner } from "@/components/program/ProgramPlanner";
import { requireAdmin } from "@/lib/auth";
import { getBooking, getCatalog } from "@/lib/store";

export default function AdminProgramPage({ params }: PageProps<"/admin/bookings/[id]/program">) {
  return (
    <Suspense fallback={<div className="h-[70vh] animate-pulse rounded-xl bg-secondary" />}>
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
      booking={{ id: b.id, code: b.code, hall: b.hall, date: b.date, slot: b.slot, guests: b.guests, eventType: b.eventType, extras: b.extras }}
      catalog={await getCatalog()}
      endpoint={`/api/admin/bookings/${b.id}`}
      editable={editable}
      lockedNote={b.status === "cancelled" ? "Бронь отменена, программу менять нельзя." : "Торжество уже прошло."}
      back={{ href: `/admin/bookings?status=all&open=${b.id}`, label: `${b.name}, бронь ${b.code}` }}
    />
  );
}
