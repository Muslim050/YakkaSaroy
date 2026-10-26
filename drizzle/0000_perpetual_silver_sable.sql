CREATE TABLE "admin_users" (
	"id" text PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"name" text NOT NULL,
	"salt" text NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"hall" text NOT NULL,
	"date" date NOT NULL,
	"slot" text NOT NULL,
	"guests" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"phone_digits" text NOT NULL,
	"event_type" text,
	"comment" text,
	"status" text NOT NULL,
	"prepayment" bigint,
	"tasting_at" text,
	"manager_note" text,
	"extras" jsonb,
	"source" text NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seeded" boolean DEFAULT false NOT NULL,
	"demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_options" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bookings_date_idx" ON "bookings" USING btree ("date");--> statement-breakpoint
CREATE INDEX "bookings_phone_idx" ON "bookings" USING btree ("phone_digits");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_hall_slot_unique" ON "bookings" USING btree ("hall","date","slot") WHERE "bookings"."hall" <> 'restaurant' and "bookings"."status" <> 'cancelled';