CREATE TABLE "preferences" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"week_starts_on" integer DEFAULT 1 NOT NULL,
	"show_weekend" boolean DEFAULT false NOT NULL,
	"day_start_hour" integer DEFAULT 9 NOT NULL,
	"day_end_hour" integer DEFAULT 17 NOT NULL,
	"daily_target_minutes" integer DEFAULT 450 NOT NULL,
	"weekly_target_minutes" integer DEFAULT 2250 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
