ALTER TABLE "calendar_events" ADD COLUMN "promoted_at" timestamp with time zone;
--> statement-breakpoint
-- Meetings already turned into entries were offered before this column
-- existed. Without a timestamp they read as never-offered, so deleting one
-- of their entries would put it straight back in the auto-promote queue -
-- the exact loop this column is here to end.
UPDATE "calendar_events"
SET "promoted_at" = COALESCE("updated_at", "created_at")
WHERE "promoted_entry_id" IS NOT NULL AND "promoted_at" IS NULL;
