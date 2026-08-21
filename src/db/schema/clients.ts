import {
    boolean,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

export const clients = pgTable(
    "clients",
    {
        id: uuid("id").defaultRandom().primaryKey(),

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
    (table) => [uniqueIndex("clients_name_unique").on(table.name)],
);
