import { sql } from "drizzle-orm";
import { bigint, boolean, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { BookingStatus, HistoryEntry } from "../lib/bookings";
import type { ProgramOption, ProgramSelection } from "../lib/program";

/** Every banquet and restaurant table booking, real or demo. */
export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    hall: text("hall").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    /** "day" | "evening" for halls, "19:00" for restaurant tables */
    slot: text("slot").notNull(),
    guests: integer("guests").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    /** 12 digits with the 998 code: how a guest is matched at sign-in */
    phoneDigits: text("phone_digits").notNull(),
    eventType: text("event_type"),
    comment: text("comment"),
    status: text("status").$type<BookingStatus>().notNull(),
    prepayment: bigint("prepayment", { mode: "number" }),
    /** local Tashkent time, "YYYY-MM-DDTHH:mm" */
    tastingAt: text("tasting_at"),
    managerNote: text("manager_note"),
    extras: jsonb("extras").$type<ProgramSelection>(),
    source: text("source").$type<"site" | "admin" | "seed">().notNull(),
    history: jsonb("history").$type<HistoryEntry[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** generated demo rows; `pnpm db:seed` replaces them, real requests are never touched */
    seeded: boolean("seeded").notNull().default(false),
    demo: boolean("demo").notNull().default(false),
  },
  (t) => [
    index("bookings_date_idx").on(t.date),
    index("bookings_phone_idx").on(t.phoneDigits),
    index("bookings_status_idx").on(t.status),
    // One active banquet per hall, day and slot: the database refuses a double booking.
    uniqueIndex("bookings_hall_slot_unique")
      .on(t.hall, t.date, t.slot)
      .where(sql`${t.hall} <> 'restaurant' and ${t.status} <> 'cancelled'`),
  ],
);

/** Program catalog options; category titles and rules live in code (programSeed). */
export const programOptions = pgTable("program_options", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  data: jsonb("data").$type<Omit<ProgramOption, "id">>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: text("id").primaryKey(),
  login: text("login").notNull().unique(),
  name: text("name").notNull(),
  salt: text("salt").notNull(),
  hash: text("hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Failed sign-in attempts per key, shared by every server instance. */
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  until: timestamp("until", { withTimezone: true }).notNull(),
});
