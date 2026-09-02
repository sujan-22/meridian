import {
    boolean,
    index,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { projects } from "./projects";
import { timeEntries } from "./time-entries";

/**
 * A meeting read from Google Calendar.
 *
 * These are not tracked time. They sit in a second lane beside the day and
 * stay there until they are promoted - either by hand, or on their own once
 * the meeting has finished. Keeping them in their own table means a calendar
 * that changes upstream (a meeting moved, or cancelled) can be re-synced
 * without ever touching an entry the user has already accepted.
 */
export const calendarEvents = pgTable(
    "calendar_events",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        /** Every row belongs to exactly one person; nothing is shared. */
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        /** Google's own id, which is what makes a re-sync an update. */
        googleEventId: text("google_event_id").notNull(),

        calendarId: text("calendar_id").notNull(),

        title: text("title").notNull(),

        startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
        endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

        /**
         * An entry created from this meeting. Its presence is what stops the
         * same meeting being promoted twice, and it survives a re-sync.
         */
        promotedEntryId: uuid("promoted_entry_id").references(
            () => timeEntries.id,
            { onDelete: "set null" },
        ),

        /** Set when the meeting is waved away; it stays hidden after a sync. */
        dismissedAt: timestamp("dismissed_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex("calendar_events_google_id_unique").on(
            table.userId,
            table.googleEventId,
        ),

        index("calendar_events_user_starts_idx").on(
            table.userId,
            table.startsAt,
        ),
    ],
);

/**
 * When the calendar was first connected.
 *
 * Auto-promotion only applies to meetings that end after this moment. Without
 * it, connecting a calendar would silently fill months of past weeks with
 * entries nobody asked for.
 */
export const calendarConnections = pgTable("calendar_connections", {
    userId: text("user_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),

    connectedAt: timestamp("connected_at", { withTimezone: true })
        .defaultNow()
        .notNull(),

    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

    /**
     * Where a promoted meeting lands when its title does not name a project.
     * Without one, auto-promotion has nowhere to put an entry and leaves the
     * meeting in the lane rather than guessing.
     */
    defaultProjectId: uuid("default_project_id").references(() => projects.id, {
        onDelete: "set null",
    }),

    /** Meetings finish, then become entries by themselves. Off by default. */
    autoPromote: boolean("auto_promote").default(true).notNull(),

    /**
     * Set when Google stops renewing access, which for an app in Testing
     * happens on a schedule: refresh tokens issued to it expire after seven
     * days. Recorded rather than rediscovered, so the week can say so without
     * asking Google on every page load.
     */
    reauthRequiredAt: timestamp("reauth_required_at", { withTimezone: true }),
});
