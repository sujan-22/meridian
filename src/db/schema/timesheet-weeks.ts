import {
    date,
    integer,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

export const timesheetWeeks = pgTable(
    "timesheet_weeks",
    {
        id: uuid("id").defaultRandom().primaryKey(),

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
        uniqueIndex("timesheet_weeks_week_start_unique").on(table.weekStart),
    ],
);
