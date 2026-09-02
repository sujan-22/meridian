import {
    boolean,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * App preferences, one row per person.
 *
 * This used to be a single row with a fixed id, back when the app had one
 * user. It is now keyed by owner like everything else.
 */
export const preferences = pgTable(
    "preferences",
    {
        // Left as text: this table predates per-user rows, and the owner
        // is what identifies a row now.
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        /** 0 = Sunday … 6 = Saturday, matching date-fns' `weekStartsOn`. */
        weekStartsOn: integer("week_starts_on").default(1).notNull(),

        /** Whether Saturday and Sunday appear on the week screen at all. */
        showWeekend: boolean("show_weekend").default(false).notNull(),

        /** The working window the calendar draws, in whole hours. */
        dayStartHour: integer("day_start_hour").default(9).notNull(),
        dayEndHour: integer("day_end_hour").default(17).notNull(),

        /** Index into the calendar's zoom steps, coarsest first. */
        calendarZoom: integer("calendar_zoom").default(1).notNull(),

        dailyTargetMinutes: integer("daily_target_minutes")
            .default(450)
            .notNull(),
        weeklyTargetMinutes: integer("weekly_target_minutes")
            .default(2250)
            .notNull(),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [uniqueIndex("preferences_user_unique").on(table.userId)],
);
