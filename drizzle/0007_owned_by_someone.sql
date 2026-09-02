-- Migration 0006 added the owner columns nullable so the rows that predate
-- accounts would survive. This is where the constraint the schema always
-- described finally holds: a row with no owner is a row no query can see.
--
-- Any rows still unclaimed go to the oldest account, which on a single-person
-- database is the only account there is. `pnpm claim` does the same thing
-- deliberately and by email; this is the safety net for a deployment that
-- runs both migrations in one go, before anyone has had the chance.
--
-- If there are unclaimed rows and no account at all to give them to, the
-- UPDATE changes nothing and the ALTER below fails loudly - which is the
-- right outcome, because silently deleting a year of tracked time is not.
UPDATE "clients" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "preferences" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "projects" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "ticket_estimates" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "time_entries" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "timesheet_weeks" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_estimates" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheet_weeks" ALTER COLUMN "user_id" SET NOT NULL;
