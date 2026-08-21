CREATE TYPE "public"."billing_type" AS ENUM('billable', 'non_billable');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"color" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"default_billing_type" "billing_type" DEFAULT 'non_billable' NOT NULL,
	"polaris_task" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"description" text NOT NULL,
	"ticket_number" varchar(64),
	"billing_type" "billing_type" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"timesheet_duration_minutes" integer,
	"timesheet_entered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"target_minutes" integer DEFAULT 2250 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_name_unique" ON "clients" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_client_name_unique" ON "projects" USING btree ("client_id","name");--> statement-breakpoint
CREATE INDEX "time_entries_started_at_idx" ON "time_entries" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "time_entries_project_started_at_idx" ON "time_entries" USING btree ("project_id","started_at");--> statement-breakpoint
CREATE INDEX "time_entries_ticket_number_idx" ON "time_entries" USING btree ("ticket_number");--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_weeks_week_start_unique" ON "timesheet_weeks" USING btree ("week_start");