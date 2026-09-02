CREATE TABLE "access_allowlist" (
	"email" text PRIMARY KEY NOT NULL,
	"note" text,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_attempts" (
	"client_hash" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"first_failure_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_failure_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
-- Everyone who already has an account keeps it. Without this the allowlist
-- would deploy empty and lock out the very people it exists to admit,
-- including whoever would have to fix it.
INSERT INTO "access_allowlist" ("email", "note")
SELECT lower("email"), 'existing account at rollout' FROM "user"
ON CONFLICT ("email") DO NOTHING;
