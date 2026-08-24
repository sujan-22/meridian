ALTER TABLE "time_entries" ADD COLUMN "unbillable_percent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "non_billable_entered_at" timestamp with time zone;