-- Migration 0006 added the owner columns nullable so the rows that predate
-- accounts would survive. `pnpm claim` has since given every one of them an
-- owner, so the constraint the schema always described can finally hold: a row
-- with no owner is a row no query can ever see.
ALTER TABLE "clients" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_estimates" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheet_weeks" ALTER COLUMN "user_id" SET NOT NULL;
