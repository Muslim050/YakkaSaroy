import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProgramPlanner } from "@/components/program/ProgramPlanner";
import { requireClient } from "@/lib/auth";
import { getBooking, getCatalog, todayISO } from "@/lib/store";
import { clientCanEdit, phoneDigits } from "@/lib/bookings";
import { CONTACTS } from "@/lib/data";

export default function CabinetProgramPage({ params }: PageProps<"/cabinet/program/[id]">) {
  return (
    <Suspense fallback={<div className="h-[70vh] animate-pulse rounded-xl bg-secondary" />}>
      <Program params={params} />
    </Suspense>
  );
}

async function Program({ params }: { params: PageProps<"/cabinet/program/[id]">["params"] }) {
  const me = await requireClient();
  const { id } = await params;
  const b = await getBooking(id);
  // Someone else's booking looks exactly like a missing one.
  if (!b || phoneDigits(b.phone) !== me.phone || b.hall === "restaurant") notFound();
  const editable = clientCanEdit(b) && b.date >= todayISO();

  return (
    <ProgramPlanner
      booking={{ id: b.id, code: b.code, hall: b.hall, date: b.date, slot: b.slot, guests: b.guests, eventType: b.eventType, extras: b.extras }}
      catalog={await getCatalog()}
      endpoint={`/api/cabinet/bookings/${b.id}`}
      editable={editable}
      lockedNote={`Программа уже согласована. Чтобы что-то поменять, позвоните менеджеру: ${CONTACTS.phone}.`}
      back={{ href: "/cabinet", label: "Мои торжества" }}
    />
  );
}
