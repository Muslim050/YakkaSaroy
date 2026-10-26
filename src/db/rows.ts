import { phoneDigits, type Booking } from "../lib/bookings";
import { bookings } from "./schema";

/** Booking -> row values for inserts (new requests and the demo seed). */
export function toRow(b: Booking): typeof bookings.$inferInsert {
  return {
    id: b.id,
    code: b.code,
    hall: b.hall,
    date: b.date,
    slot: b.slot,
    guests: b.guests,
    name: b.name,
    phone: b.phone,
    phoneDigits: phoneDigits(b.phone),
    eventType: b.eventType ?? null,
    comment: b.comment ?? null,
    status: b.status,
    prepayment: b.prepayment ?? null,
    tastingAt: b.tastingAt ?? null,
    managerNote: b.managerNote ?? null,
    extras: b.extras ?? null,
    source: b.source,
    history: b.history,
    createdAt: new Date(b.createdAt),
    updatedAt: new Date(b.updatedAt),
    seeded: !!b.seeded,
    demo: !!b.demo,
  };
}
