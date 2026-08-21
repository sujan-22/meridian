CREATE TYPE "public"."entry_kind" AS ENUM('work', 'meeting');--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "kind" "entry_kind" DEFAULT 'work' NOT NULL;