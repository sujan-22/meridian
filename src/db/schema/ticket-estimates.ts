import {
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

import { projects } from "./projects";

/**
 * The development estimate given to a client for a ticket, so tracked time can
 * be measured against it.
 *
 * Estimates are usually quoted as a range ("20-35 hours"); `minMinutes` is
 * optional for the cases where a single number was given.
 */
export const ticketEstimates = pgTable(
    "ticket_estimates",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        projectId: uuid("project_id")
            .notNull()
            .references(() => projects.id, {
                onDelete: "cascade",
            }),

        ticketNumber: varchar("ticket_number", { length: 64 }).notNull(),

        /** Low end of the quoted range; null when a single figure was given. */
        minMinutes: integer("min_minutes"),

        /** The number that matters - what the client was told at most. */
        maxMinutes: integer("max_minutes").notNull(),

        notes: text("notes"),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex("ticket_estimates_project_ticket_unique").on(
            table.projectId,
            table.ticketNumber,
        ),
    ],
);
