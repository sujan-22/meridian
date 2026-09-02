import {
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { billingTypeEnum, entryKindEnum } from "./enums";
import { projects } from "./projects";

export const timeEntries = pgTable(
    "time_entries",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        /** Every row belongs to exactly one person; nothing is shared. */
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

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

        /**
         * Share of a billable entry that is written off, 0-100.
         *
         * Polaris only accepts quarter hours, so the split is resolved to
         * whole quarters that add back up to the tracked total - see
         * `splitBillableMinutes`. Ignored when the entry is wholly
         * non-billable.
         */
        unbillablePercent: integer("unbillable_percent").default(0).notNull(),

        startedAt: timestamp("started_at", {
            withTimezone: true,
        }).notNull(),

        endedAt: timestamp("ended_at", {
            withTimezone: true,
        }),

        durationSeconds: integer("duration_seconds"),

        timesheetDurationMinutes: integer("timesheet_duration_minutes"),

        /** The billable half of a split entry, or the whole of a plain one. */
        timesheetEnteredAt: timestamp("timesheet_entered_at", {
            withTimezone: true,
        }),

        /** Only used by the written-off half of a split entry. */
        nonBillableEnteredAt: timestamp("non_billable_entered_at", {
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
        index("time_entries_user_started_at_idx").on(
            table.userId,
            table.startedAt,
        ),

        index("time_entries_project_started_at_idx").on(
            table.projectId,
            table.startedAt,
        ),

        index("time_entries_ticket_number_idx").on(table.ticketNumber),
    ],
);
