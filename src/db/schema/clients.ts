import {
    boolean,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const clients = pgTable(
    "clients",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        /** Every row belongs to exactly one person; nothing is shared. */
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        name: text("name").notNull(),

        shortName: text("short_name"),

        color: text("color"),

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
        uniqueIndex("clients_name_unique").on(table.userId, table.name),
    ],
);
