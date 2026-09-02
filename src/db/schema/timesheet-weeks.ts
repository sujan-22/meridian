import {
    date,
    integer,
    pgTable,
    timestamp,
    uniqueIndex,
    text,
    uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const timesheetWeeks = pgTable(
    "timesheet_weeks",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        /** Every row belongs to exactly one person; nothing is shared. */
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        weekStart: date("week_start").notNull(),

        weekEnd: date("week_end").notNull(),

        targetMinutes: integer("target_minutes").default(2250).notNull(),

        completedAt: timestamp("completed_at", {
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
        uniqueIndex("timesheet_weeks_week_start_unique").on(
            table.userId,
            table.weekStart,
        ),
    ],
);
