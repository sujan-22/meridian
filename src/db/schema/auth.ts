import {
    boolean,
    index,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * better-auth's tables, defined here rather than left to its own CLI so that
 * drizzle-kit stays the single migration system - `vercel-build` runs one
 * migrate step and the whole schema is covered.
 *
 * The shapes are not guesswork: they are what `getAuthTables()` reports for
 * the installed version with this exact config. Check that again after any
 * better-auth upgrade - 1.7 added `account.issuer`, and a missing column
 * shows up as a syntax error in a generated query rather than a clear one.
 */
export const users = pgTable(
    "user",
    {
        id: text("id").primaryKey(),

        name: text("name").notNull(),

        email: text("email").notNull(),

        emailVerified: boolean("email_verified").default(false).notNull(),

        image: text("image"),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    // Account linking matches on the address, so two rows may never hold it.
    (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const sessions = pgTable(
    "session",
    {
        id: text("id").primaryKey(),

        token: text("token").notNull(),

        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),

        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex("session_token_unique").on(table.token),
        index("session_user_idx").on(table.userId),
    ],
);

export const accounts = pgTable(
    "account",
    {
        id: text("id").primaryKey(),

        // Identity is scoped by issuer as of better-auth 1.7: the provider
        // says who vouched for the account ("google"), the issuer says which
        // service actually did ("https://accounts.google.com").
        issuer: text("issuer").notNull(),

        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),

        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),

        accessTokenExpiresAt: timestamp("access_token_expires_at", {
            withTimezone: true,
        }),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
            withTimezone: true,
        }),

        scope: text("scope"),
        password: text("password"),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("account_user_idx").on(table.userId),
        // How a sign-in finds an existing account.
        index("account_issuer_account_idx").on(table.issuer, table.accountId),
    ],
);

export const verifications = pgTable(
    "verification",
    {
        id: text("id").primaryKey(),

        identifier: text("identifier").notNull(),
        value: text("value").notNull(),

        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    // Every OAuth round trip looks a row up by identifier.
    (table) => [index("verification_identifier_idx").on(table.identifier)],
);
