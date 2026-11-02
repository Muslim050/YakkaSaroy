DROP INDEX "bookings_hall_slot_unique";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "start_time" text;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_hall_slot_unique" ON "bookings" USING btree ("hall","date","slot") WHERE "bookings"."hall" <> 'restaurant' and "bookings"."slot" <> 'day' and "bookings"."status" <> 'cancelled';