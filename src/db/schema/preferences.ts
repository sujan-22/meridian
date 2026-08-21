import {
    boolean,
    integer,
    pgTable,
    text,
    timestamp,
} from "drizzle-orm/pg-core";

/**
 * A single row of app-wide preferences.
 *
 * This is a personal, single-user app, so rather than a settings table keyed
 * by user there is exactly one row with a fixed id.
 */
export const PREFERENCES_ID = "default";

export const preferences = pgTable("preferences", {
    id: text("id").primaryKey().default(PREFERENCES_ID),

    /** 0 = Sunday … 6 = Saturday, matching date-fns' `weekStartsOn`. */
    weekStartsOn: integer("week_starts_on").default(1).notNull(),

    /** Whether Saturday and Sunday appear on the week screen at all. */
    showWeekend: boolean("show_weekend").default(false).notNull(),

    /** The working window the calendar draws, in whole hours. */
    dayStartHour: integer("day_start_hour").default(9).notNull(),
    dayEndHour: integer("day_end_hour").default(17).notNull(),

    /** Index into the calendar's zoom steps, coarsest first. */
    calendarZoom: integer("calendar_zoom").default(1).notNull(),

    dailyTargetMinutes: integer("daily_target_minutes").default(450).notNull(),
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
});
