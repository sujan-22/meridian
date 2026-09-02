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

        polarisTask: text("polaris_task"),

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
