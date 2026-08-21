import {
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

import { billingTypeEnum, entryKindEnum } from "./enums";
import { projects } from "./projects";

export const timeEntries = pgTable(
    "time_entries",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        projectId: uuid("project_id")
            .notNull()
            .references(() => projects.id, {
                onDelete: "restrict",
            }),

        description: text("description").notNull(),

        ticketNumber: varchar("ticket_number", {
            length: 64,
        }),

        billingType: billingTypeEnum("billing_type").notNull(),

        kind: entryKindEnum("kind").default("work").notNull(),

        startedAt: timestamp("started_at", {
            withTimezone: true,
        }).notNull(),

        endedAt: timestamp("ended_at", {
            withTimezone: true,
        }),

        durationSeconds: integer("duration_seconds"),

        timesheetDurationMinutes: integer("timesheet_duration_minutes"),

        timesheetEnteredAt: timestamp("timesheet_entered_at", {
            withTimezone: true,
        }),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", {
            withTimezone: true,
        })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index("time_entries_started_at_idx").on(table.startedAt),

        index("time_entries_project_started_at_idx").on(
            table.projectId,
            table.startedAt,
        ),

        index("time_entries_ticket_number_idx").on(table.ticketNumber),
    ],
);
