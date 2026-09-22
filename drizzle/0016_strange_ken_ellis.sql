ALTER TABLE "calendar_connections" ALTER COLUMN "auto_promote" SET DEFAULT false;
--> statement-breakpoint
-- Changing the default leaves anyone already connected with it switched on,
-- which is exactly the behaviour being withdrawn. Turn it off for them too;
-- it can be switched back on in Settings by anyone who wants it.
UPDATE "calendar_connections" SET "auto_promote" = false;
