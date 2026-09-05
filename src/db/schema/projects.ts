import {
    boolean,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { clients } from "./clients";
import { billingTypeEnum } from "./enums";

export const projects = pgTable(
    "projects",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        /** Every row belongs to exactly one person; nothing is shared. */
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        clientId: uuid("client_id")
            .notNull()
            .references(() => clients.id, {
                onDelete: "restrict",
            }),

        name: text("name").notNull(),

        color: text("color"),

        defaultBillingType: billingTypeEnum("default_billing_type")
            .default("non_billable")
            .notNull(),

        /** The Polaris task a work entry on this project is booked to. */
        polarisTask: text("polaris_task"),

        /**
         * Replicon's own id for that task, which is what the API keys on -
         * `urn:replicon-tenant:<tenant>:task:14510`. The label above is for
         * reading; this is the part a transfer actually needs.
         */
        polarisTaskId: text("polaris_task_id"),

        /**
         * Where meetings go instead.
         *
         * Polaris keys a row by task, and the same project books its ceremonies
         * to a different one - "0200 - Meetings" beside "1500 - Ongoing
         * Support". One column per project could not say that, so a scrum and
         * the work it was about collapsed into the same row.
         */
        polarisMeetingTask: text("polaris_meeting_task"),

        polarisMeetingTaskId: text("polaris_meeting_task_id"),

        archived: boolean("archived").default(false).notNull(),

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
        uniqueIndex("projects_client_name_unique").on(
            table.clientId,
            table.name,
        ),
    ],
);
